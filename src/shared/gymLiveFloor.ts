// Pure derivation layer behind the owner-facing Live Floor and the customer's
// own access state. Kept out of GymDashboardView/GymDetailPage on purpose:
//
//   * the Inside / Left / All filtering and its composition with the search
//     box is unit-testable here without a DOM harness, and
//   * a future dedicated Check-in/Check-out history screen can render from
//     exactly these functions without lifting logic out of a page component
//     (Part 24 — structure for it now, don't build the page yet).

import type { GymOffering, GymPayment, GymVisit } from "./gymBusiness";

// --- ACCESS (owner-facing label formerly called "Plan") -------------------
// One resolver so "ACCESS / Day Pass", "ACCESS / Monthly Membership" and
// "ACCESS / Custom Entry" can never be spelled differently on two surfaces.

export const ACCESS_LABEL = "Access";
export const CUSTOM_ENTRY_LABEL = "Custom Entry";
/** The sentinel the Add Visitor dropdown submits for a free staff-verified
 * entry. Never a real GymOffering id — the server rejects it as one. */
export const CUSTOM_ENTRY_OFFERING_ID = "custom_entry";

export type AccessKind = "offering" | "custom_entry" | "unknown";
export type ResolvedAccess = { kind: AccessKind; label: string };

export function resolveAccess(
  source: { offeringId?: string; customEntry?: boolean } | undefined,
  offerings: Pick<GymOffering, "id" | "name">[],
): ResolvedAccess {
  if (!source) return { kind: "unknown", label: "—" };
  if (source.customEntry) return { kind: "custom_entry", label: CUSTOM_ENTRY_LABEL };
  const offering = source.offeringId
    ? offerings.find((o) => o.id === source.offeringId)
    : undefined;
  if (offering) return { kind: "offering", label: offering.name };
  return { kind: "unknown", label: "—" };
}

/** Part 19 — an active visit is never labeled "Membership" unless it really is
 * backed by a membership. Custom Entry is always a Visit. */
export type ActiveAccessHeading = "ACTIVE VISIT" | "ACTIVE MEMBERSHIP";

export function activeAccessHeading(
  visit: Pick<GymVisit, "purpose" | "membershipId" | "customEntry">,
): ActiveAccessHeading {
  if (visit.customEntry) return "ACTIVE VISIT";
  return visit.purpose === "member" && visit.membershipId
    ? "ACTIVE MEMBERSHIP"
    : "ACTIVE VISIT";
}

// --- Live Floor status filtering -----------------------------------------
// "Left" must read the SAME visits array as "Inside" — historical checked-out
// rows are never deleted from GymState.visits, they simply carry a
// checkedOutAt. The previous implementation filtered the list down to open
// visits before the status filter ever ran, which is why "Left" could only
// ever be empty. Filtering now happens in one place, on the full list.

export type VisitStatusFilter = "All" | "Inside" | "Left";

export const VISIT_STATUS_OPTIONS: VisitStatusFilter[] = ["Inside", "Left"];

export function visitStatus(visit: Pick<GymVisit, "checkedOutAt">): "Inside" | "Left" {
  return visit.checkedOutAt ? "Left" : "Inside";
}

/** Status + free-text search composed together, in that order, over the full
 * (active AND historical) visit list. Search matches the visitor's name; an
 * empty query matches everything. */
