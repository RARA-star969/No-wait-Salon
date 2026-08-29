import React from 'react';
import { resolveGymCrowdLevel } from '../shared/gymCrowdResolver';
import { LiveQueueScoreboard, type ScoreboardPalette } from './LiveQueueScoreboard';
import { CATEGORY_THEME_MAP } from './CustomerHomeComponents';

// Gym's own dark/violet capsule palette — sourced from the canonical Gym
// theme (CATEGORY_THEME_MAP.gym) rather than a locally hardcoded copy, so
// there is one place Gym's purple identity lives. Salon's floating
// scoreboard is untouched (it never passes `palette`, so it keeps the
// default teal glass).
const gymTheme = CATEGORY_THEME_MAP.gym;
const GYM_SCOREBOARD_PALETTE: ScoreboardPalette = {
  fill: `linear-gradient(135deg, rgba(24,15,40,0.92), ${gymTheme.glassSurface} 55%, rgba(59,7,100,0.85))`,
  rim: `linear-gradient(120deg, rgba(255,255,255,0.22), ${gymTheme.glassBorder} 35%, rgba(255,255,255,0.05) 58%, rgba(139,92,246,0.14) 82%, rgba(255,255,255,0.18))`,
  glow: gymTheme.selectedGlow,
};

export interface GymFloatingCapsuleProps {
  currentOccupancy: number;
  maxCapacity: number;
  availableTrainersCount: number;
  onTap?: () => void;
  className?: string;
}

export const GymFloatingCapsule: React.FC<GymFloatingCapsuleProps> = ({
  currentOccupancy,
  maxCapacity,
  availableTrainersCount,
  onTap,
  className = '',
}) => {
  const crowdMetrics = resolveGymCrowdLevel(currentOccupancy, maxCapacity);

  return (
    <LiveQueueScoreboard
      onTap={onTap}
      className={className}
      palette={GYM_SCOREBOARD_PALETTE}
      metrics={[
        {
          key: 'inside',
          label: 'INSIDE',
          value: `${currentOccupancy}/${maxCapacity}`,
        },
        {
          key: 'crowd',
          label: 'CROWD',
          value: crowdMetrics.level,
        },
        {
          key: 'trainers',
          label: 'TRAINERS',
          value: availableTrainersCount,
        },
      ]}
    />
  );
};
