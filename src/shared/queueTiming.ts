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
  | 'no_show';

export function callPhase(item: Pick<QueueItem, 'status' | 'graceExpiresAt'>, now = Date.now()): CallPhase {
  if (item.status === 'Serving') return 'in_service';
  if (item.status === 'Completed') return 'completed';
  if (item.status === 'NoShow') return 'no_show';
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
