import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { QueueItem } from '../src/types.ts';
import type { SalonSnapshot } from '../src/services/realtimeQueueService.ts';
import { toSalonProfile } from '../src/shared/salonProfile.ts';

/**
 * Release gate for the whole product as ONE system: Customer app, public QR
 * web page, Staff dashboard and Admin panel all driven against a single
 * running backend, exactly as they are in production (same origin, same API,
 * same SSE stream). Anything that would create "two queue realities" fails
 * here rather than on a customer's phone.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN_EMAIL = 'release-gate@example.test';
const ADMIN_PASSWORD = 'release-gate-password-not-production';

let child: ChildProcess | null = null;
let base = '';
let dataDir = '';
let adminToken = '';

type Json = Record<string, any>;

const api = async (method: string, url: string, body?: unknown, token?: string) => {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Json = {};
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { status: response.status, body: parsed };
};

const command = (salon: string, payload: unknown) => api('POST', `/api/salons/${salon}/commands`, payload);
const state = async (salon: string): Promise<SalonSnapshot> => (await api('GET', `/api/salons/${salon}/state`)).body as SalonSnapshot;

/** A live SSE subscriber — this is what the Staff dashboard actually is. */
class Stream {
  snapshots: SalonSnapshot[] = [];
  private controller = new AbortController();
  private ready!: Promise<void>;

  constructor(private salon: string) {}

