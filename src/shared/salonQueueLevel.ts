import type { SignalColor } from './signalColor';

export interface SalonQueueSignal {
  color: SignalColor;
  label: string;
}

/**
 * Traffic-light queue-load signal for a salon listing card, derived from the
 * same `waitingCustomers` count the salon detail page's live-queue card
 * reads — one pure function so the listing and detail pages can never
 * disagree about how "busy" a salon currently is.
 */
export function resolveSalonQueueSignal(waitingCustomers: number): SalonQueueSignal {
  if (waitingCustomers <= 0) return { color: 'green', label: 'Available' };
  if (waitingCustomers <= 2) return { color: 'yellow', label: 'Moderate' };
  if (waitingCustomers <= 5) return { color: 'orange', label: 'Busy' };
  return { color: 'red', label: 'High wait' };
}
