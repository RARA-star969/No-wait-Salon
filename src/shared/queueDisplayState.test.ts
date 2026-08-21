import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveQueueDisplayState } from './queueDisplayState';

test('normal waiting: shows numeric wait time and Join Queue', () => {
  const result = deriveQueueDisplayState(4, 0);
  assert.equal(result.state, 'waiting');
  assert.equal(result.ctaLabel, 'Join Queue');
});

test('zero people ahead with no ready chair still waits (chair not actually free)', () => {
  const result = deriveQueueDisplayState(0, 0);
  assert.equal(result.state, 'waiting');
  assert.equal(result.ctaLabel, 'Join Queue');
});

test('case A: one person ahead + a ready chair is "your turn"', () => {
  const result = deriveQueueDisplayState(1, 1);
  assert.equal(result.state, 'your_turn');
  assert.equal(result.ctaLabel, 'Book Seat');
});

test('case B: zero people ahead + a ready chair is "ready now" (#1)', () => {
  const result = deriveQueueDisplayState(0, 2);
  assert.equal(result.state, 'ready_now');
  assert.equal(result.ctaLabel, 'Book Seat');
});

test('case C: two or more people ahead is always normal waiting, even with ready chairs', () => {
  const result = deriveQueueDisplayState(2, 3);
  assert.equal(result.state, 'waiting');
  assert.equal(result.ctaLabel, 'Join Queue');
});
