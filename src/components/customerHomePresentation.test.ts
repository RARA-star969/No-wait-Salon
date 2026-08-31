import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NearbySalon } from '../types';
import { resolveHomeBusinessStatus } from '../shared/customerHomeStatus';

function business(overrides: Partial<NearbySalon>): NearbySalon {
  return {
    id: 'business-1',
    name: 'Test Business',
    address: 'Indiranagar',
    distanceKm: 0.4,
    rating: 4.8,
    reviewCount: 20,
    isOpen: true,
    services: [],
    defaultBarberCount: 2,
    latitude: 12.9,
    longitude: 77.6,
    openingHours: 'Open until 9 PM',
    travelTimeMinutes: 4,
    liveWaitMinutes: 12,
    waitingCustomers: 2,
    ...overrides,
  };
}

test('Salon status keeps real queue, wait, ready-now, and position data connected', () => {
  const waiting = resolveHomeBusinessStatus(business({ mainCategoryId: 'salon', waitingCustomers: 2, liveWaitMinutes: 12 }));
  assert.equal(waiting.liveLine1, '2 ahead');
  assert.equal(waiting.liveLine2, '~12 min wait');
  assert.match(waiting.positionLabel || '', /#3/);

  const ready = resolveHomeBusinessStatus(business({ mainCategoryId: 'salon', waitingCustomers: 0 }));
  assert.equal(ready.liveLine1, 'No wait');
  assert.equal(ready.liveLine2, 'Ready now');
});

test('Gym status is derived from real live-floor occupancy and capacity', () => {
  const status = resolveHomeBusinessStatus(business({ mainCategoryId: 'gym', currentOccupancy: 34, maxCapacity: 90 }));
  assert.equal(status.liveLine1, 'Live floor 34/90');
  assert.deepEqual(status.liveFloorMeter, { occupancy: 34, maxCapacity: 90, color: status.signalColor });
});

test('Shop status uses supported open/hours data and never invents pickup timing', () => {
  const status = resolveHomeBusinessStatus(business({ mainCategoryId: 'shop', isOpen: true, openingHours: 'Open until 8 PM' }));
  assert.equal(status.liveLine1, 'Open now');
  assert.equal(status.liveLine2, 'Open until 8 PM');
  assert.doesNotMatch(`${status.liveLine1} ${status.liveLine2}`, /pickup|\d+\s*min/i);
});
