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
