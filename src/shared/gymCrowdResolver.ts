export type CrowdLevel = 'Low' | 'Moderate' | 'Busy' | 'Very Busy' | 'Full';

export interface GymCrowdMetrics {
  level: CrowdLevel;
  percentage: number;
  availableSlots: number;
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
  const percentage = Math.round((occ / cap) * 100);
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
