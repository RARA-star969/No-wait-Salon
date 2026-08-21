import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCoupon, couponTotals } from './couponValidation.ts';
import type { SalonOffer } from '../types';

const offers: SalonOffer[] = [
  { id: 'o1', title: 'Welcome offer', discount: '10% off', code: 'WELCOME10', discountType: 'percent', discountValue: 10, minimumBillInr: 300 },
  { id: 'o2', title: 'Flat 50 off', discount: '₹50 off', code: 'FLAT50', discountType: 'flat', discountValue: 50, minimumBillInr: 0 },
  { id: 'o3', title: 'Display-only banner', discount: '20% off (in-store only)' },
];

test('no code entered resolves to none', () => {
  assert.deepEqual(resolveCoupon(null, offers, 500), { status: 'none' });
  assert.deepEqual(resolveCoupon('  ', offers, 500), { status: 'none' });
});

test('unknown code is invalid, not silently ignored', () => {
  const result = resolveCoupon('NOPE', offers, 500);
  assert.equal(result.status, 'invalid');
});

test('a banner offer with no code can never be applied as a coupon', () => {
  const result = resolveCoupon('display-only banner', offers, 500);
  assert.equal(result.status, 'invalid');
});

test('matching is case-insensitive and trims whitespace', () => {
  const result = resolveCoupon('  welcome10  ', offers, 500);
  assert.equal(result.status, 'applied');
});

test('percent discount is computed off the real subtotal', () => {
  const result = resolveCoupon('WELCOME10', offers, 500);
  assert.deepEqual(result, { status: 'applied', code: 'welcome10', offer: offers[0], discountInr: 50 });
});

test('below the minimum bill, the coupon is neither applied nor discarded', () => {
  const result = resolveCoupon('WELCOME10', offers, 200);
  assert.equal(result.status, 'below_minimum');
  if (result.status === 'below_minimum') {
    assert.equal(result.minimumBillInr, 300);
    assert.equal(result.shortfallInr, 100);
  }
});

test('a flat discount never drives the total negative', () => {
  const result = resolveCoupon('FLAT50', offers, 30);
  assert.equal(result.status, 'applied');
  if (result.status === 'applied') assert.equal(result.discountInr, 30);
});

test('a percent discount value above 100 is clamped, not exploited', () => {
  const rigged: SalonOffer[] = [{ id: 'o4', title: 'Rigged', discount: '', code: 'RIGGED', discountType: 'percent', discountValue: 500, minimumBillInr: 0 }];
  const result = resolveCoupon('RIGGED', rigged, 400);
  assert.equal(result.status, 'applied');
  if (result.status === 'applied') assert.equal(result.discountInr, 400);
});

test('couponTotals derives subtotal, discount and total together', () => {
  const totals = couponTotals('WELCOME10', offers, 500);
  assert.equal(totals.subtotalInr, 500);
  assert.equal(totals.discountInr, 50);
  assert.equal(totals.totalInr, 450);
});

test('couponTotals with nothing applied mirrors the subtotal exactly', () => {
  const totals = couponTotals(null, offers, 500);
  assert.equal(totals.discountInr, 0);
  assert.equal(totals.totalInr, 500);
});

test('recalculating at a lower subtotal after a service is removed drops the discount automatically', () => {
  const before = couponTotals('WELCOME10', offers, 500);
  const after = couponTotals('WELCOME10', offers, 200);
  assert.equal(before.result.status, 'applied');
  assert.equal(after.result.status, 'below_minimum');
  assert.equal(after.discountInr, 0);
  assert.equal(after.totalInr, 200);
});
