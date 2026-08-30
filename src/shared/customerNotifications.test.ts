import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_SENDABLE_TYPES,
  ALL_NOTIFICATION_TYPES,
  BUSINESS_SENDABLE_TYPES,
  DEFAULT_NOTIFICATION_PREFERENCES,
  canBusinessNotifyCustomer,
  groupNotifications,
  inQuietHours,
  isAdminSendableType,
  isBusinessSendableType,
  isKnownNotificationType,
  isSuppressedByPreferences,
  notificationCtaLabel,
  parseAdminAudience,
  relativeTimeLabel,
  resolveNotificationRoute,
  reviewRequestDedupeKey,
  reviewRequestEligibility,
  reviewRequestMessage,
  sanitizePreferences,
  unreadCount,
  type CustomerNotification,
  type CustomerNotificationType,
} from './customerNotifications.ts';

const NOW = new Date('2026-08-30T15:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;

function notification(overrides: Partial<CustomerNotification> = {}): CustomerNotification {
  return {
    id: overrides.id || 'n1',
    type: overrides.type || 'your_turn',
    category: overrides.category || 'transactional',
    priority: overrides.priority || 'transactional',
    title: overrides.title || 'Title',
    body: overrides.body ?? 'Body',
    sourceKind: overrides.sourceKind || 'business',
    sourceBusinessId: overrides.sourceBusinessId ?? 'salon-1',
    sourceName: overrides.sourceName || 'SharpCut Studio',
    deepLink: overrides.deepLink || {},
    readAt: overrides.readAt ?? null,
    createdAt: overrides.createdAt ?? NOW,
  };
}

test('every catalog type is routable, classified and recognised', () => {
  assert.ok(ALL_NOTIFICATION_TYPES.length > 25, 'the catalog covers the full documented surface');
  for (const type of ALL_NOTIFICATION_TYPES) {
    assert.ok(isKnownNotificationType(type));
    const route = resolveNotificationRoute(notification({ type, deepLink: { businessId: 'salon-1' } }));
    assert.ok(route.screen, `${type} resolves to a real screen`);
    assert.ok(notificationCtaLabel(route).length > 0, `${type} has a CTA label`);
  }
});

test('an unknown type is never accepted as a notification type', () => {
  assert.equal(isKnownNotificationType('definitely_not_a_type'), false);
  assert.equal(isKnownNotificationType(42), false);
  assert.equal(isKnownNotificationType(undefined), false);
});

test('transactional notifications can never be muted by preferences', () => {
  const muted = { ...DEFAULT_NOTIFICATION_PREFERENCES, promotionalEnabled: false, businessUpdatesEnabled: false };
  const protectedTypes: CustomerNotificationType[] = [
    'your_turn', 'turn_approaching', 'booking_confirmed', 'booking_cancelled',
    'payment_confirmed', 'membership_claim_approved', 'membership_expires_today', 'review_request',
  ];
  for (const type of protectedTypes) {
    assert.equal(isSuppressedByPreferences(type, muted), false, `${type} must survive a full mute`);
  }
});

test('promotional and business traffic honour their own switches', () => {
  const noPromos = { ...DEFAULT_NOTIFICATION_PREFERENCES, promotionalEnabled: false };
  assert.equal(isSuppressedByPreferences('business_offer', noPromos), true);
  assert.equal(isSuppressedByPreferences('admin_platform_announcement', noPromos), true);

  const noBusiness = { ...DEFAULT_NOTIFICATION_PREFERENCES, businessUpdatesEnabled: false };
  assert.equal(isSuppressedByPreferences('business_announcement', noBusiness), true);
  // A non-promotional business notice is transactional priority, so it stays.
  assert.equal(isSuppressedByPreferences('business_temporary_closure', noBusiness), false);
});

test('preferences are sanitized from untrusted input', () => {
  assert.deepEqual(sanitizePreferences(null), DEFAULT_NOTIFICATION_PREFERENCES);
  assert.deepEqual(
    sanitizePreferences({ promotionalEnabled: false, quietHoursStart: '25:00', quietHoursEnd: '07:30' }),
    { promotionalEnabled: false, businessUpdatesEnabled: true, quietHoursStart: '', quietHoursEnd: '07:30' },
  );
});

test('quiet hours handle a window that wraps midnight', () => {
  const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, quietHoursStart: '22:00', quietHoursEnd: '07:00' };
  assert.equal(inQuietHours(prefs, 23 * 60), true, '23:00 is inside the wrapped window');
  assert.equal(inQuietHours(prefs, 3 * 60), true, '03:00 is inside the wrapped window');
  assert.equal(inQuietHours(prefs, 12 * 60), false, 'midday is outside it');
  assert.equal(inQuietHours(DEFAULT_NOTIFICATION_PREFERENCES, 3 * 60), false, 'unset quiet hours never hold anything');
});

