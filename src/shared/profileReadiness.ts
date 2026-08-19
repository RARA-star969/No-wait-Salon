/**
 * Decides whether a customer still has to go through verification before they
 * can join a queue. Shared so the Customer app and the public web page agree on
 * what "we already know this person" means.
 *
 * The rule is deliberately narrow: only a verified mobile number and a usable
 * display name are required to hold a place in a queue. Everything else on the
 * profile is optional and must never gate a join — asking again for details we
 * already hold is the exact problem this replaces.
 */

import type { CustomerAuthSession, CustomerProfile } from '../types';

export type JoinGate =
  /** Nothing more to ask: go straight to the queue-join sheet. */
  | { kind: 'ready'; name: string; phone: string }
  /** No verified session at all — run OTP, then resume the join. */
  | { kind: 'needs_verification'; reason: 'not_signed_in' | 'no_verified_phone' }
  /** Verified, but we are missing something we genuinely need. */
  | { kind: 'needs_profile'; missing: JoinProfileField[] };

export type JoinProfileField = 'name';

/** Fields that actually block a join. Kept as a list so the UI can name them. */
export const REQUIRED_JOIN_FIELDS: JoinProfileField[] = ['name'];

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** A phone number counts as verified only via an authenticated session. */
export function hasVerifiedPhone(auth: CustomerAuthSession | null | undefined): boolean {
  return Boolean(auth?.token && clean(auth.phoneNumber).length >= 10);
}

export function missingJoinFields(profile: CustomerProfile | null | undefined): JoinProfileField[] {
  return REQUIRED_JOIN_FIELDS.filter((field) => field === 'name' && clean(profile?.name).length < 2);
}

/**
 * The single decision point for "can this customer join right now?".
 *
 * `profileLoading` matters: a signed-in customer whose profile has not arrived
 * yet must not be pushed into a profile form, so the caller is told to wait
 * rather than being told something is missing.
 */
export function resolveJoinGate(
  auth: CustomerAuthSession | null | undefined,
  profile: CustomerProfile | null | undefined,
  options: { profileLoading?: boolean } = {},
): JoinGate | { kind: 'loading' } {
  if (!auth?.token) return { kind: 'needs_verification', reason: 'not_signed_in' };
  if (!hasVerifiedPhone(auth)) return { kind: 'needs_verification', reason: 'no_verified_phone' };
  if (options.profileLoading && !profile) return { kind: 'loading' };

  const missing = missingJoinFields(profile);
  if (missing.length > 0) return { kind: 'needs_profile', missing };

  return {
    kind: 'ready',
    name: clean(profile?.name) || 'You',
    phone: clean(profile?.phoneNumber) || clean(auth.phoneNumber),
  };
}

/** Convenience for call sites that only care whether the sheet can open. */
export const canJoinWithoutPrompting = (
  auth: CustomerAuthSession | null | undefined,
  profile: CustomerProfile | null | undefined,
): boolean => resolveJoinGate(auth, profile).kind === 'ready';
