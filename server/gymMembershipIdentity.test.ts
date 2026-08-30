// Real-server coverage for Gym membership identity linking: a membership a
// staff member creates against a customer's mobile number must be
// recognized by that customer the moment they verify/login with the SAME
// number — independent of whatever OTP provider does the verifying. See the
// identity-linking helpers in src/shared/gymBusiness.ts (customerMobileNormalized,
// isUnclaimedCustomerId, reconcileUnclaimedMembershipsForPhone) and their
// call sites in server/index.ts (OTP verify, /my-membership, /gym-memberships)
// and server/gymOperations.ts (Add Visitor, membership claim approval).
//
// Same harness as gymAccessFlow.test.ts: a real server process against a
// fresh temp SQLite DB. Nothing here is mocked.
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";

const dataDir = mkdtempSync(path.join(tmpdir(), "noq-gym-identity-"));
const port = 41000 + Math.floor(Math.random() * 8000);
const base = `http://127.0.0.1:${port}`;
let child: ChildProcess;
let owner = "";
let membershipOfferingId = "";

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
const gymA = (p = "") => `/api/gym/gym-1/${p}`;
const gymB = (p = "") => `/api/gym/gym-2/${p}`;

async function start() {
  child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      DATABASE_URL: "",
      DATA_DIR: dataDir,
      PORT: String(port),
      NODE_ENV: "production",
      NO_WAIT_TEST_DEPLOYMENT: "true",
      ADMIN_EMAIL: "gym-identity-qa@example.test",
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

async function loginCustomer(phone: string) {
  const req = await api("POST", "/api/otp/request", { phone });
  const verify = await api("POST", "/api/otp/verify", {
    challengeId: req.data.challengeId,
    code: req.data.demoCode,
  });
  return verify.data as { token: string; customerId: string; phone: string };
}

const state = async (which: (p?: string) => string = gymA) => (await api("GET", which("overview"), undefined, owner)).data;

async function addVisitorMembership(name: string, mobile: string, ownerToken = owner, path = gymA) {
  return api(
    "POST",
    path("operations/add_visitor"),
    { name, mobile, offeringId: membershipOfferingId, method: "cash" },
    ownerToken,
  );
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

  const created = await api(
    "POST",
    gymA("operations/offerings"),
    {
      name: "Monthly Membership",
      type: "membership",
      priceInr: 1500,
      durationValue: 1,
      durationUnit: "month",
      active: true,
      customerVisible: true,
      paymentOptions: ["cash"],
    },
    owner,
  );
  assert.equal(created.status, 200);
  membershipOfferingId = created.data.state.offerings.find(
    (o: any) => o.name === "Monthly Membership",
  ).id;
});
after(async () => {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
});

test("1. staff adds a membership before any customer account exists, then the customer verifies and sees it — no repurchase", async (t) => {
  const phone = "9111100001";

  await t.test("staff creates the membership against the raw mobile number", async () => {
    const res = await addVisitorMembership("Ramu", phone);
    assert.equal(res.status, 200);
    const membership = res.data.state.memberships.find((m: any) => m.customerName === "Ramu");
    assert.ok(membership, "membership must be created");
    assert.ok(membership.customerId.startsWith("walkin-"), "unclaimed — no account existed yet");
    assert.equal(membership.customerMobileNormalized, phone);
    assert.equal(membership.status, "active");
  });

  await t.test("the customer verifies the SAME mobile number and immediately sees the membership", async () => {
    const customer = await loginCustomer(phone);
    const mine = await api("GET", gymA("my-membership"), undefined, customer.token);
    assert.equal(mine.status, 200);
    assert.ok(mine.data.membership, "the existing membership must auto-link, not require repurchase");
    assert.equal(mine.data.membership.planName, "Monthly Membership");
    assert.equal(mine.data.membership.customerId, customer.customerId);
    assert.equal(mine.data.membership.displayStatus, "active");
    assert.ok(mine.data.membership.daysRemaining > 0);
  });

  await t.test("the membership row itself is now linked to the real customerId, not the synthetic one", async () => {
    const customer = await loginCustomer(phone);
    const s = await state();
    const membership = s.memberships.find((m: any) => m.customerName === "Ramu");
    assert.equal(membership.customerId, customer.customerId);
    assert.equal(
      s.memberships.filter((m: any) => m.customerName === "Ramu" && m.status === "active").length,
      1,
      "still exactly one membership row",
    );
  });
});

