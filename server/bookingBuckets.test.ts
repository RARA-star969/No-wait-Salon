import assert from 'node:assert/strict';
import test from 'node:test';
import type { QueueItem, Salon } from '../src/types.ts';
import {
  applyFilters,
  BOOKING_TABS,
  grossSummary,
  isCancelled,
  isCompleted,
  isLive,
  isReserved,
  isUpcoming,
  outcomeBadge,
  sourceLabel,
} from '../src/shared/bookingBuckets.ts';
import { normaliseOffers, toSalonProfile, visibleSections, waitLabel } from '../src/shared/salonProfile.ts';
import { CUSTOMER_CANCEL_REASONS, STAFF_CANCEL_REASONS, canCancel, normaliseCancelReason } from '../src/shared/queueTiming.ts';

const T0 = 1_700_000_000_000;
const item = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: 'q1',
  name: 'Customer',
  service: 'Haircut',
  status: 'Waiting',
  createdAt: T0 - 60_000,
  ...overrides,
});

test('the Bookings section exposes exactly the six agreed tabs, in order', () => {
  assert.deepEqual(BOOKING_TABS.map((tab) => tab.id), ['live', 'upcoming', 'reserved', 'completed', 'cancelled', 'gross']);
});

test('a cancellation is never counted as a completed service', () => {
  const cancelled = item({ status: 'Cancelled', outcome: 'cancelled_customer', cancelledAt: T0 });
  assert.equal(isCompleted(cancelled), false);
  assert.equal(isCancelled(cancelled), true);
  assert.equal(isLive(cancelled, T0), false);
});

test('a no-show lands in Cancelled, badged as its own outcome', () => {
  const noShow = item({ status: 'NoShow', outcome: 'no_show', noShowAt: T0 });
  assert.equal(isCompleted(noShow), false);
  assert.equal(isCancelled(noShow), true);
  assert.equal(outcomeBadge(noShow).label, 'NO SHOW');
});

test('each cancellation is badged with who cancelled it', () => {
  assert.equal(outcomeBadge(item({ outcome: 'cancelled_customer' })).label, 'CANCELLED BY CUSTOMER');
  assert.equal(outcomeBadge(item({ outcome: 'cancelled_staff' })).label, 'CANCELLED BY SALON');
  assert.equal(outcomeBadge(item({ status: 'Completed', outcome: 'completed' })).label, 'DONE');
});

test('live, upcoming and reserved classify without overlap traps', () => {
  const waiting = item({ status: 'Waiting' });
  const serving = item({ status: 'Serving' });
  const reserved = item({ status: 'Reserved', reservedFor: '5:30 PM' });
  assert.equal(isLive(waiting, T0), true);
  assert.equal(isUpcoming(waiting), true);
  assert.equal(isUpcoming(serving), false, 'someone in the chair is not "upcoming"');
  assert.equal(isReserved(reserved), true);
  assert.equal(isReserved(waiting), false);
});

test('filters narrow by range, source and free text', () => {
  const rows = [
    item({ id: 'a', name: 'Aman', source: 'customer_app', serviceCompletedAt: T0 }),
    item({ id: 'b', name: 'Bina', source: 'qr_web', serviceCompletedAt: T0 }),
    item({ id: 'c', name: 'Chan', source: 'qr_web', serviceCompletedAt: T0 - 40 * 24 * 60 * 60_000 }),
  ];
  const base = { range: 'all', source: 'all', search: '' } as const;
  assert.deepEqual(applyFilters(rows, base, T0).map((row) => row.id), ['a', 'b', 'c']);
  assert.deepEqual(applyFilters(rows, { ...base, source: 'qr_web' }, T0).map((row) => row.id), ['b', 'c']);
  assert.deepEqual(applyFilters(rows, { ...base, search: 'ami' }, T0).map((row) => row.id), []);
  assert.deepEqual(applyFilters(rows, { ...base, search: 'bina' }, T0).map((row) => row.id), ['b']);
  assert.deepEqual(applyFilters(rows, { ...base, range: '30d' }, T0).map((row) => row.id), ['a', 'b']);
});

test('gross summary separates the outcomes instead of lumping them together', () => {
  const summary = grossSummary(
    [item({ id: 'live1', status: 'Serving' })],
    [
      item({ id: 'h1', status: 'Completed', outcome: 'completed', callAttempt: 1 }),
      item({ id: 'h2', status: 'Completed', outcome: 'completed', callAttempt: 3 }),
      item({ id: 'h3', status: 'NoShow', outcome: 'no_show', callAttempt: 2 }),
      item({ id: 'h4', status: 'Cancelled', outcome: 'cancelled_customer' }),
      item({ id: 'h5', status: 'Cancelled', outcome: 'cancelled_staff' }),
    ],
    T0,
  );
  assert.equal(summary.completed, 2);
  assert.equal(summary.noShow, 1);
  assert.equal(summary.cancelledCustomer, 1);
  assert.equal(summary.cancelledStaff, 1);
  assert.equal(summary.live, 1);
  assert.equal(summary.total, 6);
  assert.equal(summary.completionRate, 33);
  assert.equal(summary.averageCallAttempts, 2);
});

