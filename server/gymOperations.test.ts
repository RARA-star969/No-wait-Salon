import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  campaignAnalytics,
  filterGymEvents,
  gymEventsCsv,
} from "../src/shared/gymBusiness.ts";

const dataDir = mkdtempSync(path.join(tmpdir(), "noq-gym-v1-"));
const port = 41000 + Math.floor(Math.random() * 10000);
const base = `http://127.0.0.1:${port}`;
let child: ChildProcess;
let owner = "",
  trainer = "",
  memberId = "",
  visitId = "",
  trainerId = "",
  campaignId = "",
  campaignUrl = "";
const api = async (
  method: string,
  endpoint: string,
  body?: unknown,
  token = owner,
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
const gym = (path = "") => `/api/gym/gym-1/${path}`;
async function start() {
  child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      DATABASE_URL: "",
      DATA_DIR: dataDir,
      PORT: String(port),
      NODE_ENV: "production",
      NO_WAIT_TEST_DEPLOYMENT: "true",
      ADMIN_EMAIL: "gym-qa@example.test",
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
      "",
    )
  ).data.token;
  trainer = (
    await api(
      "POST",
      "/api/staff/login",
      {
        businessCode: "IRONHOUSE01",
        email: "ironhouse-trainer@nowaitsalon.test",
        password: "staff123",
      },
      "",
    )
  ).data.token;
  assert.ok(owner);
  assert.ok(trainer);
});
after(async () => {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
});

