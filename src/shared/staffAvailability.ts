// Foundation for a date-aware "working today / on duty" stylist state.
//
// This is deliberately additive and read-only from the client side: the
// Staff Dashboard does not yet expose a toggle for it, and no backend column
// has been added in this pass (that migration is a future task's to make).
// `Barber.workingToday` is optional, so every existing salon/staff record
// (which has no opinion on it) reads as on-duty, exactly like before this
// field existed. Once a future task adds the Staff Dashboard toggle and the
// backend field it writes, every caller of `isOnDutyToday` / `stylistLiveStatus`
// picks it up automatically — nothing else needs to change.

import type { Barber } from '../types';

export function isOnDutyToday(barber: Pick<Barber, 'workingToday'>): boolean {
  return barber.workingToday !== false;
}

export type StylistLiveStatus = 'free' | 'with_customer' | 'break' | 'unavailable';

/**
 * The single place that turns a barber's raw status + attendance into the
 * label/colour the customer sees. `status` stays the source of truth for
 * "busy right now"; `workingToday` only ever narrows it toward unavailable,
 * never widens it — an off-duty stylist can't read as free.
 */
export function stylistLiveStatus(barber: Pick<Barber, 'status' | 'workingToday'>): StylistLiveStatus {
  if (!isOnDutyToday(barber)) return 'unavailable';
  if (barber.status === 'unavailable') return 'unavailable';
  if (barber.status === 'busy') return 'with_customer';
  return 'free';
}

export const STYLIST_STATUS_LABEL: Record<StylistLiveStatus, string> = {
  free: 'Free now',
  with_customer: 'With a customer',
  break: 'On a break',
  unavailable: 'Unavailable',
};

/** Stylists a customer can actually pick right now. */
export function selectableStylists(barbers: Barber[]): Barber[] {
  return barbers.filter((barber) => stylistLiveStatus(barber) !== 'unavailable');
}
