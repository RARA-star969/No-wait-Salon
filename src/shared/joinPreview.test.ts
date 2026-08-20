import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJoinPreview } from './joinPreview.ts';
import type { Barber, QueueItem } from '../types';

const barbers: Barber[] = [
  { id: 'b1', name: 'Arjun', status: 'available' },
  { id: 'b2', name: 'Vikram', status: 'busy' },
  { id: 'b3', name: 'Neha', status: 'unavailable' },
];

const waiting = (id: string, createdAt: number): QueueItem => ({
  id,
  name: id,
  service: 'Haircut',
  status: 'Waiting',
  createdAt,
});

test('an empty queue projects position one and no wait', () => {
  const preview = buildJoinPreview([], barbers);
  assert.equal(preview.peopleAhead, 0);
  assert.equal(preview.projectedPosition, 1);
  assert.equal(preview.estimatedWaitMinutes, 0);
});

test('people ahead only counts active statuses', () => {
  const queue: QueueItem[] = [
    waiting('q1', 1),
    { ...waiting('q2', 2), status: 'Completed' },
    { ...waiting('q3', 3), status: 'Cancelled' },
    { ...waiting('q4', 4), status: 'Called' },
  ];
  const preview = buildJoinPreview(queue, barbers);
  assert.equal(preview.peopleAhead, 2);
  assert.equal(preview.projectedPosition, 3);
});

test('open and working chairs reflect barber status, not just count', () => {
  const preview = buildJoinPreview([], barbers);
  assert.equal(preview.openChairs, 1);
  assert.equal(preview.workingChairs, 2);
});

test('an unavailable-only roster still reports at least one working chair', () => {
  const preview = buildJoinPreview([], [{ id: 'b1', name: 'Neha', status: 'unavailable' }]);
  assert.equal(preview.workingChairs, 1);
  assert.equal(preview.openChairs, 0);
});
