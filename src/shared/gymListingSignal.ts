import type { CrowdLevel } from './gymCrowdResolver';
import type { SignalColor } from './signalColor';

export interface GymListingSignal {
  color: SignalColor;
  label: string;
}

const GYM_SIGNAL_BY_LEVEL: Record<CrowdLevel, GymListingSignal> = {
  Low: { color: 'green', label: 'Quiet' },
  Moderate: { color: 'yellow', label: 'Moderate' },
  Busy: { color: 'red', label: 'Busy' },
  'Very Busy': { color: 'red', label: 'Busy' },
  Full: { color: 'red', label: 'Busy' },
};

/**
 * Display wording/color for a gym listing card's signal chip, mapped from
 * the already-shared `resolveGymCrowdLevel` result — never a second crowd
 * calculation, only presentation on top of the one the Gym Detail page uses.
 */
export function gymListingSignal(level: CrowdLevel): GymListingSignal {
  return GYM_SIGNAL_BY_LEVEL[level];
}
