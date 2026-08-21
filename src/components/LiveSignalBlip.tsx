import React from 'react';

/**
 * The small "signal" dot that sits beside the LIVE chip. Every ~3s it
 * travels into the chip, turns green and blinks a few times, then travels
 * back out and resumes its idle teal glow — a single infinite CSS
 * animation (transform/opacity/background-color only), so it stays cheap
 * on low-end Android hardware. Shared by the salon page's hero live card
 * and the sticky scoreboard capsule so the two never drift apart.
 */
export const LiveSignalBlip: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`live-signal-blip relative inline-flex h-2 w-2 shrink-0 rounded-full ${className}`} aria-hidden="true" />
);
