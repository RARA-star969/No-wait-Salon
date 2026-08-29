import React from 'react';
import { resolveGymCrowdLevel } from '../shared/gymCrowdResolver';
import { CategoryLiveCard, type CategoryLiveCardPalette } from './CategoryLiveCard';

// Gym's own restrained near-black/deep-violet glass palette — darker and
// quieter than the old flat purple/fuchsia gradient, so the numbers (not
// the card surface) carry the visual weight. Content/data/behavior below
// is unchanged; this is a color/surface-only override.
const GYM_LIVE_CARD_PALETTE: CategoryLiveCardPalette = {
  gradient: 'linear-gradient(160deg,#180F28 0%,#241539 55%,#2E1B4A 100%)',
  rim: 'linear-gradient(120deg, rgba(255,255,255,0.14), rgba(192,132,252,0.16) 35%, rgba(255,255,255,0.04) 58%, rgba(168,85,247,0.14) 82%, rgba(255,255,255,0.12))',
  glowColorA: '#8B5CF6',
  glowColorB: '#5B21B6',
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
