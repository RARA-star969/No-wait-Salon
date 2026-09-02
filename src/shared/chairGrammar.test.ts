import assert from 'node:assert/strict';
import test from 'node:test';
import { formatChairCount } from './chairGrammar.ts';

test('chair grammar is singular for one and plural for every other count', () => {
  assert.equal(formatChairCount(1), '1 CHAIR');
  assert.equal(formatChairCount(0), '0 CHAIRS');
  assert.equal(formatChairCount(2), '2 CHAIRS');
});
