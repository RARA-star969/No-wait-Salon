import assert from 'node:assert/strict';
import test from 'node:test';
import { filterServices, selectionTotals, serviceFilterTags, summarizeServiceLabels } from './serviceSelection.ts';
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

test('an empty services list summarizes to an empty string', () => {
  assert.equal(summarizeServiceLabels([]), '');
});

test('repeated categories collapse into one label, with a remaining count', () => {
  // "Haircut", "Beard Trim", "Haircut + Beard Package" collapse to the
  // Haircut and Beard labels — the combo package folds into Beard.
  assert.equal(summarizeServiceLabels(services), 'Haircut · Beard +1 more');
});

test('a salon with many services caps the summary at 3 labels plus a remaining count', () => {
  const manyServices: SalonProfileService[] = [
    { id: '1', name: 'Haircut', durationMin: 30, priceInr: 250, description: '' },
    { id: '2', name: 'Haircut + Beard', durationMin: 45, priceInr: 400, description: '' },
    { id: '3', name: 'Beard Trim & Shape', durationMin: 20, priceInr: 150, description: '' },
    { id: '4', name: 'Detox Head Massage', durationMin: 25, priceInr: 300, description: '' },
    { id: '5', name: 'Hair Spa & Conditioning', durationMin: 40, priceInr: 550, description: '' },
  ];
  const summary = summarizeServiceLabels(manyServices);
  assert.equal(summary, 'Haircut · Beard · Grooming +2 more');
});
