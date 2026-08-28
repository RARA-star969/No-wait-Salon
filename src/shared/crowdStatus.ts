/**
 * Deterministic, front-end-only crowd-status heuristic for listing cards.
 * There is no dedicated backend "crowd level" field, so this derives one
 * from the same live wait/queue numbers the card already renders — no
 * invented data, just a clear mapping a customer can trust.
 */
export type CrowdLevel = 'busy' | 'moderate' | 'low';

export type CrowdStatus = {
  level: CrowdLevel;
  label: string;
};

const BUSY_WAIT_MINUTES = 20;
const MODERATE_WAIT_MINUTES = 8;
const BUSY_QUEUE_SIZE = 6;
const MODERATE_QUEUE_SIZE = 3;

/**
 * `waitingCustomers` is the stronger signal when present (it's the actual
 * queue size); `liveWaitMinutes` alone still gives a reasonable read when a
 * business has no queue data yet.
 */
export function deriveCrowdStatus(input: { liveWaitMinutes: number; waitingCustomers?: number }): CrowdStatus {
  const wait = input.liveWaitMinutes;
  const queueSize = input.waitingCustomers ?? 0;

  if (wait >= BUSY_WAIT_MINUTES || queueSize >= BUSY_QUEUE_SIZE) {
    return { level: 'busy', label: 'Busy' };
  }
  if (wait >= MODERATE_WAIT_MINUTES || queueSize >= MODERATE_QUEUE_SIZE) {
    return { level: 'moderate', label: 'Moderate' };
  }
  return { level: 'low', label: 'Low crowd' };
}
