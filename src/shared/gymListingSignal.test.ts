import test from 'node:test';
import assert from 'node:assert/strict';
import { gymListingSignal } from './gymListingSignal.ts';

test('Gym Listing Signal', async (t) => {
  await t.test('Low crowd level maps to green/Light Crowd', () => {
    const signal = gymListingSignal('Low');
    assert.equal(signal.color, 'green');
    assert.equal(signal.label, 'Light Crowd');
  });

  await t.test('Moderate maps to yellow/Moderate', () => {
    assert.deepEqual(gymListingSignal('Moderate'), { color: 'yellow', label: 'Moderate' });
  });

  await t.test('Busy maps to orange/Busy', () => {
    assert.deepEqual(gymListingSignal('Busy'), { color: 'orange', label: 'Busy' });
  });

  await t.test('Very Busy and Full both map to red, with distinct labels', () => {
    const veryBusy = gymListingSignal('Very Busy');
    const full = gymListingSignal('Full');
    assert.equal(veryBusy.color, 'red');
    assert.equal(full.color, 'red');
    assert.equal(veryBusy.label, 'Near Full');
    assert.equal(full.label, 'Full');
  });
});
