/**
 * The single authoritative decision point for "is this customer ready to use
 * the app?" — shared by every surface (the Customer app's onboarding gate,
 * QueueJoinSheet's callers, the public web page) so none of them keep their
 * own copy of what "we already know this person" means.
 *
 * The rule is deliberately narrow: only a verified mobile number and a usable
 * display name are required. Everything else on the profile is optional and
 * must never gate anything — asking again for details we already hold is the
 * exact problem this replaces.
 *
 * Each surface still owns *how* it reacts to a non-ready result — the app
 * routes to a first-run onboarding gate before Home ever renders, the public
 * web page runs its own lightweight guest verification — but all of them
 * answer the readiness question through this one function.
 */

import type { CustomerAuthSession, CustomerProfile } from '../types';

export type AppReadiness =
  /** Nothing more to ask: safe to enter the app / open the queue-join sheet. */
  | { kind: 'ready'; name: string; phone: string }
  /** No verified session at all — onboarding must run OTP first. */
  | { kind: 'onboarding_required'; reason: 'not_signed_in' | 'no_verified_phone' | 'missing_profile'; missing?: RequiredProfileField[] };

export type RequiredProfileField = 'name';

/** Fields that actually block readiness. Kept as a list so the UI can name them. */
export const REQUIRED_PROFILE_FIELDS: RequiredProfileField[] = ['name'];

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** A phone number counts as verified only via an authenticated session. */
export function hasVerifiedPhone(auth: CustomerAuthSession | null | undefined): boolean {
  return Boolean(auth?.token && clean(auth.phoneNumber).length >= 10);
}

export function missingProfileFields(profile: CustomerProfile | null | undefined): RequiredProfileField[] {
  return REQUIRED_PROFILE_FIELDS.filter((field) => field === 'name' && clean(profile?.name).length < 2);
}

/**
 * `profileLoading` matters: a signed-in customer whose profile has not
 * arrived yet must not be pushed into onboarding, so the caller is told to
 * wait rather than being told something is missing.
 */
export function resolveAppReadiness(
  auth: CustomerAuthSession | null | undefined,
  profile: CustomerProfile | null | undefined,
  options: { profileLoading?: boolean } = {},
): AppReadiness | { kind: 'loading' } {
  if (!auth?.token) return { kind: 'onboarding_required', reason: 'not_signed_in' };
  if (!hasVerifiedPhone(auth)) return { kind: 'onboarding_required', reason: 'no_verified_phone' };
  if (options.profileLoading && !profile) return { kind: 'loading' };

  const missing = missingProfileFields(profile);
  if (missing.length > 0) return { kind: 'onboarding_required', reason: 'missing_profile', missing };

  return {
    kind: 'ready',
    name: clean(profile?.name) || 'You',
    phone: clean(profile?.phoneNumber) || clean(auth.phoneNumber),
  };
}

/** Convenience for call sites that only care whether the app can be entered. */
export const isAppReady = (
  auth: CustomerAuthSession | null | undefined,
  profile: CustomerProfile | null | undefined,
): boolean => resolveAppReadiness(auth, profile).kind === 'ready';
