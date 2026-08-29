import React from 'react';
import { resolveGymCrowdLevel } from '../shared/gymCrowdResolver';
import { LiveQueueScoreboard, type ScoreboardPalette } from './LiveQueueScoreboard';

// Gym's own dark/violet capsule palette — Salon's floating scoreboard is
// untouched (it never passes `palette`, so it keeps the default teal glass).
const GYM_SCOREBOARD_PALETTE: ScoreboardPalette = {
  fill: 'linear-gradient(135deg, rgba(24,15,40,0.92), rgba(46,27,74,0.88) 55%, rgba(59,7,100,0.85))',
  rim: 'linear-gradient(120deg, rgba(255,255,255,0.22), rgba(192,132,252,0.16) 35%, rgba(255,255,255,0.05) 58%, rgba(139,92,246,0.14) 82%, rgba(255,255,255,0.18))',
  glow: '#8B5CF6',
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
