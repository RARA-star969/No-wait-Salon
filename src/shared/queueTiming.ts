// Single source of truth for the call / arrival grace-period state machine.
//
// Imported by the Express backend, the Staff dashboard, the public QR web page
// and the Customer app, so all four derive identical behaviour from the same
// server-authoritative timestamps. Clients never run their own clock for the
// deadline: they only count down to `graceExpiresAt`, which the server stamps.

import type { QueueItem } from '../types';

/**
 * Default arrival grace period. Overridable per deployment via
 * QUEUE_GRACE_MINUTES so a future per-salon setting (5 / 7 / 10) can be wired
 * in without touching the state machine or any UI.
 */
export const DEFAULT_GRACE_MINUTES = 7;

export function graceMinutes(configured?: string | number | null): number {
  const raw = typeof configured === 'string' ? Number(configured) : configured;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 && raw <= 60) return raw;
  return DEFAULT_GRACE_MINUTES;
}

export const graceWindowMs = (minutes = DEFAULT_GRACE_MINUTES): number => minutes * 60_000;

/**
 * Derived lifecycle state. Nothing here is stored: it is computed from the
 * stored status plus `graceExpiresAt`, which makes expiry idempotent and
 * immune to refresh, reconnect or a stale client clock.
 */
export type CallPhase =
  | 'waiting'
  | 'called'//          within the arrival window
  | 'call_again'//      window elapsed, staff must decide
  | 'in_service'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export function callPhase(item: Pick<QueueItem, 'status' | 'graceExpiresAt'>, now = Date.now()): CallPhase {
  if (item.status === 'Serving') return 'in_service';
  if (item.status === 'Completed') return 'completed';
  if (item.status === 'NoShow') return 'no_show';
  // A cancelled booking is terminal. Without this it read as 'waiting', which
  // would put it back in the Live tab and under a live countdown.
  if (item.status === 'Cancelled') return 'cancelled';
  if (item.status !== 'Called') return 'waiting';
  // Missing deadline (an entry called before this feature shipped) is treated
  // as still inside the window rather than instantly expired.
  if (!item.graceExpiresAt) return 'called';
  return now >= item.graceExpiresAt ? 'call_again' : 'called';
}

/** Milliseconds left in the arrival window; never negative. */
export function remainingMs(item: Pick<QueueItem, 'graceExpiresAt'>, now = Date.now()): number {
  if (!item.graceExpiresAt) return 0;
  return Math.max(0, item.graceExpiresAt - now);
}

/** Minutes elapsed since the customer joined the queue. Never negative. */
export function waitingMinutes(item: Pick<QueueItem, 'createdAt'>, now = Date.now()): number {
  return Math.max(0, Math.floor((now - item.createdAt) / 60_000));
}

/** mm:ss for display. Rounds up so a live countdown never shows 00:00 early. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Whether a fresh Call should start a new window. Pressing Call twice inside
 * an active window is a no-op, so a double tap cannot create a second timer or
 * a duplicate notification.
 */
export function shouldStartNewCall(
  item: Pick<QueueItem, 'status' | 'graceExpiresAt'>,
  now = Date.now(),
): boolean {
  if (item.status !== 'Called') return true;
  return callPhase(item, now) === 'call_again';
}

/** Reasons a customer can give. Shared by the web page and the Customer app. */
export const CUSTOMER_CANCEL_REASONS = [
  { code: 'wait_too_long', label: 'Wait too long' },
  { code: 'running_late', label: 'Running late' },
  { code: 'changed_mind', label: 'Changed mind' },
  { code: 'booked_by_mistake', label: 'Booked by mistake' },
  { code: 'chose_another_salon', label: 'Chose another salon' },
  { code: 'price_or_service', label: 'Price/service issue' },
  { code: 'other', label: 'Other' },
] as const;

/** Reasons staff can give when cancelling a chair. */
export const STAFF_CANCEL_REASONS = [
  { code: 'customer_requested', label: 'Customer requested' },
  { code: 'booking_mistake', label: 'Booking mistake' },
  { code: 'service_unavailable', label: 'Service unavailable' },
  { code: 'staff_unavailable', label: 'Staff unavailable' },
  { code: 'salon_closing', label: 'Salon closing' },
  { code: 'other', label: 'Other' },
] as const;

const CUSTOMER_CODES = new Set(CUSTOMER_CANCEL_REASONS.map((reason) => reason.code as string));
const STAFF_CODES = new Set(STAFF_CANCEL_REASONS.map((reason) => reason.code as string));

/** Server-side validation: an unknown code is stored as 'other', never trusted raw. */
export function normaliseCancelReason(by: 'customer' | 'staff', code: unknown): string {
  const value = typeof code === 'string' ? code.trim() : '';
  const allowed = by === 'staff' ? STAFF_CODES : CUSTOMER_CODES;
  return allowed.has(value) ? value : 'other';
}

/** A booking can only be cancelled before it is in service or already closed. */
export function canCancel(status: QueueItem['status']): boolean {
  return status === 'Waiting' || status === 'Called' || status === 'Reserved';
}