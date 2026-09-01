/**
 * Shared teal "mirror/lens" material tokens for the Salon Detail live-queue
 * card and its floating capsule — one definition instead of each file
 * hand-typing its own gradient/rim numbers.
 */
export const LIVE_QUEUE_GRADIENT = 'linear-gradient(135deg,#0B4A44,#0F6B62 55%,#0F766E)';

export const LIVE_QUEUE_RIM_FULL =
  'linear-gradient(120deg, rgba(255,255,255,0.5), rgba(125,239,198,0.22) 35%, rgba(255,255,255,0.08) 58%, rgba(94,224,180,0.2) 82%, rgba(255,255,255,0.42))';

export const LIVE_QUEUE_RIM_CAPSULE =
  'linear-gradient(120deg, rgba(255,255,255,0.32), rgba(125,239,198,0.14) 35%, rgba(255,255,255,0.05) 58%, rgba(94,224,180,0.12) 82%, rgba(255,255,255,0.26))';

export const LIVE_QUEUE_FILL_CAPSULE = 'linear-gradient(135deg, rgba(15,86,79,0.9), rgba(18,112,103,0.86) 55%, rgba(20,122,113,0.84))';

/** Customer-only NOQ brand variants. Legacy exports above remain untouched
 * because the staff workspace also consumes them. */
export const NOQ_CUSTOMER_LIVE_QUEUE_GRADIENT =
  'linear-gradient(145deg, #7890FF 0%, #3454FD 52%, #1D36C9 100%)';
export const NOQ_CUSTOMER_LIVE_QUEUE_RIM_FULL =
  'linear-gradient(120deg, rgba(255,255,255,0.62), rgba(120,144,255,0.34) 35%, rgba(255,255,255,0.14) 58%, rgba(52,84,253,0.28) 82%, rgba(255,255,255,0.5))';
export const NOQ_CUSTOMER_LIVE_QUEUE_RIM_CAPSULE =
  'linear-gradient(120deg, rgba(255,255,255,0.42), rgba(120,144,255,0.22) 35%, rgba(255,255,255,0.08) 58%, rgba(52,84,253,0.18) 82%, rgba(255,255,255,0.32))';
export const NOQ_CUSTOMER_LIVE_QUEUE_FILL_CAPSULE =
  'linear-gradient(135deg, rgba(120,144,255,0.92), rgba(52,84,253,0.9) 55%, rgba(29,54,201,0.88))';
