import assert from 'node:assert/strict';
import test from 'node:test';
import { filterServices, selectionTotals, serviceFilterTags } from './serviceSelection.ts';
import type { SalonProfileService } from './salonProfile.ts';

const services: SalonProfileService[] = [
  { id: 'haircut', name: 'Haircut', durationMin: 30, priceInr: 250, description: 'Precision cut, wash & styling' },
  { id: 'beard', name: 'Beard Trim', durationMin: 15, priceInr: 180, description: 'Beard shaping & detailing' },
  { id: 'combo', name: 'Haircut + Beard Package', durationMin: 45, priceInr: 400, description: 'Combo package' },
];

test('running totals sum price, duration and count across the selection', () => {
  const totals = selectionTotals(services, ['haircut', 'beard']);
  assert.equal(totals.count, 2);
  assert.equal(totals.totalPriceInr, 430);
  assert.equal(totals.totalDurationMin, 45);
  assert.deepEqual(totals.names, ['Haircut', 'Beard Trim']);
});

test('an empty selection totals to zero, not undefined', () => {
  const totals = selectionTotals(services, []);
  assert.equal(totals.count, 0);
  assert.equal(totals.totalPriceInr, 0);
  assert.equal(totals.totalDurationMin, 0);
});

test('the Packages filter matches a bundled service by name', () => {
  assert.ok(serviceFilterTags(services[2]).includes('Packages'));
  assert.deepEqual(filterServices(services, 'Packages'), [services[2]]);
});

test('the All filter never drops a service', () => {
  assert.equal(filterServices(services, 'All').length, services.length);
});
