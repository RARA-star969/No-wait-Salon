/**
 * The single authoritative sequence for the Customer app's first-run
 * onboarding gate: welcome, then permissions, then identity (OTP + name),
 * only then the usable app. Each stage is checked in order and the first one
 * not yet satisfied is what renders — a returning customer who already
 * satisfies every stage lands on 'ready' with nothing shown in between.
 */
export type OnboardingStage = 'loading' | 'welcome' | 'location' | 'notifications' | 'identity' | 'ready';

export function resolveOnboardingStage(input: {
  hasCompletedOnboarding: boolean;
  locationHydrated: boolean;
  locationSetupCompleted: boolean;
  notificationPromptNeeded: boolean;
  readiness: 'ready' | 'onboarding_required' | 'loading';
}): OnboardingStage {
  if (!input.hasCompletedOnboarding) return 'welcome';
  if (!input.locationHydrated) return 'loading';
  if (!input.locationSetupCompleted) return 'location';
  if (input.notificationPromptNeeded) return 'notifications';
  if (input.readiness === 'loading') return 'loading';
  if (input.readiness === 'onboarding_required') return 'identity';
  return 'ready';
}
