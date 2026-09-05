// Auth + business-isolation coverage for GET /api/staff/business/staff-performance.
//
// This endpoint returns real per-staff revenue, completed-booking counts,
// average ticket, top services and cancellation/no-show counts — private
// business metrics that must never be readable without a valid staff
// session, and must always be scoped to the caller's own authenticated
// business (session.businessId), never a client-supplied salon/business id.
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

let ownerATokenValue = '';
let ownerBTokenValue = '';
let managerATokenValue = '';
let nonManagerATokenValue = '';

const api = async (method: string, url: string, body?: unknown, token = '') => {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};

/** Mints a staff session directly against the server's own token-hash
 *  scheme (sha256/base64url) — same technique used by gymLiveFloor.test.ts
 *  — for roles (manager, a non-owner/manager staff role) the demo seed
 *  data does not already provide an account for. */
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
  dataDir = mkdtempSync(path.join(tmpdir(), 'nws-staff-perf-auth-'));
  const port = 9700 + Math.floor(Math.random() * 400);
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

  // Sessions minted directly via the server's own token-hash scheme (rather
  // than /api/staff/login, which additionally requires a provisioned
  // business_code the demo seed does not set for salon-1/salon-2) — same
  // technique gymLiveFloor.test.ts already uses for a salon owner session.
  ownerATokenValue = mintStaffSession(SALON_A, 'owner');
  ownerBTokenValue = mintStaffSession(SALON_B, 'owner');
  managerATokenValue = mintStaffSession(SALON_A, 'manager');
  nonManagerATokenValue = mintStaffSession(SALON_A, 'staff');
});

after(() => {
  child?.kill('SIGKILL');
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('an unauthenticated request is rejected with 401', async () => {
  const res = await api('GET', '/api/staff/business/staff-performance?range=30d');
  assert.equal(res.status, 401);
  assert.ok(res.body.error);
});

test('a staff session that is neither owner nor manager is rejected with 403', async () => {
  const res = await api('GET', '/api/staff/business/staff-performance?range=30d', undefined, nonManagerATokenValue);
  assert.equal(res.status, 403);
  assert.ok(res.body.error);
});

test('an owner session succeeds and returns this business\'s own staff', async () => {
  const res = await api('GET', '/api/staff/business/staff-performance?range=all', undefined, ownerATokenValue);
  assert.equal(res.status, 200);
  assert.equal(res.body.range, 'all');
  assert.ok(Array.isArray(res.body.staff));
  assert.ok(res.body.staff.length > 0, 'Salon A has demo staff, so the response must not be empty');
  for (const row of res.body.staff) {
    assert.ok(row.staffId.startsWith('salon-1'), `Every staff row must belong to Salon A, got ${row.staffId}`);
    // Real-data-only invariants carried over from the original implementation.
    assert.ok(row.revenueInr === null || typeof row.revenueInr === 'number');
    assert.equal(row.verifiedRating, null, 'No per-staff review system exists yet — must never fabricate a rating');
    assert.equal(row.verifiedReviewCount, null);
  }
});

test('a manager session succeeds the same as an owner session', async () => {
  const res = await api('GET', '/api/staff/business/staff-performance?range=all', undefined, managerATokenValue);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.staff));
  assert.ok(res.body.staff.every((row: { staffId: string }) => row.staffId.startsWith('salon-1')));
});

test('Business A session can never read Business B\'s staff performance, even via a query-string override attempt', async () => {
  const asOwnerB = await api('GET', '/api/staff/business/staff-performance?range=all', undefined, ownerBTokenValue);
  assert.equal(asOwnerB.status, 200);
  assert.ok(asOwnerB.body.staff.length > 0, 'Salon B has demo staff, so the response must not be empty');
  const businessBStaffIds = new Set(asOwnerB.body.staff.map((row: { staffId: string }) => row.staffId));

  // A malicious/legacy client might still try to pass a business id as a
  // query param (the old, now-removed :salonId path param, or a made-up
  // businessId/salonId query key) — the endpoint must derive scope only
  // from session.businessId and ignore any such override entirely.
  const asOwnerAWithOverride = await api(
    'GET',
    `/api/staff/business/staff-performance?range=all&businessId=${SALON_B}&salonId=${SALON_B}`,
    undefined,
    ownerATokenValue,
  );
  assert.equal(asOwnerAWithOverride.status, 200);
  for (const row of asOwnerAWithOverride.body.staff) {
    assert.ok(!businessBStaffIds.has(row.staffId), `Salon A's session must never see Salon B's staffId ${row.staffId} even with a spoofed query param`);
    assert.ok(row.staffId.startsWith('salon-1'));
  }
});

test('range filters are accepted and echoed back (today/7d/30d/all), with an invalid range defaulting safely', async () => {
  for (const range of ['today', '7d', '30d', 'all']) {
    const res = await api('GET', `/api/staff/business/staff-performance?range=${range}`, undefined, ownerATokenValue);
    assert.equal(res.status, 200);
    assert.equal(res.body.range, range);
  }
  const invalid = await api('GET', '/api/staff/business/staff-performance?range=not-a-real-range', undefined, ownerATokenValue);
  assert.equal(invalid.status, 200);
  assert.equal(invalid.body.range, '30d', 'An unrecognised range must fall back to a safe default, never throw or leak data');
});
