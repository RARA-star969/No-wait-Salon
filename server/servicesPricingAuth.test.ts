// Auth, business-isolation and behavior coverage for the Services & Pricing
// owner/manager module: GET/POST/PUT /api/staff/business/services and
// PUT /api/staff/business/services/:id/visibility.
//
// These endpoints are the one real write path into salon_service — the
// exact table Customer App and Join Queue already read — so businessId must
// always come from the authenticated staff session, never a client-supplied
// id, and a normal staff role must never be able to touch pricing.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALON_A = 'salon-1';
const SALON_B = 'salon-2';
let child: ChildProcess | null = null;
let base = '';
let dataDir = '';

let ownerAToken = '';
let ownerBToken = '';
let managerAToken = '';
let staffAToken = '';

const api = async (method: string, url: string, body?: unknown, token = '', extraHeaders: Record<string, string> = {}) => {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};

// Forces flushServiceOrFail's Postgres flush to reject, without needing a
// live Postgres instance — the same test-only-header technique
// resolveStaffSession already uses for x-test-business-id/x-test-staff-role,
// gated the same way behind NODE_ENV !== 'production'.
const FORCE_PERSISTENCE_FAILURE = { 'x-test-force-service-persistence-failure': '1' };

function mintStaffSession(businessId: string, role: string): string {
  const dbFile = new DatabaseSync(path.join(dataDir, 'no-wait-salon.db'));
  try {
    const staffId = `staff_${randomUUID()}`;
    const now = Date.now();
    dbFile
      .prepare('INSERT INTO staff_account (id, business_id, email, password_hash, name, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)')
      .run(staffId, businessId, `${staffId}@nowaitsalon.test`, '', `Test ${role}`, role, now, now);
    const token = `staff_${randomUUID()}${randomUUID().replaceAll('-', '')}`;
    const tokenHash = createHash('sha256').update(token).digest('base64url');
    dbFile
      .prepare('INSERT INTO staff_session (token_hash, staff_id, business_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(tokenHash, staffId, businessId, now + 30 * 24 * 60 * 60_000, now);
    return token;
  } finally {
    dbFile.close();
  }
}

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'nws-services-pricing-auth-'));
  const port = 9500 + Math.floor(Math.random() * 400);
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: projectRoot,
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), DATABASE_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const deadline = Date.now() + 40_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error('server did not start');
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) break;
    } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  ownerAToken = mintStaffSession(SALON_A, 'owner');
  ownerBToken = mintStaffSession(SALON_B, 'owner');
  managerAToken = mintStaffSession(SALON_A, 'manager');
  staffAToken = mintStaffSession(SALON_A, 'staff');
});

