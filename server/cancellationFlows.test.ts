import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { QueueItem } from '../src/types.ts';
import type { SalonSnapshot as SalonState } from '../src/services/realtimeQueueService.ts';

/**
 * End-to-end cover for the cancellation flows against the real server: the
 * reducer, the SQLite write and the HTTP contract, not a re-implementation of
 * them. A throwaway DATA_DIR keeps it fully isolated from any real data.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALON = 'salon-1';
let child: ChildProcess | null = null;
let base = '';
let dataDir = '';

const api = async (method: string, url: string, body?: unknown) => {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};

const command = (payload: unknown) => api('POST', `/api/salons/${SALON}/commands`, payload);
const state = async (): Promise<SalonState> => (await api('GET', `/api/salons/${SALON}/state`)).body as SalonState;

const join = async (sessionId: string, name: string): Promise<QueueItem> => {
  const response = await command({
    type: 'join',
    item: { name, service: 'Haircut', status: 'Waiting', sessionId, source: 'customer_app' },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const item = (response.body as SalonState).queue.find((entry) => entry.sessionId === sessionId);
  assert.ok(item, 'joined entry is in the queue');
  return item;
};

const history = async (sessionId: string): Promise<QueueItem | undefined> =>
  (await state()).completedList.find((item) => item.sessionId === sessionId);

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'nws-cancel-'));
  const port = 8900 + Math.floor(Math.random() * 400);
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
  // Start every run from a clean queue for this salon.
  await command({ type: 'reset' });
});

after(() => {
  child?.kill('SIGKILL');
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('a waiting customer can cancel with a structured reason', async () => {
  const session = `sess-waiting-${Date.now()}`;
  await join(session, 'Waiting Cancel');
  const response = await command({ type: 'cancel_customer', sessionId: session, reasonCode: 'wait_too_long', reasonText: '' });
  assert.equal(response.status, 200);

  const live = (response.body as SalonState).queue.find((item) => item.sessionId === session);
  assert.equal(live, undefined, 'cancelled booking leaves the live queue');
  const record = await history(session);
  assert.equal(record?.status, 'Cancelled');
  assert.equal(record?.outcome, 'cancelled_customer');
  assert.equal(record?.cancelledBy, 'customer');
  assert.equal(record?.cancelReasonCode, 'wait_too_long');
  assert.ok(record?.cancelledAt && record.cancelledAt > 0, 'cancellation is timestamped');
});

test('an unknown reason code is normalised rather than stored raw', async () => {
  const session = `sess-bogus-${Date.now()}`;
  await join(session, 'Bogus Reason');
  await command({ type: 'cancel_customer', sessionId: session, reasonCode: '<script>', reasonText: 'typed by hand' });
  const record = await history(session);
  assert.equal(record?.cancelReasonCode, 'other');
  assert.equal(record?.cancelReasonText, 'typed by hand');
});

test('a called customer can still cancel, and the chair is released', async () => {
  const session = `sess-called-${Date.now()}`;
  const item = await join(session, 'Called Cancel');
  const called = await command({ type: 'queue_action', itemId: item.id, action: 'Call' });
  assert.equal(called.status, 200);
  const busyBefore = (called.body as SalonState).barbers.filter((barber) => barber.status === 'busy').length;

  const response = await command({ type: 'cancel_customer', sessionId: session, reasonCode: 'running_late' });
  assert.equal(response.status, 200);
  const busyAfter = (response.body as SalonState).barbers.filter((barber) => barber.status === 'busy').length;
  assert.equal(busyAfter, busyBefore - 1, 'the barber is freed by the cancellation');

  const record = await history(session);
  assert.equal(record?.outcome, 'cancelled_customer');
  assert.equal(record?.graceExpiresAt, undefined, 'no stale arrival deadline survives cancellation');
});

test('acknowledging "on my way" does not block a later cancellation', async () => {
  const session = `sess-ack-${Date.now()}`;
  const item = await join(session, 'On My Way');
  await command({ type: 'queue_action', itemId: item.id, action: 'Call' });
  await command({ type: 'queue_action', itemId: item.id, action: 'Acknowledge' });
  const response = await command({ type: 'cancel_customer', sessionId: session, reasonCode: 'changed_mind' });
  assert.equal(response.status, 200);
  assert.equal((await history(session))?.outcome, 'cancelled_customer');
});

test('a customer already in service cannot cancel', async () => {
  const session = `sess-serving-${Date.now()}`;
  const item = await join(session, 'In Service');
  await command({ type: 'queue_action', itemId: item.id, action: 'Start' });
  const response = await command({ type: 'cancel_customer', sessionId: session, reasonCode: 'changed_mind' });
  assert.equal(response.status, 409, 'the server refuses instead of silently dropping the service');
  const live = (await state()).queue.find((entry) => entry.sessionId === session);
  assert.equal(live?.status, 'Serving');
  await command({ type: 'queue_action', itemId: item.id, action: 'Complete' });
});

test('cancelling twice is idempotent, not an error', async () => {
  const session = `sess-twice-${Date.now()}`;
  await join(session, 'Double Cancel');
  assert.equal((await command({ type: 'cancel_customer', sessionId: session, reasonCode: 'other' })).status, 200);
  assert.equal((await command({ type: 'cancel_customer', sessionId: session, reasonCode: 'other' })).status, 200);
  const cancelled = (await state()).completedList.filter((item) => item.sessionId === session);
  assert.equal(cancelled.length, 1, 'history records the cancellation exactly once');
});

test('staff Cancel Chair records a salon-side cancellation with its reason', async () => {
  const session = `sess-chair-${Date.now()}`;
  const item = await join(session, 'Chair Cancel');
  await command({ type: 'queue_action', itemId: item.id, action: 'Call' });
  const response = await command({
    type: 'queue_action',
    itemId: item.id,
    action: 'Cancel-chair',
    reasonCode: 'staff_unavailable',
    reasonText: '',
  });
  assert.equal(response.status, 200);
  const record = await history(session);
  assert.equal(record?.outcome, 'cancelled_staff');
  assert.equal(record?.cancelledBy, 'staff');
  assert.equal(record?.cancelReasonCode, 'staff_unavailable');
  assert.equal((response.body as SalonState).barbers.some((barber) => barber.currentCustomerName === 'Chair Cancel'), false);
});

test('staff cannot cancel the chair of a customer being served', async () => {
  const session = `sess-chair-serving-${Date.now()}`;
  const item = await join(session, 'Serving Chair');
  await command({ type: 'queue_action', itemId: item.id, action: 'Start' });
  const response = await command({ type: 'queue_action', itemId: item.id, action: 'Cancel-chair', reasonCode: 'other' });
  assert.equal(response.status, 409);
  await command({ type: 'queue_action', itemId: item.id, action: 'Complete' });
});

test('a cancelled booking can never be marked no-show or called again', async () => {
  const session = `sess-resurrect-${Date.now()}`;
  const item = await join(session, 'No Resurrection');
  await command({ type: 'queue_action', itemId: item.id, action: 'Call' });
  await command({ type: 'cancel_customer', sessionId: session, reasonCode: 'chose_another_salon' });

  for (const action of ['No-show', 'Call', 'Start', 'Complete']) {
    const response = await command({ type: 'queue_action', itemId: item.id, action });
    assert.equal(response.status, 409, `${action} on a cancelled booking is rejected`);
  }
  const record = await history(session);
  assert.equal(record?.outcome, 'cancelled_customer', 'the outcome is still the cancellation');
});

test('the cancelled customer may join again afterwards', async () => {
  const session = `sess-rejoin-${Date.now()}`;
  await join(session, 'Rejoiner');
  await command({ type: 'cancel_customer', sessionId: session, reasonCode: 'booked_by_mistake' });
  const again = await join(session, 'Rejoiner');
  assert.equal(again.status, 'Waiting');
  await command({ type: 'cancel_customer', sessionId: session, reasonCode: 'other' });
});

test('the salon profile endpoint serves the same record the public QR page reads', async () => {
  const response = await api('GET', `/api/salons/${SALON}/profile`);
  assert.equal(response.status, 200);
  const salon = (response.body as { salon: Record<string, unknown> }).salon;
  for (const field of ['id', 'name', 'address', 'services', 'openingHours', 'liveWaitMinutes', 'waitingCustomers']) {
    assert.ok(field in salon, `profile exposes ${field}`);
  }
  assert.equal((await api('GET', '/api/salons/does-not-exist/profile')).status, 404);
});
