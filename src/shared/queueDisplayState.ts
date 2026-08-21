// Single source of truth for the "is this customer basically next" moment.
// The main live-queue card, the sticky dock CTA, and any other salon-page
// surface all derive from this instead of each re-deciding independently,
// so they can never disagree about WAITING vs YOUR TURN / BOOK SEAT.
//
// Pure presentation logic over already-computed queue/chair numbers — it
// does not talk to the backend and does not change queue semantics.

export type QueueDisplayState = 'waiting' | 'your_turn' | 'ready_now';

export type QueueDisplayInfo = {
  state: QueueDisplayState;
  ctaLabel: 'Join Queue' | 'Book Seat';
};

export function deriveQueueDisplayState(peopleAhead: number, readyChairs: number): QueueDisplayInfo {
  if (peopleAhead === 0 && readyChairs > 0) {
    return { state: 'ready_now', ctaLabel: 'Book Seat' };
  }
  if (peopleAhead === 1 && readyChairs > 0) {
    return { state: 'your_turn', ctaLabel: 'Book Seat' };
  }
  return { state: 'waiting', ctaLabel: 'Join Queue' };
}