test("2. customer account exists first, then staff adds a membership — links directly, no walk-in id", async (t) => {
  const phone = "9111100002";
  let customer: { token: string; customerId: string };

  await t.test("customer verifies first, with no membership anywhere yet", async () => {
    customer = await loginCustomer(phone);
    const mine = await api("GET", gymA("my-membership"), undefined, customer.token);
    assert.equal(mine.data.membership, null);
  });

  await t.test("staff adds the membership using the same mobile — it attaches to the real customerId immediately", async () => {
    const res = await addVisitorMembership("Seema", phone);
    assert.equal(res.status, 200);
    const membership = res.data.state.memberships.find((m: any) => m.customerName === "Seema");
    assert.equal(membership.customerId, customer.customerId, "Case A: direct link, never a synthetic walk-in id");
  });

  await t.test("the customer sees it without any extra step", async () => {
    const mine = await api("GET", gymA("my-membership"), undefined, customer.token);
    assert.ok(mine.data.membership);
    assert.equal(mine.data.membership.planName, "Monthly Membership");
  });
});

test("3. phone normalization — staff uses +91 formatting, customer verifies the local 10-digit number", async (t) => {
  const local = "9111100003";

  await t.test("staff enters the number with country code, spaces and a dash", async () => {
    const res = await addVisitorMembership("Formatted Person", "+91 91111-00003");
    assert.equal(res.status, 200);
    const membership = res.data.state.memberships.find((m: any) => m.customerName === "Formatted Person");
    assert.equal(membership.customerMobileNormalized, local, "normalized to the same 10-digit key");
  });

  await t.test("the customer verifies the plain local number and it links", async () => {
    const customer = await loginCustomer(local);
    const mine = await api("GET", gymA("my-membership"), undefined, customer.token);
    assert.ok(mine.data.membership, "+91-formatted and local numbers must resolve to the same identity");
    assert.equal(mine.data.membership.customerId, customer.customerId);
  });
});

test("4. wrong number — a different verified customer cannot see or claim someone else's membership", async (t) => {
  await addVisitorMembership("Private Owner", "9111100004");
  const stranger = await loginCustomer("9111100005");
  const mine = await api("GET", gymA("my-membership"), undefined, stranger.token);
  assert.equal(mine.data.membership, null, "a non-matching verified phone must never see the membership");
});

