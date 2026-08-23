import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOnboardingStage } from './onboardingStage.ts';

const base = {
  hasEnteredApp: true,
  locationHydrated: true,
  locationSetupCompleted: true,
  notificationPromptNeeded: false,
};

test('fresh install starts at the landing screen, before anything else is checked', () => {
  assert.equal(resolveOnboardingStage({ ...base, hasEnteredApp: false }), 'landing');
});

test('location setup is required before permissions, once the landing screen is dismissed', () => {
  assert.equal(resolveOnboardingStage({ ...base, locationSetupCompleted: false }), 'location');
});

test('the notification permission ask comes after location', () => {
  assert.equal(resolveOnboardingStage({ ...base, notificationPromptNeeded: true }), 'notifications');
});

test('a fully returning customer reaches ready with every stage already satisfied', () => {
  assert.equal(resolveOnboardingStage(base), 'ready');
});

test('killing and reopening with everything persisted skips straight to ready, never the landing screen again', () => {
  const returning = { ...base, hasEnteredApp: true, locationSetupCompleted: true, notificationPromptNeeded: false };
  assert.equal(resolveOnboardingStage(returning), 'ready');
});

test('location not yet hydrated from storage waits, rather than flashing the landing screen again', () => {
  assert.equal(resolveOnboardingStage({ ...base, locationHydrated: false }), 'loading');
});
