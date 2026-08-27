// Static regression coverage for the Live Floor "always visible tabs, real
// empty states" requirement. This repo has no DOM/component-render test
// harness (no jsdom/testing-library — every other *.test.ts here is either a
// pure-function unit test or a real-server integration test), so this
// guards the actual source text instead: the three tabs must always be part
// of the same unconditional array (never filtered out when a count is 0),
// and each tab's exact required empty-state copy must be present verbatim.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "GymDashboardView.tsx"), "utf8");

test("Live Floor tabs are always rendered, with the required empty-state copy", async (t) => {
  await t.test("Inside/Waiting/Payments are declared as one unconditional tab list", () => {
    const tabsBlock = source.match(
      /\[\s*\[\s*"inside"[\s\S]*?\]\s*as const\s*\)\s*\.map/,
    );
    assert.ok(tabsBlock, "expected a single literal array driving the tab bar");
    assert.match(tabsBlock![0], /"inside",\s*"Inside"/);
    assert.match(tabsBlock![0], /"waiting",\s*"Waiting"/);
    assert.match(tabsBlock![0], /"payments",\s*"Payments"/);
  });

  await t.test("the tab bar itself is not conditionally skipped when a list is empty", () => {
    const tabsBarIndex = source.indexOf('className="gym-floor-tabs"');
    assert.ok(tabsBarIndex > -1);
    const before = source.slice(Math.max(0, tabsBarIndex - 400), tabsBarIndex);
    // No "X.length && ... gym-floor-tabs" style guard directly wrapping it.
    assert.doesNotMatch(before, /\.length\s*&&\s*\($/m);
  });

  for (const copy of [
    "No one is inside right now",
    "No waiting entries",
    "No pending cash payments",
  ]) {
    await t.test(`required empty-state copy present: "${copy}"`, () => {
      assert.ok(
        source.includes(copy),
        `expected GymDashboardView.tsx to contain the exact empty-state copy "${copy}"`,
      );
    });
  }

  await t.test("Decline sits alongside Accept on each pending payment card", () => {
    const paymentsTab = source.slice(
      source.indexOf('liveFloorTab === "payments"'),
      source.indexOf('liveFloorTab === "payments"') + 5000,
    );
    assert.match(paymentsTab, /openAcceptPayment/);
    assert.match(paymentsTab, /setDeclinePayment/);
  });

  await t.test("payment cards are driven by the shared paymentCardState resolver", () => {
    const paymentsTab = source.slice(
      source.indexOf('liveFloorTab === "payments"'),
      source.indexOf('liveFloorTab === "payments"') + 5000,
    );
    // Cash vs online-paid wording and which actions exist are decided in
    // shared/gymLiveFloor.ts, never re-derived inline here.
    assert.match(paymentsTab, /paymentCardState\(p\)/);
    assert.match(paymentsTab, /card\.canAccept/);
    assert.match(paymentsTab, /card\.canDecline/);
    assert.match(paymentsTab, /Confirm Check-In/);
  });

  await t.test("Inside/Left cards say ACCESS, never PLAN", () => {
    const insideTab = source.slice(
      source.indexOf('{liveFloorTab === "inside" && ('),
      source.indexOf('{liveFloorTab === "waiting" && ('),
    );
    assert.match(insideTab, /<dt>Access<\/dt>/);
    assert.doesNotMatch(insideTab, /<dt>Plan<\/dt>/);
    // Left rows show a frozen total and no Check Out button.
    assert.match(insideTab, /<dt>Total duration<\/dt>/);
    assert.match(insideTab, /\{!left && \(/);
  });

  await t.test("the Status filter reads the full visits list, not a pre-narrowed one", () => {
    // The regression this guards: filtering to open visits BEFORE applying the
    // status filter made "Left" permanently empty.
    assert.match(source, /filterVisits\(state\.visits/);
    assert.match(source, /status: status as VisitStatusFilter/);
  });
});
