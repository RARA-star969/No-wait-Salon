import assert from 'node:assert/strict';
import test from 'node:test';
import { customerLocalGreeting } from './customerHomePersonalization.ts';

const localTime = (hour: number) => {
  const date = new Date(2026, 8, 2, hour, 0, 0);
  return date;
};

test('customer-local greeting covers morning, afternoon, and evening boundaries', () => {
  assert.deepEqual(customerLocalGreeting(localTime(5)), { period: 'morning', text: 'Good Morning', icon: 'sun' });
  assert.deepEqual(customerLocalGreeting(localTime(12)), { period: 'afternoon', text: 'Good Afternoon', icon: 'sun' });
  assert.deepEqual(customerLocalGreeting(localTime(17)), { period: 'evening', text: 'Good Evening', icon: 'moon' });
  assert.deepEqual(customerLocalGreeting(localTime(2)), { period: 'evening', text: 'Good Evening', icon: 'moon' });
});

test('greeting uses only a real first name when present', () => {
  assert.equal(customerLocalGreeting(localTime(9), '  Ritik Singh  ').text, 'Good Morning, Ritik');
});

test('greeting omits the name cleanly when unavailable and never inserts a dummy name', () => {
  for (const missing of [undefined, null, '', '   ']) {
    const text = customerLocalGreeting(localTime(14), missing).text;
    assert.equal(text, 'Good Afternoon');
    assert.doesNotMatch(text, /Alex|Customer User/);
  }
});
