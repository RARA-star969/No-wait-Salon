// Real-data-only Overview derivation — Gym shared-architecture v1, Gap 1.
// Every helper here reads straight off GymState fixtures; no network, no DOM.
import assert from "node:assert/strict";
import test from "node:test";
import {
  overviewInsideNow,
  overviewCheckinsToday,
  overviewCollectionToday,
  overviewEndingSoonCount,
  overviewMembersSummary,
  overviewMemberActivity,
  overviewMonthActivity,
  overviewNeedsAttention,
  type GymVisit,
  type GymEvent,
  type GymPayment,
  type GymMembership,
  type GymMembershipClaim,
  type GymQueueEntry,
} from "./gymBusiness";

const DAY_MS = 24 * 60 * 60 * 1000;

function visit(over: Partial<GymVisit> = {}): GymVisit {
  return {
    id: over.id || Math.random().toString(36).slice(2),
    name: "Someone",
    checkedInAt: Date.now(),
    ...over,
  };
}
function event(over: Partial<GymEvent> = {}): GymEvent {
  return {
    id: over.id || Math.random().toString(36).slice(2),
    at: Date.now(),
    category: "checkins",
    action: "checkin",
    subject: "Someone",
    actor: "Staff",
    occupancy: 1,
    capacity: 10,
    availableTrainers: 1,
    ...over,
  };
}
function payment(over: Partial<GymPayment> = {}): GymPayment {
  return {
    id: over.id || Math.random().toString(36).slice(2),
    customerName: "Someone",
    customerMobile: "",
    offeringId: "off-1",
    offeringName: "Day pass",
    amountInr: 100,
    method: "cash",
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...over,
  };
}
function membership(over: Partial<GymMembership> = {}): GymMembership {
  return {
    id: over.id || Math.random().toString(36).slice(2),
    customerId: over.customerId || "cust-1",
    customerName: "Someone",
    customerMobile: "",
    planName: "Monthly",
    source: "purchase",
    status: "active",
    joinedDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 60 * DAY_MS).toISOString().slice(0, 10),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...over,
  };
}

test("overviewInsideNow — counts only real active visits, split by purpose", () => {
  const visits = [
    visit({ purpose: "member" }),
    visit({ purpose: "member" }),
    visit({ purpose: "visitor" }),
    visit({ purpose: "visitor", checkedOutAt: Date.now() }), // left — excluded
  ];
  assert.deepEqual(overviewInsideNow(visits), { total: 3, members: 2, visitors: 1 });
});

test("overviewCheckinsToday — omits yesterday comparison when history doesn't reach back that far", () => {
  const now = Date.now();
  const events = [event({ at: now })];
  // History only starts a few minutes ago — no real coverage of yesterday.
  const result = overviewCheckinsToday(events, now - 5 * 60_000, now);
  assert.equal(result.today, 1);
  assert.equal(result.yesterday, undefined);
});

test("overviewCheckinsToday — includes a real (possibly zero) yesterday count when history covers it", () => {
  const now = Date.now();
  const events = [event({ at: now }), event({ at: now - DAY_MS })];
  const result = overviewCheckinsToday(events, now - 10 * DAY_MS, now);
  assert.equal(result.today, 1);
  assert.equal(result.yesterday, 1);
});

test("overviewCheckinsToday — a real zero yesterday count is reported, not hidden", () => {
  const now = Date.now();
  const events = [event({ at: now })];
  const result = overviewCheckinsToday(events, now - 10 * DAY_MS, now);
  assert.equal(result.yesterday, 0);
});

test("overviewCollectionToday — paid-today and cash-pending are kept separate, never merged", () => {
  const now = Date.now();
  const payments = [
    payment({ status: "paid", acceptedAt: now, amountInr: 500 }),
    payment({ status: "paid", acceptedAt: now - 2 * DAY_MS, amountInr: 9000 }), // not today
    payment({ status: "pending", method: "cash", amountInr: 300 }),
    payment({ status: "pending", method: "online", amountInr: 700 }), // not cash
  ];
  const result = overviewCollectionToday(payments, now);
  assert.equal(result.paidToday, 500);
  assert.equal(result.cashPendingTotal, 300);
});

test("overviewEndingSoonCount — memberships expiring within 7 days only", () => {
  const now = Date.now();
  const memberships = [
    membership({ customerId: "a", expiryDate: new Date(now + 3 * DAY_MS).toISOString().slice(0, 10) }),
    membership({ customerId: "b", expiryDate: new Date(now + 30 * DAY_MS).toISOString().slice(0, 10) }),
    membership({ customerId: "c", expiryDate: new Date(now - 3 * DAY_MS).toISOString().slice(0, 10), status: "expired" }),
  ];
  assert.equal(overviewEndingSoonCount(memberships, now), 1);
});

