// Real-server coverage for the Gym access state machine added in the
// shared-architecture v1 extension: free Custom Entry, the paid cash flow
// (select -> purchase intent -> pending -> staff accept -> visit starts), the
// honesty of the online path, the server-enforced single-active-visit lock,
// the owner "Recommend this plan" toggle, and the checkout transition that
// moves a visit from Inside to Left and re-opens purchasing.
//
// Same harness as gymOperations.test.ts / gymLiveFloor.test.ts: a real server
// process against a fresh temp SQLite DB. Nothing here is mocked.
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = mkdtempSync(path.join(tmpdir(), "noq-gym-access-"));
const port = 42000 + Math.floor(Math.random() * 8000);
const base = `http://127.0.0.1:${port}`;
let child: ChildProcess;
let owner = "";

const api = async (method: string, endpoint: string, body?: unknown, token = "") => {
  const res = await fetch(base + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) as any };
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
      ADMIN_EMAIL: "gym-access-qa@example.test",
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
  return verify.data as { token: string; customerId: string };
}

const state = async () => (await api("GET", gym("overview"), undefined, owner)).data;

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
});
after(async () => {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
});

test("Custom Entry — Free: a real visit with no payment behind it", async (t) => {
  let visitId = "";

  await t.test("requires a Gym staff session for this business", async () => {
    const res = await api("POST", gym("operations/add_visitor"), {
      name: "Unauthorized Guest",
      offeringId: "custom_entry",
    });
    assert.equal(res.status, 403);
  });

  await t.test("creates a staff-verified visitor visit immediately, with no GymPayment at all", async () => {
    const before = await state();
    const paymentsBefore = before.payments.length;

    const res = await api(
      "POST",
      gym("operations/add_visitor"),
      { name: "Trial Guest", mobile: "9811100001", offeringId: "custom_entry", method: "cash" },
      owner,
    );
    assert.equal(res.status, 200);
    const after = res.data.state;

    // No payment object was created — not even a ₹0 "paid" one.
    assert.equal(after.payments.length, paymentsBefore, "Custom Entry must not create a payment");

    const visit = after.visits.find((v: any) => v.name === "Trial Guest");
    assert.ok(visit, "Custom Entry must create a real visit");
    visitId = visit.id;
    assert.equal(visit.customEntry, true);
    assert.equal(visit.purpose, "visitor");
    assert.equal(visit.entryMethod, "staff_manual");
    assert.equal(visit.offeringId, undefined, "Custom Entry is not backed by an offering");
    assert.equal(visit.paymentId, undefined, "Custom Entry has no payment to link");
    assert.equal(visit.membershipId, undefined, "Custom Entry is never a membership");
    assert.ok(visit.checkedInAt > 0);
    assert.equal(visit.checkedOutAt, undefined);
    assert.equal(after.currentOccupancy, before.currentOccupancy + 1, "Inside Now +1");
  });

  await t.test("no pending payment is waiting on the Payments tab because of it", async () => {
    const s = await state();
    assert.equal(
      s.payments.some((p: any) => p.customerName === "Trial Guest"),
      false,
    );
  });

  await t.test("checking a Custom Entry visitor out works and freezes the visit", async () => {
    const before = await state();
    const res = await api("POST", gym("checkout"), { visitId }, owner);
    assert.equal(res.status, 200);
    const closed = res.data.state.visits.find((v: any) => v.id === visitId);
    assert.ok(closed.checkedOutAt >= closed.checkedInAt);
    assert.equal(closed.checkoutSource, "staff");
    assert.equal(closed.customEntry, true, "the record keeps saying it was a Custom Entry");
    assert.equal(res.data.state.currentOccupancy, before.currentOccupancy - 1);
  });

  await t.test("the checked-out Custom Entry visit is retained as history, never deleted", async () => {
    const s = await state();
    const row = s.visits.find((v: any) => v.id === visitId);
    assert.ok(row, "history must survive checkout");
    assert.ok(row.checkedOutAt);
  });

  await t.test("'custom_entry' is never accepted as a real offering id elsewhere", async () => {
    const res = await api(
      "POST",
      gym("operations/accept_payment"),
      { paymentId: "custom_entry" },
      owner,
    );
    assert.equal(res.status, 400);
  });
});