test("5. cross-gym isolation — the same phone's membership at Gym A never appears at Gym B", async (t) => {
  // Gym B ("gym-2" / VELOCITY01) is one of the app's own demo businesses,
  // already backfilled by the server's own startup seeding — just give it a
  // staff session directly in SQLite, exactly like gymLiveFloor.test.ts does
  // for its cross-business isolation coverage, using the server's own
  // token-hash scheme (sha256/base64url via hashCode).
  const fixture = new DatabaseSync(path.join(dataDir, "no-wait-salon.db"));
  const now = Date.now();
  fixture.prepare("UPDATE salon SET onboarded = 1 WHERE id = 'gym-2'").run();
  const staffId = `staff_${randomUUID()}`;
  fixture
    .prepare(
      "INSERT INTO staff_account (id, business_id, email, password_hash, name, role, active, created_at, updated_at) VALUES (?, 'gym-2', 'ironpeak-owner@nowaitsalon.test', '', 'Peak Owner', 'owner', 1, ?, ?)",
    )
    .run(staffId, now, now);
  const gym2Token = `staff_${randomUUID()}${randomUUID().replaceAll("-", "")}`;
  const tokenHash = createHash("sha256").update(gym2Token).digest("base64url");
  fixture
    .prepare(
      "INSERT INTO staff_session (token_hash, staff_id, business_id, expires_at, created_at) VALUES (?, ?, 'gym-2', ?, ?)",
    )
    .run(tokenHash, staffId, now + 30 * 24 * 60 * 60_000, now);
  fixture.close();

  const offeringB = await api(
    "POST",
    gymB("operations/offerings"),
    {
      name: "Peak Monthly",
      type: "membership",
      priceInr: 1200,
      durationValue: 1,
      durationUnit: "month",
      active: true,
      customerVisible: true,
      paymentOptions: ["cash"],
    },
    gym2Token,
  );
  assert.equal(offeringB.status, 200);
  const offeringBId = offeringB.data.state.offerings.find((o: any) => o.name === "Peak Monthly").id;

  const phone = "9111100006";
  await addVisitorMembership("Cross Gym Person", phone); // Gym A membership

  const customer = await loginCustomer(phone);
  const atGymA = await api("GET", gymA("my-membership"), undefined, customer.token);
  assert.ok(atGymA.data.membership, "Gym A membership must be visible");

  const atGymB = await api("GET", gymB("my-membership"), undefined, customer.token);
  assert.equal(atGymB.data.membership, null, "Gym B must stay isolated from Gym A's membership");

  await api(
    "POST",
    gymB("operations/add_visitor"),
    { name: "Cross Gym Person", mobile: phone, offeringId: offeringBId, method: "cash" },
    gym2Token,
  );
  const atGymBAfter = await api("GET", gymB("my-membership"), undefined, customer.token);
  assert.ok(atGymBAfter.data.membership, "a separate Gym B membership is independent and unaffected");
  assert.equal(atGymBAfter.data.membership.planName, "Peak Monthly");
});

test("6. duplicate prevention — repeating the same staff Add Visitor for an active member asks for confirmation instead of duplicating", async (t) => {
  const phone = "9111100007";
  const first = await addVisitorMembership("Repeat Person", phone);
  assert.equal(first.status, 200);

  // Add Visitor never silently creates a second membership for an already
  // active member — it comes back with a confirmation prompt instead, and
  // creates nothing until the owner explicitly confirms "Check in as Member".
  const second = await addVisitorMembership("Repeat Person", phone);
  assert.equal(second.status, 200);
  assert.equal(second.data.requiresConfirmation, true);
  assert.match(second.data.existingMember.planName, /.+/);
  assert.equal(second.data.existingMember.name, "Repeat Person");

  const s = await state();
  assert.equal(
    s.memberships.filter((m: any) => m.customerName === "Repeat Person" && m.status === "active").length,
    1,
    "only one active membership must exist",
  );

  // The original purchase already checked this person in (capacity was
  // available) — close that visit so confirming below starts from "not
  // inside" instead of hitting the already-checked-in guard.
  const openVisit = s.visits.find(
    (v: any) => v.membershipId === second.data.existingMember.membershipId && !v.checkedOutAt,
  );
  assert.ok(openVisit);
  await api("POST", gymA("checkout"), { visitId: openVisit.id }, owner);

  // Confirming uses the existing membership identity and opens exactly one
  // physical visit — never a second membership.
  const confirmed = await api(
    "POST",
    gymA("operations/confirm_member_checkin"),
    { membershipId: second.data.existingMember.membershipId },
    owner,
  );
  assert.equal(confirmed.status, 200);
  const visits = confirmed.data.state.visits.filter(
    (v: any) => v.membershipId === second.data.existingMember.membershipId && !v.checkedOutAt,
  );
  assert.equal(visits.length, 1, "confirming must create exactly one open visit");
  assert.equal(visits[0].purpose, "member");

  // Confirming again while still checked in must block the duplicate.
  const again = await api(
    "POST",
    gymA("operations/confirm_member_checkin"),
    { membershipId: second.data.existingMember.membershipId },
    owner,
  );
  assert.equal(again.status, 400);
  assert.match(again.data.error, /already checked in/i);
});

