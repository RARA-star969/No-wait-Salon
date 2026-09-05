// Single source of truth for how a booking is classified in the Staff
// "Bookings" section. Shared so the tabs, badges and any future reporting all
// agree on what Completed / Cancelled / Live actually mean.

import type { QueueItem } from '../types';
import { callPhase } from './queueTiming';

export type BookingTab = 'live' | 'upcoming' | 'reserved' | 'completed' | 'cancelled' | 'gross';

export const BOOKING_TABS: Array<{ id: BookingTab; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'upcoming', label: 'Upcoming Queue' },
  { id: 'reserved', label: 'Reserved' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'gross', label: 'Gross Bookings' },
];

/** Live = anything actively being worked: waiting, called, call-again, in service. */
export function isLive(item: QueueItem, now = Date.now()): boolean {
  const phase = callPhase(item, now);
  return phase === 'waiting' || phase === 'called' || phase === 'call_again' || phase === 'in_service';
}

/** Upcoming = active but not yet called. Reserved slots are counted separately. */
export function isUpcoming(item: QueueItem): boolean {
  return item.status === 'Waiting';
}

export function isReserved(item: QueueItem): boolean {
  return item.status === 'Reserved' || Boolean(item.reservedFor);
}

/** Completed means a service actually happened. Nothing else may land here. */
export function isCompleted(item: QueueItem): boolean {
  return item.outcome === 'completed' || (item.status === 'Completed' && !item.outcome);
}

/** Cancelled groups both cancellations and no-shows, each badged distinctly. */
export function isCancelled(item: QueueItem): boolean {
  return (
    item.outcome === 'cancelled_customer' ||
    item.outcome === 'cancelled_staff' ||
    item.outcome === 'no_show' ||
    item.status === 'Cancelled' ||
    item.status === 'NoShow'
  );
}

export function outcomeBadge(item: QueueItem): { label: string; tone: 'good' | 'bad' | 'warn' } {
  if (item.outcome === 'no_show' || item.status === 'NoShow') return { label: 'NO SHOW', tone: 'bad' };
  if (item.outcome === 'cancelled_staff') return { label: 'CANCELLED BY SALON', tone: 'warn' };
  if (item.outcome === 'cancelled_customer') return { label: 'CANCELLED BY CUSTOMER', tone: 'warn' };
  if (item.status === 'Cancelled') return { label: 'CANCELLED', tone: 'warn' };
  return { label: 'DONE', tone: 'good' };
}

export const sourceLabel = (item: QueueItem): string =>
  item.source === 'qr_web' ? 'Web QR' : item.source === 'qr_walk_in' ? 'QR Walk-in' : item.source === 'staff_walk_in' ? 'Walk-in' : 'App';

export type BookingFilters = {
  range: 'today' | '7d' | '30d' | 'all';
  source: 'all' | 'customer_app' | 'qr_web' | 'walk_in';
  search: string;
};

const rangeStart = (range: BookingFilters['range'], now = Date.now()): number => {
  if (range === 'all') return 0;
  if (range === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  return now - (range === '7d' ? 7 : 30) * 24 * 60 * 60_000;
};

const stamp = (item: QueueItem): number =>
  item.serviceCompletedAt || item.cancelledAt || item.noShowAt || item.createdAt;

export function applyFilters(items: QueueItem[], filters: BookingFilters, now = Date.now()): QueueItem[] {
  const from = rangeStart(filters.range, now);
  const search = filters.search.trim().toLocaleLowerCase();
  return items.filter((item) => {
    if (stamp(item) < from) return false;
    const itemSource = item.source || 'customer_app';
    if (filters.source === 'walk_in' && itemSource !== 'staff_walk_in' && itemSource !== 'qr_walk_in') return false;
    if (filters.source !== 'all' && filters.source !== 'walk_in' && itemSource !== filters.source) return false;
    if (search && ![item.name, item.service, item.token].some((value) => value?.toLocaleLowerCase().includes(search))) return false;
    return true;
  });
}

/**
 * Gross bookings summary. Revenue is intentionally omitted: the queue carries
 * no reliable per-booking price, so inventing one would be worse than
 * reporting activity counts only.
 */
export function grossSummary(active: QueueItem[], history: QueueItem[], now = Date.now()) {
  const completed = history.filter(isCompleted).length;
  const noShow = history.filter((item) => item.outcome === 'no_show' || item.status === 'NoShow').length;
  const cancelledCustomer = history.filter((item) => item.outcome === 'cancelled_customer').length;
  const cancelledStaff = history.filter((item) => item.outcome === 'cancelled_staff').length;
  const live = active.filter((item) => isLive(item, now)).length;
  const total = completed + noShow + cancelledCustomer + cancelledStaff + live;
  const attempts = history.reduce((sum, item) => sum + (item.callAttempt || 0), 0);
  const called = history.filter((item) => (item.callAttempt || 0) > 0).length;
  return {
    total,
    live,
    completed,
    noShow,
    cancelledCustomer,
    cancelledStaff,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
    averageCallAttempts: called > 0 ? Number((attempts / called).toFixed(1)) : 0,
    fromApp: [...active, ...history].filter((item) => (item.source || 'customer_app') === 'customer_app').length,
    fromWebQr: [...active, ...history].filter((item) => item.source === 'qr_web').length,
  };
}
