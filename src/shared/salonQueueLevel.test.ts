import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSalonQueueSignal } from './salonQueueLevel.ts';

test('Salon Queue Signal Resolver', async (t) => {
  await t.test('zero waiting resolves to green/Low Wait', () => {
    const signal = resolveSalonQueueSignal(0);
    assert.equal(signal.color, 'green');
    assert.equal(signal.label, 'Low Wait');
  });

  await t.test('1-2 waiting resolves to yellow/Moderate', () => {
    assert.equal(resolveSalonQueueSignal(1).color, 'yellow');
    assert.equal(resolveSalonQueueSignal(2).color, 'yellow');
    assert.equal(resolveSalonQueueSignal(2).label, 'Moderate');
  });

  await t.test('3-5 waiting resolves to orange/Busy', () => {
    assert.equal(resolveSalonQueueSignal(3).color, 'orange');
    assert.equal(resolveSalonQueueSignal(5).color, 'orange');
    assert.equal(resolveSalonQueueSignal(5).label, 'Busy');
  });

  await t.test('6+ waiting resolves to red/Busy', () => {
    assert.equal(resolveSalonQueueSignal(6).color, 'red');
    assert.equal(resolveSalonQueueSignal(20).color, 'red');
    assert.equal(resolveSalonQueueSignal(6).label, 'Busy');
  });
});
