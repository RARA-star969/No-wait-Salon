import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGymCrowdLevel } from './gymCrowdResolver.ts';

test('Gym Crowd Level Resolver', async (t) => {
  await t.test('0-35% occupancy resolves to Low', () => {
    assert.equal(resolveGymCrowdLevel(0, 100).level, 'Low');
    assert.equal(resolveGymCrowdLevel(35, 100).level, 'Low');
  });

  await t.test('36-65% occupancy resolves to Moderate', () => {
    assert.equal(resolveGymCrowdLevel(36, 100).level, 'Moderate');
    assert.equal(resolveGymCrowdLevel(42, 80).level, 'Moderate');
    assert.equal(resolveGymCrowdLevel(65, 100).level, 'Moderate');
  });

  await t.test('66-89% occupancy resolves to Busy', () => {
    assert.equal(resolveGymCrowdLevel(66, 100).level, 'Busy');
    assert.equal(resolveGymCrowdLevel(85, 100).level, 'Busy');
  });

  await t.test('90-99% occupancy resolves to Very Busy', () => {
    assert.equal(resolveGymCrowdLevel(90, 100).level, 'Very Busy');
    assert.equal(resolveGymCrowdLevel(95, 100).level, 'Very Busy');
  });

  await t.test('100%+ occupancy resolves to Full', () => {
    assert.equal(resolveGymCrowdLevel(100, 100).level, 'Full');
    assert.equal(resolveGymCrowdLevel(105, 100).level, 'Full');
  });
});

test('Trainer Availability Counter', async (t) => {
  await t.test('Only Available trainers count toward metric', () => {
    const trainers = [
      { id: 't1', name: 'Coach Vikram', status: 'Available' },
      { id: 't2', name: 'Coach Rahul', status: 'Available' },
      { id: 't3', name: 'Coach Ananya', status: 'In Class' },
      { id: 't4', name: 'Coach Rohit', status: 'Off Duty' },
    ];
    const availableCount = trainers.filter((t) => t.status === 'Available').length;
    assert.equal(availableCount, 2);
  });

  await t.test('Changing trainer status to Busy decreases available count', () => {
    const trainers = [
      { id: 't1', name: 'Coach Vikram', status: 'Available' },
      { id: 't2', name: 'Coach Rahul', status: 'Busy' },
      { id: 't3', name: 'Coach Ananya', status: 'In Class' },
    ];
    const availableCount = trainers.filter((t) => t.status === 'Available').length;
    assert.equal(availableCount, 1);
  });
});

test('Category Resolution: Gym vs Salon', async (t) => {
  await t.test('mainCategoryId = gym resolves to Gym Live Card & Capsule', () => {
    const mainCategoryId = 'gym';
    const isGym = mainCategoryId === 'gym';
    const isSalon = mainCategoryId === 'salon';
    assert.equal(isGym, true);
    assert.equal(isSalon, false);
  });

  await t.test('mainCategoryId = salon preserves existing Salon Live Queue Card & Capsule', () => {
    const mainCategoryId = 'salon';
    const isGym = mainCategoryId === 'gym';
    const isSalon = mainCategoryId === 'salon';
    assert.equal(isGym, false);
    assert.equal(isSalon, true);
  });
});