test("Gym business v1 real APIs, persistence and analytics", async (t) => {
  await t.test(
    "no fabricated state and strict session/category/business isolation",
    async () => {
      const s = await api("GET", gym("overview"));
      assert.equal(s.status, 200);
      assert.equal(s.data.currentOccupancy, 0);
      assert.deepEqual(s.data.events, []);
      assert.deepEqual(s.data.trainers, []);
      assert.equal(
        (await api("GET", gym("overview"), undefined, "")).status,
        403,
      );
      assert.equal((await api("GET", "/api/gym/gym-2/overview")).status, 403);
      const switched = await api(
        "POST",
        "/api/staff/test-login",
        { businessId: "gym-2" },
        "",
      );
      assert.equal(switched.status, 200);
      assert.equal(switched.data.business.id, "gym-2");
      assert.equal(
        (await api("GET", gym("overview"), undefined, switched.data.token))
          .status,
        403,
      );
      assert.equal(
        (
          await api(
            "POST",
            "/api/staff/test-login",
            { businessId: "salon-1" },
            "",
          )
        ).status,
        404,
      );
      const anonymous = await api("POST", gym("checkin"), {});
      assert.equal(anonymous.data.state.currentOccupancy, 1);
      assert.equal(
        (await api("POST", gym("checkout"), {})).data.state.currentOccupancy,
        0,
      );
      assert.equal(
        (await api("PUT", gym("core-state"), { maxCapacity: 100 }, trainer))
          .status,
        403,
      );
      assert.equal(
        (await api("POST", gym("checkin"), {}, trainer)).status,
        403,
      );
      assert.equal(
        (await api("POST", gym("campaigns"), {}, trainer)).status,
        403,
      );
      assert.equal(
        (
          await api(
            "GET",
            gym("reports") + "?from=2020-01-01&to=2030-01-01",
            undefined,
            trainer,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await api(
            "POST",
            gym("operations/trainers"),
            { name: "Unauthorized", role: "Coach" },
            trainer,
          )
        ).status,
        403,
      );
    },
  );
  await t.test(
    "validates capacity, member check-in duplication and queue admission",
    async () => {
      assert.equal(
        (await api("PUT", gym("core-state"), { maxCapacity: 2.5 })).status,
        400,
      );
      assert.equal(
        (await api("PUT", gym("core-state"), { currentOccupancy: -1 })).status,
        400,
      );
      assert.equal(
        (await api("PUT", gym("core-state"), { maxCapacity: 2 })).status,
        200,
      );
      const member = await api("POST", gym("operations/members"), {
        name: "=SUM(1,2)",
        phone: "12345",
        membership: "Monthly",
        status: "Active",
      });
      memberId = member.data.state.members[0].id;
      const inside = await api("POST", gym("checkin"), { memberId });
      visitId = inside.data.state.visits[0].id;
      assert.equal(inside.data.state.currentOccupancy, 1);
      assert.equal(
        (await api("POST", gym("checkin"), { memberId })).status,
        400,
      );
      const parallel = await Promise.all([
        api("POST", gym("checkin"), { name: "Visitor two" }),
        api("POST", gym("checkin"), { name: "Visitor three" }),
      ]);
      assert.equal(parallel.filter((r) => r.status === 200).length, 1);
      const queue = await api("POST", gym("operations/queue"), {
        action: "add",
        name: "Waiting visitor",
      });
      const qid = queue.data.state.entryQueue[0].id;
      assert.equal(
        (
          await api("POST", gym("operations/queue"), {
            id: qid,
            action: "admit",
          })
        ).status,
        400,
      );
      assert.equal(
        (await api("PUT", gym("core-state"), { currentOccupancy: 0 })).status,
        400,
      );
      assert.equal(
        (await api("POST", gym("checkout"), { visitId })).data.state
          .currentOccupancy,
        1,
      );
      assert.equal(
        (await api("POST", gym("checkout"), { visitId })).status,
        400,
      );
      const admit = await api("POST", gym("operations/queue"), {
        id: qid,
        action: "admit",
      });
      assert.equal(admit.data.state.currentOccupancy, 2);
      assert.equal(admit.data.state.waitingOutsideCount, 0);
      assert.equal(
        (
          await api("POST", gym("operations/queue"), {
            id: qid,
            action: "admit",
          })
        ).status,
        400,
      );
      const publicData = (
        await api("GET", gym("public-overview"), undefined, "")
      ).data;
      assert.equal(publicData.members, undefined);
      assert.equal(publicData.events, undefined);
      assert.deepEqual(publicData.entryQueue, []);
    },
  );
  await t.test(
    "trainer, PT and class transitions synchronize availability and prevent overlaps",
    async () => {
      const add = await api("POST", gym("operations/trainers"), {
        name: "Test coach",
        role: "Strength",
      });
      trainerId = add.data.state.trainers[0].id;
      assert.equal(add.data.state.availableTrainersCount, 1);
      const accounts = await api("GET", gym("trainer-accounts"));
      assert.ok(accounts.data.some((a) => a.id === "staff-acc-gym-1-trainer"));
      assert.equal(
        (
          await api("POST", gym("operations/trainers"), {
            id: trainerId,
            name: "Test coach",
            role: "Strength",
            staffId: "staff-acc-salon-1-owner",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await api("POST", gym("operations/trainers"), {
            id: trainerId,
            name: "Test coach",
            role: "Strength",
            staffId: "staff-acc-gym-1-trainer",
          })
        ).status,
        200,
      );
      const startsAt = new Date(Date.now() + 3600000).toISOString();
      const booking = await api("POST", gym("operations/pt"), {
        trainerId,
        clientName: "Test member",
        startsAt,
        durationMinutes: 60,
        service: "Strength PT",
      });
      assert.equal(booking.status, 200);
      const id = booking.data.state.ptBookings[0].id;
      assert.equal(
        (
          await api("POST", gym("operations/classes"), {
            trainerId,
            title: "Conflict",
            startsAt,
            durationMinutes: 30,
            maxCapacity: 10,
            enrolled: 0,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await api("POST", gym("operations/pt"), {
            id,
            action: "status",
            status: "Completed",
          })
        ).status,
        400,
      );
      const started = await api("POST", gym("operations/pt"), {
        id,
        action: "status",
        status: "In Progress",
      });
      assert.equal(started.data.state.availableTrainersCount, 0);
      assert.equal(started.data.state.trainers[0].status, "In Session");
      assert.equal(
        (
          await api("POST", gym("trainer-status"), {
            trainerId,
            status: "Available",
          })
        ).status,
        400,
      );
      const completed = await api("POST", gym("operations/pt"), {
        id,
        action: "status",
        status: "Completed",
      });
      assert.equal(completed.data.state.availableTrainersCount, 1);
      assert.equal(
        (
          await api("POST", gym("operations/pt"), {
            id,
            action: "status",
            status: "In Progress",
          })
        ).status,
        400,
      );
      const klass = await api("POST", gym("operations/classes"), {
        trainerId,
        title: "Strength class",
        startsAt,
        durationMinutes: 30,
        maxCapacity: 10,
        enrolled: 3,
      });
      assert.equal(klass.status, 200);
      assert.equal(
        (
          await api("POST", gym("trainer-status"), {
            trainerId,
            status: "Invalid",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "campaign QR identity, real link events, duplicate action and inactive enforcement",
    async () => {
      const fields = {
        title: "<script>unsafe</script>",
        message: "A real test offer",
        type: "Offer",
        status: "Active",
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
      };
      assert.equal(
        (
          await api("POST", gym("campaigns"), {
            ...fields,
            endsAt: fields.startsAt,
          })
        ).status,
        400,
      );
      const create = await api("POST", gym("campaigns"), fields);
      assert.equal(create.status, 200);
      campaignId = create.data.state.campaigns[0].id;
      const identity = await api(
        "GET",
        gym(`campaigns/${campaignId}/identity`),
      );
      campaignUrl = identity.data.url;
      assert.ok(identity.data.qr.startsWith("data:image/svg+xml"));
      assert.ok(campaignUrl.startsWith(base));
      const landing = await fetch(campaignUrl);
      const cookie = landing.headers.get("set-cookie")!.split(";")[0];
      const html = await landing.text();
      assert.ok(html.includes("&lt;script&gt;"));
      assert.ok(!html.includes("<script>unsafe"));
      assert.equal((await fetch(campaignUrl, { method: "POST" })).status, 400);
      await fetch(campaignUrl, { headers: { Cookie: cookie } });
      await fetch(campaignUrl, { method: "POST", headers: { Cookie: cookie } });
      await fetch(campaignUrl, { method: "POST", headers: { Cookie: cookie } });
      const state = (await api("GET", gym("overview"))).data;
      const a = campaignAnalytics(state.campaigns, state.events);
      assert.deepEqual(a, {
        active: 1,
        scans: 1,
        actions: 1,
        reach: 1,
        conversion: 100,
      });
      await api("POST", gym("campaigns"), {
        ...fields,
        id: campaignId,
        status: "Paused",
      });
      assert.equal((await fetch(campaignUrl)).status, 404);
      const trainerView = (
        await api("GET", gym("overview"), undefined, trainer)
      ).data;
      assert.deepEqual(trainerView.members, []);
      assert.deepEqual(trainerView.campaigns, []);
      assert.equal(trainerView.ptBookings.length, 1);
    },
  );
  await t.test(
    "filtered reports and CSV use real events and safe spreadsheet cells",
    async () => {
      const query =
        "?from=2020-01-01T00:00:00Z&to=2030-01-01T00:00:00Z&category=checkins";
      const report = await api("GET", gym("reports") + query);
      assert.equal(report.status, 200);
      assert.ok(report.data.events.length > 0);
      assert.ok(report.data.events.every((e) => e.category === "checkins"));
      const csv = await fetch(base + gym("reports") + query + "&format=csv", {
        headers: { Authorization: `Bearer ${owner}` },
      });
      const text = await csv.text();
      assert.match(csv.headers.get("content-type")!, /text\/csv/);
      assert.ok(text.includes("Timestamp (UTC)"));
      assert.ok(text.includes("'=SUM(1,2)"));
      assert.ok(!text.includes("Test coach"));
      const empty = await api(
        "GET",
        gym("reports") + "?from=2000-01-01&to=2000-01-02",
      );
      assert.deepEqual(empty.data.events, []);
      assert.equal(
        (await api("GET", gym("reports") + "?from=invalid&to=2030-01-01"))
          .status,
        400,
      );
      assert.equal(
        (await api("GET", gym("reports") + "?from=2030-01-01&to=2020-01-01"))
          .status,
        400,
      );
      const all = (await api("GET", gym("overview"))).data.events;
      const filtered = filterGymEvents(
        all,
        0,
        Date.now(),
        "campaigns",
        campaignId,
      );
      assert.ok(filtered.every((e) => e.campaignId === campaignId));
      assert.ok(gymEventsCsv([]).includes("Event ID"));
    },
  );
  await t.test(
    "all Gym records survive a real server restart with the same SQLite database",
    async () => {
      const before = (await api("GET", gym("overview"))).data;
      await stop();
      const db = new DatabaseSync(path.join(dataDir, "no-wait-salon.db"));
      const saved = JSON.parse(
        (
          db
            .prepare("SELECT state_json FROM gym_state WHERE gym_id=?")
            .get("gym-1") as any
        ).state_json,
      );
      db.close();
      assert.equal(saved.members.length, 1);
      assert.equal(saved.campaigns.length, 1);
      await start();
      const after = (await api("GET", gym("overview"))).data;
      assert.equal(after.currentOccupancy, before.currentOccupancy);
      assert.deepEqual(after.events, before.events);
      assert.deepEqual(after.ptBookings, before.ptBookings);
      assert.deepEqual(after.members, before.members);
    },
  );
});
