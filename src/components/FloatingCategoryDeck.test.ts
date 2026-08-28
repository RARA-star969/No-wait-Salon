import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDeckTarget, rubberBandResistance } from './FloatingCategoryDeck';

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

test('velocity alone (zero drag distance) produces a progressively larger skip as speed increases', () => {
  // Same release point (dragX=0), only the speed of the flick differs —
  // this is the "velocity must matter" requirement: identical finger
  // position, increasingly different outcomes.
  assert.equal(resolveDeckTarget(3, 0, -0.2, 100, 7), 3, 'a slow flick barely projects past the release point');
  assert.equal(resolveDeckTarget(3, 0, -0.6, 100, 7), 4, 'a medium flick projects one category further');
  assert.equal(resolveDeckTarget(3, 0, -1.2, 100, 7), 5, 'a hard flick projects two categories further');
});

test('even an extreme velocity spike never skips more than 2 categories', () => {
  assert.equal(resolveDeckTarget(3, 0, -5, 100, 7), 5);
  assert.equal(resolveDeckTarget(3, 0, 5, 100, 7), 1);
});

test('rubber-band resistance is zero at rest and preserves the pull direction', () => {
  assert.equal(rubberBandResistance(0, 44), 0);
  assert.ok(rubberBandResistance(30, 44) > 0);
  assert.ok(rubberBandResistance(-30, 44) < 0);
});

test('rubber-band resistance grows with distance but stays under the visual cap', () => {
  const near = rubberBandResistance(20, 44);
  const far = rubberBandResistance(80, 44);
  assert.ok(far > near, 'further overscroll still moves the card further');
  assert.ok(far < 44, 'but never reaches, let alone exceeds, the configured cap');
  assert.ok(rubberBandResistance(5000, 44) <= 44, 'even a huge overscroll approaches the cap without crossing it');
});

test('rubber-band resistance tracks the finger closely for small pulls', () => {
  // Progressive resistance, not a flat linear damping factor: right near
  // zero the output should be close to 1:1 with the input.
  const smallPull = rubberBandResistance(2, 44);
  assert.ok(smallPull > 1.5 && smallPull < 2, `expected near-1:1 tracking for a tiny pull, got ${smallPull}`);
});