export function filterVisits<T extends Pick<GymVisit, "name" | "checkedOutAt">>(
  visits: T[],
  options: { status?: VisitStatusFilter; query?: string } = {},
): T[] {
  const status = options.status || "All";
  const query = (options.query || "").trim().toLowerCase();
  return visits.filter((visit) => {
    if (status !== "All" && visitStatus(visit) !== status) return false;
    if (query && !visit.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

/** Most-recent-first ordering that keeps open visits meaningful in the "All"
 * tab: sort by whichever timestamp last changed on the row. */
export function sortVisitsForFloor<T extends Pick<GymVisit, "checkedInAt" | "checkedOutAt">>(
  visits: T[],
): T[] {
  return [...visits].sort(
    (a, b) => (b.checkedOutAt || b.checkedInAt) - (a.checkedOutAt || a.checkedInAt),
  );
}

// --- Avatars --------------------------------------------------------------

/** Up to two initials from a display name; empty string when there is nothing
 * usable, so the caller can fall back to a neutral person glyph rather than
 * rendering a stray character. */
export function initialsFor(name: string | undefined): string {
  return (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

// --- Payment presentation -------------------------------------------------
// Payment state is presented, never invented: a visit with no payment row
// behind it (Custom Entry, membership entry) says so plainly instead of
// borrowing a ₹0 "paid" transaction.

export type VisitPaymentDisplay =
  | { kind: "not_required"; label: string }
  | { kind: "paid"; label: string }
  | { kind: "pending"; label: string }
  | { kind: "declined"; label: string }
  | { kind: "none"; label: string };

export function visitPaymentDisplay(
  visit: Pick<GymVisit, "paymentId" | "customEntry">,
  payments: Pick<GymPayment, "id" | "status" | "amountInr" | "method">[],
): VisitPaymentDisplay {
  if (visit.customEntry) return { kind: "not_required", label: "Not required" };
  const payment = visit.paymentId
    ? payments.find((p) => p.id === visit.paymentId)
    : undefined;
  if (!payment) return { kind: "none", label: "—" };
  if (payment.status === "paid")
    return { kind: "paid", label: `₹${payment.amountInr} paid` };
  if (payment.status === "declined") return { kind: "declined", label: "Declined" };
  if (payment.status === "pending")
    return {
      kind: "pending",
      label: payment.method === "cash" ? "Cash pending" : "Online pending",
    };
  return { kind: "none", label: payment.status };
}

/** Owner-facing state of a payment sitting in the Live Floor → Payments tab.
 *
 * "ONLINE PAID" only ever appears for a payment the server has genuinely
 * moved to `paid` through a real settlement path — this function does not
 * manufacture that state, it only reads it. A paid online payment offers
 * Confirm Check-In (physical entry still needs an explicit staff step) and
 * deliberately offers NO decline action, because declining money that has
 * actually been captured would require a refund path this system does not
 * have. Cash stays "CASH PENDING" with Accept & Check In / Decline. */
export type PaymentCardState =
  | { kind: "cash_pending"; badge: string; canAccept: true; canDecline: true }
  | { kind: "online_pending"; badge: string; canAccept: false; canDecline: true }
  | { kind: "online_paid"; badge: string; canAccept: true; canDecline: false };

export function paymentCardState(
  payment: Pick<GymPayment, "status" | "method" | "visitId">,
): PaymentCardState | null {
  if (payment.method === "cash" && payment.status === "pending")
    return { kind: "cash_pending", badge: "CASH PENDING", canAccept: true, canDecline: true };
  if (payment.method === "online" && payment.status === "pending")
    return {
      kind: "online_pending",
      badge: "ONLINE PENDING",
      canAccept: false,
      canDecline: true,
    };
  if (payment.method === "online" && payment.status === "paid" && !payment.visitId)
    return { kind: "online_paid", badge: "ONLINE PAID", canAccept: true, canDecline: false };
  return null;
}

/** Everything the Payments tab should show: real pending cash/online rows plus
 * genuinely-paid online rows still awaiting the staff Confirm Check-In step. */
export function paymentsAwaitingAction<
  T extends Pick<GymPayment, "status" | "method" | "visitId">,
>(payments: T[]): T[] {
  return payments.filter((p) => paymentCardState(p) !== null);
}

// --- Recommended offerings (Part 17/18) ----------------------------------

export type OfferingSections = {
  recommended: GymOffering[];
  others: GymOffering[];
};

/** Splits real, currently-purchasable offerings into the customer sheet's two
 * sections. `recommended` is empty unless the owner actually toggled
 * "Recommend this plan" — the caller must then render no Recommended heading
 * at all rather than promoting the priciest plan. */
export function splitRecommendedOfferings(
  offerings: GymOffering[],
  options: { excludeOfferingId?: string } = {},
): OfferingSections {
  const available = offerings.filter(
    (o) => o.active && o.id !== options.excludeOfferingId,
  );
  return {
    recommended: available.filter((o) => o.recommended === true),
    others: available.filter((o) => o.recommended !== true),
  };
}