test("7. existing duplicate reconciliation — an approved claim re-links an existing unclaimed row instead of duplicating it", async (t) => {
  const phone = "9111100008";
  const walkin = await addVisitorMembership("Legacy Duplicate", phone);
  assert.equal(walkin.status, 200);
  const originalMembershipId = walkin.data.state.memberships.find(
    (m: any) => m.customerName === "Legacy Duplicate",
  ).id;
  const originalJoinedDate = walkin.data.state.memberships.find(
    (m: any) => m.customerName === "Legacy Duplicate",
  ).joinedDate;

  const customer = await loginCustomer(phone);
  // This customer already auto-linked via OTP verify — simulate the "claim
  // still pending from before this fix" edge case by submitting one anyway;
  // it is rejected because reconciliation already attached an active
  // membership, which is itself proof there is no duplicate to create.
  const claimAttempt = await api(
    "POST",
    gymA("membership-claims"),
    { name: "Legacy Duplicate", mobile: phone, joiningDate: "2026-01-01", expiryDate: "2099-01-01", planText: "Old plan" },
    customer.token,
  );
  assert.equal(claimAttempt.status, 409, "cannot file a claim while already an active member — no duplicate path");

  const s = await state();
  const rows = s.memberships.filter((m: any) => m.customerName === "Legacy Duplicate");
  assert.equal(rows.length, 1, "exactly one logical membership row survives");
  assert.equal(rows[0].id, originalMembershipId, "the original row's identity and history are preserved");
  assert.equal(rows[0].joinedDate, originalJoinedDate, "earliest valid join date is preserved");
  assert.equal(rows[0].customerId, customer.customerId);
});

test("8. members analytics — active members and revenue are not double-counted after auto-link", async (t) => {
  const phone = "9111100009";
  const before = await state();
  const activeBefore = before.memberships.filter((m: any) => m.status === "active").length;

  await addVisitorMembership("Analytics Person", phone);
  const customer = await loginCustomer(phone);
  await api("GET", gymA("my-membership"), undefined, customer.token); // triggers self-heal read path too

  const after = await state();
  const activeAfter = after.memberships.filter((m: any) => m.status === "active").length;
  assert.equal(activeAfter, activeBefore + 1, "exactly one new active membership, not two");

  const payments = after.payments.filter((p: any) => p.customerName === "Analytics Person");
  assert.equal(payments.length, 1, "exactly one payment recorded for this member");
  assert.equal(payments[0].customerId, customer.customerId, "payment history re-links to the real customer");
});

test("9. customer UI contract — active membership appears immediately post-verification, no buy-again signal needed", async (t) => {
  const phone = "9111100010";
  await addVisitorMembership("UI Person", phone);
  const customer = await loginCustomer(phone);
  const mine = await api("GET", gymA("my-membership"), undefined, customer.token);
  assert.ok(mine.data.membership, "ACTIVE MEMBERSHIP must be present so the client never renders Buy Membership");
  assert.equal(mine.data.membership.status, "active");
  assert.equal(mine.data.membership.displayStatus, "active");
  assert.equal(mine.data.pendingClaim, null, "no pending claim CTA either — this member is already resolved");
});

test("10. regression — manual existing-member claim flow and payment/check-in still work for a brand-new person", async (t) => {
  const phone = "9111100011";
  const customer = await loginCustomer(phone);

  const claim = await api(
    "POST",
    gymA("membership-claims"),
    { name: "Genuine Claimant", mobile: phone, joiningDate: "2026-01-01", expiryDate: "2099-01-01", planText: "Legacy plan" },
    customer.token,
  );
  assert.equal(claim.status, 201);
  const claimId = claim.data.claim.id;

  const approve = await api(
    "POST",
    gymA("operations/membership_claims"),
    { id: claimId, action: "approve" },
    owner,
  );
  assert.equal(approve.status, 200);
  const membership = approve.data.state.memberships.find((m: any) => m.customerId === customer.customerId);
  assert.ok(membership, "manual claim approval must still create/link a real membership");
  assert.equal(membership.source, "claim");

  const mine = await api("GET", gymA("my-membership"), undefined, customer.token);
  assert.ok(mine.data.membership);
  assert.equal(mine.data.membership.planName, "Legacy plan");
});
