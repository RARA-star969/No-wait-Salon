import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDurationLabel } from './durationFormat';

test('formats minutes under an hour', () => {
  assert.equal(formatDurationLabel(45), '45 min');
  assert.equal(formatDurationLabel(0), '0 min');
});

test('formats whole hours without a minutes remainder', () => {
  assert.equal(formatDurationLabel(60), '1 hr');
  assert.equal(formatDurationLabel(120), '2 hr');
});

test('formats hours with a minutes remainder', () => {
  assert.equal(formatDurationLabel(75), '1 hr 15 min');
  assert.equal(formatDurationLabel(130), '2 hr 10 min');
});

test('clamps negative or non-numeric input to zero', () => {
  assert.equal(formatDurationLabel(-10), '0 min');
  assert.equal(formatDurationLabel(NaN), '0 min');
});
