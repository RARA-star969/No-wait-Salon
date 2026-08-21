import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveLiveQueueMetrics } from './liveQueueMetrics.ts';
import type { Barber, QueueItem } from '../types';

const barbers: Barber[] = [
  { id: 'b1', name: 'Arjun', status: 'available' },
  { id: 'b2', name: 'Vikram', status: 'busy' },
  { id: 'b3', name: 'Neha', status: 'unavailable' },
];

const item = (id: string, status: QueueItem['status']): QueueItem => ({
  id,
  name: id,
  service: 'Haircut',
  status,
  createdAt: 1,
});

test('an empty queue has no wait and no one ahead', () => {
  const metrics = deriveLiveQueueMetrics([], barbers);
  assert.equal(metrics.waitingCount, 0);
  assert.equal(metrics.waitMinutes, 0);
});

test('only Waiting and Called count as ahead — Serving does not', () => {
  const queue: QueueItem[] = [item('q1', 'Waiting'), item('q2', 'Called'), item('q3', 'Serving'), item('q4', 'Completed')];
  const metrics = deriveLiveQueueMetrics(queue, barbers);
  assert.equal(metrics.waitingCount, 2);
});

test('active and available barbers are read from status, not just count', () => {
  const metrics = deriveLiveQueueMetrics([], barbers);
  assert.equal(metrics.activeBarbers, 2);
  assert.equal(metrics.availableBarbers, 1);
});

test('wait minutes split across active barbers, rounded up', () => {
  const queue: QueueItem[] = [item('q1', 'Waiting'), item('q2', 'Waiting'), item('q3', 'Called')];
  const metrics = deriveLiveQueueMetrics(queue, barbers);
  // 3 waiting * 15 min / 2 active barbers = 22.5 -> 23
  assert.equal(metrics.waitMinutes, 23);
  assert.equal(metrics.waitLabel, '23 min');
});

test('no active barbers means no computable wait, not a crash', () => {
  const queue: QueueItem[] = [item('q1', 'Waiting')];
  const metrics = deriveLiveQueueMetrics(queue, [{ id: 'b1', name: 'Neha', status: 'unavailable' }]);
  assert.equal(metrics.activeBarbers, 0);
  assert.equal(metrics.waitMinutes, 0);
});
