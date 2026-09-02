import React from 'react';
import { resolveGymCrowdLevel } from '../shared/gymCrowdResolver';
import { LiveQueueScoreboard, type ScoreboardPalette } from './LiveQueueScoreboard';
import { CATEGORY_THEME_MAP } from './CustomerHomeComponents';

// Gym shares the canonical NOQ capsule material. Category changes data only.
const gymTheme = CATEGORY_THEME_MAP.gym;
const GYM_SCOREBOARD_PALETTE: ScoreboardPalette = {
  fill: gymTheme.ctaGradient,
  rim: `linear-gradient(120deg, rgba(255,255,255,0.42), ${gymTheme.glassBorder} 35%, rgba(255,255,255,0.08) 58%, rgba(52,84,253,0.18) 82%, rgba(255,255,255,0.32))`,
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
      premiumLive
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
