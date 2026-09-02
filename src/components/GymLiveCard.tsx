import React from 'react';
import { resolveGymCrowdLevel } from '../shared/gymCrowdResolver';
import { CategoryLiveCard, type CategoryLiveCardPalette } from './CategoryLiveCard';
import { CATEGORY_THEME_MAP } from './CustomerHomeComponents';

// Gym shares the canonical NOQ material palette. Category changes metrics and
// copy only; it never recolors the customer experience.
const gymTheme = CATEGORY_THEME_MAP.gym;
const GYM_LIVE_CARD_PALETTE: CategoryLiveCardPalette = {
  gradient: gymTheme.ctaGradient,
  rim: `linear-gradient(120deg, rgba(255,255,255,0.14), ${gymTheme.glassBorder} 35%, rgba(255,255,255,0.04) 58%, ${gymTheme.primary}24 82%, rgba(255,255,255,0.12))`,
  glowColorA: gymTheme.selectedGlow,
  // Matches gymTheme.ctaGradient's opening stop by design (same deep
  // purple), kept as its own value here since this card blends two glow
  // colors rather than painting a gradient.
  glowColorB: gymTheme.primary,
  flashColor: gymTheme.subtleAccent,
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
      liveLabel="Live"
      premiumLive
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
