import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOnboardingStage } from './onboardingStage.ts';

const base = {
  hasCompletedOnboarding: true,
  locationHydrated: true,
  locationSetupCompleted: true,
  notificationPromptNeeded: false,
  readiness: 'ready' as const,
};

test('fresh install starts at welcome, before anything else is checked', () => {
  assert.equal(resolveOnboardingStage({ ...base, hasCompletedOnboarding: false, readiness: 'onboarding_required' }), 'welcome');
});

test('location setup is required before permissions or identity', () => {
  assert.equal(resolveOnboardingStage({ ...base, locationSetupCompleted: false, readiness: 'onboarding_required' }), 'location');
});

test('the notification permission ask comes after location, before identity', () => {
  assert.equal(resolveOnboardingStage({ ...base, notificationPromptNeeded: true, readiness: 'onboarding_required' }), 'notifications');
});

test('identity (OTP + name) is the last gate before the app is usable', () => {
  assert.equal(resolveOnboardingStage({ ...base, readiness: 'onboarding_required' }), 'identity');
});

test('a signed-in customer whose profile has not loaded yet waits rather than flashing identity', () => {
  assert.equal(resolveOnboardingStage({ ...base, readiness: 'loading' }), 'loading');
});

test('a fully returning customer reaches ready with every stage already satisfied', () => {
  assert.equal(resolveOnboardingStage(base), 'ready');
});

test('killing and reopening with everything persisted skips straight to ready, never welcome again', () => {
  const returning = { ...base, hasCompletedOnboarding: true, locationSetupCompleted: true, notificationPromptNeeded: false, readiness: 'ready' as const };
  assert.equal(resolveOnboardingStage(returning), 'ready');
});
