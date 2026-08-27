import assert from "node:assert/strict";
import test from "node:test";
import {
  formatGymClock,
  formatGymDateTime,
  formatGymDuration,
  formatGymTimeWithDay,
  gymElapsedLabel,
  gymVisitDurationLabel,
  gymVisitDurationMinutes,
} from "./gymTime.ts";

const at = (h: number, m: number, day = 27, month = 7) =>
  new Date(2026, month, day, h, m, 0, 0).getTime();

test("Gym clock formatting is 12-hour everywhere", async (t) => {
  await t.test("late evening reads as PM, never 23:50", () => {
    const label = formatGymClock(at(23, 50));
    assert.equal(label, "11:50 PM");
    // The 24-hour rendering of this instant would be "23:50" with no meridiem.
    assert.doesNotMatch(label, /^(1[3-9]|2[0-3]):/);
    assert.match(label, /(AM|PM)$/);
  });

  await t.test("early hours read as AM", () => {
    assert.equal(formatGymClock(at(6, 5)), "6:05 AM");
  });

  await t.test("midnight and noon are not confused", () => {
    assert.equal(formatGymClock(at(0, 0)), "12:00 AM");
    assert.equal(formatGymClock(at(12, 0)), "12:00 PM");
  });

  await t.test("no Gym timestamp is ever rendered on a 24-hour clock", () => {
    for (let hour = 0; hour < 24; hour++) {
      const label = formatGymClock(at(hour, 30));
      assert.match(label, /^(1[0-2]|[1-9]):[0-5]\d (AM|PM)$/, label);
    }
  });

  await t.test("date context uses '27 Aug, 11:50 PM'", () => {
    assert.equal(formatGymDateTime(at(23, 50)), "27 Aug, 11:50 PM");
  });

  await t.test("same-day timestamps collapse to just the clock time", () => {
    const now = at(23, 55);
    assert.equal(formatGymTimeWithDay(at(23, 50), now), "11:50 PM");
    assert.equal(formatGymTimeWithDay(at(7, 5, 21), now), "21 Aug, 7:05 AM");
  });

  await t.test("missing timestamps degrade to a dash, never 'Invalid Date'", () => {
    assert.equal(formatGymClock(undefined), "—");
    assert.equal(formatGymClock(null), "—");
    assert.equal(formatGymDateTime(Number.NaN), "—");
  });
});

test("Gym duration derivation is shared, timestamp-based and second-free", async (t) => {
  await t.test("formats as N min / H hr / H hr M min, never with seconds", () => {
    assert.equal(formatGymDuration(8), "8 min");
    assert.equal(formatGymDuration(47), "47 min");
    assert.equal(formatGymDuration(60), "1 hr");
    assert.equal(formatGymDuration(84), "1 hr 24 min");
    assert.equal(formatGymDuration(125), "2 hr 5 min");
    for (const minutes of [0, 1, 59, 60, 61, 599, 1441]) {
      assert.doesNotMatch(formatGymDuration(minutes), /sec/i);
    }
  });

  await t.test("an active visit derives from checkedInAt and the given now", () => {
    const checkedInAt = at(20, 0);
    const visit = { checkedInAt };
    assert.equal(gymVisitDurationMinutes(visit, at(20, 18)), 18);
    assert.equal(gymVisitDurationLabel(visit, at(20, 18)), "18 min");
    assert.equal(gymVisitDurationLabel(visit, at(21, 24)), "1 hr 24 min");
  });

  await t.test(
    "surviving a reload: the value depends only on the server timestamp, not on when the surface started watching",
    () => {
      const visit = { checkedInAt: at(20, 0) };
      const now = at(20, 45);
      // Simulates three different surfaces mounting at three different times
      // (Live Floor open since 20:00, Customer page opened at 20:30, Profile
      // opened "just now" at 20:44). All must agree, because none of them
      // derives from its own mount time.
      const liveFloor = gymVisitDurationLabel(visit, now);
      const customerPage = gymVisitDurationLabel(visit, now);
      const profile = gymVisitDurationLabel(visit, now);
      assert.equal(liveFloor, "45 min");
      assert.equal(customerPage, liveFloor);
      assert.equal(profile, liveFloor);
      // A "reload" is just calling the same function again with the same
      // record — there is no stored elapsed counter that could reset to 0.
      assert.equal(gymVisitDurationLabel({ ...visit }, now), "45 min");
    },
  );

  await t.test("after checkout the duration freezes at checkedOutAt - checkedInAt", () => {
    const visit = { checkedInAt: at(20, 0), checkedOutAt: at(21, 24) };
    assert.equal(gymVisitDurationLabel(visit, at(21, 24)), "1 hr 24 min");
    // Read hours later: unchanged.
    assert.equal(gymVisitDurationLabel(visit, at(23, 59)), "1 hr 24 min");
    assert.equal(gymVisitDurationLabel(visit, at(9, 0, 28)), "1 hr 24 min");
  });

  await t.test("a clock skew that puts now before checkedInAt clamps to 0, never negative", () => {
    assert.equal(gymVisitDurationMinutes({ checkedInAt: at(20, 0) }, at(19, 0)), 0);
  });

  await t.test("elapsed labels (queue wait, payment age) use the same wording", () => {
    assert.equal(gymElapsedLabel(at(20, 0), at(20, 12)), "12 min");
    assert.equal(gymElapsedLabel(at(20, 0), at(22, 30)), "2 hr 30 min");
  });
});
