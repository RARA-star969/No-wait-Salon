import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveCrowdStatus } from './crowdStatus';

test('a long wait is Busy even with a small tracked queue', () => {
  assert.equal(deriveCrowdStatus({ liveWaitMinutes: 25, waitingCustomers: 1 }).level, 'busy');
});

test('a large queue is Busy even with a short reported wait', () => {
  assert.equal(deriveCrowdStatus({ liveWaitMinutes: 5, waitingCustomers: 7 }).level, 'busy');
});

test('a medium wait with no queue data is Moderate', () => {
  assert.equal(deriveCrowdStatus({ liveWaitMinutes: 10 }).level, 'moderate');
});

test('a medium queue size is Moderate', () => {
  assert.equal(deriveCrowdStatus({ liveWaitMinutes: 2, waitingCustomers: 4 }).level, 'moderate');
});

test('no wait and no queue is Low crowd', () => {
  const status = deriveCrowdStatus({ liveWaitMinutes: 0, waitingCustomers: 0 });
  assert.equal(status.level, 'low');
  assert.equal(status.label, 'Low crowd');
});

test('a short wait with queue data omitted is Low crowd', () => {
  assert.equal(deriveCrowdStatus({ liveWaitMinutes: 4 }).level, 'low');
});

test('the boundary wait value itself is Busy, not Moderate', () => {
  assert.equal(deriveCrowdStatus({ liveWaitMinutes: 20 }).level, 'busy');
});
