/**
 * The customer app's first-run sequence: landing, then location, then an
 * optional notification-permission ask, then the usable app. Identity (OTP +
 * profile) is deliberately NOT part of this sequence — guests can browse
 * salons and live queues freely. Verification only gates the moment a
 * booking/queue-join is actually created, handled separately by
 * `resolveAppReadiness` at that call site.
 */
export type OnboardingStage = 'loading' | 'landing' | 'location' | 'notifications' | 'ready';

export function resolveOnboardingStage(input: {
  hasEnteredApp: boolean;
  locationHydrated: boolean;
  locationSetupCompleted: boolean;
  notificationPromptNeeded: boolean;
}): OnboardingStage {
  if (!input.hasEnteredApp) return 'landing';
  if (!input.locationHydrated) return 'loading';
  if (!input.locationSetupCompleted) return 'location';
  if (input.notificationPromptNeeded) return 'notifications';
  return 'ready';
}
