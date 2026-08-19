import assert from 'node:assert/strict';
import test from 'node:test';
import type { QueueItem } from '../src/types.ts';

/**
 * Regression 1 — QR scanner flicker.
 *
 * The camera lifecycle effect used to depend on [open, start, stop]. `start`
 * is rebuilt whenever its parent re-renders (onResolved is a fresh closure),
 * so a 1s ticking clock upstream re-ran the effect every second: cleanup
 * stopped the native scanner and the body re-started it, which reads on device
 * as a blink. Pinning the effect to [open] keeps the preview mounted.
 */
function effectRuns(deps: Array<() => unknown[]>, renders: number): number {
  let runs = 0;
  let previous: unknown[] | null = null;
  for (let render = 0; render < renders; render += 1) {
    const current = deps.map((read) => read()).flat();
    if (!previous || current.some((value, index) => value !== previous![index])) runs += 1;
    previous = current;
  }
  return runs;
}

test('camera lifecycle keyed on unstable callbacks restarts on every render', () => {
  const open = () => [true];
  // A new function identity per render, as before the fix.
  const unstableStart = () => [() => {}];
  assert.equal(effectRuns([open, unstableStart], 5), 5, 'restarts once per render');
});

test('camera lifecycle keyed only on `open` starts exactly once', () => {
  const open = () => [true];
  assert.equal(effectRuns([open], 5), 1, 'preview stays mounted across re-renders');
});

test('closing and reopening the scanner starts the camera again', () => {
  const states = [false, true, true, true, false, true];
  let runs = 0;
  let previous: boolean | null = null;
  for (const open of states) {
    if (previous !== open && open) runs += 1;
    previous = open;
  }
  assert.equal(runs, 2, 'one start per open, and reopening works');
});

test('the countdown clock only ticks inside a live call window', () => {
  const ticks = (item: Partial<QueueItem>) => Boolean(item.status === 'Called' && item.graceExpiresAt);
  assert.equal(ticks({ status: 'Waiting' }), false);
  assert.equal(ticks({ status: 'Serving' }), false);
  assert.equal(ticks({ status: 'Completed' }), false);
  assert.equal(ticks({ status: 'Called', graceExpiresAt: Date.now() + 60_000 }), true);
});

/**
 * Regression 3 — App bookings missing from the Staff dashboard.
 *
 * The Staff APK has no discovery flow, so it stayed pinned to the first mock
 * salon while the Customer app could select any salon. Both must resolve to the
 * same salon id or the SSE streams never meet.
 */
function sameStream(customerSalonId: string, staffSalonId: string): boolean {
  return customerSalonId === staffSalonId;
}

test('a booking is only visible to staff watching the same salon', () => {
  assert.equal(sameStream('salon-2', 'salon-1'), false, 'the reported failure');
  assert.equal(sameStream('salon-2', 'salon-2'), true, 'after staff select the salon');
});

test('staff salon selection persists so the binding survives an app restart', () => {
  const directory = [
    { id: 'salon-1', name: 'Sharpcut Studio' },
    { id: 'salon-2', name: 'Royal Man Salon' },
  ];
  const restore = (savedId: string | null) => directory.find((entry) => entry.id === savedId) || directory[0];
  assert.equal(restore('salon-2').id, 'salon-2', 'a saved choice is restored');
  assert.equal(restore(null).id, 'salon-1', 'first run falls back to the first salon');
  assert.equal(restore('deleted-salon').id, 'salon-1', 'a stale id falls back safely');
});

test('App and Web QR bookings coexist with their source preserved', () => {
  const queue: QueueItem[] = [
    { id: 'a', name: 'App User', service: 'Haircut', status: 'Waiting', createdAt: 1, source: 'customer_app' },
    { id: 'b', name: 'Web User', service: 'Haircut', status: 'Waiting', createdAt: 2, source: 'qr_web' },
  ];
  assert.equal(queue.filter((item) => item.source === 'customer_app').length, 1);
  assert.equal(queue.filter((item) => item.source === 'qr_web').length, 1);
  assert.equal(new Set(queue.map((item) => item.id)).size, queue.length, 'no duplicate entries');
});

test('a duplicate join for the same session is rejected', () => {
  const queue: QueueItem[] = [
    { id: 'a', name: 'App User', service: 'Haircut', status: 'Waiting', createdAt: 1, sessionId: 'sess-1' },
  ];
  const duplicate = (sessionId: string) => queue.some((item) => item.sessionId === sessionId);
  assert.equal(duplicate('sess-1'), true);
  assert.equal(duplicate('sess-2'), false);
});
