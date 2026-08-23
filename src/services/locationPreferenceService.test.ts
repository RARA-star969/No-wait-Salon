import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStartupPlan, type StoredLocationPreference } from './locationPreferenceService.ts';

const gps: StoredLocationPreference = { setupCompleted: true, mode: 'gps', label: 'Current location' };
const gpsWithPoint: StoredLocationPreference = { ...gps, latitude: 12.97, longitude: 77.59 };
const manual: StoredLocationPreference = {
  setupCompleted: true,
  mode: 'manual',
  label: 'Indiranagar',
  area: 'Indiranagar',
};

test('first install shows location setup', () => {
  const plan = resolveStartupPlan(null, 'prompt');
  assert.equal(plan.showOnboarding, true);
  assert.equal(plan.clearStoredPreference, false);
});

test('completed setup never shows onboarding again, whatever the permission says', () => {
  for (const permission of ['granted', 'denied', 'prompt', 'unknown'] as const) {
    assert.equal(resolveStartupPlan(gps, permission).showOnboarding, false, permission);
    assert.equal(resolveStartupPlan(manual, permission).showOnboarding, false, permission);
  }
});

test("an unreportable WebView permission never discards saved location (regression)", () => {
  // Android WebViews often cannot answer navigator.permissions.query for
  // geolocation. Treating that as a denial previously wiped the saved
  // preference on every launch and forced onboarding to reappear.
  const plan = resolveStartupPlan(gps, 'unknown');
  assert.equal(plan.showOnboarding, false);
  assert.equal(plan.clearStoredPreference, false);
});

test('stored preference is never cleared on startup for any permission state', () => {
  for (const permission of ['granted', 'denied', 'prompt', 'unknown'] as const) {
    assert.equal(resolveStartupPlan(gps, permission).clearStoredPreference, false, permission);
    assert.equal(resolveStartupPlan(manual, permission).clearStoredPreference, false, permission);
  }
});

test('granted GPS setup refreshes through GPS', () => {
  assert.equal(resolveStartupPlan(gps, 'granted').refresh, 'gps');
});

test('manual selection replays by area without touching GPS', () => {
  for (const permission of ['granted', 'denied', 'prompt', 'unknown'] as const) {
    assert.equal(resolveStartupPlan(manual, permission).refresh, 'area', permission);
  }
});

test('revoked permission falls back to last known point instead of prompting', () => {
  assert.equal(resolveStartupPlan(gpsWithPoint, 'denied').refresh, 'last-known');
  assert.equal(resolveStartupPlan(gpsWithPoint, 'unknown').refresh, 'last-known');
});

test('revoked permission with no stored point simply does not refresh', () => {
  assert.equal(resolveStartupPlan(gps, 'denied').refresh, 'none');
});