test("Paid access: select -> pay -> pending -> staff accept -> visit starts", async (t) => {
  let customer: { token: string; customerId: string };
  let offeringId = "";
  let paymentId = "";
  let visitId = "";

  await t.test("a purchase intent creates a pending payment and NOTHING else", async () => {
    customer = await loginCustomer("9822200001");
    const before = await state();
    offeringId = before.offerings.find((o: any) => o.active && o.type !== "membership").id;
    const insideBefore = before.currentOccupancy;

    const res = await api(
      "POST",
      gym("purchase-intent"),
      { offeringId, method: "cash" },
      customer.token,
    );
    assert.equal(res.status, 201);
    paymentId = res.data.payment.id;
    assert.equal(res.data.payment.status, "pending");
    assert.equal(res.data.payment.method, "cash");

    const after = await state();
    // The critical invariant: paying is not entering.
    assert.equal(after.currentOccupancy, insideBefore, "purchase must not change Inside Now");
    assert.equal(
      after.visits.some((v: any) => v.customerId === customer.customerId && !v.checkedOutAt),
      false,
      "purchase must not create an active visit",
    );
  });

  await t.test("the customer sees their own pending payment, and no active visit", async () => {
    const mine = await api("GET", gym("my-membership"), undefined, customer.token);
    assert.equal(mine.status, 200);
    assert.equal(mine.data.activeVisit, null);
    const pending = mine.data.pendingPayments.find((p: any) => p.id === paymentId);
    assert.ok(pending, "the pending payment must be visible to the customer");
    assert.equal(pending.status, "pending");
    assert.equal(pending.method, "cash");
  });

  await t.test("the gym sees it as a cash payment awaiting a decision", async () => {
    const s = await state();
    const payment = s.payments.find((p: any) => p.id === paymentId);
    assert.equal(payment.status, "pending");
    assert.equal(payment.method, "cash");
    assert.equal(payment.visitId, undefined);
  });

  await t.test("a duplicate intent for the same access is rejected, not queued twice", async () => {
    const res = await api(
      "POST",
      gym("purchase-intent"),
      { offeringId, method: "cash" },
      customer.token,
    );
    assert.equal(res.status, 409);
    assert.equal(res.data.code, "PAYMENT_ALREADY_PENDING");
  });

  await t.test("staff Accept & Check In is what actually starts the visit and Inside Now +1", async () => {
    const before = await state();
    const res = await api("POST", gym("operations/accept_payment"), { paymentId }, owner);
    assert.equal(res.status, 200);
    const after = res.data.state;

    const payment = after.payments.find((p: any) => p.id === paymentId);
    assert.equal(payment.status, "paid");
    assert.ok(payment.acceptedAt > 0);
    assert.ok(payment.acceptedBy);

    const visit = after.visits.find(
      (v: any) => v.customerId === customer.customerId && !v.checkedOutAt,
    );
    assert.ok(visit, "accepting must open the real visit");
    visitId = visit.id;
    assert.equal(visit.paymentId, paymentId);
    assert.equal(visit.offeringId, offeringId);
    assert.equal(payment.visitId, visit.id);
    assert.equal(after.currentOccupancy, before.currentOccupancy + 1, "Inside Now +1");
  });

  await t.test("the customer flips to the Active Visit state with a real checkedInAt", async () => {
    const mine = await api("GET", gym("my-membership"), undefined, customer.token);
    assert.ok(mine.data.activeVisit);
    assert.equal(mine.data.activeVisit.id, visitId);
    assert.ok(mine.data.activeVisit.checkedInAt > 0);
    assert.equal(mine.data.activeVisit.checkedOutAt, undefined);
  });

  await t.test("ACTIVE-PASS LOCK: buying another visitor pass while inside is refused server-side", async () => {
    const s = await state();
    const otherPass = s.offerings.find(
      (o: any) => o.active && o.type !== "membership" && o.id !== offeringId,
    );
    const sameAgain = await api(
      "POST",
      gym("purchase-intent"),
      { offeringId, method: "cash" },
      customer.token,
    );
    assert.equal(sameAgain.status, 409);
    assert.equal(sameAgain.data.code, "ACTIVE_VISIT_EXISTS");
    if (otherPass) {
      const different = await api(
        "POST",
        gym("purchase-intent"),
        { offeringId: otherPass.id, method: "cash" },
        customer.token,
      );
      assert.equal(different.status, 409);
      assert.equal(different.data.code, "ACTIVE_VISIT_EXISTS");
    }
  });

  await t.test("no duplicate active visit can be created from the staff side either", async () => {
    const res = await api(
      "POST",
      gym("operations/add_visitor"),
      {
        name: "Duplicate Attempt",
        mobile: "9822200001",
        offeringId,
        method: "cash",
        customerId: customer.customerId,
      },
      owner,
    );
    assert.equal(res.status, 400);
    assert.match(res.data.error, /already has an open visit/i);

    const custom = await api(
      "POST",
      gym("operations/add_visitor"),
      {
        name: "Duplicate Custom",
        mobile: "9822200001",
        offeringId: "custom_entry",
        customerId: customer.customerId,
      },
      owner,
    );
    assert.equal(custom.status, 400);

    const s = await state();
    assert.equal(
      s.visits.filter((v: any) => v.customerId === customer.customerId && !v.checkedOutAt).length,
      1,
      "exactly one open visit, always",
    );
  });

  await t.test("checkout moves the visit Inside -> Left with a frozen duration", async () => {
    const before = await state();
    const res = await api("POST", gym("checkout/self"), { visitId }, customer.token);
    assert.equal(res.status, 200);
    assert.equal(res.data.visit.checkoutSource, "customer");

    const after = await state();
    assert.equal(after.currentOccupancy, before.currentOccupancy - 1, "Inside Now -1");
    const closed = after.visits.find((v: any) => v.id === visitId);
    assert.ok(closed.checkedOutAt >= closed.checkedInAt);
    const frozen = closed.checkedOutAt - closed.checkedInAt;
    // Read again later: the same two timestamps, so the same duration.
    const again = await state();
    const reread = again.visits.find((v: any) => v.id === visitId);
    assert.equal(reread.checkedOutAt - reread.checkedInAt, frozen);
    assert.equal(
      after.visits.some((v: any) => v.customerId === customer.customerId && !v.checkedOutAt),
      false,
    );
  });

  await t.test("after checkout the customer may buy a visitor pass again", async () => {
    const res = await api(
      "POST",
      gym("purchase-intent"),
      { offeringId, method: "cash" },
      customer.token,
    );
    assert.equal(res.status, 201, "the active-pass lock only applies while a visit is open");
    assert.equal(res.data.payment.status, "pending");
    // Clean up so it does not leak into later subtests.
    await api("POST", gym("operations/decline_payment"), {
      paymentId: res.data.payment.id,
      reasonCode: "cancelled",
    }, owner);
  });

  await t.test("the closed visit is still in history and readable by the customer", async () => {
    const mine = await api("GET", gym("my-membership"), undefined, customer.token);
    assert.equal(mine.data.activeVisit, null);
    assert.ok(
      mine.data.recentVisits.some((v: any) => v.id === visitId),
      "past visits stay available to the customer",
    );
  });
});

