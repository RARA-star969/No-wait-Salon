import assert from "node:assert/strict";
import test from "node:test";
import type { GymOffering, GymPayment, GymVisit } from "./gymBusiness.ts";
import {
  CUSTOM_ENTRY_LABEL,
  activeAccessHeading,
  filterVisits,
  initialsFor,
  paymentCardState,
  paymentsAwaitingAction,
  resolveAccess,
  sortVisitsForFloor,
  splitRecommendedOfferings,
  visitPaymentDisplay,
  visitStatus,
} from "./gymLiveFloor.ts";

const offering = (over: Partial<GymOffering> = {}): GymOffering => ({
  id: "off-day",
  name: "Day Pass",
  type: "visitor_pass",
  priceInr: 300,
  durationValue: 1,
  durationUnit: "day",
  description: "",
  active: true,
  customerVisible: true,
  paymentOptions: ["cash"],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const visit = (over: Partial<GymVisit> = {}): GymVisit => ({
  id: "v1",
  name: "Asha Rao",
  checkedInAt: 1_000_000,
  ...over,
});

const payment = (over: Partial<GymPayment> = {}): GymPayment => ({
  id: "p1",
  customerName: "Asha Rao",
  customerMobile: "",
  offeringId: "off-day",
  offeringName: "Day Pass",
  amountInr: 300,
  method: "cash",
  status: "pending",
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

test("Live Floor status filter — Inside / Left / All, composed with search", async (t) => {
  const offerings = [offering(), offering({ id: "off-month", name: "Monthly Membership" })];
  const visits: GymVisit[] = [
    visit({ id: "in-1", name: "Asha Rao", checkedInAt: 100 }),
    visit({ id: "in-2", name: "Bilal Khan", checkedInAt: 200 }),
    visit({ id: "left-1", name: "Asha Rao", checkedInAt: 50, checkedOutAt: 300 }),
    visit({ id: "left-2", name: "Chetna Iyer", checkedInAt: 10, checkedOutAt: 90 }),
  ];
  void offerings;

  await t.test("Inside returns only open visits", () => {
    const ids = filterVisits(visits, { status: "Inside" }).map((v) => v.id);
    assert.deepEqual(ids.sort(), ["in-1", "in-2"]);
  });

  await t.test(
    "Left returns historical checked-out visits from the same source list, not an empty set",
    () => {
      const left = filterVisits(visits, { status: "Left" });
      assert.equal(left.length, 2);
      assert.deepEqual(left.map((v) => v.id).sort(), ["left-1", "left-2"]);
      assert.ok(left.every((v) => v.checkedOutAt));
    },
  );

  await t.test("All returns both, and every row can be classified", () => {
    const all = filterVisits(visits, { status: "All" });
    assert.equal(all.length, 4);
    assert.equal(visitStatus(all.find((v) => v.id === "in-1")!), "Inside");
    assert.equal(visitStatus(all.find((v) => v.id === "left-1")!), "Left");
  });

  await t.test("search alone matches across both current and historical rows", () => {
    const ids = filterVisits(visits, { query: "asha" }).map((v) => v.id);
    assert.deepEqual(ids.sort(), ["in-1", "left-1"]);
  });

  await t.test("search and status compose — Left + 'asha' is only the left Asha row", () => {
    const ids = filterVisits(visits, { status: "Left", query: "asha" }).map((v) => v.id);
    assert.deepEqual(ids, ["left-1"]);
  });

  await t.test("search and status compose — Inside + 'asha' is only the open Asha row", () => {
    const ids = filterVisits(visits, { status: "Inside", query: "ASHA" }).map((v) => v.id);
    assert.deepEqual(ids, ["in-1"]);
  });

  await t.test("a status/search pair matching nothing yields an empty list, not everything", () => {
    assert.equal(filterVisits(visits, { status: "Left", query: "bilal" }).length, 0);
  });

  await t.test("checked-out rows are never dropped from the source (history is preserved)", () => {
    const all = filterVisits(visits, {});
    assert.equal(all.length, visits.length);
  });

  await t.test("ordering puts the most recent activity first", () => {
    const ids = sortVisitsForFloor(filterVisits(visits, {})).map((v) => v.id);
    assert.equal(ids[0], "left-1"); // checkedOutAt 300 is the latest event
  });
});

test("ACCESS terminology replaces PLAN and covers Custom Entry", async (t) => {
  const offerings = [offering(), offering({ id: "off-month", name: "Monthly Membership" })];

  await t.test("an offering-backed visit resolves to that offering's real name", () => {
    assert.deepEqual(resolveAccess(visit({ offeringId: "off-month" }), offerings), {
      kind: "offering",
      label: "Monthly Membership",
    });
  });

  await t.test("a Custom Entry visit resolves to 'Custom Entry', never 'Plan: Custom'", () => {
    const access = resolveAccess(visit({ customEntry: true }), offerings);
    assert.equal(access.kind, "custom_entry");
    assert.equal(access.label, CUSTOM_ENTRY_LABEL);
    assert.doesNotMatch(access.label, /plan/i);
  });

  await t.test("an unknown/legacy visit degrades to a dash rather than inventing a plan", () => {
    assert.equal(resolveAccess(visit(), offerings).kind, "unknown");
    assert.equal(resolveAccess(visit({ offeringId: "gone" }), offerings).label, "—");
  });

  await t.test("Custom Entry and visitor passes are labeled VISIT, never MEMBERSHIP", () => {
    assert.equal(activeAccessHeading({ customEntry: true }), "ACTIVE VISIT");
    assert.equal(activeAccessHeading({ purpose: "visitor" }), "ACTIVE VISIT");
    assert.equal(
      activeAccessHeading({ purpose: "member", membershipId: "m1" }),
      "ACTIVE MEMBERSHIP",
    );
    // purpose=member without a real membership record is still only a visit.
    assert.equal(activeAccessHeading({ purpose: "member" }), "ACTIVE VISIT");
  });
});

test("Payment presentation is honest about what actually happened", async (t) => {
  await t.test("Custom Entry says payment is not required — no ₹0 transaction", () => {
    const display = visitPaymentDisplay(visit({ customEntry: true }), []);
    assert.equal(display.kind, "not_required");
    assert.equal(display.label, "Not required");
    assert.doesNotMatch(display.label, /paid|₹/);
  });

  await t.test("a paid visitor pass shows the real collected amount", () => {
    const p = payment({ status: "paid" });
    assert.equal(visitPaymentDisplay(visit({ paymentId: p.id }), [p]).label, "₹300 paid");
  });

  await t.test("cash pending is shown as pending, never as paid", () => {
    const p = payment();
    assert.equal(visitPaymentDisplay(visit({ paymentId: p.id }), [p]).kind, "pending");
  });

  await t.test("cash pending offers Accept & Check In and Decline", () => {
    const card = paymentCardState(payment())!;
    assert.equal(card.badge, "CASH PENDING");
    assert.equal(card.canAccept, true);
    assert.equal(card.canDecline, true);
  });

  await t.test(
    "a genuinely paid online payment offers Confirm Check-In and NO decline (no refund path exists)",
    () => {
      const card = paymentCardState(payment({ method: "online", status: "paid" }))!;
      assert.equal(card.badge, "ONLINE PAID");
      assert.equal(card.canAccept, true);
      assert.equal(card.canDecline, false);
    },
  );

  await t.test("an online payment already tied to a visit needs no further action", () => {
    assert.equal(
      paymentCardState(payment({ method: "online", status: "paid", visitId: "v1" })),
      null,
    );
  });

  await t.test("declined and refunded payments never resurface as actionable", () => {
    assert.equal(paymentCardState(payment({ status: "declined" })), null);
    assert.equal(paymentCardState(payment({ status: "refunded" })), null);
  });

  await t.test("the Payments tab list is exactly the rows needing a staff decision", () => {
    const rows = paymentsAwaitingAction([
      payment({ id: "cash-pending" }),
      payment({ id: "paid-cash", status: "paid" }),
      payment({ id: "declined", status: "declined" }),
      payment({ id: "online-paid", method: "online", status: "paid" }),
    ]);
    assert.deepEqual(rows.map((p) => p.id).sort(), ["cash-pending", "online-paid"]);
  });
});

test("Recommended offerings come only from the owner's real toggle", async (t) => {
  await t.test("nothing flagged -> no Recommended section at all", () => {
    const sections = splitRecommendedOfferings([offering(), offering({ id: "b", priceInr: 9999 })]);
    assert.equal(sections.recommended.length, 0);
    // Explicitly: the most expensive plan is NOT auto-promoted.
    assert.equal(sections.others.length, 2);
  });

  await t.test("only genuinely flagged offerings are recommended", () => {
    const sections = splitRecommendedOfferings([
      offering({ id: "a", recommended: true }),
      offering({ id: "b" }),
      offering({ id: "c", recommended: false }),
    ]);
    assert.deepEqual(sections.recommended.map((o) => o.id), ["a"]);
    assert.deepEqual(sections.others.map((o) => o.id), ["b", "c"]);
  });

  await t.test("inactive offerings never appear in either section", () => {
    const sections = splitRecommendedOfferings([
      offering({ id: "a", recommended: true, active: false }),
      offering({ id: "b", active: false }),
    ]);
    assert.equal(sections.recommended.length, 0);
    assert.equal(sections.others.length, 0);
  });

  await t.test("the currently active access can be excluded from an Upgrade sheet", () => {
    const sections = splitRecommendedOfferings(
      [offering({ id: "a" }), offering({ id: "b" })],
      { excludeOfferingId: "a" },
    );
    assert.deepEqual(sections.others.map((o) => o.id), ["b"]);
  });
});

test("Avatar initials fall back cleanly", async (t) => {
  await t.test("two initials from a full name", () => {
    assert.equal(initialsFor("Asha Rao"), "AR");
  });
  await t.test("single name gives one initial", () => {
    assert.equal(initialsFor("Asha"), "A");
  });
  await t.test("nothing usable gives an empty string, so the caller shows a glyph", () => {
    assert.equal(initialsFor(""), "");
    assert.equal(initialsFor(undefined), "");
    assert.equal(initialsFor("   "), "");
  });
});