test('booking source is labelled distinctly for app and web QR', () => {
  assert.equal(sourceLabel(item({ source: 'customer_app' })), 'App');
  assert.equal(sourceLabel(item({ source: 'qr_web' })), 'Web QR');
  assert.equal(sourceLabel(item({ source: 'qr_walk_in' })), 'QR Walk-in');
  assert.equal(sourceLabel(item({ source: 'staff_walk_in' })), 'Walk-in');
});

test('cancellation is allowed before service and refused during it', () => {
  assert.equal(canCancel('Waiting'), true);
  assert.equal(canCancel('Called'), true);
  assert.equal(canCancel('Reserved'), true);
  assert.equal(canCancel('Serving'), false);
  assert.equal(canCancel('Completed'), false);
  assert.equal(canCancel('Cancelled'), false);
});

test('reason codes are validated per audience', () => {
  assert.equal(normaliseCancelReason('customer', 'wait_too_long'), 'wait_too_long');
  assert.equal(normaliseCancelReason('customer', 'staff_unavailable'), 'other', 'a staff-only reason is not accepted from a customer');
  assert.equal(normaliseCancelReason('staff', 'staff_unavailable'), 'staff_unavailable');
  assert.equal(normaliseCancelReason('staff', undefined), 'other');
  assert.ok(CUSTOMER_CANCEL_REASONS.length >= 5 && STAFF_CANCEL_REASONS.length >= 5);
});

/* ---------------------------- app / web parity ---------------------------- */

const salon = (overrides: Partial<Salon> = {}): Salon => ({
  id: 'salon-1',
  name: 'Sharpcut Studio',
  address: '742, 12th Main Road, Bengaluru',
  distanceKm: 0.8,
  rating: 4.8,
  reviewCount: 320,
  isOpen: true,
  services: [{ id: 's1', name: 'Haircut', durationMin: 30, priceInr: 250, description: 'Precision cut' }],
  defaultBarberCount: 2,
  latitude: 12.97,
  longitude: 77.64,
  openingHours: 'Mon-Sun 9:00 AM-9:00 PM',
  description: 'A modern grooming studio.',
  amenities: ['Wi-Fi'],
  offers: [{ id: 'o1', title: 'Weekday 10% off', discount: '10% OFF' }],
  gallery: [{ id: 'g1', imageUrl: 'https://example.test/1.jpg' }],
  ...overrides,
});

test('app and web build an identical profile from the same salon record', () => {
  const record = salon();
  const fromApp = toSalonProfile(record, { liveWaitMinutes: 12, waitingCustomers: 3 });
  const fromWeb = toSalonProfile({ ...record, liveWaitMinutes: 12, waitingCustomers: 3 } as never);
  assert.deepEqual(fromApp, fromWeb);
  assert.deepEqual(visibleSections(fromApp), visibleSections(fromWeb));
});

test('both surfaces word the wait the same way', () => {
  assert.equal(waitLabel(0), 'No wait right now');
  assert.equal(waitLabel(12), '12 min wait');
});

test('a salon with no extras hides the same sections on both surfaces', () => {
  const bare = toSalonProfile(salon({ offers: [], gallery: [], amenities: [] }));
  assert.deepEqual(visibleSections(bare), ['live', 'services', 'about', 'hours']);
  assert.ok(bare.description.length > 0, 'a fallback description keeps the About section honest');
});

test('legacy string offers still render on the web page', () => {
  assert.deepEqual(normaliseOffers(['Flat 20% off']), [{ id: 'offer-0', title: 'Flat 20% off', discount: '' }]);
  assert.deepEqual(normaliseOffers(undefined), []);
  assert.deepEqual(normaliseOffers([{ title: '' }, null, 7]), []);
});

test('the profile carries every field the app screen renders', () => {
  const profile = toSalonProfile(salon());
  for (const field of ['name', 'address', 'rating', 'reviewCount', 'openingHours', 'description', 'amenities', 'offers', 'gallery', 'services', 'directionsUrl']) {
    assert.ok(field in profile, `profile exposes ${field}`);
  }
  assert.equal(profile.services[0].description, 'Precision cut', 'service descriptions reach the web page too');
});