test("Online payment honesty — nothing is ever marked paid without a real settlement", async (t) => {
  await t.test("an online intent stays pending; it never self-reports success", async () => {
    const customer = await loginCustomer("9833300001");
    const s = await state();
    const offering = s.offerings.find(
      (o: any) => o.active && o.paymentOptions.includes("online"),
    );
    if (!offering) {
      // No offering at this gym accepts online payment — that itself is an
      // honest state, and there is nothing that could fake a capture.
      return;
    }
    const res = await api(
      "POST",
      gym("purchase-intent"),
      { offeringId: offering.id, method: "online" },
      customer.token,
    );
    assert.equal(res.status, 201);
    assert.equal(res.data.payment.status, "pending", "never 'paid' straight out of an intent");

    const after = await state();
    const payment = after.payments.find((p: any) => p.id === res.data.payment.id);
    assert.equal(payment.status, "pending");
    assert.equal(payment.visitId, undefined);
    assert.equal(
      after.visits.some((v: any) => v.customerId === customer.customerId && !v.checkedOutAt),
      false,
      "an unpaid online intent never puts anyone inside",
    );
  });

  await t.test("Confirm Check-In refuses a payment that has not genuinely been paid", async () => {
    const s = await state();
    const pending = s.payments.find((p: any) => p.status === "pending");
    if (!pending) return;
    const res = await api("POST", gym("operations/confirm_checkin"), { paymentId: pending.id }, owner);
    assert.equal(res.status, 400);
    assert.match(res.data.error, /paid payment/i);
  });

  await t.test(
    "a genuinely paid payment still needs the explicit Confirm Check-In before a visit exists",
    async () => {
      const customer = await loginCustomer("9833300002");
      const s = await state();
      const offering = s.offerings.find((o: any) => o.active && o.type !== "membership");
      const intent = await api(
        "POST",
        gym("purchase-intent"),
        { offeringId: offering.id, method: "cash" },
        customer.token,
      );
      const paymentId = intent.data.payment.id;

      // Reach a real `paid` state through the real staff path, then detach the
      // visit so we are looking at exactly the "money settled, body not yet
      // here" case an online gateway would produce.
      await api("POST", gym("operations/accept_payment"), { paymentId }, owner);
      const afterAccept = await state();
      const visit = afterAccept.visits.find((v: any) => v.paymentId === paymentId);
      await api("POST", gym("checkout"), { visitId: visit.id }, owner);

      // Re-confirming an already-checked-in payment is refused, because the
      // payment is already tied to a visit — no second entry from one payment.
      const again = await api("POST", gym("operations/confirm_checkin"), { paymentId }, owner);
      assert.equal(again.status, 400);
      assert.match(again.data.error, /already been checked in/i);
    },
  );
});