test("overviewMembersSummary — active / new-this-month / expired / ending-soon from real memberships", () => {
  const now = Date.now();
  const thisMonth = new Date(now).toISOString().slice(0, 7);
  const memberships = [
    membership({ customerId: "a", joinedDate: `${thisMonth}-05` }),
    membership({
      customerId: "b",
      joinedDate: "2020-01-01",
      expiryDate: new Date(now + 2 * DAY_MS).toISOString().slice(0, 10),
    }),
    membership({
      customerId: "c",
      joinedDate: "2020-01-01",
      status: "expired",
      expiryDate: new Date(now - 30 * DAY_MS).toISOString().slice(0, 10),
    }),
  ];
  const summary = overviewMembersSummary(memberships, now);
  assert.equal(summary.active, 2);
  assert.equal(summary.newThisMonth, 1);
  assert.equal(summary.expired, 1);
  assert.equal(summary.endingSoon, 1);
});

test("overviewMemberActivity — buckets very_active / regular / not_visiting via the shared consistency engine", () => {
  const now = Date.now();
  const memberships = [
    membership({ customerId: "va" }),
    membership({ customerId: "reg" }),
    membership({ customerId: "cold" }),
  ];
  const visits: GymVisit[] = [];
  // "va" — checks in almost daily over the last 30 days -> highly_consistent.
  for (let i = 0; i < 28; i++)
    visits.push(visit({ customerId: "va", checkedInAt: now - i * DAY_MS }));
  // "reg" — roughly 1.2/week over the last 30 days -> regular.
  for (let i = 0; i < 5; i++)
    visits.push(visit({ customerId: "reg", checkedInAt: now - i * 6 * DAY_MS }));
  // "cold" — nothing in the last 30 days -> at_risk -> not_visiting bucket.
  visits.push(visit({ customerId: "cold", checkedInAt: now - 60 * DAY_MS }));

  const buckets = overviewMemberActivity(memberships, visits, now);
  assert.equal(buckets.very_active, 1);
  assert.equal(buckets.regular, 1);
  assert.equal(buckets.not_visiting, 1);
});

test("overviewMonthActivity — omits vs-last-month and pattern when there isn't enough real history", () => {
  const now = Date.now();
  const visits = [visit({ checkedInAt: now })];
  const result = overviewMonthActivity(visits, now - 3 * DAY_MS, now);
  assert.equal(result.visitsThisMonth, 1);
  assert.equal(result.vsLastMonthPct, undefined);
  assert.equal(result.bestDay, undefined);
  assert.equal(result.busiestTime, undefined);
});

test("overviewMonthActivity — computes a real month-over-month percentage once history covers last month", () => {
  const now = Date.now();
  const lastMonthAnchor = new Date(now);
  lastMonthAnchor.setDate(1);
  lastMonthAnchor.setMonth(lastMonthAnchor.getMonth() - 1);
  const visits = [
    visit({ checkedInAt: now }),
    visit({ checkedInAt: now }),
    visit({ checkedInAt: +lastMonthAnchor + DAY_MS }),
  ];
  const result = overviewMonthActivity(visits, +lastMonthAnchor - DAY_MS, now);
  assert.equal(result.visitsThisMonth, 2);
  assert.equal(result.vsLastMonthPct, 100);
});

test("overviewMonthActivity — bestDay / busiestTime appear only with enough real check-ins", () => {
  const now = Date.now();
  const monday = new Date(now);
  // Force a specific, known weekday/hour so the pattern is deterministic.
  monday.setHours(9, 0, 0, 0);
  const visits: GymVisit[] = [];
  for (let i = 0; i < 25; i++) visits.push(visit({ checkedInAt: +monday - i * 7 * DAY_MS }));
  const result = overviewMonthActivity(visits, now - 200 * DAY_MS, now);
  assert.ok(result.bestDay);
  assert.ok(result.busiestTime);
});

test("overviewNeedsAttention — everything looks good when nothing real qualifies", () => {
  const state = {
    payments: [] as GymPayment[],
    membershipClaims: [] as GymMembershipClaim[],
    memberships: [] as GymMembership[],
    visits: [] as GymVisit[],
    entryQueue: [] as GymQueueEntry[],
  };
  assert.deepEqual(overviewNeedsAttention(state), []);
});

test("overviewNeedsAttention — only real qualifying items appear, each with the real count", () => {
  const now = Date.now();
  const state = {
    payments: [payment({ status: "pending", method: "cash" }), payment({ status: "pending", method: "online" })],
    membershipClaims: [{ id: "c1", customerId: "x", name: "X", mobile: "", joiningDate: "", expiryDate: "", planText: "", status: "pending" as const, createdAt: now }],
    memberships: [] as GymMembership[],
    visits: [] as GymVisit[],
    entryQueue: [{ id: "q1", name: "Y", arrivedAt: now, status: "Waiting" } as GymQueueEntry],
  };
  const items = overviewNeedsAttention(state, now);
  const ids = items.map((i) => i.id).sort();
  assert.deepEqual(ids, ["approvals_waiting", "cash_pending", "waiting_entry"]);
  assert.equal(items.find((i) => i.id === "cash_pending")!.count, 1);
});
