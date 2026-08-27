// Decline pending cash/online payments from Live Floor — Gym shared-
// architecture v1 Live Operations Control Panel work. Spawns the real
// server against a fresh temp SQLite DB, same pattern as the other gym
// integration tests.
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = mkdtempSync(path.join(tmpdir(), "noq-gym-decline-"));
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
      ADMIN_EMAIL: "gym-decline-qa@example.test",
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
  const req = await api("POST", "/api/otp/request", { phone }, "");
  const verify = await api(
    "POST",
    "/api/otp/verify",
    { challengeId: req.data.challengeId, code: req.data.demoCode },
    "",
  );
  return verify.data as { token: string; customerId: string };
}

async function pendingCashPayment(name: string) {
  const overview = await api("GET", gym("overview"));
  const offeringId = overview.data.offerings.find(
    (o: { type: string }) => o.type === "visitor_pass",
  ).id;
  const customer = await loginCustomer(String(9820000000 + Math.floor(Math.random() * 999999)));
  const intent = await api(
    "POST",
    gym("purchase-intent"),
    { offeringId, method: "cash" },
    customer.token,
  );
  assert.equal(intent.status, 201, JSON.stringify(intent.data));
  void name;
  return intent.data.payment as { id: string; status: string };
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

test("Decline a pending payment", async (t) => {
  await t.test("requires a reason code", async () => {
    const payment = await pendingCashPayment("No Reason Guest");
    const res = await api("POST", gym("operations/decline_payment"), { paymentId: payment.id });
    assert.equal(res.status, 400);
    // Still pending — nothing was persisted.
    const overview = await api("GET", gym("overview"));
    const still = overview.data.payments.find((p: { id: string }) => p.id === payment.id);
    assert.equal(still.status, "pending");
  });

  await t.test('"Other" requires free-text reason', async () => {
    const payment = await pendingCashPayment("Other No Text Guest");
    const missingText = await api("POST", gym("operations/decline_payment"), {
      paymentId: payment.id,
      reasonCode: "other",
    });
    assert.equal(missingText.status, 400);

    const withText = await api("POST", gym("operations/decline_payment"), {
      paymentId: payment.id,
      reasonCode: "other",
      reasonText: "Card machine down, customer walked away",
    });
    assert.equal(withText.status, 200, JSON.stringify(withText.data));
    const declined = withText.data.state.payments.find((p: { id: string }) => p.id === payment.id);
    assert.equal(declined.status, "declined");
    assert.equal(declined.reasonCode, "other");
    assert.equal(declined.reasonText, "Card machine down, customer walked away");
    assert.ok(declined.declinedAt);
    assert.equal(declined.declinedBy, "Vikram (Owner)");
  });

  await t.test("success path stores reasonCode/declinedAt/declinedBy and clears the pending list", async () => {
    const payment = await pendingCashPayment("Did Not Pay Guest");
    const before = await api("GET", gym("overview"));
    assert.ok(
      before.data.payments.some(
        (p: { id: string; status: string }) => p.id === payment.id && p.status === "pending",
      ),
    );

    const res = await api("POST", gym("operations/decline_payment"), {
      paymentId: payment.id,
      reasonCode: "no_payment",
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const declined = res.data.state.payments.find((p: { id: string }) => p.id === payment.id);
    assert.equal(declined.status, "declined");
    assert.equal(declined.reasonCode, "no_payment");
    assert.equal(declined.reasonText, undefined);
    assert.ok(declined.declinedAt);
    assert.equal(declined.declinedBy, "Vikram (Owner)");

    // No visit or queue entry was created for a declined payment.
    assert.equal(
      declined.visitId,
      undefined,
      "a declined payment must never end up linked to a visit",
    );
    assert.equal(
      res.data.state.visits.some((v: { paymentId?: string }) => v.paymentId === payment.id),
      false,
    );
    assert.equal(
      res.data.state.entryQueue.some((q: { paymentId?: string }) => q.paymentId === payment.id),
      false,
    );

    // No longer pending — it must disappear from any "pending" listing.
    const after = await api("GET", gym("overview"));
    assert.equal(
      after.data.payments.some(
        (p: { id: string; status: string }) => p.id === payment.id && p.status === "pending",
      ),
      false,
    );

    // Exposed for future history/monitoring via the reports/events feed.
    const reports = await api(
      "GET",
      gym(
        `reports?from=${encodeURIComponent(new Date(Date.now() - 3600_000).toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 3600_000).toISOString())}&category=members`,
      ),
    );
    assert.equal(reports.status, 200);
    assert.ok(
      reports.data.events.some(
        (e: { action: string; subject: string }) =>
          e.action === "payment_declined" && e.subject === declined.customerName,
      ),
      "a declined payment must not be silently invisible from reports",
    );
  });

  await t.test("rejects declining an already-declined payment (no double-decline)", async () => {
    const payment = await pendingCashPayment("Double Decline Guest");
    const first = await api("POST", gym("operations/decline_payment"), {
      paymentId: payment.id,
      reasonCode: "duplicate",
    });
    assert.equal(first.status, 200);
    const second = await api("POST", gym("operations/decline_payment"), {
      paymentId: payment.id,
      reasonCode: "duplicate",
    });
    assert.equal(second.status, 400);
    assert.match(second.data.error, /already been declined/i);
  });

  await t.test("rejects declining an already-accepted payment", async () => {
    const payment = await pendingCashPayment("Already Accepted Guest");
    const accept = await api("POST", gym("operations/accept_payment"), { paymentId: payment.id });
    assert.equal(accept.status, 200, JSON.stringify(accept.data));
    const decline = await api("POST", gym("operations/decline_payment"), {
      paymentId: payment.id,
      reasonCode: "cancelled",
    });
    assert.equal(decline.status, 400);
    assert.match(decline.data.error, /already been processed/i);
  });

  await t.test("rejects declining a payment belonging to another gym", async () => {
    const payment = await pendingCashPayment("Cross Gym Guest");
    const switched = await api("POST", "/api/staff/test-login", { businessId: "gym-2" }, "");
    assert.equal(switched.status, 200);
    const crossGym = await api(
      "POST",
      "/api/gym/gym-2/operations/decline_payment",
      { paymentId: payment.id, reasonCode: "duplicate" },
      switched.data.token,
    );
    assert.equal(crossGym.status, 400, JSON.stringify(crossGym.data));

    // The real payment on gym-1 is untouched.
    const overview = await api("GET", gym("overview"));
    const untouched = overview.data.payments.find((p: { id: string }) => p.id === payment.id);
    assert.equal(untouched.status, "pending");
  });

  await t.test("Accept still works unaffected for a different pending payment", async () => {
    const payment = await pendingCashPayment("Still Works Guest");
    const res = await api("POST", gym("operations/accept_payment"), { paymentId: payment.id });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const accepted = res.data.state.payments.find((p: { id: string }) => p.id === payment.id);
    assert.equal(accepted.status, "paid");
    assert.ok(accepted.acceptedAt);
    assert.equal(accepted.acceptedBy, "Vikram (Owner)");
  });
});
