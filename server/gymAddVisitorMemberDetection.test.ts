// Regression coverage for Add Visitor's server-side existing-member
// detection (see findActiveMembershipForIdentity / existingMemberConfirmation
// / recordSessionUsage in server/gymOperations.ts): Add Visitor must never
// create a duplicate visitor/membership for a phone number that already has
// an active membership at this gym, must offer "Check in as Member" instead,
// must block a duplicate check-in, must leave an expired member free to be
// re-sold, and must track session-package usage without ever touching a
// calendar membership's expiry.
//
// Same harness as gymMembershipIdentity.test.ts: a real server process
// against a fresh temp SQLite DB. Nothing here is mocked.
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = mkdtempSync(path.join(tmpdir(), "noq-gym-add-visitor-"));
const port = 41000 + Math.floor(Math.random() * 8000);
const base = `http://127.0.0.1:${port}`;
let child: ChildProcess;
let owner = "";
let membershipOfferingId = "";
let sessionOfferingId = "";

const api = async (method: string, endpoint: string, body?: unknown, token = "") => {
  const res = await fetch(base + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as any };
};
const gym = (p = "") => `/api/gym/gym-1/${p}`;

async function start() {
  child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      DATABASE_URL: "",
      DATA_DIR: dataDir,
      PORT: String(port),
      NODE_ENV: "production",
      NO_WAIT_TEST_DEPLOYMENT: "true",
      ADMIN_EMAIL: "gym-add-visitor-qa@example.test",
      ADMIN_PASSWORD: "local-qa-only-password",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    let logs = "";
    const timeout = setTimeout(() => reject(new Error(logs || "Server start timed out")), 15000);
    child.stdout!.on("data", (b) => {
      logs += b;
      if (logs.includes("server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr!.on("data", (b) => {
      logs += b;
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited ${code}: ${logs}`));
    });
  });
}
async function stop() {
  if (child && child.exitCode === null)
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.kill("SIGTERM");
    });
}

const state = async () => (await api("GET", gym("overview"), undefined, owner)).data;

async function addVisitor(body: Record<string, unknown>) {
  return api("POST", gym("operations/add_visitor"), body, owner);
}

before(async () => {
  await start();
  const fixture = new DatabaseSync(path.join(dataDir, "no-wait-salon.db"));
  fixture.prepare("UPDATE salon SET business_code=? WHERE id=?").run("IRONHOUSE01", "gym-1");
  fixture.close();
  owner = (
    await api("POST", "/api/staff/login", {
      businessCode: "IRONHOUSE01",
      email: "ironhouse-owner@nowaitsalon.test",
      password: "staff123",
    })
  ).data.token;
  assert.ok(owner, "gym-1 owner must log in");

  const membership = await api(
    "POST",
    gym("operations/offerings"),
    {
      name: "Gold Membership",
      type: "membership",
      priceInr: 2000,
      durationValue: 1,
      durationUnit: "month",
      active: true,
      customerVisible: true,
      paymentOptions: ["cash"],
    },
    owner,
  );
  assert.equal(membership.status, 200);
  membershipOfferingId = membership.data.state.offerings.find(
    (o: any) => o.name === "Gold Membership",
  ).id;

  const sessionPack = await api(
    "POST",
    gym("operations/offerings"),
    {
      name: "10-Session Pack",
      type: "membership",
      priceInr: 3000,
      durationValue: 3,
      durationUnit: "session",
      active: true,
      customerVisible: true,
      paymentOptions: ["cash"],
    },
    owner,
  );
  assert.equal(sessionPack.status, 200);
  sessionOfferingId = sessionPack.data.state.offerings.find(
    (o: any) => o.name === "10-Session Pack",
  ).id;
});
after(async () => {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
});

test("mobile number is required for Add Visitor", async () => {
  const missing = await addVisitor({ name: "No Phone Guy", offeringId: "custom_entry" });
  assert.equal(missing.status, 400);
  assert.match(missing.data.error, /mobile number is required/i);

  const tooShort = await addVisitor({ name: "Bad Phone", mobile: "12345", offeringId: "custom_entry" });
  assert.equal(tooShort.status, 400);
});

test("existing active member entered through Add Visitor (Custom Entry) is caught before creating anything", async () => {
  const phone = "9200000001";
  const purchase = await addVisitor({
    name: "Rahul",
    mobile: phone,
    offeringId: membershipOfferingId,
    method: "cash",
  });
  assert.equal(purchase.status, 200);
  // Check the purchase's own immediate visit back out first, so this test
  // isolates duplicate-membership detection from the already-inside case
  // (covered separately below).
  const purchaseMembership = purchase.data.state.memberships.find((m: any) => m.customerName === "Rahul");
  const purchaseVisit = purchase.data.state.visits.find(
    (v: any) => v.membershipId === purchaseMembership.id && !v.checkedOutAt,
  );
  assert.ok(purchaseVisit);
  const afterCheckout = await api("POST", gym("checkout"), { visitId: purchaseVisit.id }, owner);
  const membershipsBefore = afterCheckout.data.state.memberships.length;
  const visitsBefore = afterCheckout.data.state.visits.length;

  // Staff tries to add the same person again as a free Custom Entry —
  // never identified by name alone, the phone number alone is enough to
  // catch it.
  const repeat = await addVisitor({ name: "Rahul K", mobile: phone, offeringId: "custom_entry" });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.data.requiresConfirmation, true);
  assert.equal(repeat.data.alreadyCheckedIn, false);
  assert.equal(repeat.data.existingMember.name, "Rahul");
  assert.equal(repeat.data.existingMember.planName, "Gold Membership");
  assert.ok(repeat.data.existingMember.daysRemaining > 0);

  const s = await state();
  assert.equal(s.memberships.length, membershipsBefore, "no duplicate membership was created");
  assert.equal(s.visits.length, visitsBefore, "no duplicate visitor visit was created");
});

test("existing active member entered through Add Visitor (paid offering) is caught before creating a payment", async () => {
  const phone = "9200000002";
  const purchase = await addVisitor({
    name: "Priya",
    mobile: phone,
    offeringId: membershipOfferingId,
    method: "cash",
  });
  assert.equal(purchase.status, 200);
  const paymentsBefore = purchase.data.state.payments.length;
  const membershipsBefore = purchase.data.state.memberships.length;

  const repeat = await addVisitor({
    name: "Priya",
    mobile: phone,
    offeringId: membershipOfferingId,
    method: "cash",
  });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.data.requiresConfirmation, true);

  const s = await state();
  assert.equal(s.payments.length, paymentsBefore, "no duplicate payment was created");
  assert.equal(s.memberships.length, membershipsBefore, "no duplicate membership was created");
});

test("confirming 'Check in as Member' uses the existing identity and creates exactly one visit", async () => {
  const phone = "9200000003";
  const purchase = await addVisitor({
    name: "Vikram",
    mobile: phone,
    offeringId: membershipOfferingId,
    method: "cash",
  });
  const originalMembershipId = purchase.data.state.memberships.find(
    (m: any) => m.customerName === "Vikram",
  ).id;
  // The purchase itself already opened a visit (capacity available) — close
  // it so the confirmation flow below starts from "not inside". Matched by
  // membershipId: this membership is unclaimed (no verified account exists
  // for this phone yet), so its visit never carries a customerId.
  const openVisit = purchase.data.state.visits.find(
    (v: any) => v.membershipId === originalMembershipId && !v.checkedOutAt,
  );
  assert.ok(openVisit);
  await api("POST", gym("checkout"), { visitId: openVisit.id }, owner);

  const repeat = await addVisitor({ name: "Vikram", mobile: phone, offeringId: "custom_entry" });
  assert.equal(repeat.data.requiresConfirmation, true);
  assert.equal(repeat.data.existingMember.membershipId, originalMembershipId);

  const confirmed = await api(
    "POST",
    gym("operations/confirm_member_checkin"),
    { membershipId: originalMembershipId },
    owner,
  );
  assert.equal(confirmed.status, 200);
  const openVisits = confirmed.data.state.visits.filter(
    (v: any) => v.membershipId === originalMembershipId && !v.checkedOutAt,
  );
  assert.equal(openVisits.length, 1, "exactly one physical visit must exist");
  assert.equal(openVisits[0].purpose, "member", "Live Floor type must be MEMBER");
  assert.equal(openVisits[0].membershipId, originalMembershipId, "uses the existing membership identity");

  const memberships = confirmed.data.state.memberships.filter(
    (m: any) => m.id === originalMembershipId,
  );
  assert.equal(memberships.length, 1, "never duplicates the membership");
});

test("already-inside member: confirming a second time blocks the duplicate check-in", async () => {
  const phone = "9200000004";
  const purchase = await addVisitor({
    name: "Ananya",
    mobile: phone,
    offeringId: membershipOfferingId,
    method: "cash",
  });
  const membershipId = purchase.data.state.memberships.find(
    (m: any) => m.customerName === "Ananya",
  ).id;
  // Purchase already checked them in (capacity available). Add Visitor
  // called again for the same phone must report alreadyCheckedIn.
  const repeat = await addVisitor({ name: "Ananya", mobile: phone, offeringId: "custom_entry" });
  assert.equal(repeat.data.requiresConfirmation, true);
  assert.equal(repeat.data.alreadyCheckedIn, true, "already inside must be flagged before any confirm step");

  const confirmAgain = await api(
    "POST",
    gym("operations/confirm_member_checkin"),
    { membershipId },
    owner,
  );
  assert.equal(confirmAgain.status, 400);
  assert.match(confirmAgain.data.error, /already checked in/i);
});

test("expired membership is never treated as active — Add as Visitor / Renew / Sell Access all remain available", async () => {
  const phone = "9200000005";
  const purchase = await addVisitor({
    name: "Rohit",
    mobile: phone,
    offeringId: membershipOfferingId,
    method: "cash",
  });
  const membershipId = purchase.data.state.memberships.find(
    (m: any) => m.customerName === "Rohit",
  ).id;

  // Force this membership into the past so reconcileExpiredMemberships (run
  // on every commit) flips it to expired, exactly like real calendar decay.
  const fixture = new DatabaseSync(path.join(dataDir, "no-wait-salon.db"));
  const row = fixture.prepare("SELECT state_json FROM gym_state WHERE gym_id='gym-1'").get() as {
    state_json: string;
  };
  const raw = JSON.parse(row.state_json);
  const m = raw.memberships.find((x: any) => x.id === membershipId);
  m.expiryDate = "2000-01-01";
  fixture.prepare("UPDATE gym_state SET state_json=? WHERE gym_id='gym-1'").run(JSON.stringify(raw));
  fixture.close();

  // Add as Visitor (Custom Entry) must succeed — an expired member is not
  // an active member.
  const asVisitor = await addVisitor({ name: "Rohit", mobile: phone, offeringId: "custom_entry" });
  assert.equal(asVisitor.status, 200);
  assert.equal(asVisitor.data.requiresConfirmation, undefined, "expired membership must never trigger the member-confirmation prompt");

  // Renew / Sell Access (buying the membership offering again) must also
  // succeed rather than being blocked as a duplicate.
  await api("POST", gym("checkout"), { visitId: asVisitor.data.state.visits.find((v: any) => v.name === "Rohit").id }, owner);
  const renew = await addVisitor({
    name: "Rohit",
    mobile: phone,
    offeringId: membershipOfferingId,
    method: "cash",
  });
  assert.equal(renew.status, 200);
  assert.equal(renew.data.requiresConfirmation, undefined);
  const activeNow = renew.data.state.memberships.filter(
    (mm: any) => mm.customerName === "Rohit" && mm.status === "active",
  );
  assert.equal(activeNow.length, 1, "renewal creates a fresh active membership");
});

test("session package usage: consumes exactly one session per successful new check-in, never on a duplicate", async () => {
  const phone = "9200000006";
  const purchase = await addVisitor({
    name: "Meera",
    mobile: phone,
    offeringId: sessionOfferingId,
    method: "cash",
  });
  assert.equal(purchase.status, 200);
  const membership = purchase.data.state.memberships.find((m: any) => m.customerName === "Meera");
  assert.equal(membership.sessionsTotal, 3);
  // Capacity was available, so the purchase itself opened a visit and
  // consumed the first session already.
  assert.equal(membership.sessionsUsed, 1);

  const visit1 = purchase.data.state.visits.find(
    (v: any) => v.membershipId === membership.id && !v.checkedOutAt,
  );
  await api("POST", gym("checkout"), { visitId: visit1.id }, owner);

  const secondCheckIn = await api(
    "POST",
    gym("operations/confirm_member_checkin"),
    { membershipId: membership.id },
    owner,
  );
  assert.equal(secondCheckIn.status, 200);
  let updated = secondCheckIn.data.state.memberships.find((m: any) => m.id === membership.id);
  assert.equal(updated.sessionsUsed, 2, "second physical check-in consumes exactly one more session");
  assert.equal(updated.status, "active", "one session remains");

  const visit2 = secondCheckIn.data.state.visits.find(
    (v: any) => v.membershipId === membership.id && !v.checkedOutAt,
  );
  await api("POST", gym("checkout"), { visitId: visit2.id }, owner);

  const thirdCheckIn = await api(
    "POST",
    gym("operations/confirm_member_checkin"),
    { membershipId: membership.id },
    owner,
  );
  assert.equal(thirdCheckIn.status, 200);
  updated = thirdCheckIn.data.state.memberships.find((m: any) => m.id === membership.id);
  assert.equal(updated.sessionsUsed, 3, "third check-in uses the last session");
  assert.equal(updated.status, "expired", "the package is used up once sessionsUsed reaches sessionsTotal");

  // No sessions left: a 4th confirm must fail because the membership is no
  // longer active (findActiveMembershipForIdentity/confirm_member_checkin
  // both gate on status === "active").
  const visit3 = thirdCheckIn.data.state.visits.find(
    (v: any) => v.membershipId === membership.id && !v.checkedOutAt,
  );
  await api("POST", gym("checkout"), { visitId: visit3.id }, owner);
  const fourthAttempt = await api(
    "POST",
    gym("operations/confirm_member_checkin"),
    { membershipId: membership.id },
    owner,
  );
  assert.equal(fourthAttempt.status, 400);
});

test("calendar (date-based) membership: check-in never subtracts from expiry — attendance only", async () => {
  const phone = "9200000007";
  const purchase = await addVisitor({
    name: "Sana",
    mobile: phone,
    offeringId: membershipOfferingId,
    method: "cash",
  });
  const membership = purchase.data.state.memberships.find((m: any) => m.customerName === "Sana");
  assert.equal(membership.sessionsTotal, undefined, "a calendar membership carries no session counter");
  const originalExpiry = membership.expiryDate;

  const visit1 = purchase.data.state.visits.find(
    (v: any) => v.membershipId === membership.id && !v.checkedOutAt,
  );
  await api("POST", gym("checkout"), { visitId: visit1.id }, owner);

  // Two more full check-in/check-out cycles — a date-based membership's
  // expiry must be byte-for-byte unchanged no matter how many times the
  // member checks in.
  for (let i = 0; i < 2; i++) {
    const checkIn = await api(
      "POST",
      gym("operations/confirm_member_checkin"),
      { membershipId: membership.id },
      owner,
    );
    assert.equal(checkIn.status, 200);
    const updated = checkIn.data.state.memberships.find((m: any) => m.id === membership.id);
    assert.equal(updated.expiryDate, originalExpiry, "expiry must never move on check-in");
    assert.equal(updated.status, "active");
    const openVisit = checkIn.data.state.visits.find(
      (v: any) => v.membershipId === membership.id && !v.checkedOutAt,
    );
    await api("POST", gym("checkout"), { visitId: openVisit.id }, owner);
  }
});
