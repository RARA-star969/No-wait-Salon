import assert from "node:assert/strict";
import test from "node:test";
import {
  gymMemberReportCsv,
  gymMemberReportRows,
  memberActivityFor,
  type GymState,
} from "./gymBusiness.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-08-28T12:00:00+05:30").getTime();
const state: GymState = {
  gymId: "gym-a",
  currentOccupancy: 0,
  maxCapacity: 50,
  availableTrainersCount: 0,
  waitingOutsideCount: 0,
  checkinsTodayCount: 0,
  classesToday: [],
  trainers: [],
  entryQueue: [],
  members: [],
  ptBookings: [],
  campaigns: [],
  events: [],
  historyStartedAt: now - 90 * DAY,
  revision: 1,
  membershipClaims: [],
  offerings: [
    {
      id: "monthly",
      name: "Monthly Strength",
      type: "membership",
      priceInr: 1800,
      durationValue: 1,
      durationUnit: "month",
      description: "",
      active: true,
      customerVisible: true,
      paymentOptions: ["cash"],
      createdAt: now - 60 * DAY,
      updatedAt: now - 60 * DAY,
    },
  ],
  memberships: [
    {
      id: "membership-1",
      customerId: "customer-1",
      customerName: "=Owner Formula",
      customerMobile: "+919999999999",
      offeringId: "monthly",
      planName: "Monthly Strength",
      source: "purchase",
      status: "active",
      joinedDate: "2026-08-01",
      expiryDate: "2026-09-01",
      createdAt: now - 27 * DAY,
      updatedAt: now - 27 * DAY,
    },
    {
      id: "membership-2",
      customerId: "customer-2",
      customerName: "Manual Member",
      customerMobile: "9000000000",
      planName: "Founder access",
      source: "manual",
      status: "active",
      joinedDate: "2026-08-01",
      expiryDate: "2026-12-01",
      createdAt: now - 27 * DAY,
      updatedAt: now - 27 * DAY,
    },
  ],
  visits: [
    {
      id: "visit-1",
      name: "=Owner Formula",
      customerId: "customer-1",
      membershipId: "membership-1",
      purpose: "member",
      entryMethod: "qr",
      checkedInAt: now - DAY,
    },
    {
      id: "visit-2",
      name: "=Owner Formula",
      customerId: "customer-1",
      membershipId: "membership-1",
      purpose: "member",
      entryMethod: "qr",
      checkedInAt: now - 3 * DAY,
    },
  ],
  payments: [
    {
      id: "payment-1",
      customerId: "customer-1",
      customerName: "=Owner Formula",
      customerMobile: "+919999999999",
      offeringId: "monthly",
      offeringName: "Monthly Strength",
      amountInr: 1800,
      method: "cash",
      status: "paid",
      membershipId: "membership-1",
      acceptedAt: now - 27 * DAY,
      createdAt: now - 27 * DAY,
      updatedAt: now - 27 * DAY,
    },
  ],
};

test("member activity uses existing real attendance thresholds", () => {
  assert.equal(memberActivityFor(state.visits, "customer-1", now).bucket, "not_visiting");
  assert.equal(memberActivityFor(state.visits, "customer-2", now).bucket, "not_visiting");
});

test("member report filters real range data and never invents manual-plan revenue", () => {
  const rows = gymMemberReportRows(
    state,
    new Date("2026-08-01T00:00:00+05:30").getTime(),
    new Date("2026-08-31T23:59:59+05:30").getTime(),
    now,
  );
  assert.equal(rows.length, 2);
  const paid = rows.find((row) => row.memberName === "=Owner Formula")!;
  assert.equal(paid.visitsInRange, 2);
  assert.equal(paid.amountPaidInr, 1800);
  assert.equal(paid.expectedRenewal, "Included in estimate");
  const manual = rows.find((row) => row.memberName === "Manual Member")!;
  assert.equal(manual.amountPaidInr, 0);
  assert.equal(manual.paymentStatus, "No payment in range");
  assert.equal(manual.expectedRenewal, "Not estimated");
});

test("member CSV is Excel-friendly and neutralizes spreadsheet formulas", () => {
  const csv = gymMemberReportCsv(gymMemberReportRows(state, 0, now, now));
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("Total visits in range"));
  assert.ok(csv.includes("\"'=Owner Formula\""));
  assert.ok(csv.includes("\"1800\""));
});
