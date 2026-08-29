// Single source of truth for "is this offer usable, and what does it save" —
// imported by both the client (Salon Detail / Join Queue price breakdown,
// live as the customer picks services) and the server (the `join` command,
// which recomputes the same thing from the trusted salon_offer row instead
// of believing whatever number the client sent). Neither side hand-rolls
// its own version of this math.

import type { SalonOffer } from '../types';

export type CouponEligibility =
  | { eligible: true; discountInr: number }
  | { eligible: false; reason: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluateCoupon(
  offer: SalonOffer,
  params: { subtotalInr: number; serviceIds: string[]; offeringId?: string; now?: number },
): CouponEligibility {
  const now = params.now ?? Date.now();
  if (offer.active === false) return { eligible: false, reason: 'This offer is no longer active.' };
  if (!offer.discountType || !offer.discountValue) return { eligible: false, reason: 'This offer has no applicable discount.' };
  if (offer.startDate) {
    const starts = Date.parse(offer.startDate);
    if (Number.isFinite(starts) && now < starts) return { eligible: false, reason: "This offer isn't live yet." };
  }
  if (offer.endDate) {
    const ends = Date.parse(offer.endDate);
    if (Number.isFinite(ends) && now > ends + DAY_MS - 1) return { eligible: false, reason: 'This offer has expired.' };
  }
  if (offer.minimumBillInr && params.subtotalInr < offer.minimumBillInr) {
    return { eligible: false, reason: `Add ₹${offer.minimumBillInr - params.subtotalInr} more to use this offer (min. bill ₹${offer.minimumBillInr}).` };
  }
  // An empty serviceIds list means "not tracked at this call site" (the
  // `join` command only carries service names, not ids) rather than "no
  // services selected" — skip this one rule there instead of always failing it.
  if (offer.eligibleServiceIds?.length && params.serviceIds.length > 0) {
    const matches = params.serviceIds.some((id) => offer.eligibleServiceIds!.includes(id));
    if (!matches) return { eligible: false, reason: 'Not valid for the selected services.' };
  }
  // Gym's equivalent restriction: an offer scoped to specific offerings
  // (Day Pass / Monthly / Quarterly / ...) only applies when the caller
  // passes the offeringId it was scoped for.
  if (offer.eligibleOfferingIds?.length && params.offeringId) {
    if (!offer.eligibleOfferingIds.includes(params.offeringId)) {
      return { eligible: false, reason: 'Not valid for the selected plan.' };
    }
  }
  const raw = offer.discountType === 'percent'
    ? Math.round((params.subtotalInr * Math.min(100, Math.max(0, offer.discountValue))) / 100)
    : Math.max(0, Math.round(offer.discountValue));
  return { eligible: true, discountInr: Math.min(raw, params.subtotalInr) };
}

/** Short display label for an offer's real discount, e.g. "20% OFF" / "₹100 OFF". */
export function offerDiscountLabel(offer: SalonOffer): string {
  if (!offer.discountType || !offer.discountValue) return offer.discount || '';
  return offer.discountType === 'percent' ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`;
}
