import React from 'react';
import { Users, Dumbbell, Activity } from 'lucide-react';
import { useMetricFlash } from '../shared/useMetricFlash';
import { LIVE_QUEUE_FILL_CAPSULE, LIVE_QUEUE_RIM_FULL } from '../shared/liveQueueVisual';
import { resolveGymCrowdLevel, CrowdLevel } from '../shared/gymCrowdResolver';

export interface GymLiveCardProps {
  currentOccupancy: number;
  maxCapacity: number;
  availableTrainersCount: number;
  live?: boolean;
  className?: string;
}

const GymStat: React.FC<{ label: string; value: React.ReactNode; flashing?: boolean }> = ({
  label,
  value,
  flashing,
}) => (
  <div className="min-w-0 text-center">
    <p
      className={`whitespace-nowrap text-[22px] font-bold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${
        flashing ? 'scale-[1.12] text-[#7DEFC6]' : ''
      }`}
    >
      {value}
    </p>
    <p className="mt-1.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-white/55">
      {label}
    </p>
  </div>
);

export const GymLiveCard: React.FC<GymLiveCardProps> = ({
  currentOccupancy,
  maxCapacity,
  availableTrainersCount,
  live = true,
  className = '',
}) => {
  const occupancyFlash = useMetricFlash(`${currentOccupancy}/${maxCapacity}`);
  const trainerFlash = useMetricFlash(availableTrainersCount);
  const crowdMetrics = resolveGymCrowdLevel(currentOccupancy, maxCapacity);
  const crowdFlash = useMetricFlash(crowdMetrics.level);

  const trainerLabel = `${availableTrainersCount} ${availableTrainersCount === 1 ? 'Trainer' : 'Trainers'} Available`;

  return (
    <div
      id="gym-live-card"
      className={`relative isolate overflow-hidden rounded-3xl p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_40px_-16px_rgba(6,30,27,0.55)] ${className}`}
      style={{
        background: LIVE_QUEUE_FILL_CAPSULE,
      }}
    >
      {/* Outer Rim Highlight */}
      <span
        className="pointer-events-none absolute inset-0 rounded-3xl p-px"
        style={{
          background: LIVE_QUEUE_RIM_FULL,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
        aria-hidden="true"
      />
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[40%] rounded-t-3xl bg-gradient-to-b from-white/[0.14] to-transparent" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#5EE0B4]/10 blur-3xl" aria-hidden="true" />

      {/* Top Banner: Status + Live Pulse */}
      <div className="relative flex items-center justify-between border-b border-white/10 pb-3.5">
        <div className="flex items-center gap-2">
          {live && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/90 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              Live Gym Crowd
            </span>
          )}
        </div>

        <span className="flex items-center gap-1 text-[11px] font-bold text-[#7DEFC6]">
          <Dumbbell className="h-3.5 w-3.5" />
          {trainerLabel}
        </span>
      </div>

      {/* Main 3 Metrics Row */}
      <div className="relative mt-4 grid grid-cols-3 divide-x divide-white/10 text-center">
        <GymStat
          label="Inside"
          value={`${currentOccupancy} / ${maxCapacity}`}
          flashing={occupancyFlash}
        />
        <GymStat
          label="Crowd"
          value={crowdMetrics.level}
          flashing={crowdFlash}
        />
        <GymStat
          label="Trainers"
          value={availableTrainersCount}
          flashing={trainerFlash}
        />
      </div>
    </div>
  );
};
