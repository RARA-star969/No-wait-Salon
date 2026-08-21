/**
 * Shared teal "mirror/lens" material tokens for the Live Queue system — the
 * full card and the floating capsule both derive from this one definition
 * (capsule = a lighter fraction of the same values) instead of each file
 * hand-typing its own gradient/rim/shadow numbers.
 */
export const LIVE_QUEUE_GRADIENT = 'linear-gradient(135deg,#0B4A44,#0F6B62 55%,#0F766E)';

export const LIVE_QUEUE_RIM_FULL =
  'linear-gradient(120deg, rgba(255,255,255,0.5), rgba(125,239,198,0.22) 35%, rgba(255,255,255,0.08) 58%, rgba(94,224,180,0.2) 82%, rgba(255,255,255,0.42))';

export const LIVE_QUEUE_RIM_CAPSULE =
  'linear-gradient(120deg, rgba(255,255,255,0.32), rgba(125,239,198,0.14) 35%, rgba(255,255,255,0.05) 58%, rgba(94,224,180,0.12) 82%, rgba(255,255,255,0.26))';

export const LIVE_QUEUE_FILL_CAPSULE = 'linear-gradient(135deg, rgba(15,86,79,0.9), rgba(18,112,103,0.86) 55%, rgba(20,122,113,0.84))';
