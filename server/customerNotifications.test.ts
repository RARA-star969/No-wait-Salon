/**
 * End-to-end coverage for the customer Notification domain against a real
 * server process and a real database — persistence, read/unread, preference
 * gating, business/admin authorization, audience resolution, queue-lifecycle
 * generation, and review-request eligibility/idempotency.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let child: ChildProcess | null = null;
let base = '';
let dataDir = '';
let adminToken = '';
let salonId = '';
let otherSalonId = '';
let customerToken = '';
let customerId = '';
let otherCustomerToken = '';
let otherCustomerId = '';
/** Server-assigned queue entry ids — the client-supplied id is not authoritative. */
let entryOne = '';
let entryTwo = '';

const api = async (method: string, url: string, body?: unknown, token?: string, extraHeaders: Record<string, string> = {}) => {
  const headers: Record<string, string> = { ...extraHeaders };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  const data = text && !text.startsWith('<') ? JSON.parse(text) : null;
  return { status: response.status, data };
};

/** Staff auth for a business, via the same test-session header the other
 *  business-side suites use — never a forged customer token. */
const staffHeaders = (businessId: string) => ({ 'x-test-business-id': businessId, 'x-test-staff-role': 'owner' });

const verifyCustomer = async (phone: string) => {
  const requested = await api('POST', '/api/otp/request', { phone });
  const verified = await api('POST', '/api/otp/verify', { challengeId: requested.data.challengeId, code: requested.data.demoCode });
  return { token: verified.data.token as string, customerId: verified.data.customerId as string };
};

const inbox = async (token: string) => (await api('GET', '/api/me/notifications', undefined, token)).data;

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'noq-notifications-test-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  base = `http://127.0.0.1:${port}`;
  child = spawn('node', ['--import', 'tsx', 'server/index.ts'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NO_WAIT_TEST_DEPLOYMENT: 'true', ADMIN_PASSWORD: 'test' },
  });
  await new Promise<void>((resolve, reject) => {
    let output = '';
    const onData = (b: Buffer) => {
      output += b.toString();
      if (output.includes('server listening')) { child?.stdout?.off('data', onData); resolve(); }
    };
    child?.stdout?.on('data', onData);
    child?.on('exit', () => reject(new Error('server died')));
  });

  adminToken = (await api('POST', '/api/admin/login', { password: 'admin123' })).data.token;
  salonId = (await api('POST', '/api/admin/salons', {
    name: 'Notify Salon', main_category_id: 'salon', business_code: 'NOTIFY01', status: 'active',
    latitude: 0, longitude: 0, city: 'Bengaluru',
  }, adminToken)).data.salon.id;
  otherSalonId = (await api('POST', '/api/admin/salons', {
    name: 'Other Salon', main_category_id: 'salon', business_code: 'NOTIFY02', status: 'active',
    latitude: 0, longitude: 0, city: 'Pune',
  }, adminToken)).data.salon.id;

  ({ token: customerToken, customerId } = await verifyCustomer('9111100001'));
  ({ token: otherCustomerToken, customerId: otherCustomerId } = await verifyCustomer('9111100002'));
});

after(() => {
  if (child) child.kill();
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
});

test('the notification inbox requires an authenticated customer', async () => {
  assert.equal((await api('GET', '/api/me/notifications')).status, 401);
  assert.equal((await api('POST', '/api/me/notifications/read-all')).status, 401);
  assert.equal((await api('PUT', '/api/me/notification-preferences', { promotionalEnabled: false })).status, 401);
});

test('a fresh customer has a real empty inbox, not a fabricated one', async () => {
  const body = await inbox(customerToken);
  assert.deepEqual(body.notifications, []);
  assert.equal(body.unreadCount, 0);
  assert.deepEqual(body.preferences, {
    promotionalEnabled: true, businessUpdatesEnabled: true, quietHoursStart: '', quietHoursEnd: '',
  });
});

test('push transport status is reported honestly, never as a simulated success', async () => {
  const body = await inbox(customerToken);
  assert.equal(typeof body.pushTransport.configured, 'boolean');
  // No external provider is configured in this deployment; the API must say so
  // rather than claiming delivery.
  assert.equal(body.pushTransport.configured, false);
  assert.equal(body.pushTransport.name, 'none');

  // Device registration still persists, so enabling a provider later needs no
  // re-registration campaign.
  const registered = await api('POST', '/api/me/push-devices', { token: 'device-token-abc', platform: 'android' }, customerToken);
  assert.equal(registered.status, 201);
  assert.equal(registered.data.pushTransport.configured, false);
  assert.equal((await api('POST', '/api/me/push-devices', {}, customerToken)).status, 400);
});

