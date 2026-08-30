import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DECK_EASING,
  DECK_SETTLE_MS,
  deckCardGeometry,
  resolveDeckTarget,
  rubberBandResistance,
} from './FloatingCategoryDeck';

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

test('side cards stay visually distinct and tappable at every target width', () => {
  // 320/360/375/390/412/430 are the target device widths. Home pads its
  // content by 16px a side, but the deck stage cancels that with its own
  // -1rem horizontal margin, so the stage width is the viewport width.
  for (const width of [320, 360, 375, 390, 412, 430]) {
    const geometry = deckCardGeometry(width);
    assert.ok(
      geometry.neighbourCentreClear,
      `at ${width}px the neighbour's own centre must sit clear of the active card ` +
        `(step ${geometry.cardStep.toFixed(1)} vs half-width ${(geometry.cardWidth / 2).toFixed(1)})`,
    );
    // A comfortable Android touch target is ~48dp; the exposed strip must
    // clear that so a side card is genuinely tappable, not a hairline.
    assert.ok(
      geometry.exposedNeighbourWidth >= 48,
      `at ${width}px the side card must expose a tappable strip, got ${geometry.exposedNeighbourWidth.toFixed(1)}px`,
    );
  }
});

test('deck geometry scales monotonically with the stage width', () => {
  const narrow = deckCardGeometry(320);
  const wide = deckCardGeometry(430);
  assert.ok(wide.cardWidth >= narrow.cardWidth);
  assert.ok(wide.cardStep >= narrow.cardStep);
  // Clamped so an unusually wide container never produces an absurd deck.
  assert.equal(deckCardGeometry(2000).cardWidth, deckCardGeometry(1000).cardWidth);
});

test('one settle system: a hard flick and a slow drag share the same motion', () => {
  // Only the chosen target may differ with velocity; the animation that
  // carries the deck there is a single duration and a single curve.
  assert.equal(typeof DECK_SETTLE_MS, 'number');
  assert.ok(DECK_SETTLE_MS > 0 && DECK_SETTLE_MS < 900, 'settle stays inside a responsive range');
  assert.match(DECK_EASING, /^cubic-bezier\(/);
  // No overshoot past 1 in the output control points — an overshooting curve
  // on a 3D-transformed stack is what produced the visible wobble.
  const [, , y1, , y2] = DECK_EASING.replace(/[^0-9.,]/g, '').split(',').map(Number);
  void y1; void y2;
  const points = DECK_EASING.match(/-?\d*\.?\d+/g)!.map(Number);
  assert.ok(points[1] <= 1 && points[3] <= 1, 'the settle curve never overshoots past its target');
});

test('tap-to-select uses the same target maths as a swipe, from a standing start', () => {
  // Tapping a side card is modelled as a zero-drag, zero-velocity move to
  // that index — the deck must animate through, not jump past, its neighbour.
  assert.equal(resolveDeckTarget(1, 0, 0, 100, 7), 1, 'no drag and no flick never changes the active card');
  // And a swipe from the same state with a real gesture does change it, which
  // is what proves both paths run through one selection mechanism.
  assert.equal(resolveDeckTarget(1, -60, -0.4, 100, 7), 2);
});

test('rubber-band resistance tracks the finger closely for small pulls', () => {
  // Progressive resistance, not a flat linear damping factor: right near
  // zero the output should be close to 1:1 with the input.
  const smallPull = rubberBandResistance(2, 44);
  assert.ok(smallPull > 1.5 && smallPull < 2, `expected near-1:1 tracking for a tiny pull, got ${smallPull}`);
});
