import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { QueueItem } from '../src/types.ts';
import { bookingCardState, maskedPhone, sourceBadge } from '../src/shared/queueCardState.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative: string) => readFileSync(path.join(projectRoot, relative), 'utf8');

const T0 = 1_700_000_000_000;
const GRACE = 7 * 60_000;

const item = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: 'q1', name: 'Aman Verma', service: 'Haircut', status: 'Waiting', createdAt: T0, ...overrides,
});
const called = (overrides: Partial<QueueItem> = {}): QueueItem =>
  item({ status: 'Called', calledAt: T0, graceExpiresAt: T0 + GRACE, callAttempt: 1, barberName: 'Arjun', ...overrides });

const ids = (state: ReturnType<typeof bookingCardState>) => state.actions.map((action) => action.id);

/* ------------------------------- WAITING -------------------------------- */

test('a waiting booking offers Call, Start and remove — and never Cancel Chair', () => {
  const state = bookingCardState(item(), T0);
  assert.equal(state.kind, 'waiting');
  assert.equal(state.statusLabel, 'WAITING');
  assert.deepEqual(ids(state), ['call', 'start', 'remove']);
  assert.equal(ids(state).includes('cancel_chair'), false, 'the trash action already covers removal here');
  assert.equal(state.timerLabel, undefined, 'nothing is counting down yet');
});

test('removal on a waiting card is the icon-only action, so it never crowds the row', () => {
  const state = bookingCardState(item(), T0);
  const remove = state.actions.find((action) => action.id === 'remove')!;
  assert.equal(remove.iconOnly, true);
  assert.equal(state.actions.filter((action) => !action.iconOnly).length, 2, 'two labelled buttons only');
});

/* --------------------- CALLED, arrival window running -------------------- */

test('while the arrival window runs, only Start Service and Cancel Chair are offered', () => {
  const state = bookingCardState(called(), T0 + 36_000);
  assert.equal(state.kind, 'called_active');
  assert.equal(state.statusLabel, 'CALLED');
  assert.deepEqual(ids(state), ['start', 'cancel_chair']);
  assert.equal(ids(state).includes('call_again'), false, 'Call Again stays locked until the deadline passes');
  assert.equal(ids(state).includes('no_show'), false, 'No-show stays locked until the deadline passes');
});

test('the running countdown is its own label, not mixed into the status chip', () => {
  const state = bookingCardState(called(), T0 + 36_000);
  assert.equal(state.timerLabel, '06:24 remaining');
  assert.equal(state.statusLabel, 'CALLED', 'the chip carries the state, the timer carries the time');
  assert.deepEqual(state.detailLines, ['Called for: Arjun']);
});

test('a called booking with no stylist simply omits that line', () => {
  const state = bookingCardState(called({ barberName: undefined }), T0 + 1000);
  assert.deepEqual(state.detailLines, []);
});

/* ------------------------- CALLED, window expired ------------------------ */

test('an expired arrival window drops the redundant CALLED pill for an informational status', () => {
  const state = bookingCardState(called(), T0 + GRACE + 1000);
  assert.equal(state.kind, 'call_expired');
  assert.equal(state.statusLabel, 'ARRIVAL WINDOW ENDED');
  assert.notEqual(state.statusLabel, 'CALLED');
  assert.equal(state.timerLabel, undefined, 'no countdown once the window has ended');
  assert.deepEqual(state.detailLines, ['Call attempt 1', 'Called for: Arjun']);
});

test('an expired window unlocks all four decisions, in priority order', () => {
  const state = bookingCardState(called({ callAttempt: 2 }), T0 + GRACE + 1000);
  assert.deepEqual(ids(state), ['call_again', 'start', 'cancel_chair', 'no_show']);

  const tones = Object.fromEntries(state.actions.map((action) => [action.id, action.tone]));
  assert.equal(tones.call_again, 'primary');
  assert.equal(tones.start, 'primary');
  assert.equal(tones.cancel_chair, 'secondary');
  assert.equal(tones.no_show, 'destructive');
  assert.deepEqual(state.detailLines[0], 'Call attempt 2');
});

/* -------------------------------- SERVING -------------------------------- */

test('a booking in the chair offers exactly one action, Complete', () => {
  const state = bookingCardState(item({ status: 'Serving', barberName: 'Sameer' }), T0);
  assert.equal(state.kind, 'serving');
  assert.equal(state.statusLabel, 'SERVING');
  assert.deepEqual(ids(state), ['complete']);
  assert.deepEqual(state.detailLines, ['With Sameer']);
  for (const forbidden of ['call', 'call_again', 'cancel_chair', 'no_show']) {
    assert.equal(ids(state).includes(forbidden as never), false, `${forbidden} is not offered during service`);
  }
});

test('the Complete button is labelled "Complete", not "Finish / Complete"', () => {
  const state = bookingCardState(item({ status: 'Serving' }), T0);
  assert.equal(state.actions[0].label, 'Complete');
  const card = source('src/components/QueueBookingCard.tsx');
  assert.doesNotMatch(card, /Finish \/ Complete/);
});

/* ------------------------------- RESERVED -------------------------------- */

test('a reservation keeps its existing check-in path', () => {
  const state = bookingCardState(item({ status: 'Reserved', reservedFor: '5:30 PM' }), T0);
  assert.equal(state.kind, 'reserved');
  assert.deepEqual(ids(state), ['call', 'start']);
  assert.deepEqual(state.detailLines, ['Reserved for 5:30 PM']);
});

/* ------------------------- Badges and long values ------------------------ */

test('source badges stay short and distinct', () => {
  assert.equal(sourceBadge(item({ source: 'customer_app' })), 'APP');
  assert.equal(sourceBadge(item({ source: 'qr_web' })), 'WEB QR');
  assert.equal(sourceBadge(item({ source: 'qr_walk_in' })), 'QR WALK-IN');
  assert.equal(sourceBadge(item({ source: 'staff_walk_in' })), 'WALK-IN');
  assert.equal(sourceBadge(item()), 'APP', 'an unset source reads as the app');
});

test('phone numbers are masked to the last four digits', () => {
  assert.equal(maskedPhone('9876543210'), '•••• 3210');
  assert.equal(maskedPhone('+91 98765 43210'), '•••• 3210');
  assert.equal(maskedPhone(''), '');
  assert.equal(maskedPhone(undefined), '');
});

/* ----------------------- Layout guarantees in markup --------------------- */

test('the card is a responsive grid, not one fixed horizontal row', () => {
  const card = source('src/components/QueueBookingCard.tsx');
  assert.match(card, /grid gap-3 sm:grid-cols-\[minmax\(0,1fr\)_auto\]/, 'identity column can shrink, actions keep their width');
  assert.match(card, /flex flex-wrap items-center gap-2/, 'actions wrap rather than overlap');
  assert.match(card, /h-9/, 'buttons share one height');
});

test('long names and services are truncated instead of breaking the layout', () => {
  const card = source('src/components/QueueBookingCard.tsx');
  const truncations = card.match(/truncate/g) || [];
  assert.ok(truncations.length >= 3, 'name, service and detail lines all truncate');
  assert.match(card, /min-w-0/, 'flex children may shrink below their content width');
});

test('the live queue renders through the shared card, with no inline copy left behind', () => {
  const dashboard = source('src/components/StaffDashboard.tsx');
  assert.match(dashboard, /<QueueBookingCard/);
  assert.doesNotMatch(dashboard, /action-cancelchair-waiting-/, 'the old waiting-state Cancel Chair is gone');
  assert.doesNotMatch(dashboard, /Finish \/ Complete/);
});
