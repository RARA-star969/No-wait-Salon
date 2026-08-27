// Capacity-full auto-route to Waiting — Gym shared-architecture v1, Gap 2.
// When the gym is already at maxCapacity, Add Visitor / Accept Payment must
// land the person in the real entry queue (Waiting) instead of erroring out
// or over-capacity checking them in. Spawns the real server against a fresh
// temp SQLite DB, same pattern as gymOperations.test.ts / gymLiveFloor.test.ts.
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = mkdtempSync(path.join(tmpdir(), "noq-gym-capacity-waiting-"));
const port = 41000 + Math.floor(Math.random() * 10000);
const base = `http://127.0.0.1:${port}`;
let child: ChildProcess;
let owner = "";

const api = async (method: string, endpoint: string, body?: unknown, token = owner) => {
  const res = await fetch(base + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
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
      ADMIN_EMAIL: "gym-capacity-qa@example.test",
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

before(async () => {
  await start();
  const fixture = new DatabaseSync(path.join(dataDir, "no-wait-salon.db"));
  fixture.prepare("UPDATE salon SET business_code=? WHERE id=?").run("IRONHOUSE01", "gym-1");
  fixture.close();
  owner = (
    await api(
      "POST",
      "/api/staff/login",
      { businessCode: "IRONHOUSE01", email: "ironhouse-owner@nowaitsalon.test", password: "staff123" },
      "",
    )
  ).data.token;
  assert.ok(owner, "gym-1 owner must log in");
});
after(async () => {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
});

test("Capacity-full → Waiting, not an error", async (t) => {
  await t.test("fills the gym to maxCapacity with real check-ins", async () => {
    const overview = await api("GET", gym("overview"));
    // Shrink capacity down to a small, known number so filling it is fast
    // and deterministic regardless of the shared demo state.
    const set = await api("PUT", gym("core-state"), { maxCapacity: 2 });
    assert.equal(set.status, 200);
    // Close out any pre-existing open visits so occupancy starts at 0.
    for (const v of set.data.state.visits.filter((x: { checkedOutAt?: number }) => !x.checkedOutAt)) {
      await api("POST", gym("checkout"), { visitId: v.id });
    }
    const c1 = await api("POST", gym("checkin"), { name: "Filler One" });
    assert.equal(c1.status, 200);
    const c2 = await api("POST", gym("checkin"), { name: "Filler Two" });
    assert.equal(c2.status, 200);
    assert.equal(c2.data.state.currentOccupancy, 2);
    assert.equal(c2.data.state.maxCapacity, 2);
    void overview;
  });

  let dayPassId = "";
  await t.test("Add Visitor at full capacity lands the visitor in Waiting, not Inside, and does not error", async () => {
    const overview = await api("GET", gym("overview"));
    dayPassId = overview.data.offerings.find((o: { type: string }) => o.type === "visitor_pass").id;
    const before = overview.data.currentOccupancy;

    const res = await api("POST", gym("operations/add_visitor"), {
      name: "Overflow Visitor",
      offeringId: dayPassId,
      method: "cash",
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.state.currentOccupancy, before, "occupancy must not change");
    const visit = res.data.state.visits.find((v: { name: string }) => v.name === "Overflow Visitor");
    assert.equal(visit, undefined, "no GymVisit should be created while full");
    const queued = res.data.state.entryQueue.find(
      (q: { name: string; status: string }) => q.name === "Overflow Visitor" && q.status === "Waiting",
    );
    assert.ok(queued, "visitor must land in the Waiting queue");
    // The payment was still collected — it's the check-in that's deferred.
    const payment = res.data.state.payments.find((p: { id: string }) => p.id === queued.paymentId);
    assert.ok(payment);
    assert.equal(payment.status, "paid");
  });

  await t.test("Accept Payment (cash) at full capacity also routes to Waiting", async () => {
    // Create a fresh pending cash payment the normal way (staff-recorded
    // Add Visitor while there happens to be room), then fill the floor
    // back up before accepting it.
    const setRoom = await api("PUT", gym("core-state"), { maxCapacity: 3 });
    assert.equal(setRoom.status, 200);
    const created = await api("POST", gym("operations/add_visitor"), {
      name: "Pending Cash Guest",
      offeringId: dayPassId,
      method: "cash",
    });
    // At maxCapacity 3 with 2 filler visits still inside, this one checks
    // straight in — pull its payment back to pending to simulate the normal
    // "pay at gym" flow, and reset it to pending for the accept step.
    const guestVisit = created.data.state.visits.find(
      (v: { name: string }) => v.name === "Pending Cash Guest",
    );
    assert.ok(guestVisit);
    await api("POST", gym("checkout"), { visitId: guestVisit.id });

    // Now record a genuinely pending cash payment via a fresh customer with
    // no room: shrink capacity to match current occupancy first.
    const afterCheckout = await api("GET", gym("overview"));
    await api("PUT", gym("core-state"), { maxCapacity: afterCheckout.data.currentOccupancy || 1 });

    const pendingRes = await api("POST", gym("operations/add_visitor"), {
      name: "Cash Pending Overflow",
      offeringId: dayPassId,
      method: "cash",
    });
    const overflowPayment = pendingRes.data.state.payments.find(
      (p: { customerName: string }) => p.customerName === "Cash Pending Overflow",
    );
    assert.ok(overflowPayment);
    assert.equal(overflowPayment.status, "paid", "add_visitor always accepts payment immediately");

    // Directly exercise accept_payment's own capacity-full branch using a
    // payment we force back to pending.
    const forcedPendingId = overflowPayment.id;
    // add_visitor pays immediately, so simulate the "pay at gym, staff
    // accepts later" path: seed a pending payment straight into state via
    // the DB the same way normalizeGymState reads it.
    const fixture = new DatabaseSync(path.join(dataDir, "no-wait-salon.db"));
    const row = fixture.prepare("SELECT state_json FROM gym_state WHERE gym_id='gym-1'").get() as
      | { state_json: string }
      | undefined;
    assert.ok(row);
    const state = JSON.parse(row.state_json);
    const pendingPayment = {
      id: "test-pending-cash-payment",
      customerName: "Later Cash Payer",
      customerMobile: "",
      offeringId: dayPassId,
      offeringName: "Day Pass",
      amountInr: 299,
      method: "cash",
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.payments.unshift(pendingPayment);
    fixture
      .prepare("UPDATE gym_state SET state_json=? WHERE gym_id='gym-1'")
      .run(JSON.stringify(state));
    fixture.close();
    void forcedPendingId;

    const beforeAccept = await api("GET", gym("overview"));
    const occBefore = beforeAccept.data.currentOccupancy;
    assert.ok(occBefore >= beforeAccept.data.maxCapacity, "gym must be full for this assertion to be meaningful");

    const accepted = await api("POST", gym("operations/accept_payment"), {
      paymentId: pendingPayment.id,
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
    assert.equal(accepted.data.state.currentOccupancy, occBefore, "occupancy must not change");
    const visit = accepted.data.state.visits.find((v: { name: string }) => v.name === "Later Cash Payer");
    assert.equal(visit, undefined, "no GymVisit should be created while full");
    const queued = accepted.data.state.entryQueue.find(
      (q: { name: string; status: string }) => q.name === "Later Cash Payer" && q.status === "Waiting",
    );
    assert.ok(queued, "the cash payer must land in the Waiting queue");
    const linkedPayment = accepted.data.state.payments.find((p: { id: string }) => p.id === pendingPayment.id);
    assert.equal(linkedPayment.status, "paid");
  });

  await t.test("admitting a queued capacity-fallback entry produces the real deferred check-in", async () => {
    const before = await api("GET", gym("overview"));
    const queued = before.data.entryQueue.find(
      (q: { name: string; status: string }) => q.name === "Later Cash Payer" && q.status === "Waiting",
    );
    assert.ok(queued);
    // Free up a slot, then admit.
    const openVisit = before.data.visits.find((v: { checkedOutAt?: number }) => !v.checkedOutAt);
    assert.ok(openVisit);
    await api("POST", gym("checkout"), { visitId: openVisit.id });

    const admit = await api("POST", gym("operations/queue"), { id: queued.id, action: "admit" });
    assert.equal(admit.status, 200, JSON.stringify(admit.data));
    const visit = admit.data.state.visits.find((v: { name: string }) => v.name === "Later Cash Payer");
    assert.ok(visit, "admitting must finally create the real GymVisit");
    assert.equal(visit.paymentId, queued.paymentId);
    assert.equal(visit.purpose, "visitor");
    const payment = admit.data.state.payments.find((p: { id: string }) => p.id === queued.paymentId);
    assert.equal(payment.visitId, visit.id, "the earlier payment must be linked to the deferred visit");
  });

  await t.test("does not create a duplicate queue entry for the same customer while full", async () => {
    // A second add_visitor call for the same known customerId, while still
    // full, must not create a second Waiting row for that customer.
    const before = await api("GET", gym("overview"));
    await api("PUT", gym("core-state"), { maxCapacity: before.data.currentOccupancy || 1 });

    const customerId = "dedupe-test-customer";
    const first = await api("POST", gym("operations/add_visitor"), {
      name: "Dedupe Guest",
      offeringId: dayPassId,
      method: "cash",
      customerId,
    });
    assert.equal(first.status, 200);
    const second = await api("POST", gym("operations/add_visitor"), {
      name: "Dedupe Guest",
      offeringId: dayPassId,
      method: "cash",
      customerId,
    });
    assert.equal(second.status, 200);
    const waitingForCustomer = second.data.state.entryQueue.filter(
      (q: { customerId?: string; status: string }) => q.customerId === customerId && q.status === "Waiting",
    );
    assert.equal(waitingForCustomer.length, 1, "must not duplicate the Waiting entry for the same customer");
  });
});
