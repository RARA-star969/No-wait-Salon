import React from 'react';
import { resolveGymCrowdLevel } from '../shared/gymCrowdResolver';
import { CategoryLiveCard } from './CategoryLiveCard';

export interface GymLiveCardProps {
  currentOccupancy: number;
  maxCapacity: number;
  availableTrainersCount: number;
  live?: boolean;
  className?: string;
}

export const GymLiveCard: React.FC<GymLiveCardProps> = ({
  currentOccupancy,
  maxCapacity,
  availableTrainersCount,
  live = true,
  className = '',
}) => {
  const crowdMetrics = resolveGymCrowdLevel(currentOccupancy, maxCapacity);
  const trainerLabel = `${availableTrainersCount} ${availableTrainersCount === 1 ? 'TRAINER' : 'TRAINERS'} AVAILABLE`;

  return (
    <CategoryLiveCard
      id="gym-live-card"
      live={live}
      liveLabel="LIVE GYM CROWD"
      topRightLabel={trainerLabel}
      className={className}
      metrics={[
        {
          key: 'inside',
          label: 'INSIDE',
          value: `${currentOccupancy} / ${maxCapacity}`,
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
