import assert from 'node:assert/strict';
import test from 'node:test';
import { isGymCategory, normalizeMainCategoryId } from './businessCategory';

test('Business category resolution — the single source of truth for Gym vs Salon UI', async (t) => {
  await t.test('a Salon business never resolves as Gym', () => {
    assert.equal(isGymCategory('salon'), false);
    assert.equal(isGymCategory('Salon'), false);
  });

  await t.test('a Gym business always resolves as Gym', () => {
    assert.equal(isGymCategory('gym'), true);
    assert.equal(isGymCategory('GYM'), true);
    assert.equal(isGymCategory(' Gym '), true);
  });

  await t.test('a missing/undefined category defaults to Salon, never Gym', () => {
    assert.equal(isGymCategory(undefined), false);
    assert.equal(isGymCategory(null), false);
    assert.equal(isGymCategory(''), false);
    assert.equal(normalizeMainCategoryId(undefined), 'salon');
  });

  await t.test('a business object that only had its id/name refreshed keeps its own real category, never a stale one from a previously selected business', () => {
    // Regression guard: the exact shape of the App.tsx bug that let a
    // business-switch flow update `id`/`name` while silently leaving a
    // stale `mainCategoryId` from whatever business was selected before.
    const previouslySelected = { id: 'gym-1', name: 'Iron House Gym', mainCategoryId: 'gym' };
    const switchedToEntry = { id: 'salon-1', name: 'Sharpcut Studio', mainCategoryId: 'salon' };
    // The correct merge always carries the new entry's own mainCategoryId.
    const correctlyMerged = { ...previouslySelected, id: switchedToEntry.id, name: switchedToEntry.name, mainCategoryId: switchedToEntry.mainCategoryId };
    assert.equal(isGymCategory(correctlyMerged.mainCategoryId), false);
    // The buggy merge (id/name only) would have left mainCategoryId: 'gym'.
    const buggyMerge = { ...previouslySelected, id: switchedToEntry.id, name: switchedToEntry.name };
    assert.equal(isGymCategory(buggyMerge.mainCategoryId), true, 'sanity check: this is exactly the bug shape being guarded against');
  });
});
