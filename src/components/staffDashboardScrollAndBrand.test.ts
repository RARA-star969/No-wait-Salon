import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shellSource = readFileSync(path.join(here, 'StaffAppShell.tsx'), 'utf8');
const dashboardSource = readFileSync(path.join(here, 'StaffDashboard.tsx'), 'utf8');
const gymCssSource = readFileSync(path.join(here, 'GymDashboardView.css'), 'utf8');

// The modular Salon dashboard owns its whole screen (mirrors Gym): a bounded
// root height, <header shrink-0>, then <main min-h-0 flex-1 overflow-y-auto>
// as the single real scroll container.
test('StaffAppShell hands the whole screen to StaffDashboard — no second header/scroll wrapper', () => {
  const salonBranch = shellSource.slice(
    shellSource.indexOf('// 4. Normal Authorized Staff Dashboard'),
  );
  assert.match(salonBranch, /<StaffDashboard[\s\S]*?role=\{session!\.staff\.role as any\}/);
  assert.match(salonBranch, /activeModule=\{salonModule\}/);
  assert.match(salonBranch, /onModuleSelect=\{setSalonModule\}/);
  // No leftover header/<main overflow-y-auto> wrapper in StaffAppShell —
  // StaffDashboard owns its own header, drawer and scroll region now.
  const beforeStaffDashboard = salonBranch.slice(0, salonBranch.indexOf('<StaffDashboard'));
  assert.doesNotMatch(beforeStaffDashboard, /<header/);
  assert.doesNotMatch(beforeStaffDashboard, /overflow-y-auto/);
});

test('the Salon dashboard root has a bounded height so <main> is a real scroll container', () => {
  // h-dvh full-screen, or plain h-full when embedded inside the hosted
  // TEST panel's already-bounded wrapper — never h-full/min-h-screen with
  // no percentage-height ancestor chain (the original scroll-bug root cause).
  assert.match(dashboardSource, /\$\{embedded \? 'h-full' : 'h-dvh'\}/);
  assert.doesNotMatch(dashboardSource, /h-full min-h-screen/);
  assert.match(dashboardSource, /<header className="flex shrink-0/);
  assert.match(dashboardSource, /<main className="flex-1 min-h-0 overflow-y-auto">/);
});

test('the drawer nav itself scrolls independently and never traps the main content scroll', () => {
  assert.match(dashboardSource, /<nav aria-label="Salon dashboard" className="flex-1 min-h-0 overflow-y-auto/);
});

test('every long module body renders inside the single <main> scroll region with bottom breathing room', () => {
  const mainBlock = dashboardSource.slice(
    dashboardSource.indexOf('<main className="flex-1 min-h-0 overflow-y-auto">'),
    dashboardSource.indexOf('</main>'),
  );
  // Overview, Live Salon, Bookings and the concept screens all end their
  // content with pb-8 so the last card/row is never flush against the
  // viewport edge or hidden by anything sticky.
  assert.match(mainBlock, /space-y-5 p-4 pb-8/);
  assert.match(mainBlock, /space-y-4 p-4 pb-8/);
  assert.match(mainBlock, /space-y-3 p-4 pb-8/);
});

test('the Gym dashboard is untouched by the Salon modularization — it renders its own layout entirely, before the Salon shell', () => {
  assert.match(shellSource, /if \(isGym\) return <GymDashboardView/);
  const isGymIndex = shellSource.indexOf('if (isGym) return <GymDashboardView');
  const salonReturnIndex = shellSource.indexOf('<StaffDashboard');
  assert.ok(isGymIndex > -1 && salonReturnIndex > -1 && isGymIndex < salonReturnIndex, 'Gym must return before the Salon dashboard renders');
});

test('Gym dashboard scrolling regression guard — its own layout still defines a real scroll model', () => {
  assert.match(gymCssSource, /\.gym-app\s*\{[^}]*min-height:\s*100dvh/);
  assert.match(gymCssSource, /\.gym-sidebar\s*\{[^}]*position:\s*sticky/);
});

test('NOQ blue is the Salon dashboard drawer/dashboard accent, not legacy teal', () => {
  assert.match(dashboardSource, /text-\[#3454FD\]">BUSINESS/);
  assert.match(dashboardSource, /isActive \? 'bg-\[#3454FD\]\/10 text-\[#3454FD\]'/);
  assert.match(dashboardSource, /bg-\[#3454FD\] px-3 py-3 text-xs font-bold text-white active:scale-\[0\.98\]/); // Add Walk-in quick action
  assert.doesNotMatch(dashboardSource, /#2A7BFF/);
  assert.doesNotMatch(dashboardSource, /#0F766E/);
});

test('the bright shared theme removed the header LIVE badge and top-right Sign Out, and the drawer footer Sign Out — Sign Out lives only in Settings, reachable by every role', () => {
  assert.doesNotMatch(dashboardSource, />\s*Live\s*<\/span>/);
  assert.doesNotMatch(dashboardSource, /id="salon-signout"/);
  assert.doesNotMatch(dashboardSource, /id="salon-drawer-signout"/);
  assert.match(dashboardSource, /id="salon-settings-signout"/);
});

test('semantic Live/Available/busy status colors stay in the green/amber/rose family, never migrated to blue', () => {
  assert.match(dashboardSource, /border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/); // Available barber pill
  assert.match(dashboardSource, /isBusy \? 'animate-pulse bg-amber-500' : isAvailable \? 'bg-emerald-500'/); // barber status dot
});

test('resolver-driven modules, authenticated role, and staff-scoped business isolation are wired through', () => {
  assert.match(dashboardSource, /resolveCategoryModules\('salon', role\)/);
  assert.match(dashboardSource, /categoryModules\.some\(\(m\) => m\.id === activeModule\) \? activeModule : 'overview'/);
  // role comes from the prop (ultimately session.staff.role), never a local
  // hardcoded default like the old `useState<StaffRole>('owner')`.
  assert.doesNotMatch(dashboardSource, /useState<StaffRole>\('owner'\)/);
});

test('Android hardware back closes the deepest overlay first, without a window.history hack', () => {
  assert.match(dashboardSource, /handleHardwareBack = useCallback/);
  assert.match(dashboardSource, /if \(cancelTarget\) \{ setCancelTarget\(null\); return true; \}/);
  assert.match(dashboardSource, /if \(isWalkinModalOpen\) \{ setIsWalkinModalOpen\(false\); return true; \}/);
  assert.match(dashboardSource, /if \(navOpen\) \{ setNavOpen\(false\); return true; \}/);
  assert.doesNotMatch(dashboardSource, /window\.history\.pushState/);
  assert.doesNotMatch(dashboardSource, /popstate/);
});