  async open() {
    const response = await fetch(`${base}/api/salons/${this.salon}/events`, { signal: this.controller.signal });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let resolveReady: () => void;
    this.ready = new Promise((resolve) => { resolveReady = resolve; });
    (async () => {
      let buffer = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let index;
          while ((index = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            const line = chunk.split('\n').find((entry) => entry.startsWith('data: '));
            if (!line) continue;
            this.snapshots.push(JSON.parse(line.slice(6)));
            resolveReady();
          }
        }
      } catch { /* closed */ }
    })();
    await this.ready;
    return this;
  }

  get latest(): SalonSnapshot { return this.snapshots[this.snapshots.length - 1]; }

  /** Wait for a pushed snapshot satisfying `predicate` — no polling of the API. */
  async until(predicate: (snapshot: SalonSnapshot) => boolean, label: string, timeoutMs = 5000): Promise<SalonSnapshot> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = [...this.snapshots].reverse().find(predicate);
      if (hit) return hit;
      if (Date.now() > deadline) throw new Error(`SSE never delivered: ${label}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  close() { this.controller.abort(); }
}

const find = (snapshot: SalonSnapshot, sessionId: string): QueueItem | undefined =>
  snapshot.queue.find((item) => item.sessionId === sessionId);
const findHistory = (snapshot: SalonSnapshot, sessionId: string): QueueItem | undefined =>
  snapshot.completedList.find((item) => item.sessionId === sessionId);

/** Authenticate a customer the way both the app and the web page do. */
async function authenticate(phone: string): Promise<string> {
  const requested = await api('POST', '/api/otp/request', { phone });
  assert.equal(requested.status, 200);
  const verified = await api('POST', '/api/otp/verify', {
    challengeId: requested.body.challengeId,
    code: requested.body.demoCode,
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  return verified.body.token as string;
}

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'nws-release-'));
  const port = 8700 + Math.floor(Math.random() * 200);
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      PORT: String(port),
      DATABASE_URL: '',
      NODE_ENV: 'production',
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error('server did not start');
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) break;
    } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const login = await api('POST', '/api/admin/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert.equal(login.status, 200, 'admin can sign in');
  adminToken = login.body.token;
  await command('salon-1', { type: 'reset' });
  await command('salon-2', { type: 'reset' });
});

after(() => {
  child?.kill('SIGKILL');
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

/* ======================= 3. ONE CONNECTED SYSTEM ======================= */

test('health, admin, staff and public surfaces are all served by one backend', async () => {
  const health = await api('GET', '/api/health');
  assert.equal(health.status, 200);
  const summary = await api('GET', '/api/admin/summary', undefined, adminToken);
  assert.equal(summary.status, 200);
  assert.ok(summary.body.totalSalons >= 2, 'admin sees the salon records');
  const directory = await api('GET', '/api/salons/directory');
  assert.ok(directory.body.salons.length >= 2, 'staff salon picker is served the same salons');
});

/* ================ 4A. CUSTOMER APP -> STAFF DASHBOARD ================= */

test('Scenario A: an app booking reaches the Staff dashboard live and completes', async () => {
  const staff = await new Stream('salon-1').open();
  const session = `app-${Date.now()}`;
  try {
    const joined = await command('salon-1', {
      type: 'join',
      item: { name: 'App Customer', service: 'Haircut', status: 'Waiting', sessionId: session, source: 'customer_app' },
    });
    assert.equal(joined.status, 200);

    // 3 + 4: the dashboard is pushed the booking, no refresh, labelled App.
    const arrived = await staff.until((snapshot) => Boolean(find(snapshot, session)), 'app booking');
    assert.equal(find(arrived, session)!.source, 'customer_app');

    const itemId = find(arrived, session)!.id;

    // 5: Call pushes a server-stamped deadline back to the app.
    await command('salon-1', { type: 'queue_action', itemId, action: 'Call' });
    const called = await staff.until((snapshot) => find(snapshot, session)?.status === 'Called', 'call');
    const entry = find(called, session)!;
    assert.equal(entry.callAttempt, 1);
    assert.ok(entry.graceExpiresAt! - entry.calledAt! === 7 * 60_000, 'a 7 minute arrival window');

    // 6: "I'm on my way" records intent without moving the deadline.
    await command('salon-1', { type: 'queue_action', itemId, action: 'Acknowledge' });
    const acked = await staff.until((snapshot) => Boolean(find(snapshot, session)?.acknowledgedAt), 'acknowledgement');
    assert.equal(find(acked, session)!.graceExpiresAt, entry.graceExpiresAt, 'the deadline is never extended');

    // 7: Start then Complete.
    await command('salon-1', { type: 'queue_action', itemId, action: 'Start' });
    const serving = await staff.until((snapshot) => find(snapshot, session)?.status === 'Serving', 'start');
    assert.equal(find(serving, session)!.graceExpiresAt, undefined, 'no stale countdown while in service');

    await command('salon-1', { type: 'queue_action', itemId, action: 'Complete' });
    const done = await staff.until((snapshot) => Boolean(findHistory(snapshot, session)), 'complete');
    const record = findHistory(done, session)!;
    assert.equal(record.outcome, 'completed');
    assert.ok(record.serviceCompletedAt, 'completion is timestamped');
  } finally {
    staff.close();
  }
});

/* ================ 4B. PUBLIC QR WEB -> STAFF DASHBOARD ================ */

test('Scenario B: a production QR resolves, joins, and reaches the same dashboard', async () => {
  const qr = await api('GET', '/api/admin/businesses/salon-1/qr', undefined, adminToken);
  assert.equal(qr.status, 200);
  const token = qr.body.qr.publicToken || qr.body.qr.token;
  assert.ok(token, 'the salon has a public QR token');

  // 2: scanning it resolves the correct salon, with live queue facts attached.
  const resolved = await api('GET', `/api/business-qr/${token}`);
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.business.id, 'salon-1');
  assert.equal(typeof resolved.body.business.liveWaitMinutes, 'number');

  const staff = await new Stream('salon-1').open();
  try {
    const auth = await authenticate('9000000001');
    const service = resolved.body.business.services[0];
    const session = `web-${Date.now()}`;
    const joined = await fetch(`${base}/api/business-qr/${token}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ serviceId: service.id, sessionId: session, source: 'qr_web', requestId: crypto.randomUUID() }),
    });
    // The public join endpoint answers 201 Created for a new queue entry.
    assert.ok([200, 201].includes(joined.status), await joined.clone().text());

    // 4 + 5: the same dashboard, attributed to Web QR.
    const arrived = await staff.until((snapshot) => Boolean(find(snapshot, session)), 'web booking');
    const entry = find(arrived, session)!;
    assert.equal(entry.source, 'qr_web');

    // 6: Call pushes the turn alert and countdown to the web page.
    await command('salon-1', { type: 'queue_action', itemId: entry.id, action: 'Call' });
    const called = await staff.until((snapshot) => find(snapshot, session)?.status === 'Called', 'web call');
    assert.ok(find(called, session)!.graceExpiresAt, 'the web page gets a server deadline to count down to');

    // 7: the customer cancels from the web page.
    await command('salon-1', { type: 'cancel_customer', sessionId: session, reasonCode: 'running_late' });
    const cancelled = await staff.until((snapshot) => Boolean(findHistory(snapshot, session)), 'web cancellation');
    const record = findHistory(cancelled, session)!;
    assert.equal(record.outcome, 'cancelled_customer');
    assert.equal(record.source, 'qr_web', 'attribution survives the cancellation');
  } finally {
    staff.close();
  }
});

