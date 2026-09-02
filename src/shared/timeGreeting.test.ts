import assert from 'node:assert/strict';
import test from 'node:test';
import { getTimeBasedGreeting, formatCustomerGreeting } from './timeGreeting';

test('Time-based greeting logic', async (t) => {
  await t.test('returns Good Morning in the morning (4:00 - 11:59)', () => {
    const d4 = new Date(2026, 8, 2, 4, 0, 0);
    const d8 = new Date(2026, 8, 2, 8, 30, 0);
    const d11 = new Date(2026, 8, 2, 11, 59, 59);
    assert.equal(getTimeBasedGreeting(d4), 'Good Morning');
    assert.equal(getTimeBasedGreeting(d8), 'Good Morning');
    assert.equal(getTimeBasedGreeting(d11), 'Good Morning');
  });

  await t.test('returns Good Afternoon in the afternoon (12:00 - 16:59)', () => {
    const d12 = new Date(2026, 8, 2, 12, 0, 0);
    const d14 = new Date(2026, 8, 2, 14, 15, 0);
    const d16 = new Date(2026, 8, 2, 16, 59, 59);
    assert.equal(getTimeBasedGreeting(d12), 'Good Afternoon');
    assert.equal(getTimeBasedGreeting(d14), 'Good Afternoon');
    assert.equal(getTimeBasedGreeting(d16), 'Good Afternoon');
  });

  await t.test('returns Good Evening in the evening & night (17:00 - 3:59)', () => {
    const d17 = new Date(2026, 8, 2, 17, 0, 0);
    const d20 = new Date(2026, 8, 2, 20, 45, 0);
    const d23 = new Date(2026, 8, 2, 23, 59, 0);
    const d0 = new Date(2026, 8, 2, 0, 0, 0);
    const d3 = new Date(2026, 8, 2, 3, 59, 59);
    assert.equal(getTimeBasedGreeting(d17), 'Good Evening');
    assert.equal(getTimeBasedGreeting(d20), 'Good Evening');
    assert.equal(getTimeBasedGreeting(d23), 'Good Evening');
    assert.equal(getTimeBasedGreeting(d0), 'Good Evening');
    assert.equal(getTimeBasedGreeting(d3), 'Good Evening');
  });

  await t.test('formats greeting with customer first name when known', () => {
    const morning = new Date(2026, 8, 2, 9, 0, 0);
    assert.equal(formatCustomerGreeting('Ritik Singh', morning), 'Good Morning, Ritik');
    assert.equal(formatCustomerGreeting('Priya', morning), 'Good Morning, Priya');
  });

  await t.test('does not use dummy names when customer name is missing/empty', () => {
    const evening = new Date(2026, 8, 2, 19, 0, 0);
    assert.equal(formatCustomerGreeting(null, evening), 'Good Evening');
    assert.equal(formatCustomerGreeting(undefined, evening), 'Good Evening');
    assert.equal(formatCustomerGreeting('', evening), 'Good Evening');
    assert.equal(formatCustomerGreeting('   ', evening), 'Good Evening');
    assert.doesNotMatch(formatCustomerGreeting('', evening), /Alex/i);
  });
});