test('a business may only notify a customer it is genuinely linked to', () => {
  assert.equal(canBusinessNotifyCustomer({ hasBooking: false, hasMembership: false, hasVisit: false }), false);
  assert.equal(canBusinessNotifyCustomer({ hasBooking: true, hasMembership: false, hasVisit: false }), true);
  assert.equal(canBusinessNotifyCustomer({ hasBooking: false, hasMembership: true, hasVisit: false }), true);
  assert.equal(canBusinessNotifyCustomer({ hasBooking: false, hasMembership: false, hasVisit: true }), true);
});

test('businesses and admins can each only originate their own permitted types', () => {
  assert.equal(isBusinessSendableType('business_offer'), true);
  assert.equal(isBusinessSendableType('admin_platform_announcement'), false, 'a business cannot speak as the platform');
  assert.equal(isBusinessSendableType('your_turn'), false, 'a business cannot forge a queue event');

  assert.equal(isAdminSendableType('admin_targeted'), true);
  assert.equal(isAdminSendableType('business_offer'), false, 'admin does not impersonate a business offer');
  assert.equal(isAdminSendableType('membership_activated'), false);

  for (const type of [...BUSINESS_SENDABLE_TYPES, ...ADMIN_SENDABLE_TYPES]) {
    assert.ok(isKnownNotificationType(type));
  }
});

test('admin audiences are parsed strictly, and anything malformed is rejected', () => {
  assert.deepEqual(parseAdminAudience({ kind: 'customer', customerId: 'cust-1' }), { kind: 'customer', customerId: 'cust-1' });
  assert.deepEqual(parseAdminAudience({ kind: 'category', categoryId: 'GYM' }), { kind: 'category', categoryId: 'gym' });
  assert.deepEqual(parseAdminAudience({ kind: 'platform' }), { kind: 'platform' });
  assert.equal(parseAdminAudience({ kind: 'customer' }), null, 'a customer audience needs a customer');
  assert.equal(parseAdminAudience({ kind: 'business', businessId: '  ' }), null);
  assert.equal(parseAdminAudience({ kind: 'everyone' }), null);
  assert.equal(parseAdminAudience(null), null);
});

test('review requests are only eligible for a real, completed, unreviewed visit', () => {
  const booking = {
    customerId: 'cust-1',
    businessId: 'salon-1',
    status: 'Completed',
    outcome: 'completed',
    serviceCompletedAt: NOW,
  };
  assert.deepEqual(
    reviewRequestEligibility({ booking, requestingBusinessId: 'salon-1', alreadyReviewed: false, alreadyRequested: false }),
    { ok: true },
  );

  const cases: Array<[string, ReturnType<typeof reviewRequestEligibility>]> = [
    ['NOT_FOUND', reviewRequestEligibility({ booking: null, requestingBusinessId: 'salon-1', alreadyReviewed: false, alreadyRequested: false })],
    ['FORBIDDEN', reviewRequestEligibility({ booking, requestingBusinessId: 'salon-2', alreadyReviewed: false, alreadyRequested: false })],
    ['NO_CUSTOMER', reviewRequestEligibility({ booking: { ...booking, customerId: null }, requestingBusinessId: 'salon-1', alreadyReviewed: false, alreadyRequested: false })],
    ['NOT_COMPLETED', reviewRequestEligibility({ booking: { ...booking, outcome: null, status: 'Waiting', serviceCompletedAt: null }, requestingBusinessId: 'salon-1', alreadyReviewed: false, alreadyRequested: false })],
    ['NOT_COMPLETED', reviewRequestEligibility({ booking: { ...booking, outcome: 'no_show', serviceCompletedAt: null }, requestingBusinessId: 'salon-1', alreadyReviewed: false, alreadyRequested: false })],
    ['ALREADY_REVIEWED', reviewRequestEligibility({ booking, requestingBusinessId: 'salon-1', alreadyReviewed: true, alreadyRequested: false })],
    ['ALREADY_REQUESTED', reviewRequestEligibility({ booking, requestingBusinessId: 'salon-1', alreadyReviewed: false, alreadyRequested: true })],
  ];
  for (const [expected, result] of cases) {
    assert.equal(result.ok, false);
    assert.equal((result as { code: string }).code, expected);
  }
});