test('duplicate joins are refused for the same session', async () => {
  const session = `dupe-${Date.now()}`;
  const item = { name: 'Dupe', service: 'Haircut', status: 'Waiting', sessionId: session, source: 'customer_app' };
  assert.equal((await command('salon-1', { type: 'join', item })).status, 200);
  const second = await command('salon-1', { type: 'join', item });
  assert.equal(second.status, 409, 'a second booking for the same session is rejected');
  await command('salon-1', { type: 'cancel_customer', sessionId: session, reasonCode: 'other' });
});

test('an invalid or revoked QR never resolves to a salon', async () => {
  const bogus = await api('GET', '/api/business-qr/not-a-real-token');
  assert.equal(bogus.status, 404);
  assert.equal(bogus.body.code, 'INVALID_BUSINESS_QR');
});

test('each salon has its own QR and its own queue — no cross-salon bleed', async () => {
  const first = await api('GET', '/api/admin/businesses/salon-1/qr', undefined, adminToken);
  const second = await api('GET', '/api/admin/businesses/salon-2/qr', undefined, adminToken);
  const tokenA = first.body.qr.publicToken || first.body.qr.token;
  const tokenB = second.body.qr.publicToken || second.body.qr.token;
  assert.notEqual(tokenA, tokenB);
  assert.equal((await api('GET', `/api/business-qr/${tokenB}`)).body.business.id, 'salon-2');

  const streamA = await new Stream('salon-1').open();
  const streamB = await new Stream('salon-2').open();
  try {
    const appSession = `bleed-app-${Date.now()}`;
    const webSession = `bleed-web-${Date.now()}`;
    await command('salon-1', { type: 'join', item: { name: 'At Salon One', service: 'Haircut', status: 'Waiting', sessionId: appSession, source: 'customer_app' } });
    await command('salon-2', { type: 'join', item: { name: 'At Salon Two', service: 'Haircut', status: 'Waiting', sessionId: webSession, source: 'qr_web' } });

    const a = await streamA.until((snapshot) => Boolean(find(snapshot, appSession)), 'salon-1 booking');
    const b = await streamB.until((snapshot) => Boolean(find(snapshot, webSession)), 'salon-2 booking');
    assert.equal(find(a, webSession), undefined, 'salon-2 booking never appears at salon-1');
    assert.equal(find(b, appSession), undefined, 'salon-1 booking never appears at salon-2');

    // Both sources coexist in one salon without collision.
    const alsoWeb = `bleed-both-${Date.now()}`;
    await command('salon-1', { type: 'join', item: { name: 'Web At Salon One', service: 'Haircut', status: 'Waiting', sessionId: alsoWeb, source: 'qr_web' } });
    const both = await streamA.until((snapshot) => Boolean(find(snapshot, alsoWeb)), 'second source');
    assert.equal(find(both, appSession)!.source, 'customer_app');
    assert.equal(find(both, alsoWeb)!.source, 'qr_web');

    for (const session of [appSession, alsoWeb]) await command('salon-1', { type: 'cancel_customer', sessionId: session, reasonCode: 'other' });
    await command('salon-2', { type: 'cancel_customer', sessionId: webSession, reasonCode: 'other' });
  } finally {
    streamA.close();
    streamB.close();
  }
});

/* ==================== 5. STAFF DASHBOARD BEHAVIOUR ==================== */

test('Call Again is only possible after the window elapses, and No-show is distinct', async () => {
  const session = `noshow-${Date.now()}`;
  await command('salon-1', { type: 'join', item: { name: 'No Show', service: 'Haircut', status: 'Waiting', sessionId: session, source: 'customer_app' } });
  const item = find(await state('salon-1'), session)!;
  const first = await command('salon-1', { type: 'queue_action', itemId: item.id, action: 'Call' });
  const attempt = find(first.body as SalonSnapshot, session)!.callAttempt;

  // Pressing Call twice inside a live window must not start a second timer.
  const again = await command('salon-1', { type: 'queue_action', itemId: item.id, action: 'Call' });
  assert.equal(find(again.body as SalonSnapshot, session)!.callAttempt, attempt, 'no second timer from a double tap');

  const noShow = await command('salon-1', { type: 'queue_action', itemId: item.id, action: 'No-show' });
  const record = findHistory(noShow.body as SalonSnapshot, session)!;
  assert.equal(record.outcome, 'no_show');
  assert.notEqual(record.outcome, 'completed');
});