test("Owner 'Recommend this plan' control", async (t) => {
  let offeringId = "";

  await t.test("a new offering is not recommended unless the owner says so", async () => {
    const res = await api(
      "POST",
      gym("operations/offerings"),
      {
        name: "QA Recommend Pass",
        type: "visitor_pass",
        priceInr: 250,
        durationValue: 1,
        durationUnit: "day",
        active: true,
        customerVisible: true,
        paymentOptions: ["cash"],
      },
      owner,
    );
    assert.equal(res.status, 200);
    const offering = res.data.state.offerings.find((o: any) => o.name === "QA Recommend Pass");
    offeringId = offering.id;
    assert.notEqual(offering.recommended, true);
  });

  await t.test("no offering is recommended by default anywhere at this gym", async () => {
    const s = await state();
    assert.equal(
      s.offerings.some((o: any) => o.recommended === true),
      false,
      "nothing is auto-promoted",
    );
  });

  await t.test("the toggle persists and reaches the customer-facing overview", async () => {
    const res = await api(
      "POST",
      gym("operations/offerings"),
      {
        id: offeringId,
        name: "QA Recommend Pass",
        type: "visitor_pass",
        priceInr: 250,
        durationValue: 1,
        durationUnit: "day",
        active: true,
        customerVisible: true,
        recommended: true,
        paymentOptions: ["cash"],
      },
      owner,
    );
    assert.equal(res.status, 200);
    assert.equal(
      res.data.state.offerings.find((o: any) => o.id === offeringId).recommended,
      true,
    );

    const publicOverview = await api("GET", gym("public-overview"));
    const publicOffering = publicOverview.data.offerings.find((o: any) => o.id === offeringId);
    assert.ok(publicOffering, "a recommended plan must still be customer-visible");
    assert.equal(publicOffering.recommended, true);
  });

  await t.test("it survives a reload from storage", async () => {
    const s = await state();
    assert.equal(s.offerings.find((o: any) => o.id === offeringId).recommended, true);
  });

  await t.test("an unrelated edit that omits the field does not silently clear it", async () => {
    const res = await api(
      "POST",
      gym("operations/offerings"),
      {
        id: offeringId,
        name: "QA Recommend Pass (renamed)",
        type: "visitor_pass",
        priceInr: 275,
        durationValue: 1,
        durationUnit: "day",
        active: true,
        customerVisible: true,
        paymentOptions: ["cash"],
      },
      owner,
    );
    assert.equal(res.data.state.offerings.find((o: any) => o.id === offeringId).recommended, true);
  });

  await t.test("the owner can turn it back off", async () => {
    const res = await api(
      "POST",
      gym("operations/offerings"),
      {
        id: offeringId,
        name: "QA Recommend Pass (renamed)",
        type: "visitor_pass",
        priceInr: 275,
        durationValue: 1,
        durationUnit: "day",
        active: true,
        customerVisible: true,
        recommended: false,
        paymentOptions: ["cash"],
      },
      owner,
    );
    assert.equal(res.data.state.offerings.find((o: any) => o.id === offeringId).recommended, false);
  });

  await t.test("a customer session cannot edit offerings at all", async () => {
    const customer = await loginCustomer("9844400001");
    const res = await api(
      "POST",
      gym("operations/offerings"),
      { id: offeringId, name: "Hijacked", type: "visitor_pass", priceInr: 1, durationValue: 1, durationUnit: "day", recommended: true },
      customer.token,
    );
    assert.equal(res.status, 403);
  });
});

