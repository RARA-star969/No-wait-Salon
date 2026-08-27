// Live Floor / Entry QR reuse / customer self-checkout — additive coverage
// for the Gym shared-architecture v1 restructure. Spawns the real server
// against a fresh temp SQLite DB, exactly like gymOperations.test.ts.
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";

const dataDir = mkdtempSync(path.join(tmpdir(), "noq-gym-live-floor-"));
const port = 41000 + Math.floor(Math.random() * 10000);
const base = `http://127.0.0.1:${port}`;
let child: ChildProcess;
let owner = "";
let salonOwner = "";
let adminToken = "";

const api = async (
  method: string,
  endpoint: string,
  body?: unknown,
  token = "",
) => {
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
      ADMIN_EMAIL: "gym-livefloor-qa@example.test",
      ADMIN_PASSWORD: "local-qa-only-password",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    let logs = "";
    const timeout = setTimeout(
      () => reject(new Error(logs || "Server start timed out")),
      15000,
    );
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

before(async () => {
  await start();
  const fixture = new DatabaseSync(path.join(dataDir, "no-wait-salon.db"));
  fixture
    .prepare("UPDATE salon SET business_code=? WHERE id=?")
    .run("IRONHOUSE01", "gym-1");
  fixture.close();
  owner = (
    await api(
      "POST",
      "/api/staff/login",
      {
        businessCode: "IRONHOUSE01",
        email: "ironhouse-owner@nowaitsalon.test",
        password: "staff123",
      },
    )
  ).data.token;
  assert.ok(owner, "gym-1 owner must log in");
  // A staff session scoped to a different (Salon) business — used to prove
  // the entry-qr endpoint rejects cross-business reads. Inserted directly
  // (rather than via /api/staff/test-login, which only issues Gym sessions)
  // using the server's own token-hash scheme (sha256/base64url).
  {
    const fixture = new DatabaseSync(path.join(dataDir, "no-wait-salon.db"));
    const staffId = `staff_${randomUUID()}`;
    const now = Date.now();
    fixture
      .prepare(
        "INSERT INTO staff_account (id, business_id, email, password_hash, name, role, active, created_at, updated_at) VALUES (?, 'salon-1', 'salon-livefloor-qa@example.com', '', 'Salon QA Owner', 'owner', 1, ?, ?)",
      )
      .run(staffId, now, now);
    salonOwner = `staff_${randomUUID()}${randomUUID().replaceAll("-", "")}`;
    const tokenHash = createHash("sha256").update(salonOwner).digest("base64url");
    fixture
      .prepare(
        "INSERT INTO staff_session (token_hash, staff_id, business_id, expires_at, created_at) VALUES (?, ?, 'salon-1', ?, ?)",
      )
      .run(tokenHash, staffId, now + 30 * 24 * 60 * 60_000, now);
    fixture.close();
  }
  adminToken = (
    await api("POST", "/api/admin/login", {
      email: "gym-livefloor-qa@example.test",
      password: "local-qa-only-password",
    })
  ).data.token;
  assert.ok(adminToken, "admin must log in");
});
after(async () => {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
});

test("Entry QR — Gym Settings reuses the exact Admin-provisioned token", async (t) => {
  await t.test("business-scoped read requires a Gym staff session for this business", async () => {
    assert.equal((await api("GET", gym("entry-qr"))).status, 403);
    if (salonOwner) {
      assert.equal((await api("GET", gym("entry-qr"), undefined, salonOwner)).status, 403);
    }
  });

  await t.test("resolves to the same stored token Admin provisioned — never a new one", async () => {
    const businessRead = await api("GET", gym("entry-qr"), undefined, owner);
    assert.equal(businessRead.status, 200);
    assert.ok(businessRead.data.qr.publicToken);

    const adminRead = await api(
      "GET",
      "/api/admin/businesses/gym-1/qr",
      undefined,
      adminToken,
    );
    assert.equal(adminRead.status, 200);
    assert.equal(adminRead.data.qr.publicToken, businessRead.data.qr.publicToken);
    assert.equal(adminRead.data.qr.businessType, "gym");

    // Calling it again must return the identical token, not mint a second one.
    const again = await api("GET", gym("entry-qr"), undefined, owner);
    assert.equal(again.data.qr.publicToken, businessRead.data.qr.publicToken);
  });
});

test("Customer self-checkout — own visit only, active session, correct gym, still open", async (t) => {
  await t.test("rejects an unauthenticated request", async () => {
    const res = await api("POST", gym("checkout/self"), {});
    assert.equal(res.status, 401);
  });

  await t.test("closes the caller's own open visit and records source=customer", async () => {
    const overviewBefore = await api("GET", gym("overview"), undefined, owner);
    const offeringId = overviewBefore.data.offerings[0].id;

    const customerA = await loginCustomer("9810000001");
    assert.ok(customerA.token && customerA.customerId);

    // Staff records a paid cash visitor tied to this real customer account —
    // the same add_visitor operation Live Floor's "Add Visitor" uses.
    const added = await api(
      "POST",
      gym("operations/add_visitor"),
      {
        name: "Self Checkout Tester",
        offeringId,
        method: "cash",
        customerId: customerA.customerId,
      },
      owner,
    );
    assert.equal(added.status, 200);
    const visit = added.data.state.visits.find(
      (v: { customerId?: string }) => v.customerId === customerA.customerId,
    );
    assert.ok(visit && !visit.checkedOutAt);

    const before = added.data.state.currentOccupancy;
    const checkout = await api(
      "POST",
      gym("checkout/self"),
      { visitId: visit.id },
      customerA.token,
    );
    assert.equal(checkout.status, 200);
    assert.equal(checkout.data.visit.checkoutSource, "customer");
    assert.ok(checkout.data.visit.checkedOutAt);

    const overviewAfter = await api("GET", gym("overview"), undefined, owner);
    assert.equal(overviewAfter.data.currentOccupancy, before - 1);
    const closedVisit = overviewAfter.data.visits.find((v: { id: string }) => v.id === visit.id);
    assert.equal(closedVisit.checkoutSource, "customer");
  });

  await t.test("rejects checking out an already-closed visit", async () => {
    const overview = await api("GET", gym("overview"), undefined, owner);
    const closed = overview.data.visits.find((v: { checkedOutAt?: number }) => v.checkedOutAt);
    assert.ok(closed);
    const customerA = await loginCustomer("9810000001");
    const res = await api(
      "POST",
      gym("checkout/self"),
      { visitId: closed.id },
      customerA.token,
    );
    assert.equal(res.status, 409);
  });

  await t.test("a customer can never close another customer's visit", async () => {
    const overviewBefore = await api("GET", gym("overview"), undefined, owner);
    const offeringId = overviewBefore.data.offerings[0].id;

    const customerB = await loginCustomer("9810000002");
    const addedForB = await api(
      "POST",
      gym("operations/add_visitor"),
      {
        name: "Victim Visitor",
        offeringId,
        method: "cash",
        customerId: customerB.customerId,
      },
      owner,
    );
    const bVisit = addedForB.data.state.visits.find(
      (v: { customerId?: string }) => v.customerId === customerB.customerId,
    );
    assert.ok(bVisit && !bVisit.checkedOutAt);

    const customerC = await loginCustomer("9810000003");
    const attempt = await api(
      "POST",
      gym("checkout/self"),
      { visitId: bVisit.id },
      customerC.token,
    );
    assert.equal(attempt.status, 404);

    // The real visit is untouched by the rejected attempt.
    const overviewAfter = await api("GET", gym("overview"), undefined, owner);
    const stillOpen = overviewAfter.data.visits.find((v: { id: string }) => v.id === bVisit.id);
    assert.equal(stillOpen.checkedOutAt, undefined);
  });
});
