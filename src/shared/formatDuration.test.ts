import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDuration } from './formatDuration.ts';

test('1 minute reads as a plain minute count', () => {
  assert.equal(formatDuration(1), '1 min');
});

test('exactly 60 minutes stays in the minutes bucket, never "1 hr"', () => {
  assert.equal(formatDuration(60), '60 min');
});

test('61 minutes crosses into hours, with the leftover minute kept', () => {
  assert.equal(formatDuration(61), '1 hr 1 min');
});

test('75 minutes is 1 hr 15 min', () => {
  assert.equal(formatDuration(75), '1 hr 15 min');
});

test('an even multiple of an hour omits the minutes clause', () => {
  assert.equal(formatDuration(120), '2 hr');
});

test('160 minutes is 2 hr 40 min', () => {
  assert.equal(formatDuration(160), '2 hr 40 min');
});

test('719 minutes stays in the hours format, just under 12 hr', () => {
  assert.equal(formatDuration(719), '11 hr 59 min');
});

test('720 minutes (12 hr) still reads as a plain hour count', () => {
  assert.equal(formatDuration(720), '12 hr');
});

test('a full day (1440 minutes) reads as "1 day"', () => {
  assert.equal(formatDuration(1440), '1 day');
});

test('a day plus a couple hours keeps the hours clause', () => {
  assert.equal(formatDuration(1560), '1 day 2 hr');
});

test('multiple days with no leftover hours omits the hours clause', () => {
  assert.equal(formatDuration(2880), '2 day');
});

test('zero minutes is treated as no duration, not negative or NaN', () => {
  assert.equal(formatDuration(0), '0 min');
});

test('a fractional minute value is rounded before formatting', () => {
  assert.equal(formatDuration(90.6), '1 hr 31 min');
});
