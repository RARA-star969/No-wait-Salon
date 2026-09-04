import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SalonSnapshot as SalonState } from '../src/services/realtimeQueueService.ts';

/**
 * Regression cover for CRITICAL FIX #1 (Staff business scoping).
 *
 * Before the fix, `App.tsx`'s `runCommand()` was hard-wired to
 * `customerSalon.id` — the Salon Staff dashboard's queue/barber/save_staff/
 * save_offers writes all posted against whichever business the *Customer*
 * panel happened to have open, not the authenticated Staff business. The fix
 * split `runCommand` (customer-scoped) from a new `runStaffCommand`
 * (`staffSalon.id`-scoped), with fully separate state, subscriptions and
 * command paths for each panel.
 *
 * `App.tsx` itself has no component-test harness in this repo, so this
 * exercises the actual invariant the fix depends on at the boundary that
 * *is* testable here: the real HTTP server must keep every business's state
 * fully isolated by `salonId`, so that posting Staff's command against
 * Salon B's id (as `runStaffCommand` now always does) can never be observed
 * by — or accidentally mutate — Salon A, even while a Customer panel has
 * Salon A open at the same time.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALON_A = 'salon-1'; // "Customer panel" business in this scenario
const SALON_B = 'salon-2'; // "Staff panel" business in this scenario
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

const command = (salonId: string, payload: unknown) => api('POST', `/api/salons/${salonId}/commands`, payload);
const state = async (salonId: string): Promise<SalonState> => (await api('GET', `/api/salons/${salonId}/state`)).body as SalonState;

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'nws-staff-scope-'));
  const port = 9300 + Math.floor(Math.random() * 400);
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
  await command(SALON_A, { type: 'reset' });
  await command(SALON_B, { type: 'reset' });
});

after(() => {
  child?.kill('SIGKILL');
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('Customer panel on Salon A + Staff panel on Salon B: a Staff walk-in only ever lands in Salon B', async () => {
  // "Customer panel" is browsing Salon A — a customer joins Salon A's queue,
  // exactly as it would if a real Customer panel were open on Salon A at
  // the same time as the scenario below.
  const customerJoin = await command(SALON_A, {
    type: 'join',
    item: { name: 'Customer A Visitor', service: 'Haircut', status: 'Waiting', sessionId: `sess-a-${Date.now()}`, source: 'customer_app' },
  });
  assert.equal(customerJoin.status, 200);

  const beforeA = await state(SALON_A);
  const beforeB = await state(SALON_B);

  // "Staff panel" is signed into Salon B and adds a walk-in — this is
  // exactly the shape `runStaffCommand` sends, scoped to `staffSalon.id`.
  const staffWalkin = await command(SALON_B, {
    type: 'add_walkin',
    item: { id: '', name: 'Staff B Walk-in', phone: '', service: 'Haircut', status: 'Waiting', isUser: false, createdAt: Date.now(), estimatedDurationMin: 30 },
  });
  assert.equal(staffWalkin.status, 200);

  const afterA = await state(SALON_A);
  const afterB = await state(SALON_B);

  // Salon A (the Customer panel's business) must be byte-for-byte
  // unaffected by the Staff action against Salon B.
  assert.equal(afterA.queue.length, beforeA.queue.length, "Staff's walk-in on Salon B must not appear in Salon A's queue");
  assert.equal(afterA.version, beforeA.version, "Salon A's state must not advance from a command sent to Salon B");
  assert.ok(!afterA.queue.some((item) => item.name === 'Staff B Walk-in'), "Salon A's queue must never contain Salon B's walk-in");

  // Salon B (the Staff panel's business) must show the new walk-in and
  // nothing from Salon A's customer join.
  assert.ok(afterB.queue.some((item) => item.name === 'Staff B Walk-in'), "Salon B's queue must contain the walk-in Staff just added");
  assert.ok(!afterB.queue.some((item) => item.name === 'Customer A Visitor'), "Salon B's queue must never contain Salon A's customer join");
  assert.equal(afterB.queue.length, beforeB.queue.length + 1);
});

test('Customer panel on Salon A + Staff panel on Salon B: a Staff queue action only mutates Salon B', async () => {
  // Seed a barber-toggle target and a queue entry on Salon B so there is
  // real state for the Staff panel to act on.
  const seed = await state(SALON_B);
  const barber = seed.barbers[0];
  assert.ok(barber, 'Salon B has at least one barber to toggle');

  const beforeA = await state(SALON_A);

  const toggle = await command(SALON_B, { type: 'toggle_barber', barberId: barber.id });
  assert.equal(toggle.status, 200);

  const afterA = await state(SALON_A);
  const afterB = await state(SALON_B);

  assert.equal(afterA.version, beforeA.version, "A Staff toggle_barber on Salon B must not touch Salon A's state at all");
  const toggledBarberOnB = afterB.barbers.find((b) => b.id === barber.id);
  assert.notEqual(toggledBarberOnB?.status, barber.status, "Salon B's barber status must actually change");
  const sameBarberIdOnA = afterA.barbers.find((b) => b.id === barber.id);
  if (sameBarberIdOnA) {
    assert.equal(sameBarberIdOnA.status, beforeA.barbers.find((b) => b.id === barber.id)?.status, "Even if Salon A happens to reuse the same barber id, Salon A's own record must be untouched");
  }
});