test('Cancel Chair frees the barber and is recorded as a salon cancellation', async () => {
  const session = `chair-${Date.now()}`;
  await command('salon-1', { type: 'join', item: { name: 'Chair', service: 'Haircut', status: 'Waiting', sessionId: session, source: 'customer_app' } });
  const item = find(await state('salon-1'), session)!;
  await command('salon-1', { type: 'queue_action', itemId: item.id, action: 'Call' });
  const cancelled = await command('salon-1', { type: 'queue_action', itemId: item.id, action: 'Cancel-chair', reasonCode: 'salon_closing' });
  const snapshot = cancelled.body as SalonSnapshot;
  assert.equal(findHistory(snapshot, session)!.outcome, 'cancelled_staff');
  assert.equal(snapshot.barbers.some((barber) => barber.currentCustomerName === 'Chair'), false);
});

/* ================== 9. TERMINAL-STATE RACE SAFETY ==================== */

test('terminal states can never be overwritten by a later action', async () => {
  const terminal = async (label: string, finish: (itemId: string, session: string) => Promise<unknown>) => {
    const session = `${label}-${Date.now()}`;
    await command('salon-1', { type: 'join', item: { name: label, service: 'Haircut', status: 'Waiting', sessionId: session, source: 'customer_app' } });
    const item = find(await state('salon-1'), session)!;
    await finish(item.id, session);
    for (const action of ['Call', 'Start', 'Complete', 'No-show', 'Cancel-chair', 'Acknowledge']) {
      const response = await command('salon-1', { type: 'queue_action', itemId: item.id, action });
      assert.equal(response.status, 409, `${action} after ${label} is refused`);
    }
    return findHistory(await state('salon-1'), session)!;
  };

  const cancelled = await terminal('cancelled', (_id, session) => command('salon-1', { type: 'cancel_customer', sessionId: session, reasonCode: 'other' }));
  assert.equal(cancelled.outcome, 'cancelled_customer');

  const noShow = await terminal('noshow2', (id) => command('salon-1', { type: 'queue_action', itemId: id, action: 'No-show' }));
  assert.equal(noShow.outcome, 'no_show');

  const completed = await terminal('completed', async (id) => {
    await command('salon-1', { type: 'queue_action', itemId: id, action: 'Start' });
    return command('salon-1', { type: 'queue_action', itemId: id, action: 'Complete' });
  });
  assert.equal(completed.outcome, 'completed');
});

test('a reconnecting client is restored to server truth, not its own stale view', async () => {
  const session = `reconnect-${Date.now()}`;
  await command('salon-1', { type: 'join', item: { name: 'Reconnect', service: 'Haircut', status: 'Waiting', sessionId: session, source: 'qr_web' } });
  const item = find(await state('salon-1'), session)!;
  await command('salon-1', { type: 'queue_action', itemId: item.id, action: 'Call' });

  // A brand new subscriber (a refresh, or a phone waking up) gets the full
  // truth in its very first frame.
  const fresh = await new Stream('salon-1').open();
  try {
    const first = fresh.snapshots[0];
    const entry = find(first, session)!;
    assert.equal(entry.status, 'Called');
    assert.ok(entry.graceExpiresAt, 'the deadline is server-side, so the countdown resumes correctly');
  } finally {
    fresh.close();
  }
  await command('salon-1', { type: 'cancel_customer', sessionId: session, reasonCode: 'other' });
});

/* ============ 7 + 8. ADMIN EDITS FEED THE APP AND THE WEB ============ */

test('an admin salon edit reaches both the Customer app and the public QR page', async () => {
  const current = await api('GET', '/api/admin/salons/salon-2', undefined, adminToken);
  assert.equal(current.status, 200);
  const salon = current.body.salon;
  const renamed = `${salon.name} · Release Check`;

  const saved = await api('PUT', '/api/admin/salons/salon-2', { ...salon, name: renamed }, adminToken);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));

  // The app reads this endpoint for a salon it already has selected.
  const appView = await api('GET', '/api/salons/salon-2/profile');
  assert.equal(appView.body.salon.name, renamed);

  // The public QR page reads the QR endpoint.
  const qr = await api('GET', '/api/admin/businesses/salon-2/qr', undefined, adminToken);
  const token = qr.body.qr.publicToken || qr.body.qr.token;
  const webView = await api('GET', `/api/business-qr/${token}`);
  assert.equal(webView.body.business.name, renamed);

  // And both build an identical profile from it — no drift between surfaces.
  assert.deepEqual(
    toSalonProfile(appView.body.salon),
    toSalonProfile(webView.body.business),
    'the app and the web page render the same salon identity, services and details',
  );

  await api('PUT', '/api/admin/salons/salon-2', { ...salon, name: salon.name }, adminToken);
});

