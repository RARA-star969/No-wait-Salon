import { deriveQueueDisplayState, type QueueDisplayState } from './queueDisplayState';

/**
 * Single source for the Position field shown identically by the Salon
 * Detail live-queue card and its floating scoreboard capsule, so the two
 * surfaces can never disagree and a metric-change pulse always fires on the
 * same field in both places for the same real event.
 */
export type LiveQueuePosition = {
  state: QueueDisplayState;
  positionLabel: string;
};

export function liveQueuePosition(peopleAhead: number, readyChairs: number): LiveQueuePosition {
  const { state } = deriveQueueDisplayState(peopleAhead, readyChairs);
  const positionLabel = state === 'ready_now' ? 'Now' : state === 'your_turn' ? 'Next' : `#${peopleAhead + 1}`;
  return { state, positionLabel };
}

/**
 * "You'd be #N" copy for a salon listing card, built on the exact same
 * `liveQueuePosition` the Detail page's Position field renders — a listing
 * card and the Detail page can therefore never disagree about where a
 * customer would land. Returns null when there's no wait to report a
 * position for (the card shows "No wait · Ready now" instead), and never
 * implies a reserved position since no queue entry exists yet.
 */
export function salonListingPositionLabel(peopleAhead: number, readyChairs: number): string | null {
  const { state, positionLabel } = liveQueuePosition(peopleAhead, readyChairs);
  if (state === 'ready_now') return null;
  if (state === 'your_turn') return "You'd be next";
  return `You'd be ${positionLabel}`;
}
