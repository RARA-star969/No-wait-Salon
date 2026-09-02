import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_HOME_CATEGORY_ORDER, normalizeHomeCategoryPreference } from './homeCategoryPreferenceService.ts';

const available = ['salon', 'gym', 'shop', 'clinic', 'spa', 'moto'];

test('category preferences keep real IDs, remove duplicates, and preserve pinned order', () => {
  assert.deepEqual(
    normalizeHomeCategoryPreference(['spa', 'gym', 'spa', 'fake-category'], available),
    ['spa', 'gym', 'salon', 'shop', 'clinic', 'moto'],
  );
});

test('category preferences fall back to the approved order and retain Explore All categories', () => {
  const result = normalizeHomeCategoryPreference([], available);
  assert.deepEqual(result.slice(0, 5), DEFAULT_HOME_CATEGORY_ORDER);
  assert.equal(result.at(-1), 'moto');
});

test('category visibility never invents IDs that are absent from authoritative categories', () => {
  assert.deepEqual(normalizeHomeCategoryPreference(['clinic', 'spa'], ['salon', 'gym']), ['salon', 'gym']);
});
