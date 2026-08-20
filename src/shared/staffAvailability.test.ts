import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isOnDutyToday, selectableStylists, stylistLiveStatus } from './staffAvailability';

test('a barber with no workingToday opinion reads as on duty (backward compatible)', () => {
  assert.equal(isOnDutyToday({}), true);
  assert.equal(isOnDutyToday({ workingToday: undefined }), true);
});

test('workingToday: false takes the barber off duty regardless of status', () => {
  assert.equal(isOnDutyToday({ workingToday: false }), false);
  assert.equal(stylistLiveStatus({ status: 'available', workingToday: false }), 'unavailable');
});

test('an on-duty barber maps status to the live pill', () => {
  assert.equal(stylistLiveStatus({ status: 'available' }), 'free');
  assert.equal(stylistLiveStatus({ status: 'busy' }), 'with_customer');
  assert.equal(stylistLiveStatus({ status: 'unavailable' }), 'unavailable');
});

test('selectableStylists drops anyone who reads as unavailable, on duty or not', () => {
  const barbers = [
    { id: 'a', name: 'A', status: 'available' as const },
    { id: 'b', name: 'B', status: 'busy' as const },
    { id: 'c', name: 'C', status: 'unavailable' as const },
    { id: 'd', name: 'D', status: 'available' as const, workingToday: false },
  ];
  assert.deepEqual(selectableStylists(barbers).map((b) => b.id), ['a', 'b']);
});
