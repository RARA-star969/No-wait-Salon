import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAIQueueInsight } from './aiQueueInsight';

test('resolves to unavailable when there is no input', () => {
  assert.deepEqual(resolveAIQueueInsight(null), { status: 'unavailable' });
  assert.deepEqual(resolveAIQueueInsight(undefined), { status: 'unavailable' });
});

test('resolves to unavailable when the range label or hourly load is missing', () => {
  assert.deepEqual(resolveAIQueueInsight({ rangeLabel: null, hourlyLoad: [1, 2, 3] }), { status: 'unavailable' });
  assert.deepEqual(resolveAIQueueInsight({ rangeLabel: '5 PM – 6 PM', hourlyLoad: null }), { status: 'unavailable' });
  assert.deepEqual(resolveAIQueueInsight({ rangeLabel: '5 PM – 6 PM', hourlyLoad: [1] }), { status: 'unavailable' });
});

test('resolves ready and derives the ideal index from peak load when unset', () => {
  const insight = resolveAIQueueInsight({ rangeLabel: '5 PM – 6 PM', hourlyLoad: [1, 5, 2] });
  assert.equal(insight.status, 'ready');
  assert.equal(insight.status === 'ready' && insight.idealIndex, 1);
});

test('honors an explicit ideal index within range', () => {
  const insight = resolveAIQueueInsight({ rangeLabel: '5 PM – 6 PM', hourlyLoad: [1, 5, 2], idealIndex: 0 });
  assert.equal(insight.status === 'ready' && insight.idealIndex, 0);
});

test('falls back to the peak-load index when the explicit ideal index is out of range', () => {
  const insight = resolveAIQueueInsight({ rangeLabel: '5 PM – 6 PM', hourlyLoad: [1, 5, 2], idealIndex: 9 });
  assert.equal(insight.status === 'ready' && insight.idealIndex, 1);
});
