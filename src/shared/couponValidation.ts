/**
 * Single source of truth for resolving a coupon code against a salon's real
 * configured offers. Both Salon Detail's Price Breakdown and the Join Queue
 * sheet call this with the same (code, offers, subtotal) inputs, so the two
 * can never disagree about whether a coupon applies or what it's worth —
 * there is one calculation, not two that happen to match.
 *
 * Pure and stateless: it does not remember anything between calls, so a
 * service-selection change that shifts the subtotal is automatically
 * re-resolved on the next render rather than needing an explicit "revalidate"
 * step.
 */

import type { SalonOffer } from '../types';

export type CouponResult =
  | { status: 'none' }
  | { status: 'applied'; code: string; offer: SalonOffer; discountInr: number }
  | { status: 'invalid'; code: string }
  | { status: 'below_minimum'; code: string; offer: SalonOffer; minimumBillInr: number; shortfallInr: number };

const findOffer = (code: string, offers: SalonOffer[]): SalonOffer | undefined =>
  offers.find((offer) => (offer.code || '').trim().toLowerCase() === code);

export function resolveCoupon(code: string | null | undefined, offers: SalonOffer[], subtotalInr: number): CouponResult {
  const trimmed = (code || '').trim().toLowerCase();
  if (!trimmed) return { status: 'none' };

  const offer = findOffer(trimmed, offers);
  if (!offer) return { status: 'invalid', code: trimmed };

  const minimumBillInr = Math.max(0, Number(offer.minimumBillInr) || 0);
  if (subtotalInr < minimumBillInr) {
    return { status: 'below_minimum', code: trimmed, offer, minimumBillInr, shortfallInr: minimumBillInr - subtotalInr };
  }

  const rawValue = Math.max(0, Number(offer.discountValue) || 0);
  const rawDiscount = offer.discountType === 'percent' ? (subtotalInr * Math.min(rawValue, 100)) / 100 : rawValue;
  // Never let a discount exceed the bill it applies to — no negative totals.
  const discountInr = Math.min(Math.round(rawDiscount), subtotalInr);
  return { status: 'applied', code: trimmed, offer, discountInr };
}

export type CouponTotals = {
  result: CouponResult;
  subtotalInr: number;
  discountInr: number;
  totalInr: number;
};

export function couponTotals(code: string | null | undefined, offers: SalonOffer[], subtotalInr: number): CouponTotals {
  const result = resolveCoupon(code, offers, subtotalInr);
  const discountInr = result.status === 'applied' ? result.discountInr : 0;
  return { result, subtotalInr, discountInr, totalInr: Math.max(0, subtotalInr - discountInr) };
}
