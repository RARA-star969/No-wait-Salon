import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLiveOperationalFields } from './nearbySalonsSync.ts';
import type { NearbySalon } from '../types.ts';

const base = (overrides: Partial<NearbySalon>): NearbySalon => ({
  id: 'gym-1',
  name: 'Iron House Gym',
  address: '100 Feet Road, Indiranagar',
  distanceKm: 0,
  rating: 4.9,
  reviewCount: 10,
  isOpen: true,
  services: [],
  defaultBarberCount: 0,
  latitude: 0,
  longitude: 0,
  openingHours: '',
  mainCategoryId: 'gym',
  travelTimeMinutes: 5,
  liveWaitMinutes: 0,
  waitingCustomers: 0,
  currentOccupancy: 0,
  maxCapacity: 80,
  ...overrides,
});

test('Nearby Salons Live Sync', async (t) => {
  await t.test('updates operational fields for a matching business', () => {
    const current = [base({ id: 'gym-1', currentOccupancy: 0 })];
    const fresh = [base({ id: 'gym-1', currentOccupancy: 5 })];
    const merged = mergeLiveOperationalFields(current, fresh);
    assert.equal(merged[0].currentOccupancy, 5);
  });

  await t.test('never reorders the current list, even if fresh data is in a different order', () => {
    const current = [base({ id: 'a', name: 'A' }), base({ id: 'b', name: 'B' })];
    const fresh = [base({ id: 'b', name: 'B', currentOccupancy: 3 }), base({ id: 'a', name: 'A', currentOccupancy: 7 })];
    const merged = mergeLiveOperationalFields(current, fresh);
    assert.deepEqual(merged.map((s) => s.id), ['a', 'b']);
    assert.equal(merged[0].currentOccupancy, 7);
    assert.equal(merged[1].currentOccupancy, 3);
  });

  await t.test('keeps a business missing from the fresh response, with its last known values', () => {
    const current = [base({ id: 'qr-business', name: 'QR Business', currentOccupancy: 12 })];
    const fresh: NearbySalon[] = [];
    const merged = mergeLiveOperationalFields(current, fresh);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].currentOccupancy, 12);
  });

  await t.test('does not touch identity fields like name or rating', () => {
    const current = [base({ id: 'gym-1', name: 'Iron House Gym', rating: 4.9 })];
    const fresh = [base({ id: 'gym-1', name: 'Renamed (should not apply)', rating: 1, currentOccupancy: 9 })];
    const merged = mergeLiveOperationalFields(current, fresh);
    assert.equal(merged[0].name, 'Iron House Gym');
    assert.equal(merged[0].rating, 4.9);
    assert.equal(merged[0].currentOccupancy, 9);
  });
});