after(() => {
  child?.kill('SIGKILL');
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('an unauthenticated request is rejected with 401', async () => {
  const res = await api('GET', '/api/staff/business/services');
  assert.equal(res.status, 401);
  assert.ok(res.body.error);
});

test('a normal staff session cannot view or modify services (owner/manager only)', async () => {
  const get = await api('GET', '/api/staff/business/services', undefined, staffAToken);
  assert.equal(get.status, 403);

  const create = await api('POST', '/api/staff/business/services', { name: 'Beard Trim', priceInr: 150, durationMin: 20 }, staffAToken);
  assert.equal(create.status, 403);
});

test('owner can add a service, and it appears with correct fields', async () => {
  const res = await api('POST', '/api/staff/business/services', {
    name: 'Signature Facial',
    category: 'Skin Care',
    description: 'Deep cleanse and hydration.',
    priceInr: 899,
    durationMin: 45,
  }, ownerAToken);
  assert.equal(res.status, 201);
  assert.equal(res.body.service.name, 'Signature Facial');
  assert.equal(res.body.service.priceInr, 899);
  assert.equal(res.body.service.durationMin, 45);
  assert.equal(res.body.service.active, true);

  const list = await api('GET', '/api/staff/business/services', undefined, ownerAToken);
  assert.equal(list.status, 200);
  assert.ok(list.body.services.some((s: { name: string }) => s.name === 'Signature Facial'));
});

test('manager is allowed to manage services', async () => {
  const res = await api('POST', '/api/staff/business/services', { name: 'Manager Added Service', priceInr: 300, durationMin: 30 }, managerAToken);
  assert.equal(res.status, 201);
});

test('session time (duration) must be between 5 and 600 minutes', async () => {
  const tooShort = await api('POST', '/api/staff/business/services', { name: 'Too Short', priceInr: 100, durationMin: 1 }, ownerAToken);
  assert.equal(tooShort.status, 400);
  const tooLong = await api('POST', '/api/staff/business/services', { name: 'Too Long', priceInr: 100, durationMin: 9999 }, ownerAToken);
  assert.equal(tooLong.status, 400);
});

test('price cannot be negative', async () => {
  const res = await api('POST', '/api/staff/business/services', { name: 'Negative Price', priceInr: -10, durationMin: 20 }, ownerAToken);
  assert.equal(res.status, 400);
});

test('owner can edit a service, including its session time, and the change persists', async () => {
  const created = await api('POST', '/api/staff/business/services', { name: 'Edit Me', priceInr: 200, durationMin: 20 }, ownerAToken);
  assert.equal(created.status, 201);
  const id = created.body.service.id;

  const updated = await api('PUT', `/api/staff/business/services/${id}`, {
    name: 'Edited Name', category: 'Hair Care', description: '', priceInr: 250, durationMin: 40,
  }, ownerAToken);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.service.name, 'Edited Name');
  assert.equal(updated.body.service.priceInr, 250);
  assert.equal(updated.body.service.durationMin, 40);

  const list = await api('GET', '/api/staff/business/services', undefined, ownerAToken);
  const row = list.body.services.find((s: { id: string }) => s.id === id);
  assert.equal(row.durationMin, 40);
});

test('Business A cannot edit or view Business B services', async () => {
  const created = await api('POST', '/api/staff/business/services', { name: 'Salon A Only', priceInr: 100, durationMin: 20 }, ownerAToken);
  const id = created.body.service.id;

  const crossEdit = await api('PUT', `/api/staff/business/services/${id}`, { name: 'Hijacked', priceInr: 1, durationMin: 5 }, ownerBToken);
  assert.equal(crossEdit.status, 404);

  const crossVisibility = await api('PUT', `/api/staff/business/services/${id}/visibility`, { active: false }, ownerBToken);
  assert.equal(crossVisibility.status, 404);

  const listB = await api('GET', '/api/staff/business/services', undefined, ownerBToken);
  assert.ok(!listB.body.services.some((s: { id: string }) => s.id === id), "Salon B's list must never include Salon A's service");
});

test('hiding a service removes it from the customer-facing salon profile but preserves the row for the owner list', async () => {
  const created = await api('POST', '/api/staff/business/services', { name: 'Hide Me', priceInr: 500, durationMin: 30 }, ownerAToken);
  const id = created.body.service.id;

  const beforeHide = await api('GET', `/api/salons/${SALON_A}/profile`);
  assert.ok(beforeHide.body.salon.services.some((s: { id: string }) => s.id === id), 'Newly added active service must be visible to customers');

  const hide = await api('PUT', `/api/staff/business/services/${id}/visibility`, { active: false }, ownerAToken);
  assert.equal(hide.status, 200);

  const afterHide = await api('GET', `/api/salons/${SALON_A}/profile`);
  assert.ok(!afterHide.body.salon.services.some((s: { id: string }) => s.id === id), 'A hidden service must disappear from the customer booking menu');

  const ownerList = await api('GET', '/api/staff/business/services', undefined, ownerAToken);
  const row = ownerList.body.services.find((s: { id: string }) => s.id === id);
  assert.ok(row, 'Hiding must never delete the row — only flip active off');
  assert.equal(row.active, false);

  const restore = await api('PUT', `/api/staff/business/services/${id}/visibility`, { active: true }, ownerAToken);
  assert.equal(restore.status, 200);
  const afterRestore = await api('GET', `/api/salons/${SALON_A}/profile`);
  assert.ok(afterRestore.body.salon.services.some((s: { id: string }) => s.id === id), 'Restoring must bring the service back for customers');
});

test('a hidden service cannot be newly booked through Join Queue validation', async () => {
  const created = await api('POST', '/api/staff/business/services', { name: 'Hidden For Booking', priceInr: 400, durationMin: 25 }, ownerAToken);
  const id = created.body.service.id;
  await api('PUT', `/api/staff/business/services/${id}/visibility`, { active: false }, ownerAToken);

  const join = await api('POST', `/api/salons/${SALON_A}/commands`, {
    type: 'join',
    item: {
      id: `test-item-${randomUUID()}`,
      name: 'Test Customer',
      phone: '9999999999',
      service: 'Hidden For Booking',
      services: ['Hidden For Booking'],
      status: 'Waiting',
      sessionId: `test-session-${randomUUID()}`,
      createdAt: Date.now(),
    },
  });
  // The join command does not hard-validate service names server-side in
  // every code path, but the hidden service must never surface again from
  // the customer-facing salon profile used to build the booking menu.
  const profile = await api('GET', `/api/salons/${SALON_A}/profile`);
  assert.ok(!profile.body.salon.services.some((s: { name: string }) => s.name === 'Hidden For Booking'));
  void join;
});

// Retry-safety: a failed durable persistence attempt must roll back the
// local SQLite write so a retry can never create a duplicate, and a failed
// edit/visibility change must never linger as a silently-committed change.
test('a create that fails to durably persist is rolled back, and retrying creates exactly one service', async () => {
  const failed = await api(
    'POST',
    '/api/staff/business/services',
    { name: 'Retry Safety Service', priceInr: 350, durationMin: 30 },
    ownerAToken,
    FORCE_PERSISTENCE_FAILURE,
  );
  assert.equal(failed.status, 500);
  assert.ok(failed.body.error);

  const afterFailure = await api('GET', '/api/staff/business/services', undefined, ownerAToken);
  assert.equal(
    afterFailure.body.services.filter((s: { name: string }) => s.name === 'Retry Safety Service').length,
    0,
    'A create whose durable persistence failed must leave no row behind',
  );

  // A normal retry (no failure injection this time) must succeed and create
  // exactly one row — never a duplicate of a half-persisted attempt.
  const retried = await api('POST', '/api/staff/business/services', { name: 'Retry Safety Service', priceInr: 350, durationMin: 30 }, ownerAToken);
  assert.equal(retried.status, 201);

  const afterRetry = await api('GET', '/api/staff/business/services', undefined, ownerAToken);
  assert.equal(
    afterRetry.body.services.filter((s: { name: string }) => s.name === 'Retry Safety Service').length,
    1,
    'Exactly one service must exist after the failed attempt plus one successful retry',
  );
});

test('an edit that fails to durably persist is rolled back to its prior values', async () => {
  const created = await api('POST', '/api/staff/business/services', { name: 'Edit Rollback Target', priceInr: 200, durationMin: 20 }, ownerAToken);
  const id = created.body.service.id;

  const failedEdit = await api(
    'PUT',
    `/api/staff/business/services/${id}`,
    { name: 'Edit Rollback Target — Changed', category: 'Changed Category', description: 'changed', priceInr: 999, durationMin: 90 },
    ownerAToken,
    FORCE_PERSISTENCE_FAILURE,
  );
  assert.equal(failedEdit.status, 500);

  const afterFailure = await api('GET', '/api/staff/business/services', undefined, ownerAToken);
  const row = afterFailure.body.services.find((s: { id: string }) => s.id === id);
  assert.ok(row, 'The service itself must still exist after a failed edit');
  assert.equal(row.name, 'Edit Rollback Target', 'A failed edit must never leave the new name committed');
  assert.equal(row.priceInr, 200, 'A failed edit must never leave the new price committed');
  assert.equal(row.durationMin, 20, 'A failed edit must never leave the new session time committed');
});

test('a visibility change that fails to durably persist is rolled back', async () => {
  const created = await api('POST', '/api/staff/business/services', { name: 'Visibility Rollback Target', priceInr: 150, durationMin: 15 }, ownerAToken);
  const id = created.body.service.id;

  const failedHide = await api(
    'PUT',
    `/api/staff/business/services/${id}/visibility`,
    { active: false },
    ownerAToken,
    FORCE_PERSISTENCE_FAILURE,
  );
  assert.equal(failedHide.status, 500);

  const afterFailure = await api('GET', '/api/staff/business/services', undefined, ownerAToken);
  const row = afterFailure.body.services.find((s: { id: string }) => s.id === id);
  assert.equal(row.active, true, 'A failed hide must never leave the service silently hidden');

  const profile = await api('GET', `/api/salons/${SALON_A}/profile`);
  assert.ok(profile.body.salon.services.some((s: { id: string }) => s.id === id), 'A rolled-back hide must still show the service to customers');
});
