import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bookingDetailLine,
  bookingServiceLabel,
  bookingStatusBadge,
  groupBookings,
  resolveBookingRoute,
  resolveBookingSection,
  type CustomerBookingView,
} from './customerBookingViews.ts';

const NOW = new Date('2026-08-30T15:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;

function booking(overrides: Partial<CustomerBookingView> = {}): CustomerBookingView {
  return {
    id: overrides.id || 'b1',
    queueEntryId: overrides.queueEntryId,
    businessId: overrides.businessId || 'salon-1',
    businessName: overrides.businessName || 'SharpCut Studio',
    categoryId: overrides.categoryId || 'salon',
    service: overrides.service ?? 'Haircut',
    services: overrides.services || [],
    status: overrides.status || 'Waiting',
    outcome: overrides.outcome ?? null,
    reservedFor: overrides.reservedFor ?? null,
    token: overrides.token ?? null,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
    serviceCompletedAt: overrides.serviceCompletedAt ?? null,
    cancelledAt: overrides.cancelledAt ?? null,
    noShowAt: overrides.noShowAt ?? null,
    kind: overrides.kind || 'queue',
    slotLabel: overrides.slotLabel ?? null,
  };
}

test('live queue statuses land in ACTIVE', () => {
  for (const status of ['Waiting', 'Called', 'Serving']) {
    assert.equal(resolveBookingSection(booking({ status })), 'active', `${status} is active`);
  }
});

test('reservations and gym class/PT bookings land in UPCOMING', () => {
  assert.equal(resolveBookingSection(booking({ status: 'Reserved', reservedFor: '4:30 PM' })), 'upcoming');
  assert.equal(resolveBookingSection(booking({ status: 'Booked', kind: 'class' })), 'upcoming');
  assert.equal(resolveBookingSection(booking({ status: 'Booked', kind: 'pt' })), 'upcoming');
});

test('a terminal outcome always wins over a stale status', () => {
  // The realtime snapshot can still read "Waiting" for a record the server
  // already closed; the stored outcome is authoritative.
  assert.equal(resolveBookingSection(booking({ status: 'Waiting', outcome: 'cancelled_customer' })), 'past');
  assert.equal(resolveBookingSection(booking({ status: 'Waiting', outcome: 'no_show' })), 'past');
  assert.equal(resolveBookingSection(booking({ status: 'Completed' })), 'past');
  assert.equal(resolveBookingSection(booking({ status: 'Waiting', serviceCompletedAt: NOW })), 'past');
});

test('grouping orders active/upcoming oldest-first and history newest-first', () => {
  const grouped = groupBookings([
    booking({ id: 'past-old', status: 'Completed', serviceCompletedAt: NOW - 48 * HOUR }),
    booking({ id: 'active-late', status: 'Waiting', createdAt: NOW - 1 * HOUR }),
    booking({ id: 'past-new', status: 'Completed', serviceCompletedAt: NOW - 2 * HOUR }),
    booking({ id: 'active-early', status: 'Called', createdAt: NOW - 3 * HOUR }),
    booking({ id: 'upcoming', status: 'Reserved', createdAt: NOW }),
  ]);
  assert.deepEqual(grouped.active.map((item) => item.id), ['active-early', 'active-late']);
  assert.deepEqual(grouped.upcoming.map((item) => item.id), ['upcoming']);
  assert.deepEqual(grouped.past.map((item) => item.id), ['past-new', 'past-old']);
  assert.equal(grouped.isEmpty, false);
});

test('a customer with no real records gets the empty state, never a fabricated one', () => {
  const grouped = groupBookings([]);
  assert.equal(grouped.isEmpty, true);
  assert.deepEqual([grouped.active, grouped.upcoming, grouped.past], [[], [], []]);
});

test('status wording distinguishes every real terminal outcome', () => {
  assert.deepEqual(bookingStatusBadge(booking({ status: 'Called' })), { label: 'Your turn', tone: 'live' });
  assert.deepEqual(bookingStatusBadge(booking({ status: 'Serving' })), { label: 'In service', tone: 'live' });
  assert.deepEqual(bookingStatusBadge(booking({ status: 'Waiting' })), { label: 'In queue', tone: 'live' });
  assert.deepEqual(bookingStatusBadge(booking({ status: 'Reserved' })), { label: 'Reserved', tone: 'neutral' });
  assert.deepEqual(bookingStatusBadge(booking({ outcome: 'completed' })), { label: 'Completed', tone: 'good' });
  assert.deepEqual(bookingStatusBadge(booking({ outcome: 'no_show' })), { label: 'Missed', tone: 'bad' });
  assert.deepEqual(bookingStatusBadge(booking({ outcome: 'cancelled_staff' })), { label: 'Cancelled by business', tone: 'warn' });
  assert.deepEqual(bookingStatusBadge(booking({ outcome: 'cancelled_customer' })), { label: 'Cancelled by you', tone: 'warn' });
});

test('service and detail lines read from whichever real field carries the data', () => {
  assert.equal(bookingServiceLabel(booking({ services: ['Haircut', 'Beard Trim'] })), 'Haircut + Beard Trim');
  assert.equal(bookingServiceLabel(booking({ services: [], service: 'Haircut' })), 'Haircut');
  assert.equal(bookingDetailLine(booking({ token: 'SC-014' })), 'Token SC-014');
  assert.equal(bookingDetailLine(booking({ reservedFor: '4:30 PM' })), 'Reserved 4:30 PM');
  assert.equal(bookingDetailLine(booking({ kind: 'pt', slotLabel: '06:00 PM · Rahul' })), '06:00 PM · Rahul');
  assert.equal(bookingDetailLine(booking()), '');
});

test('only a live booking opens the Live Ticket; history opens its business', () => {
  assert.deepEqual(resolveBookingRoute(booking({ status: 'Waiting' })), { screen: 'tracking' });
  assert.deepEqual(resolveBookingRoute(booking({ status: 'Called' })), { screen: 'tracking' });
  assert.deepEqual(
    resolveBookingRoute(booking({ status: 'Completed', businessId: 'gym-1' })),
    { screen: 'salon', businessId: 'gym-1' },
  );
  assert.deepEqual(
    resolveBookingRoute(booking({ status: 'Reserved', businessId: 'salon-2' })),
    { screen: 'salon', businessId: 'salon-2' },
  );
});