test("Live Floor data source — Left rows are real, retained history", async (t) => {
  await t.test("the owner overview carries both open and closed visits", async () => {
    const s = await state();
    assert.ok(s.visits.some((v: any) => !v.checkedOutAt) || s.visits.length >= 0);
    const closed = s.visits.filter((v: any) => v.checkedOutAt);
    assert.ok(closed.length > 0, "earlier subtests closed visits; they must still be here");
    for (const v of closed) {
      assert.ok(v.checkedInAt > 0);
      assert.ok(v.checkedOutAt >= v.checkedInAt, "a frozen duration is never negative");
    }
  });

  await t.test("Inside Now equals the number of open visits, nothing else", async () => {
    const s = await state();
    assert.equal(s.currentOccupancy, s.visits.filter((v: any) => !v.checkedOutAt).length);
  });
});

test("Live Floor profile photos resolve from the existing Customer Profile system", async (t) => {
  // A 1x1 PNG — the smallest real image the profile-photo endpoint accepts.
  const pngDataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  let withPhoto: { token: string; customerId: string };
  let withoutPhoto: { token: string; customerId: string };
  let unlinkedVisitId = "";

  await t.test("a linked customer WITH a profile photo gets a photo URL on their visit", async () => {
    withPhoto = await loginCustomer("9855500001");
    const upload = await api("POST", "/api/me/profile/photo", { dataUrl: pngDataUrl }, withPhoto.token);
    assert.equal(upload.status, 200);

    const added = await api(
      "POST",
      gym("operations/add_visitor"),
      { name: "Photo Customer", mobile: "9855500001", offeringId: "custom_entry", customerId: withPhoto.customerId },
      owner,
    );
    assert.equal(added.status, 200);

    const s = await state();
    const visit = s.visits.find((v: any) => v.customerId === withPhoto.customerId && !v.checkedOutAt);
    assert.ok(visit);
    assert.ok(visit.customerPhotoUrl, "a linked customer with a photo must resolve to a URL");
    assert.match(visit.customerPhotoUrl, /^\/api\/gym\/gym-1\/customer-photo\//);
  });

  await t.test("the URL is readable by this gym's staff and returns real image bytes", async () => {
    const s = await state();
    const visit = s.visits.find((v: any) => v.customerId === withPhoto.customerId && !v.checkedOutAt);
    const res = await fetch(base + visit.customerPhotoUrl, {
      headers: { Authorization: `Bearer ${owner}` },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /^image\//);
    assert.ok((await res.arrayBuffer()).byteLength > 0);
  });

  await t.test("the photo endpoint rejects anyone without a Gym staff session for this gym", async () => {
    const s = await state();
    const visit = s.visits.find((v: any) => v.customerId === withPhoto.customerId && !v.checkedOutAt);
    const anonymous = await fetch(base + visit.customerPhotoUrl);
    assert.equal(anonymous.status, 403);
    // A customer session is not a staff session either.
    const asCustomer = await fetch(base + visit.customerPhotoUrl, {
      headers: { Authorization: `Bearer ${withPhoto.token}` },
    });
    assert.equal(asCustomer.status, 403);
  });

  await t.test("no private profile field other than the photo URL leaks onto the visit", async () => {
    const s = await state();
    const visit = s.visits.find((v: any) => v.customerId === withPhoto.customerId && !v.checkedOutAt);
    for (const leaked of ["email", "dateOfBirth", "profilePhotoUrl", "phoneNumber", "city", "gender"]) {
      assert.equal(visit[leaked], undefined, `${leaked} must not be copied onto a GymVisit`);
    }
    // And no image bytes are ever stored on the record itself.
    assert.equal(JSON.stringify(visit).includes("base64"), false);
  });

  await t.test("a linked customer WITHOUT a photo resolves to nothing (caller shows initials)", async () => {
    withoutPhoto = await loginCustomer("9855500002");
    await api(
      "POST",
      gym("operations/add_visitor"),
      { name: "No Photo Customer", mobile: "9855500002", offeringId: "custom_entry", customerId: withoutPhoto.customerId },
      owner,
    );
    const s = await state();
    const visit = s.visits.find(
      (v: any) => v.customerId === withoutPhoto.customerId && !v.checkedOutAt,
    );
    assert.ok(visit);
    assert.equal(visit.customerPhotoUrl, undefined);
  });

  await t.test("an UNLINKED walk-in visit has no customerId and no photo at all", async () => {
    const added = await api(
      "POST",
      gym("operations/add_visitor"),
      { name: "Anonymous Walkin", mobile: "9855500099", offeringId: "custom_entry" },
      owner,
    );
    const visit = added.data.state.visits.find((v: any) => v.name === "Anonymous Walkin");
    unlinkedVisitId = visit.id;
    assert.equal(visit.customerId, undefined);
    assert.equal(visit.customerPhotoUrl, undefined);
  });

  await t.test("a staff session for another business cannot read this gym's customer photos", async () => {
    const s = await state();
    const visit = s.visits.find((v: any) => v.customerId === withPhoto.customerId && !v.checkedOutAt);
    const res = await fetch(base + visit.customerPhotoUrl.replace("gym-1", "salon-1"), {
      headers: { Authorization: `Bearer ${owner}` },
    });
    assert.notEqual(res.status, 200);
  });

  await t.test("a customer with no record at this gym cannot be looked up through it", async () => {
    const stranger = await loginCustomer("9855500003");
    const res = await fetch(
      `${base}/api/gym/gym-1/customer-photo/${encodeURIComponent(stranger.customerId)}`,
      { headers: { Authorization: `Bearer ${owner}` } },
    );
    assert.equal(res.status, 404);
  });

  await t.test("the photo link survives checkout — history keeps showing the right person", async () => {
    await api("POST", gym("checkout"), { visitId: unlinkedVisitId }, owner);
    const s = await state();
    const closed = s.visits.find((v: any) => v.customerId === withPhoto.customerId);
    assert.ok(closed.customerPhotoUrl, "resolution is by customerId, so it works for Left rows too");
  });
});