test('joining a real queue generates a persisted booking notification', async () => {
  const joined = await api('POST', `/api/salons/${salonId}/commands`, {
    type: 'join',
    item: {
      id: 'q-notify-1', name: 'Notify Customer', service: 'Haircut', status: 'Waiting',
      createdAt: Date.now(), sessionId: 'session-notify-1',
    },
  }, customerToken);
  assert.equal(joined.status, 200);
  entryOne = joined.data.queue.find((item: { sessionId: string }) => item.sessionId === 'session-notify-1').id;
  assert.ok(entryOne, 'the server assigns the authoritative queue entry id');

  const body = await inbox(customerToken);
  const joinNotification = body.notifications.find((item: { type: string }) => item.type === 'queue_joined');
  assert.ok(joinNotification, 'joining a queue tells the customer');
  assert.equal(joinNotification.sourceKind, 'business');
  assert.equal(joinNotification.sourceBusinessId, salonId);
  assert.equal(joinNotification.sourceName, 'Notify Salon');
  assert.equal(joinNotification.readAt, null);
  assert.equal(joinNotification.deepLink.kind, 'ticket');
  assert.ok(body.unreadCount >= 1);
});

test('re-issuing the same queue state never duplicates a notification', async () => {
  const before = (await inbox(customerToken)).notifications.filter((n: { type: string }) => n.type === 'queue_joined').length;
  // A second command over the same queue re-runs the generator for every
  // unchanged entry; the dedupe key must absorb it.
  await api('POST', `/api/salons/${salonId}/commands`, { type: 'toggle_barber', barberId: 'nope' }, customerToken).catch(() => undefined);
  await api('POST', `/api/salons/${salonId}/commands`, {
    type: 'queue_action', itemId: entryOne, action: 'Pay-cash',
  }, undefined, staffHeaders(salonId));
  const after = (await inbox(customerToken)).notifications.filter((n: { type: string }) => n.type === 'queue_joined').length;
  assert.equal(after, before, 'queue_joined is written exactly once for one booking');
});

test('being called generates exactly one "your turn" alert per call attempt', async () => {
  const called = await api('POST', `/api/salons/${salonId}/commands`, {
    type: 'queue_action', itemId: entryOne, action: 'Call',
  }, undefined, staffHeaders(salonId));
  assert.equal(called.status, 200, `Call failed: ${JSON.stringify(called.data)}`);
  await api('POST', `/api/salons/${salonId}/commands`, {
    type: 'queue_action', itemId: entryOne, action: 'Call',
  }, undefined, staffHeaders(salonId));

  const turns = (await inbox(customerToken)).notifications.filter((n: { type: string }) => n.type === 'your_turn');
  assert.equal(turns.length, 1, 'a repeated Call inside the live window never re-notifies');
  assert.equal(turns[0].deepLink.kind, 'ticket');
});

test('read and read-all transitions are scoped to the owning customer', async () => {
  const body = await inbox(customerToken);
  const target = body.notifications[0];
  assert.equal(target.readAt, null);

  // Another customer cannot mark this row read, even knowing its id.
  const foreign = await api('POST', `/api/me/notifications/${target.id}/read`, undefined, otherCustomerToken);
  assert.equal(foreign.status, 200);
  assert.equal(foreign.data.changed, false, 'a foreign id changes nothing');
  assert.equal((await inbox(customerToken)).notifications.find((n: { id: string }) => n.id === target.id).readAt, null);

  const own = await api('POST', `/api/me/notifications/${target.id}/read`, undefined, customerToken);
  assert.equal(own.data.changed, true);
  const afterRead = await inbox(customerToken);
  assert.ok(afterRead.notifications.find((n: { id: string }) => n.id === target.id).readAt);

  await api('POST', '/api/me/notifications/read-all', undefined, customerToken);
  const cleared = await inbox(customerToken);
  assert.equal(cleared.unreadCount, 0);
  assert.ok(cleared.notifications.every((n: { readAt: number | null }) => n.readAt));
});

test('a business can only notify customers legitimately linked to it', async () => {
  const linked = await api('POST', '/api/staff/business/notifications', {
    customerId, type: 'business_schedule_notice',
    title: 'Sunday hours changed', body: 'We now open at 10am on Sundays.',
  }, undefined, staffHeaders(salonId));
  assert.equal(linked.status, 201);
  assert.equal(linked.data.delivered, true);

  // otherCustomer has never transacted with this salon.
  const unlinked = await api('POST', '/api/staff/business/notifications', {
    customerId: otherCustomerId, type: 'business_offer', title: 'Come try us', body: '20% off.',
  }, undefined, staffHeaders(salonId));
  assert.equal(unlinked.status, 403);
  assert.equal(unlinked.data.code, 'CUSTOMER_NOT_LINKED');
  assert.deepEqual((await inbox(otherCustomerToken)).notifications, [], 'no arbitrary business spam reaches an unlinked customer');

  // A different business cannot reach this salon's customer either.
  const crossBusiness = await api('POST', '/api/staff/business/notifications', {
    customerId, type: 'business_offer', title: 'Switch to us', body: 'Cheaper cuts.',
  }, undefined, staffHeaders(otherSalonId));
  assert.equal(crossBusiness.status, 403);
});

