import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDurationLabel, formatDurationRangeLabel } from './durationFormat';

test('formats minutes under an hour', () => {
  assert.equal(formatDurationLabel(45), '45 min');
  assert.equal(formatDurationLabel(0), '0 min');
});

test('formats whole hours without a minutes remainder', () => {
  assert.equal(formatDurationLabel(60), '1 hr');
  assert.equal(formatDurationLabel(120), '2 hr');
});

test('formats hours with a minutes remainder with 2-digit padding', () => {
  assert.equal(formatDurationLabel(75), '1 hr 15 min');
  assert.equal(formatDurationLabel(65), '1 hr 05 min');
  assert.equal(formatDurationLabel(125), '2 hr 05 min');
  assert.equal(formatDurationLabel(130), '2 hr 10 min');
});

test('formats duration ranges correctly', () => {
  assert.equal(formatDurationRangeLabel(15, 25), '15–25 min');
  assert.equal(formatDurationRangeLabel(53, 63), '53 min – 1 hr 03 min');
  assert.equal(formatDurationRangeLabel(130, 140), '2 hr 10 min – 2 hr 20 min');
});

test('clamps negative or non-numeric input to zero', () => {
  assert.equal(formatDurationLabel(-10), '0 min');
  assert.equal(formatDurationLabel(NaN), '0 min');
});

test('12+ hours drops the minutes remainder', () => {
  assert.equal(formatDurationLabel(720), '12 hr');
  assert.equal(formatDurationLabel(725), '12 hr');
  assert.equal(formatDurationLabel(23 * 60 + 40), '23 hr');
});

test('24+ hours converts to days', () => {
  assert.equal(formatDurationLabel(1440), '1 day');
  assert.equal(formatDurationLabel(1440 + 120), '1 day 2 hr');
  assert.equal(formatDurationLabel(2 * 1440), '2 days');
});
