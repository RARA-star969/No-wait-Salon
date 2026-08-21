/**
 * Single source of truth for the customer-facing live queue numbers shown on
 * the salon page's LiveQueueCard/capsule and on the Join Queue sheet's own
 * LiveQueueCard, so the two can never disagree about people ahead, ready
 * chairs, or the wait estimate. Deliberately customer-app only: the public
 * QR page keeps its own `joinPreview.ts` maths and visuals untouched.
 */

import type { Barber, QueueItem } from '../types';
import { formatDurationLabel } from './durationFormat';

/** Statuses that count as "ahead of me" for the customer-app live card. */
const WAITING_STATUSES: Array<QueueItem['status']> = ['Waiting', 'Called'];

/** Minutes of chair time assumed per waiting customer when nothing better is known. */
const MINUTES_PER_CUSTOMER = 15;

export type LiveQueueMetrics = {
  waitingCount: number;
  activeBarbers: number;
  availableBarbers: number;
  waitMinutes: number;
  /** formatDurationLabel(waitMinutes) — callers decide the "Ready now" substitution. */
  waitLabel: string;
};

export function deriveLiveQueueMetrics(queue: QueueItem[], barbers: Barber[]): LiveQueueMetrics {
  const waitingCount = queue.filter((item) => WAITING_STATUSES.includes(item.status)).length;
  const activeBarbers = barbers.filter((barber) => barber.status !== 'unavailable').length;
  const availableBarbers = barbers.filter((barber) => barber.status === 'available').length;
  const waitMinutes = activeBarbers ? Math.ceil((waitingCount * MINUTES_PER_CUSTOMER) / activeBarbers) : 0;
  return { waitingCount, activeBarbers, availableBarbers, waitMinutes, waitLabel: formatDurationLabel(waitMinutes) };
}
