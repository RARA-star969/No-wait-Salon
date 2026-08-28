import test from 'node:test';
import assert from 'node:assert/strict';
import { salonListingPositionLabel } from './liveQueueDisplayMetrics.ts';

test('Salon Listing Position Label', async (t) => {
  await t.test('no one waiting and a chair open returns null (no wait to report)', () => {
    assert.equal(salonListingPositionLabel(0, 1), null);
  });

  await t.test('one person ahead with a chair opening returns "next"', () => {
    assert.equal(salonListingPositionLabel(1, 1), "You'd be next");
  });

  await t.test('several people waiting returns an estimated numbered position', () => {
    assert.equal(salonListingPositionLabel(2, 0), "You'd be #3");
    assert.equal(salonListingPositionLabel(5, 0), "You'd be #6");
  });

  await t.test('never claims a reserved position — always "You\'d be", never "Your position"', () => {
    const label = salonListingPositionLabel(3, 0);
    assert.ok(label?.startsWith("You'd be"));
  });
});
