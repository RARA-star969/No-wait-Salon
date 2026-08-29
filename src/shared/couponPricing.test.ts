import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCoupon, offerDiscountLabel } from './couponPricing';
import type { SalonOffer } from '../types';

const baseOffer: SalonOffer = {
  id: 'off-1',
  title: 'Festive Special',
  discount: '',
  discountType: 'percent',
  discountValue: 20,
  active: true,
};

test('a percent offer discounts the subtotal by that percentage', () => {
  const result = evaluateCoupon(baseOffer, { subtotalInr: 500, serviceIds: [] });
  assert.equal(result.eligible, true);
  if (result.eligible) assert.equal(result.discountInr, 100);
});

test('a fixed offer discounts by the flat amount, capped at the subtotal', () => {
  const offer: SalonOffer = { ...baseOffer, discountType: 'fixed', discountValue: 700 };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [] });
  assert.equal(result.eligible, true);
  if (result.eligible) assert.equal(result.discountInr, 500, 'discount never exceeds the bill');
});

test('an inactive offer is never eligible', () => {
  const offer: SalonOffer = { ...baseOffer, active: false };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [] });
  assert.equal(result.eligible, false);
});

test('an offer under its minimum bill is rejected with a clear reason', () => {
  const offer: SalonOffer = { ...baseOffer, minimumBillInr: 600 };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [] });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.match(result.reason, /min\. bill/i);
});

test('an offer at or above its minimum bill is eligible', () => {
  const offer: SalonOffer = { ...baseOffer, minimumBillInr: 500 };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [] });
  assert.equal(result.eligible, true);
});

test('an expired offer is rejected', () => {
  const offer: SalonOffer = { ...baseOffer, endDate: '2020-01-01' };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [] });
  assert.equal(result.eligible, false);
});

test('an offer that has not started yet is rejected', () => {
  const offer: SalonOffer = { ...baseOffer, startDate: '2099-01-01' };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [] });
  assert.equal(result.eligible, false);
});

test('eligible-service restriction rejects a selection with no matching service', () => {
  const offer: SalonOffer = { ...baseOffer, eligibleServiceIds: ['svc-haircut'] };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: ['svc-massage'] });
  assert.equal(result.eligible, false);
});

test('eligible-service restriction allows a selection that includes a matching service', () => {
  const offer: SalonOffer = { ...baseOffer, eligibleServiceIds: ['svc-haircut'] };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: ['svc-massage', 'svc-haircut'] });
  assert.equal(result.eligible, true);
});

test('an empty serviceIds list skips eligible-service enforcement (server join path has no ids)', () => {
  const offer: SalonOffer = { ...baseOffer, eligibleServiceIds: ['svc-haircut'] };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [] });
  assert.equal(result.eligible, true);
});

test('offerDiscountLabel prefers the structured discount over free text', () => {
  assert.equal(offerDiscountLabel(baseOffer), '20% OFF');
  assert.equal(offerDiscountLabel({ ...baseOffer, discountType: 'fixed', discountValue: 100 }), '₹100 OFF');
});

test('offerDiscountLabel falls back to the free-text discount when no structured value exists', () => {
  assert.equal(offerDiscountLabel({ id: 'x', title: 'Old style', discount: 'Flat 10% off' }), 'Flat 10% off');
});

test('eligible-offering restriction rejects a Gym offering that is not targeted', () => {
  const offer: SalonOffer = { ...baseOffer, eligibleOfferingIds: ['off-monthly'] };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [], offeringId: 'off-day-pass' });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.match(result.reason, /not valid for the selected plan/i);
});

test('eligible-offering restriction allows the targeted Gym offering', () => {
  const offer: SalonOffer = { ...baseOffer, eligibleOfferingIds: ['off-monthly', 'off-quarterly'] };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [], offeringId: 'off-monthly' });
  assert.equal(result.eligible, true);
});

test('an offer with no eligibleOfferingIds applies to every Gym offering ("All Gym Access")', () => {
  const offer: SalonOffer = { ...baseOffer, eligibleOfferingIds: [] };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [], offeringId: 'off-anything' });
  assert.equal(result.eligible, true);
});

test('no offeringId passed (Salon call sites) skips eligible-offering enforcement entirely', () => {
  const offer: SalonOffer = { ...baseOffer, eligibleOfferingIds: ['off-monthly'] };
  const result = evaluateCoupon(offer, { subtotalInr: 500, serviceIds: [] });
  assert.equal(result.eligible, true);
});
