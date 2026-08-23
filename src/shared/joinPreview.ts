/**
 * Queue facts shown on the pre-join sheet: people ahead, projected position,
 * estimated wait and open chairs. Kept separate from any single ticket's view
 * model because a join preview is computed before a booking exists.
 */

import type { Barber, QueueItem } from '../types';

/** Minutes of chair time assumed per waiting customer when nothing better is known. */
const DEFAULT_SERVICE_MINUTES = 15;

/** Statuses that occupy a place in the physical queue. */
const ACTIVE_STATUSES: Array<QueueItem['status']> = ['Waiting', 'Called', 'Serving'];

/** How many active chairs the salon is actually running. */
export const workingChairs = (barbers: Barber[]): number =>
  Math.max(1, barbers.filter((barber) => barber.status !== 'unavailable').length);

export function waitMinutesFor(peopleAhead: number, barbers: Barber[]): number {
  return Math.max(0, Math.ceil((peopleAhead * DEFAULT_SERVICE_MINUTES) / workingChairs(barbers)));
}

export const waitMinutesLabel = (minutes: number): string =>
  minutes <= 0 ? "You're next" : `About ${minutes} min`;

/** Queue facts for the pre-join sheet. */
export function buildJoinPreview(queue: QueueItem[], barbers: Barber[]) {
  const active = queue.filter((item) => ACTIVE_STATUSES.includes(item.status));
  const peopleAhead = active.length;
  const estimatedWaitMinutes = waitMinutesFor(peopleAhead, barbers);
  return {
    peopleAhead,
    /** Where this customer would land if they joined right now. */
    projectedPosition: peopleAhead + 1,
    estimatedWaitMinutes,
    estimatedWaitLabel: waitMinutesLabel(estimatedWaitMinutes),
    openChairs: barbers.filter((barber) => barber.status === 'available').length,
    workingChairs: workingChairs(barbers),
  };
}
