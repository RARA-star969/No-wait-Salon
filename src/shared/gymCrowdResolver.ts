export type CrowdLevel = 'Low' | 'Moderate' | 'Busy' | 'Very Busy' | 'Full';

export interface GymCrowdMetrics {
  level: CrowdLevel;
  percentage: number;
  availableSlots: number;
}

/** Exact proportional fill used by every compact Gym occupancy meter. */
export function resolveGymOccupancyPercentage(occupancy: number, maxCapacity: number): number {
  if (maxCapacity <= 0) return 0;
  return Math.min(100, Math.max(0, (occupancy / maxCapacity) * 100));
}

/**
 * Centralized Gym Crowd Level Resolver.
 * Resolves crowd status consistently across Customer UI and Staff Dashboard:
 *  0–35%   : Low
 *  36–65%  : Moderate
 *  66–89%  : Busy
 *  90–99%  : Very Busy
 *  100%+   : Full
 */
export function resolveGymCrowdLevel(occupancy: number, maxCapacity: number): GymCrowdMetrics {
  const cap = Math.max(1, maxCapacity);
  const occ = Math.max(0, occupancy);
  const percentage = Math.round(resolveGymOccupancyPercentage(occ, cap));
  const availableSlots = Math.max(0, cap - occ);

  let level: CrowdLevel = 'Low';
  if (percentage >= 100) {
    level = 'Full';
  } else if (percentage >= 90) {
    level = 'Very Busy';
  } else if (percentage >= 66) {
    level = 'Busy';
  } else if (percentage >= 36) {
    level = 'Moderate';
  } else {
    level = 'Low';
  }

  return { level, percentage, availableSlots };
}
