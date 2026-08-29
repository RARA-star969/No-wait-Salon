import React from 'react';
import { resolveGymCrowdLevel } from '../shared/gymCrowdResolver';
import { CategoryLiveCard, type CategoryLiveCardPalette } from './CategoryLiveCard';

// Gym's own purple/fuchsia palette (matches the Home Gym card and category
// hierarchy) — color-only override, same card layout/content as Salon's.
const GYM_LIVE_CARD_PALETTE: CategoryLiveCardPalette = {
  gradient: 'linear-gradient(135deg,#3B0764,#6B21A8 55%,#7E22CE)',
  rim: 'linear-gradient(120deg, rgba(255,255,255,0.5), rgba(192,132,252,0.28) 35%, rgba(255,255,255,0.08) 58%, rgba(168,85,247,0.24) 82%, rgba(255,255,255,0.42))',
  glowColorA: '#C084FC',
  glowColorB: '#7E22CE',
  flashColor: '#E9D5FF',
};

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
      palette={GYM_LIVE_CARD_PALETTE}
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
