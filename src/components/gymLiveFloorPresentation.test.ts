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
      source.indexOf('liveFloorTab === "payments"') + 2500,
    );
    assert.match(paymentsTab, /openAcceptPayment/);
    assert.match(paymentsTab, /setDeclinePayment/);
  });
});