test('a business cannot forge a platform or queue notification type', async () => {
  for (const type of ['admin_platform_announcement', 'your_turn', 'membership_activated', 'not_a_type']) {
    const attempt = await api('POST', '/api/staff/business/notifications', {
      customerId, type, title: 'Forged', body: 'Nope.',
    }, undefined, staffHeaders(salonId));
    assert.equal(attempt.status, 400, `${type} must be rejected`);
  }
  const unauthenticated = await api('POST', '/api/staff/business/notifications', {
    customerId, type: 'business_offer', title: 'x', body: 'y',
  });
  assert.equal(unauthenticated.status, 401);
});

test('muting promotions suppresses offers but never a transactional alert', async () => {
  const saved = await api('PUT', '/api/me/notification-preferences', {
    promotionalEnabled: false, businessUpdatesEnabled: true,
  }, customerToken);
  assert.equal(saved.data.preferences.promotionalEnabled, false);

  const offer = await api('POST', '/api/staff/business/notifications', {
    customerId, type: 'business_offer', title: 'Muted offer', body: 'Should not arrive.',
  }, undefined, staffHeaders(salonId));
  assert.equal(offer.status, 201);
  assert.equal(offer.data.delivered, false, 'a muted promotional message is not stored');

  const notice = await api('POST', '/api/staff/business/notifications', {
    customerId, type: 'business_temporary_closure', title: 'Closed Tuesday', body: 'Water works.',
  }, undefined, staffHeaders(salonId));
  assert.equal(notice.data.delivered, true, 'an urgent business notice is never suppressible');

  const titles = (await inbox(customerToken)).notifications.map((n: { title: string }) => n.title);
  assert.ok(!titles.includes('Muted offer'));
  assert.ok(titles.includes('Closed Tuesday'));

  await api('PUT', '/api/me/notification-preferences', { promotionalEnabled: true, businessUpdatesEnabled: true }, customerToken);
});

test('admin notifications resolve their audience from real relationships only', async () => {
  assert.equal((await api('POST', '/api/admin/notifications', { type: 'admin_targeted', audience: { kind: 'customer', customerId }, title: 'x' })).status, 401);
  assert.equal((await api('POST', '/api/admin/notifications', { type: 'business_offer', audience: { kind: 'platform' }, title: 'x' }, adminToken)).status, 400);
  assert.equal((await api('POST', '/api/admin/notifications', { type: 'admin_targeted', audience: { kind: 'nonsense' }, title: 'x' }, adminToken)).status, 400);

  const targeted = await api('POST', '/api/admin/notifications', {
    type: 'admin_targeted', audience: { kind: 'customer', customerId },
    title: 'Account verified', body: 'Your NOQ account is fully verified.',
  }, adminToken);
  assert.equal(targeted.status, 201);
  assert.equal(targeted.data.audienceSize, 1);
  assert.equal(targeted.data.delivered, 1);
  const received = (await inbox(customerToken)).notifications.find((n: { title: string }) => n.title === 'Account verified');
  assert.ok(received, 'the targeted customer receives it');
  assert.equal(received.sourceKind, 'admin');
  assert.equal(received.sourceName, 'NOQ Admin');
  assert.ok(!(await inbox(otherCustomerToken)).notifications.some((n: { title: string }) => n.title === 'Account verified'),
    'nobody else receives a targeted notification');

  // Business audience = customers with a real booking at that business.
  const byBusiness = await api('POST', '/api/admin/notifications', {
    type: 'admin_maintenance_notice', audience: { kind: 'business', businessId: salonId },
    title: 'Scheduled maintenance', body: 'Brief downtime tonight.',
  }, adminToken);
  assert.equal(byBusiness.data.audienceSize, 1);

  // A business with no bookings resolves to nobody, rather than everybody.
  const emptyAudience = await api('POST', '/api/admin/notifications', {
    type: 'admin_maintenance_notice', audience: { kind: 'business', businessId: otherSalonId },
    title: 'Nobody', body: 'x',
  }, adminToken);
  assert.equal(emptyAudience.data.audienceSize, 0);
  assert.equal(emptyAudience.data.delivered, 0);

  const byCategory = await api('POST', '/api/admin/notifications', {
    type: 'admin_policy_notice', audience: { kind: 'category', categoryId: 'salon' },
    title: 'Updated policy', body: 'Please review.',
  }, adminToken);
  assert.equal(byCategory.data.audienceSize, 1);

  const byCity = await api('POST', '/api/admin/notifications', {
    type: 'admin_feature_notice', audience: { kind: 'city', city: 'Bengaluru' },
    title: 'New in Bengaluru', body: 'x',
  }, adminToken);
  assert.equal(byCity.data.audienceSize, 1);
});

