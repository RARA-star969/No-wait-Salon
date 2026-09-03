import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shellSource = readFileSync(path.join(here, 'StaffAppShell.tsx'), 'utf8');
const dashboardSource = readFileSync(path.join(here, 'StaffDashboard.tsx'), 'utf8');
const gymCssSource = readFileSync(path.join(here, 'GymDashboardView.css'), 'utf8');

// The Salon dashboard shell: <div h-dvh flex-col> > <header shrink-0> +
// <main min-h-0 flex-1 overflow-y-auto>. Everything below <main> renders
// without competing for scroll ownership.
const salonShellBlock = () => shellSource.slice(
  shellSource.indexOf('// 4. Normal Authorized Staff Dashboard'),
  shellSource.indexOf('function ', shellSource.indexOf('// 4. Normal Authorized Staff Dashboard')),
);

test('the Salon dashboard shell has exactly one bounded scroll container', () => {
  const block = salonShellBlock();
  assert.match(block, /className="flex h-dvh w-full flex-col/);
  assert.match(block, /<header className="flex shrink-0/);
  assert.match(block, /<main className="min-h-0 flex-1 overflow-y-auto">/);
  // The old h-full/min-h-screen combo resolved to the content's own height
  // (no percentage-height ancestor chain), which is what broke <main>'s
  // overflow-y-auto in the first place.
  assert.doesNotMatch(block, /className="flex h-full min-h-screen/);
});

test('StaffDashboard no longer nests a second, competing scroll container', () => {
  // The double overflow-y-auto (StaffAppShell's <main> plus this component's
  // own root) is the scroll bug: with no bounded height this element's own
  // "scroll area" never contains any real overflow, yet it could still
  // swallow touch/wheel input meant for the true scrollable ancestor.
  const rootDivMatch = dashboardSource.match(/return \(\s*\/\/[\s\S]*?<div className="([^"]*)">\s*<div className="space-y-5/);
  assert.ok(rootDivMatch, 'could not find the StaffDashboard root wrapper');
  const rootClassName = rootDivMatch![1];
  assert.doesNotMatch(rootClassName, /overflow-y-auto/);
  assert.doesNotMatch(rootClassName, /\bh-full\b/);
});

test('the Salon dashboard content carries bottom safe-area padding so sticky controls never permanently cover the last card', () => {
  assert.match(dashboardSource, /space-y-5 p-5 pb-\[max\(1\.5rem,env\(safe-area-inset-bottom\)\)\]/);
});

test('the Gym dashboard is untouched by the Salon scroll fix — it renders its own layout entirely, before the Salon shell', () => {
  assert.match(shellSource, /if \(isGym\) return <GymDashboardView/);
  const isGymIndex = shellSource.indexOf('if (isGym) return <GymDashboardView');
  const salonShellIndex = shellSource.indexOf('className="flex h-dvh w-full flex-col');
  assert.ok(isGymIndex > -1 && salonShellIndex > -1 && isGymIndex < salonShellIndex, 'Gym must return before the Salon shell renders');
});

test('Gym dashboard scrolling regression guard — its own layout still defines a real scroll model', () => {
  assert.match(gymCssSource, /\.gym-app\s*\{[^}]*min-height:\s*100dvh/);
  assert.match(gymCssSource, /\.gym-sidebar\s*\{[^}]*position:\s*sticky/);
});

test('NOQ blue replaces legacy teal for non-semantic Salon dashboard UI', () => {
  // Active nav tabs, metric icons, primary actions, toggles and CTA text now
  // use the NOQ brand accent.
  assert.match(dashboardSource, /bg-white text-\[#3454FD\] ring-1 ring-\[#D6DEFB\]/);
  assert.match(dashboardSource, /<Users className="w-3\.5 h-3\.5 text-\[#3454FD\]" \/>/);
  assert.match(dashboardSource, /bg-\[#3454FD\] hover:bg-\[#2746EA\] text-white/);
});

test('semantic OPEN/AVAILABLE status colors are preserved as green/teal, not migrated to blue', () => {
  assert.match(dashboardSource, /bg-\[#E7F5F2\] px-2\.5 py-1 text-\[9px\] font-bold uppercase tracking-wider text-\[#0F766E\]/);
  assert.match(dashboardSource, /bg-\[#E7F5F2\] text-\[#0F766E\] border-\[#0F766E\]\/30 hover:bg-\[#DDECE0\]/);
});
