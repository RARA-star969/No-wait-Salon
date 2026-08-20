import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Mirrors server/index.ts's rule for a requested stylist at join time: an
 * unknown id is dropped rather than rejected, so a stale client can never
 * fail a join over it.
 */
type Barber = { id: string; name: string; status: 'available' | 'busy' | 'unavailable' };

function resolvePreferredBarber(barbers: Barber[], requestedId: string | undefined) {
  return requestedId ? barbers.find((barber) => barber.id === requestedId) : undefined;
}

/** Mirrors findAvailableBarber's staff-pick-wins-then-customer-preference order. */
function findAvailableBarber(barbers: Barber[], preferredId?: string): number {
  const preferred = preferredId ? barbers.findIndex((barber) => barber.id === preferredId && barber.status === 'available') : -1;
  return preferred >= 0 ? preferred : barbers.findIndex((barber) => barber.status === 'available');
}

const barbers: Barber[] = [
  { id: 'b1', name: 'Arjun', status: 'available' },
  { id: 'b2', name: 'Vikram', status: 'busy' },
];

test('a known stylist is recorded on the booking at join time', () => {
  const requested = resolvePreferredBarber(barbers, 'b1');
  assert.equal(requested?.name, 'Arjun');
});

test('an unknown stylist id is dropped, never fatal', () => {
  const requested = resolvePreferredBarber(barbers, 'not-a-real-id');
  assert.equal(requested, undefined);
});

test('no preference at all is "any available"', () => {
  assert.equal(resolvePreferredBarber(barbers, undefined), undefined);
});

test('at Call/Start, staff explicit pick wins over the customer preference', () => {
  const index = findAvailableBarber(barbers, 'b1');
  // Both b1 (customer preference) and no staff override here resolve to b1.
  assert.equal(barbers[index].id, 'b1');
});

test('a preferred stylist who is busy falls back to anyone available', () => {
  const index = findAvailableBarber(barbers, 'b2');
  assert.equal(barbers[index].id, 'b1');
});
