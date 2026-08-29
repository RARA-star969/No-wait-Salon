// Real-server coverage for Gym offers/coupons (shared-architecture v1,
// Requirement #7): the server NEVER trusts a client-computed final amount —
// it reloads the live offering and the live salon_offer row and recomputes
// the discount itself, the same trusted pattern the Salon `join` command
// already uses. Same harness as gymAccessFlow.test.ts: a real server
// process against a fresh temp SQLite DB, nothing mocked.
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const dataDir = mkdtempSync(path.join(tmpdir(), "noq-gym-offers-"));
const port = 42000 + Math.floor(Math.random() * 8000);
const base = `http://127.0.0.1:${port}`;
let child: ChildProcess;

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
      ADMIN_EMAIL: "gym-offers-qa@example.test",
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

/** Seeds a salon_offer row directly on gym-1 — the same table Salon offers
 * live in; a gym is just a business row like any other. */
function seedOffer(overrides: Partial<{
  code: string; discountType: "percent" | "fixed"; discountValue: number;
  eligibleOfferingIds: string[]; active: number; minimumBill: number;
  startDate: string; endDate: string;
}> = {}) {
  const db = new DatabaseSync(path.join(dataDir, "no-wait-salon.db"));
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO salon_offer (id, salon_id, title, discount_text, description, minimum_bill, start_date, end_date, terms, image_url, active, sort_order, code, discount_type, discount_value, eligible_service_ids_json, eligible_offering_ids_json, created_at, updated_at)
     VALUES (?, 'gym-1', 'QA Offer', '', '', ?, ?, ?, '', '', ?, 0, ?, ?, ?, '[]', ?, ?, ?)`
  ).run(
    id,
    overrides.minimumBill ?? 0,
    overrides.startDate ?? "",
    overrides.endDate ?? "",
    overrides.active ?? 1,
    overrides.code ?? "",
    overrides.discountType ?? "percent",
    overrides.discountValue ?? 20,
    JSON.stringify(overrides.eligibleOfferingIds ?? []),
    now,
    now,
  );
  db.close();
  return id;
}

before(async () => {
  await start();
  const fixture = new DatabaseSync(path.join(dataDir, "no-wait-salon.db"));
  fixture.prepare("UPDATE salon SET business_code=? WHERE id=?").run("IRONHOUSE01", "gym-1");
  fixture.close();
});
after(async () => {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
});

test("a coupon scoped to the purchased offering is applied and the server recomputes the trusted final amount", async (t) => {
  const overview = (await api("GET", gym("public-overview"))).data;
  const offering = overview.offerings.find((o: any) => o.active && o.type !== "membership");
  const offerId = seedOffer({ discountType: "percent", discountValue: 20, eligibleOfferingIds: [offering.id] });
  const customer = await loginCustomer("9822200001");

  const res = await api("POST", gym("purchase-intent"), { offeringId: offering.id, method: "cash", offerId }, customer.token);
  assert.equal(res.status, 201);
  const expectedDiscount = Math.round((offering.priceInr * 20) / 100);
  assert.equal(res.data.payment.discountInr, expectedDiscount);
  assert.equal(res.data.payment.originalAmountInr, offering.priceInr);
  assert.equal(res.data.payment.amountInr, offering.priceInr - expectedDiscount, "server recomputes the final amount, never trusting the client");
});

test("a coupon code (not an offerId) resolves to the same offer and the same trusted amount", async (t) => {
  const overview = (await api("GET", gym("public-overview"))).data;
  const offering = overview.offerings.find((o: any) => o.active && o.type !== "membership");
  seedOffer({ code: "QAFIT20", discountType: "percent", discountValue: 20, eligibleOfferingIds: [offering.id] });
  const customer = await loginCustomer("9822200002");

  const res = await api("POST", gym("purchase-intent"), { offeringId: offering.id, method: "cash", offerCode: "qafit20" }, customer.token);
  assert.equal(res.status, 201);
  assert.equal(res.data.payment.amountInr, offering.priceInr - Math.round((offering.priceInr * 20) / 100));
});

test("an offer scoped to a DIFFERENT offering never applies, even if the client asks for it by id", async (t) => {
  const overview = (await api("GET", gym("public-overview"))).data;
  const passOfferings = overview.offerings.filter((o: any) => o.active);
  if (passOfferings.length < 2) return t.skip("fixture needs at least two offerings");
  const [target, other] = passOfferings;
  const offerId = seedOffer({ discountType: "percent", discountValue: 50, eligibleOfferingIds: [other.id] });
  const customer = await loginCustomer("9822200003");

  const res = await api("POST", gym("purchase-intent"), { offeringId: target.id, method: "cash", offerId }, customer.token);
  assert.equal(res.status, 201);
  assert.equal(res.data.payment.amountInr, target.priceInr, "the offer for a different offering must not discount this purchase");
  assert.equal(res.data.payment.discountInr, undefined);
});

test("a client-supplied amountInr in the request body is ignored — the server always recomputes its own", async (t) => {
  const overview = (await api("GET", gym("public-overview"))).data;
  const offering = overview.offerings.find((o: any) => o.active && o.type !== "membership");
  const customer = await loginCustomer("9822200004");

  const res = await api(
    "POST",
    gym("purchase-intent"),
    { offeringId: offering.id, method: "cash", amountInr: 1 },
    customer.token,
  );
  assert.equal(res.status, 201);
  assert.equal(res.data.payment.amountInr, offering.priceInr, "a spoofed amountInr must never reach the payment");
});

test("an expired offer's id is silently ignored — the purchase still succeeds at full price", async (t) => {
  const overview = (await api("GET", gym("public-overview"))).data;
  const offering = overview.offerings.find((o: any) => o.active && o.type !== "membership");
  const offerId = seedOffer({ endDate: "2020-01-01", eligibleOfferingIds: [offering.id] });
  const customer = await loginCustomer("9822200005");

  const res = await api("POST", gym("purchase-intent"), { offeringId: offering.id, method: "cash", offerId }, customer.token);
  assert.equal(res.status, 201);
  assert.equal(res.data.payment.amountInr, offering.priceInr);
});
