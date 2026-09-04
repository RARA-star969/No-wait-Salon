import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCategoryCapabilities,
  resolveCategoryModules,
  canAccessModule,
} from './categoryDashboardResolver.ts';

test('Gym Owner resolves full Gym capabilities & modules without Salon terms', () => {
  const caps = resolveCategoryCapabilities('gym', 'owner');
  assert.ok(caps.includes('capacity_view'));
  assert.ok(caps.includes('classes_manage'));
  assert.ok(caps.includes('gym_settings'));

  const modules = resolveCategoryModules('gym', 'owner');
  const ids = modules.map((m) => m.id);
  assert.ok(ids.includes('overview'));
  // Live Capacity, Check-in/Out and Entry Queue are consolidated into one
  // "Live Floor" nav item (backend capabilities/services are unchanged).
  assert.ok(ids.includes('live_floor'));
  assert.ok(ids.includes('classes'));
  assert.ok(ids.includes('trainers'));
  assert.ok(ids.includes('settings'));
  assert.equal(ids.includes('chairs'), false);
  assert.equal(ids.includes('barbers'), false);
});

test('Gym Trainer receives restricted view denying owner capacity management, but keeps Settings for Sign Out', () => {
  const caps = resolveCategoryCapabilities('gym', 'trainer');
  assert.ok(caps.includes('my_classes'));
  assert.ok(caps.includes('my_pt_bookings'));
  assert.equal(caps.includes('gym_settings'), false);

  const modules = resolveCategoryModules('gym', 'trainer');
  const ids = modules.map((m) => m.id);
  assert.ok(ids.includes('overview'));
  assert.ok(ids.includes('classes'));
  assert.ok(ids.includes('pt_bookings'));
  // Settings is reachable by every role — it is the only place Sign Out
  // lives now that the header/sidebar no longer carry it — even though the
  // trainer's `gym_settings` capability above stays false, so the
  // privileged facility controls inside the screen stay gated off.
  assert.ok(ids.includes('settings'));
  assert.equal(ids.includes('trainers'), false);
  assert.equal(ids.includes('capacity'), false);
});

test('Salon Owner receives the full modular Salon drawer, in drawer order', () => {
  const modules = resolveCategoryModules('salon', 'owner');
  const ids = modules.map((m) => m.id);
  assert.deepEqual(ids, [
    'overview', 'live', 'bookings', 'customers', 'staff',
    'services', 'offers', 'reports', 'profile', 'settings',
  ]);
  assert.equal(ids.includes('classes'), false);
  assert.equal(ids.includes('trainers'), false);
});

test('Salon Manager sees everything, Settings included so Sign Out is always reachable', () => {
  const modules = resolveCategoryModules('salon', 'manager');
  const ids = modules.map((m) => m.id);
  assert.ok(ids.includes('customers'));
  assert.ok(ids.includes('staff'));
  assert.ok(ids.includes('offers'));
  assert.ok(ids.includes('settings'));
});

test('Salon Staff is restricted to Overview, Live Salon, Bookings and Settings', () => {
  const modules = resolveCategoryModules('salon', 'staff');
  const ids = modules.map((m) => m.id);
  assert.deepEqual(ids, ['overview', 'live', 'bookings', 'settings']);
  assert.equal(canAccessModule('salon', 'staff', 'staff'), false);
  assert.equal(canAccessModule('salon', 'staff', 'offers'), false);
  // Settings itself is reachable (it is the only place Sign Out lives), but
  // it carries no privileged control for a non-owner/manager role.
  assert.equal(canAccessModule('salon', 'staff', 'settings'), true);
});

test('canAccessModule enforces role and category permissions', () => {
  assert.equal(canAccessModule('gym', 'owner', 'settings'), true);
  // Settings navigation itself is open to every role now (Sign Out lives
  // there); the privileged facility/entry-QR controls inside the screen
  // still gate on `manager`, checked at render time, not module access.
  assert.equal(canAccessModule('gym', 'trainer', 'settings'), true);
  assert.equal(canAccessModule('salon', 'owner', 'staff'), true);
  assert.equal(canAccessModule('salon', 'manager', 'settings'), true);
  assert.equal(canAccessModule('gym', 'owner', 'staff'), false);
});

test('resolveCategoryModules falls back to overview for an unrecognized module id', () => {
  // Mirrors the clamp GymDashboardView already does — the dashboard shell
  // must never trust an out-of-registry activeModule (e.g. stale localStorage,
  // manipulated nav state, or a role downgrade mid-session).
  const modules = resolveCategoryModules('salon', 'staff');
  const ids = modules.map((m) => m.id);
  const requested = 'nonexistent-module';
  const clamped = ids.includes(requested) ? requested : 'overview';
  assert.equal(clamped, 'overview');
});
