import assert from 'node:assert/strict';
import test from 'node:test';
import type { QueueItem } from '../src/types.ts';
import {
  callPhase,
  DEFAULT_GRACE_MINUTES,
  formatCountdown,
  graceMinutes,
  graceWindowMs,
  remainingMs,
  shouldStartNewCall,
} from '../src/shared/queueTiming.ts';

const GRACE = graceWindowMs();
const T0 = 1_700_000_000_000;

const called = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: 'q1',
  name: 'Web Customer',
  service: 'Haircut',
  status: 'Called',
  createdAt: T0 - 60_000,
  calledAt: T0,
  graceExpiresAt: T0 + GRACE,
  callAttempt: 1,
  ...overrides,
});

test('grace period defaults to 7 minutes and is configurable', () => {
  assert.equal(DEFAULT_GRACE_MINUTES, 7);
  assert.equal(GRACE, 7 * 60_000);
  assert.equal(graceMinutes('5'), 5);
  assert.equal(graceMinutes(10), 10);
  // Nonsense values fall back rather than breaking the state machine.
  assert.equal(graceMinutes('abc'), 7);
  assert.equal(graceMinutes(0), 7);
  assert.equal(graceMinutes(9999), 7);
});

test('WAITING to CALLED stamps a deadline exactly one window ahead', () => {
  const item = called();
  assert.equal(item.graceExpiresAt! - item.calledAt!, GRACE);
  assert.equal(item.callAttempt, 1);
  assert.equal(callPhase(item, T0), 'called');
});

test('countdown is derived from the server deadline, so refresh cannot reset it', () => {
  const item = called();
  assert.equal(formatCountdown(remainingMs(item, T0)), '07:00');
  // A "reload" is just another read of the same stored deadline.
  assert.equal(formatCountdown(remainingMs(item, T0 + 18_000)), '06:42');
  assert.equal(formatCountdown(remainingMs(item, T0 + 2 * 60_000)), '05:00');
});

test('an SSE reconnect at any later moment restores the same deadline', () => {
  const item = called();
  const afterReconnect = { ...item };
  assert.equal(remainingMs(afterReconnect, T0 + 3 * 60_000), GRACE - 3 * 60_000);
  assert.equal(afterReconnect.graceExpiresAt, item.graceExpiresAt);
});

test('customer acknowledgement never moves the deadline', () => {
  const item = called();
  const acknowledged: QueueItem = { ...item, acknowledgedAt: T0 + 2 * 60_000 };
  assert.equal(acknowledged.graceExpiresAt, item.graceExpiresAt);
  // Two minutes spent before tapping leaves five, not seven.
  assert.equal(formatCountdown(remainingMs(acknowledged, T0 + 2 * 60_000)), '05:00');
});

test('expiry moves to call-again rather than auto no-show', () => {
  const item = called();
  assert.equal(callPhase(item, T0 + GRACE - 1), 'called');
  assert.equal(callPhase(item, T0 + GRACE), 'call_again');
  assert.equal(callPhase(item, T0 + GRACE + 60_000), 'call_again');
  // Still a live queue entry: expiry alone never closes it.
  assert.equal(item.status, 'Called');
  assert.equal(item.outcome, undefined);
});

test('a double-tapped Call inside the window is idempotent', () => {
  const item = called();
  assert.equal(shouldStartNewCall(item, T0 + 1_000), false);
  assert.equal(shouldStartNewCall(item, T0 + 60_000), false);
});

test('Call Again is allowed only once the window has elapsed', () => {
  const item = called();
  assert.equal(shouldStartNewCall(item, T0 + GRACE), true);
  assert.equal(shouldStartNewCall({ ...item, status: 'Waiting' }, T0), true);
});

test('Call Again issues a new deadline and increments the attempt', () => {
  const first = called();
  const at = T0 + GRACE + 30_000;
  const second: QueueItem = {
    ...first,
    calledAt: at,
    graceExpiresAt: at + GRACE,
    callAttempt: (first.callAttempt || 0) + 1,
    acknowledgedAt: undefined,
  };
  assert.equal(second.callAttempt, 2);
  assert.equal(second.graceExpiresAt! - at, GRACE);
  assert.equal(callPhase(second, at), 'called');
  assert.equal(formatCountdown(remainingMs(second, at)), '07:00');
  assert.equal(second.acknowledgedAt, undefined, 'a new call clears the old acknowledgement');
});

test('Start Service clears the deadline so an old timer can never re-fire', () => {
  const item = called();
  const serving: QueueItem = { ...item, status: 'Serving', graceExpiresAt: undefined, serviceStartedAt: T0 + 60_000 };
  assert.equal(callPhase(serving, T0 + 10 * 60_000), 'in_service');
  assert.equal(remainingMs(serving, T0 + 10 * 60_000), 0);
});

test('expiry evaluation is idempotent across repeated ticks', () => {
  const item = called();
  const phases = [0, 1, 2, 3].map(() => callPhase(item, T0 + GRACE + 5_000));
  assert.deepEqual(phases, ['call_again', 'call_again', 'call_again', 'call_again']);
});

test('no-show is a distinct outcome, never a completed service', () => {
  const noShow: QueueItem = { ...called(), status: 'NoShow', outcome: 'no_show', noShowAt: T0 + GRACE + 60_000 };
  assert.equal(callPhase(noShow, Date.now()), 'no_show');
  assert.notEqual(noShow.outcome, 'completed');
  assert.equal(noShow.status !== 'Completed', true);
});

test('a completed service records the completed outcome', () => {
  const done: QueueItem = { ...called(), status: 'Completed', outcome: 'completed', serviceCompletedAt: T0 + 20 * 60_000 };
  assert.equal(callPhase(done, Date.now()), 'completed');
  assert.equal(done.outcome, 'completed');
});

test('countdown formatting is stable at the boundaries', () => {
  assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(-5_000), '00:00');
  assert.equal(formatCountdown(GRACE), '07:00');
  assert.equal(formatCountdown(59_400), '01:00');
});

test('an entry called before this feature shipped is not treated as expired', () => {
  const legacy: QueueItem = { ...called(), graceExpiresAt: undefined };
  assert.equal(callPhase(legacy, T0 + 60 * 60_000), 'called');
});
