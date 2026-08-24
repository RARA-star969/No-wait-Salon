import React from 'react';
import { resolveGymCrowdLevel } from '../shared/gymCrowdResolver';
import { LiveQueueScoreboard } from './LiveQueueScoreboard';

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