test('the review-request dedupe key is stable per completed visit', () => {
  assert.equal(reviewRequestDedupeKey('q-123'), 'review_request:q-123');
  assert.equal(reviewRequestDedupeKey('q-123'), reviewRequestDedupeKey('q-123'));
  assert.notEqual(reviewRequestDedupeKey('q-123'), reviewRequestDedupeKey('q-124'));
});

test('review-request wording is neutral and never mentions a desired rating', () => {
  const message = reviewRequestMessage('SharpCut Studio', 'Haircut', NOW, NOW);
  assert.equal(message.title, 'SharpCut Studio — How was your visit?');
  assert.equal(message.body, 'Your Haircut was completed today. Rate your experience.');
  assert.ok(!/5 star|five star|good review|positive/i.test(`${message.title} ${message.body}`));
  assert.match(reviewRequestMessage('X', 'Haircut', NOW - 5 * 24 * HOUR, NOW).body, /recently/);
});

test('the inbox groups newest-first into Today and Earlier, honouring the filter', () => {
  const list = [
    notification({ id: 'old', createdAt: NOW - 48 * HOUR, readAt: NOW }),
    notification({ id: 'new', createdAt: NOW - 1 * HOUR }),
    notification({ id: 'newer', createdAt: NOW - 5 * 60_000 }),
  ];
  const all = groupNotifications(list, 'all', NOW);
  assert.deepEqual(all.map((group) => group.key), ['today', 'earlier']);
  assert.deepEqual(all[0].items.map((item) => item.id), ['newer', 'new'], 'newest first inside a group');
  assert.deepEqual(all[1].items.map((item) => item.id), ['old']);

  const unread = groupNotifications(list, 'unread', NOW);
  assert.deepEqual(unread.flatMap((group) => group.items.map((item) => item.id)), ['newer', 'new']);
  assert.equal(unreadCount(list), 2);
});

test('deep links route to their real destination, never a blanket Home redirect', () => {
  assert.deepEqual(resolveNotificationRoute(notification({ type: 'your_turn' })), { screen: 'tracking' });
  assert.deepEqual(resolveNotificationRoute(notification({ type: 'service_completed' })), { screen: 'bookings' });
  assert.deepEqual(
    resolveNotificationRoute(notification({ type: 'membership_claim_approved', deepLink: { kind: 'member-hub', businessId: 'gym-1' } })),
    { screen: 'member-hub', businessId: 'gym-1' },
  );
  assert.deepEqual(
    resolveNotificationRoute(notification({ type: 'review_request', deepLink: { kind: 'review', businessId: 'salon-1', bookingId: 'q-9' } })),
    { screen: 'review', businessId: 'salon-1', bookingId: 'q-9' },
  );
  // A stored link always wins over the catalog default, so an old row still
  // routes the way it did on the day it was written.
  assert.deepEqual(
    resolveNotificationRoute(notification({ type: 'your_turn', deepLink: { kind: 'bookings' } })),
    { screen: 'bookings' },
  );
  // An admin notice with no business context falls back to the inbox itself.
  assert.deepEqual(
    resolveNotificationRoute(notification({ type: 'admin_platform_announcement', sourceBusinessId: null })),
    { screen: 'notifications' },
  );
});

test('relative timestamps stay readable across the ranges the inbox shows', () => {
  assert.equal(relativeTimeLabel(NOW, NOW), 'Just now');
  assert.equal(relativeTimeLabel(NOW - 5 * 60_000, NOW), '5m ago');
  assert.equal(relativeTimeLabel(NOW - 2 * HOUR, NOW), '2h ago');
  assert.equal(relativeTimeLabel(NOW - 3 * 24 * HOUR, NOW), '3d ago');
});