test('review requests need a real completed visit, and fire at most once', async () => {
  const notFound = await api('POST', '/api/staff/business/review-requests', { queueEntryId: 'does-not-exist' }, undefined, staffHeaders(salonId));
  assert.equal(notFound.status, 404);

  // Still mid-queue: not completed, so no request may be sent.
  const tooEarly = await api('POST', '/api/staff/business/review-requests', { queueEntryId: entryOne }, undefined, staffHeaders(salonId));
  assert.equal(tooEarly.status, 409);
  assert.equal(tooEarly.data.code, 'NOT_COMPLETED');

  await api('POST', `/api/salons/${salonId}/commands`, { type: 'queue_action', itemId: entryOne, action: 'Start' }, undefined, staffHeaders(salonId));
  await api('POST', `/api/salons/${salonId}/commands`, { type: 'queue_action', itemId: entryOne, action: 'Complete' }, undefined, staffHeaders(salonId));

  // A different business may not request a review for this visit.
  const foreignBusiness = await api('POST', '/api/staff/business/review-requests', { queueEntryId: entryOne }, undefined, staffHeaders(otherSalonId));
  assert.equal(foreignBusiness.status, 403);

  const first = await api('POST', '/api/staff/business/review-requests', { queueEntryId: entryOne }, undefined, staffHeaders(salonId));
  assert.equal(first.status, 201);
  assert.equal(first.data.notification.type, 'review_request');
  assert.equal(first.data.notification.title, 'Notify Salon — How was your visit?');
  assert.match(first.data.notification.body, /Rate your experience/);
  assert.equal(first.data.notification.deepLink.kind, 'review');
  assert.equal(first.data.notification.deepLink.businessId, salonId);

  const duplicate = await api('POST', '/api/staff/business/review-requests', { queueEntryId: entryOne }, undefined, staffHeaders(salonId));
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.data.code, 'ALREADY_REQUESTED');

  const requests = (await inbox(customerToken)).notifications.filter((n: { type: string }) => n.type === 'review_request');
  assert.equal(requests.length, 1, 'no duplicate review-request spam for one completion');
});

test('a completed service also produces its own completion notification', async () => {
  const completions = (await inbox(customerToken)).notifications.filter((n: { type: string }) => n.type === 'service_completed');
  assert.equal(completions.length, 1);
  assert.equal(completions[0].deepLink.kind, 'bookings');
});

test('once a customer has reviewed, no further review request is allowed', async () => {
  const reviewed = await api('POST', `/api/business/${salonId}/reviews`, { rating: 5, reviewText: 'Great cut.' }, customerToken);
  assert.equal(reviewed.status, 201);

  // A second completed visit at the same business, already reviewed.
  const secondJoin = await api('POST', `/api/salons/${salonId}/commands`, {
    type: 'join',
    item: { id: 'q-notify-2', name: 'Notify Customer', service: 'Beard Trim', status: 'Waiting', createdAt: Date.now(), sessionId: 'session-notify-2' },
  }, customerToken);
  entryTwo = secondJoin.data.queue.find((item: { sessionId: string }) => item.sessionId === 'session-notify-2').id;
  await api('POST', `/api/salons/${salonId}/commands`, { type: 'queue_action', itemId: entryTwo, action: 'Start' }, undefined, staffHeaders(salonId));
  await api('POST', `/api/salons/${salonId}/commands`, { type: 'queue_action', itemId: entryTwo, action: 'Complete' }, undefined, staffHeaders(salonId));

  const blocked = await api('POST', '/api/staff/business/review-requests', { queueEntryId: entryTwo }, undefined, staffHeaders(salonId));
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.code, 'ALREADY_REVIEWED');
});

test('My Bookings reads real history for the authenticated customer only', async () => {
  const mine = await api('GET', '/api/me/bookings', undefined, customerToken);
  assert.equal(mine.status, 200);
  assert.ok(mine.data.bookings.length >= 2);
  for (const booking of mine.data.bookings) {
    assert.equal(booking.businessId, salonId);
    assert.equal(booking.businessName, 'Notify Salon');
    assert.equal(booking.categoryId, 'salon');
    assert.ok(Array.isArray(booking.services));
  }
  const completed = mine.data.bookings.find((b: { queueEntryId: string }) => b.queueEntryId === entryOne);
  assert.ok(completed.serviceCompletedAt, 'completion timestamps come from the stored record');

  const theirs = await api('GET', '/api/me/bookings', undefined, otherCustomerToken);
  assert.deepEqual(theirs.data.bookings, [], 'a customer with no history gets an empty list, never someone else\'s');
  assert.equal((await api('GET', '/api/me/bookings')).status, 401);
});
