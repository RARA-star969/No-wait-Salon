import test from 'node:test';
import assert from 'node:assert/strict';
import { gymListingSignal } from './gymListingSignal.ts';

test('Gym Listing Signal', async (t) => {
  await t.test('Low crowd level maps to green/Quiet', () => {
    const signal = gymListingSignal('Low');
    assert.equal(signal.color, 'green');
    assert.equal(signal.label, 'Quiet');
  });

  await t.test('Moderate maps to yellow/Moderate', () => {
    assert.deepEqual(gymListingSignal('Moderate'), { color: 'yellow', label: 'Moderate' });
  });

  await t.test('Busy maps to red/Busy', () => {
    assert.deepEqual(gymListingSignal('Busy'), { color: 'red', label: 'Busy' });
  });

  await t.test('Very Busy and Full both retain the compact red/Busy presentation', () => {
    const veryBusy = gymListingSignal('Very Busy');
    const full = gymListingSignal('Full');
    assert.equal(veryBusy.color, 'red');
    assert.equal(full.color, 'red');
    assert.equal(veryBusy.label, 'Busy');
    assert.equal(full.label, 'Busy');
  });
});
