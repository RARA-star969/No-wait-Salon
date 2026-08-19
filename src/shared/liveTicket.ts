/**
 * One view model for a customer's live ticket, shared by the Customer app and
 * the public QR web page so the two can never drift.
 *
 * Everything here is derived from the server snapshot plus the server-stamped
 * timestamps. No client runs its own clock for the arrival deadline: it only
 * counts down to `graceExpiresAt`, so a refresh, a reconnect or a wrong device
 * clock cannot invent a different state from the salon's.
 */

import type { Barber, QueueItem } from '../types';
import { callPhase, canCancel, formatCountdown, remainingMs, type CallPhase } from './queueTiming';

/** Minutes of chair time assumed per waiting customer when nothing better is known. */
const DEFAULT_SERVICE_MINUTES = 15;

/** Statuses that occupy a place in the physical queue. */
const ACTIVE_STATUSES: Array<QueueItem['status']> = ['Waiting', 'Called', 'Serving'];

export type LiveTicketAction =
  | 'acknowledge'   // "I'm on my way"
  | 'cancel'
  | 'rejoin'
  | 'directions'
  | 'call_salon';

export type LiveTicketModel = {
  entry: QueueItem;
  phase: CallPhase;
  /** 1-based place in the queue; 0 once the ticket is no longer active. */
  position: number;
  peopleAhead: number;
  /** Estimated minutes until this customer is called. */
  estimatedWaitMinutes: number;
  estimatedWaitLabel: string;
  /** Milliseconds left in the arrival window; 0 when there is no live window. */
  arrivalRemainingMs: number;
  arrivalCountdown: string;
  /** True only while a call is live and the customer still has time to arrive. */
  arrivalWindowOpen: boolean;
  acknowledged: boolean;
  /** Terminal readings, each distinct so no two are ever conflated. */
  isCalled: boolean;
  isInService: boolean;
  isCompleted: boolean;
  isNoShow: boolean;
  isCancelled: boolean;
  cancelledBy?: 'customer' | 'staff';
  needsCallAgain: boolean;
  /** Which actions the ticket may offer right now. */
  availableActions: LiveTicketAction[];
  headline: string;
  detail: string;
};

const activeQueue = (queue: QueueItem[]): QueueItem[] =>
  queue
    .filter((item) => ACTIVE_STATUSES.includes(item.status))
    .sort((first, second) => first.createdAt - second.createdAt);

/** How many active chairs the salon is actually running. */
export const workingChairs = (barbers: Barber[]): number =>
  Math.max(1, barbers.filter((barber) => barber.status !== 'unavailable').length);

export function peopleAheadOf(entry: QueueItem, queue: QueueItem[]): number {
  return activeQueue(queue).filter(
    (item) => item.id !== entry.id && item.createdAt < entry.createdAt,
  ).length;
}

export function positionOf(entry: QueueItem, queue: QueueItem[]): number {
  const index = activeQueue(queue).findIndex((item) => item.id === entry.id);
  return index < 0 ? 0 : index + 1;
}

export function waitMinutesFor(peopleAhead: number, barbers: Barber[]): number {
  return Math.max(0, Math.ceil((peopleAhead * DEFAULT_SERVICE_MINUTES) / workingChairs(barbers)));
}

export const waitMinutesLabel = (minutes: number): string =>
  minutes <= 0 ? "You're next" : `About ${minutes} min`;

/**
 * Build the ticket. `now` is injected so tests are deterministic and so the two
 * surfaces tick from the same value they already hold.
 */
export function buildLiveTicket(
  entry: QueueItem,
  queue: QueueItem[],
  barbers: Barber[],
  now = Date.now(),
): LiveTicketModel {
  const phase = callPhase(entry, now);
  const isCompleted = phase === 'completed';
  const isNoShow = phase === 'no_show';
  const isCancelled =
    phase === 'cancelled' || entry.outcome === 'cancelled_customer' || entry.outcome === 'cancelled_staff';
  const isInService = phase === 'in_service';
  const needsCallAgain = phase === 'call_again';
  const isCalled = phase === 'called';
  const terminal = isCompleted || isNoShow || isCancelled;

  const peopleAhead = terminal ? 0 : peopleAheadOf(entry, queue);
  const position = terminal ? 0 : positionOf(entry, queue);
  const estimatedWaitMinutes = isInService || isCalled || needsCallAgain ? 0 : waitMinutesFor(peopleAhead, barbers);
  const arrivalRemainingMs = isCalled ? remainingMs(entry, now) : 0;
  const arrivalWindowOpen = isCalled && arrivalRemainingMs > 0;

  const cancelledBy = entry.cancelledBy
    ?? (entry.outcome === 'cancelled_staff' ? 'staff' : entry.outcome === 'cancelled_customer' ? 'customer' : undefined);

  const availableActions: LiveTicketAction[] = [];
  if (arrivalWindowOpen && !entry.acknowledgedAt) availableActions.push('acknowledge');
  if (!terminal && canCancel(entry.status)) availableActions.push('cancel');
  if (terminal) availableActions.push('rejoin');
  if (!terminal) availableActions.push('directions', 'call_salon');

  return {
    entry,
    phase,
    position,
    peopleAhead,
    estimatedWaitMinutes,
    estimatedWaitLabel: waitMinutesLabel(estimatedWaitMinutes),
    arrivalRemainingMs,
    arrivalCountdown: formatCountdown(arrivalRemainingMs),
    arrivalWindowOpen,
    acknowledged: Boolean(entry.acknowledgedAt),
    isCalled,
    isInService,
    isCompleted,
    isNoShow,
    isCancelled,
    cancelledBy,
    needsCallAgain,
    availableActions,
    ...ticketCopy({ isCompleted, isNoShow, isCancelled, cancelledBy, isInService, needsCallAgain, isCalled, peopleAhead }),
  };
}

/** Wording lives here so both surfaces say exactly the same thing. */
function ticketCopy(state: {
  isCompleted: boolean;
  isNoShow: boolean;
  isCancelled: boolean;
  cancelledBy?: 'customer' | 'staff';
  isInService: boolean;
  needsCallAgain: boolean;
  isCalled: boolean;
  peopleAhead: number;
}): { headline: string; detail: string } {
  if (state.isCompleted) return { headline: 'Service complete', detail: 'Thanks for visiting today.' };
  if (state.isNoShow) return { headline: 'Marked as no show', detail: 'The salon released your place in the queue.' };
  if (state.isCancelled) {
    return state.cancelledBy === 'staff'
      ? { headline: 'Cancelled by the salon', detail: 'The salon cancelled this booking. You can join again any time.' }
      : { headline: 'Booking cancelled', detail: 'You cancelled this booking. You can join again any time.' };
  }
  if (state.isInService) return { headline: "You're in the chair", detail: 'Enjoy your service.' };
  if (state.needsCallAgain) {
    return { headline: 'Arrival time passed', detail: 'The salon is deciding whether to call you again. Head over now.' };
  }
  if (state.isCalled) return { headline: "It's your turn", detail: 'Your chair is ready — please head to the salon now.' };
  if (state.peopleAhead === 0) return { headline: "You're next", detail: 'Stay close — the salon will call you shortly.' };
  return {
    headline: `${state.peopleAhead} ${state.peopleAhead === 1 ? 'person' : 'people'} ahead`,
    detail: "We'll alert you before your turn.",
  };
}

/** Queue facts for the pre-join sheet, from the same maths as the live ticket. */
export function buildJoinPreview(queue: QueueItem[], barbers: Barber[]) {
  const active = activeQueue(queue);
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
