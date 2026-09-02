import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQueueInsight, DEMO_QUEUE_INSIGHT } from './queueInsight';

test('returns null when there is no input', () => {
  assert.equal(resolveQueueInsight(null), null);
  assert.equal(resolveQueueInsight(undefined), null);
});

test('returns null when hourly load or range label is missing', () => {
  assert.equal(resolveQueueInsight({ rangeLabel: null, hourlyLoad: [1, 2, 3] }), null);
  assert.equal(resolveQueueInsight({ rangeLabel: '5 PM – 6 PM', hourlyLoad: null }), null);
  assert.equal(resolveQueueInsight({ rangeLabel: '5 PM – 6 PM', hourlyLoad: [1] }), null);
});

test('resolves a live insight and derives the ideal index from peak load when unset', () => {
  const insight = resolveQueueInsight({ rangeLabel: '5 PM – 6 PM', hourlyLoad: [1, 5, 2] });
  assert.ok(insight);
  assert.equal(insight?.source, 'live');
  assert.equal(insight?.idealIndex, 1);
});

test('honors an explicit ideal index within range', () => {
  const insight = resolveQueueInsight({ rangeLabel: '5 PM – 6 PM', hourlyLoad: [1, 5, 2], idealIndex: 0 });
  assert.equal(insight?.idealIndex, 0);
});

test('falls back to the peak-load index when the explicit ideal index is out of range', () => {
  const insight = resolveQueueInsight({ rangeLabel: '5 PM – 6 PM', hourlyLoad: [1, 5, 2], idealIndex: 9 });
  assert.equal(insight?.idealIndex, 1);
});

test('demo insight is explicitly tagged as demo, never live', () => {
  assert.equal(DEMO_QUEUE_INSIGHT.source, 'demo');
  assert.ok(DEMO_QUEUE_INSIGHT.hourlyLoad.length >= 2);
});
