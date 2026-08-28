import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDeckTarget } from './FloatingCategoryDeck';

test('slow horizontal drag snaps to the nearest category', () => {
  assert.equal(resolveDeckTarget(0, -66, 0, 100, 7), 1);
  assert.equal(resolveDeckTarget(2, 38, 0, 100, 7), 2);
});

test('fast flick projects velocity before choosing its snap', () => {
  assert.equal(resolveDeckTarget(1, -18, -0.72, 100, 7), 2);
  assert.equal(resolveDeckTarget(3, 12, 0.8, 100, 7), 2);
});

test('release projection never moves beyond the category range', () => {
  assert.equal(resolveDeckTarget(0, 240, 1.4, 100, 7), 0);
  assert.equal(resolveDeckTarget(6, -240, -1.4, 100, 7), 6);
});
