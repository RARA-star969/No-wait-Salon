/**
 * Decides what a Staff booking card shows and which actions it offers.
 *
 * Kept out of the component so the rules are testable on their own and so the
 * card cannot quietly grow an action that does not belong to the current
 * state. The underlying booking state machine is untouched: this only chooses
 * what to present for a state the server already decided.
 */

import type { QueueItem } from '../types';
import { callPhase, formatCountdown, remainingMs } from './queueTiming';

export type CardKind =
  | 'waiting'
  /** Called, and the arrival window is still running. */
  | 'called_active'
  /** Called, but the arrival window has elapsed and staff must decide. */
  | 'call_expired'
  | 'serving'
  | 'reserved';

export type ActionTone = 'primary' | 'secondary' | 'destructive' | 'ghost';

export type CardAction = {
  /** The queue action to dispatch, or 'cancel_chair' to open the reason sheet. */
  id: 'call' | 'call_again' | 'start' | 'complete' | 'no_show' | 'cancel_chair' | 'remove';
  label: string;
  tone: ActionTone;
  title: string;
  /** Icon-only actions sit apart from the labelled row. */
  iconOnly?: boolean;
};

export type BookingCardState = {
  kind: CardKind;
  /** Single status chip. Never duplicated by an action button. */
  statusLabel: string;
  /** Countdown or similar, shown on its own line under the chip. */
  timerLabel?: string;
  /** Supporting lines such as "Call attempt 2" or "Called for: Arjun". */
  detailLines: string[];
  actions: CardAction[];
};

const CALL: CardAction = { id: 'call', label: 'Call', tone: 'primary', title: 'Call customer and assign an available barber' };
const CALL_AGAIN: CardAction = { id: 'call_again', label: 'Call Again', tone: 'primary', title: 'Call this customer again and restart the arrival window' };
const START: CardAction = { id: 'start', label: 'Start', tone: 'primary', title: 'Start service directly in the chair' };
const START_SERVICE: CardAction = { id: 'start', label: 'Start Service', tone: 'primary', title: 'Seat the customer and begin service' };
const COMPLETE: CardAction = { id: 'complete', label: 'Complete', tone: 'primary', title: 'Finish the service and free the chair' };
const CANCEL_CHAIR: CardAction = { id: 'cancel_chair', label: 'Cancel Chair', tone: 'secondary', title: 'Cancel this booking on behalf of the salon' };
const NO_SHOW: CardAction = { id: 'no_show', label: 'No-show', tone: 'destructive', title: 'The customer was called but did not arrive' };
const REMOVE: CardAction = { id: 'remove', label: 'Remove', tone: 'ghost', title: 'Remove this queue entry', iconOnly: true };
const CHECK_IN: CardAction = { id: 'call', label: 'Check In', tone: 'primary', title: 'Check this reservation in' };

export function bookingCardState(item: QueueItem, now = Date.now()): BookingCardState {
  const phase = callPhase(item, now);

  if (item.status === 'Serving') {
    return {
      kind: 'serving',
      statusLabel: 'SERVING',
      detailLines: item.barberName ? [`With ${item.barberName}`] : [],
      // Nothing else belongs here: calling or cancelling a customer who is
      // already in the chair is not a real action.
      actions: [COMPLETE],
    };
  }

  if (item.status === 'Called') {
    const stylist = item.barberName ? [`Called for: ${item.barberName}`] : [];

    if (phase === 'called') {
      return {
        kind: 'called_active',
        statusLabel: 'CALLED',
        timerLabel: `${formatCountdown(remainingMs(item, now))} remaining`,
        detailLines: stylist,
        // Call Again and No-show stay locked until the deadline passes.
        actions: [START_SERVICE, CANCEL_CHAIR],
      };
    }

    // Window elapsed. The status is informational, so there is no second
    // "CALLED" pill competing with the action row.
    return {
      kind: 'call_expired',
      statusLabel: 'ARRIVAL WINDOW ENDED',
      detailLines: [
        ...(item.callAttempt ? [`Call attempt ${item.callAttempt}`] : []),
        ...stylist,
      ],
      actions: [CALL_AGAIN, START_SERVICE, CANCEL_CHAIR, NO_SHOW],
    };
  }

  if (item.status === 'Reserved') {
    return {
      kind: 'reserved',
      statusLabel: 'RESERVED',
      detailLines: item.reservedFor ? [`Reserved for ${item.reservedFor}`] : [],
      actions: [CHECK_IN, START],
    };
  }

  return {
    kind: 'waiting',
    statusLabel: 'WAITING',
    detailLines: [],
    // The trash action already covers removal here, so Cancel Chair — which
    // exists to record WHY a called booking was dropped — would only duplicate
    // the destructive path.
    actions: [CALL, START, REMOVE],
  };
}

/** Source badge text. Short enough to stay readable in a narrow column. */
export const sourceBadge = (item: QueueItem): string =>
  item.source === 'qr_web'
    ? 'WEB QR'
    : item.source === 'qr_walk_in'
      ? 'QR WALK-IN'
      : item.source === 'staff_walk_in'
        ? 'WALK-IN'
        : 'APP';

/** Last four digits only: staff need to identify, not to read the number out. */
export const maskedPhone = (phone?: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : '';
};