test('an existing QR token keeps working after the salon is edited', async () => {
  const qr = await api('GET', '/api/admin/businesses/salon-1/qr', undefined, adminToken);
  const token = qr.body.qr.publicToken || qr.body.qr.token;
  const salon = (await api('GET', '/api/admin/salons/salon-1', undefined, adminToken)).body.salon;
  await api('PUT', '/api/admin/salons/salon-1', { ...salon, description: `${salon.description || ''} `.trim() }, adminToken);
  const after = await api('GET', `/api/business-qr/${token}`);
  assert.equal(after.status, 200, 'printed QR codes keep resolving after an edit');
  assert.equal(after.body.business.id, 'salon-1');
});

test('admin routes reject an unauthenticated caller', async () => {
  assert.equal((await api('GET', '/api/admin/salons')).status, 401);
  assert.equal((await api('GET', '/api/admin/summary', undefined, 'not-a-token')).status, 401);
});

/* ============= Stylist selection and source attribution regression ======== */

test('a stylist chosen at join is preserved and honoured when the chair is given', async () => {
  const staff = await new Stream('salon-1').open();
  const session = `stylist-${Date.now()}`;
  try {
    const roster = (await state('salon-1')).barbers;
    const wanted = roster[1];
    assert.ok(wanted, 'the salon has more than one stylist to choose between');

    await command('salon-1', {
      type: 'join',
      item: {
        name: 'Stylist Picker', service: 'Haircut', status: 'Waiting',
        sessionId: session, source: 'customer_app', preferredBarberId: wanted.id,
      },
    });

    const arrived = await staff.until((snapshot) => Boolean(find(snapshot, session)), 'stylist booking');
    const entry = find(arrived, session)!;
    assert.equal(entry.preferredBarberId, wanted.id, 'the preference is stored on the booking');
    assert.equal(entry.barberName, wanted.name, 'and is shown to staff');

    // The chair is only bound at Call time, and it must be the requested one.
    const called = await command('salon-1', { type: 'queue_action', itemId: entry.id, action: 'Call' });
    const seated = find(called.body as SalonSnapshot, session)!;
    assert.equal(seated.barberName, wanted.name, 'the requested stylist takes the customer');

    await command('salon-1', { type: 'cancel_customer', sessionId: session, reasonCode: 'other' });
  } finally {
    staff.close();
  }
});

test('an unknown stylist id never fails the join, it falls back to any available', async () => {
  const session = `stylist-bogus-${Date.now()}`;
  const response = await command('salon-1', {
    type: 'join',
    item: {
      name: 'Bogus Stylist', service: 'Haircut', status: 'Waiting',
      sessionId: session, source: 'customer_app', preferredBarberId: 'no-such-barber',
    },
  });
  assert.equal(response.status, 200, 'a stale client cannot be locked out of the queue');
  const entry = find(response.body as SalonSnapshot, session)!;
  assert.equal(entry.preferredBarberId, undefined, 'the bad preference is dropped rather than stored');
  await command('salon-1', { type: 'cancel_customer', sessionId: session, reasonCode: 'other' });
});

test('app and web bookings stay distinct and correctly ordered on one dashboard', async () => {
  const staff = await new Stream('salon-1').open();
  const appSession = `mix-app-${Date.now()}`;
  const webSession = `mix-web-${Date.now()}`;
  try {
    await command('salon-1', {
      type: 'join',
      item: { name: 'From App', service: 'Haircut', status: 'Waiting', sessionId: appSession, source: 'customer_app' },
    });
    await command('salon-1', {
      type: 'join',
      item: { name: 'From Web QR', service: 'Haircut', status: 'Waiting', sessionId: webSession, source: 'qr_web' },
    });

    const snapshot = await staff.until((current) => Boolean(find(current, webSession)), 'both bookings');
    const fromApp = find(snapshot, appSession)!;
    const fromWeb = find(snapshot, webSession)!;
    assert.equal(fromApp.source, 'customer_app');
    assert.equal(fromWeb.source, 'qr_web');
    assert.ok(fromApp.createdAt <= fromWeb.createdAt, 'the app booking holds the earlier place');

    // Acting on one must never touch the other.
    await command('salon-1', { type: 'queue_action', itemId: fromApp.id, action: 'Call' });
    const afterCall = await staff.until((current) => find(current, appSession)?.status === 'Called', 'call reaches the right customer');
    assert.equal(find(afterCall, webSession)!.status, 'Waiting', 'the web customer is untouched');

    for (const session of [appSession, webSession]) {
      await command('salon-1', { type: 'cancel_customer', sessionId: session, reasonCode: 'other' });
    }
  } finally {
    staff.close();
  }
});
