import React from 'react';
import { useMetricFlash } from '../shared/useMetricFlash';
import { LIVE_QUEUE_FILL_CAPSULE, LIVE_QUEUE_RIM_CAPSULE } from '../shared/liveQueueVisual';
import { resolveGymCrowdLevel } from '../shared/gymCrowdResolver';

export interface GymFloatingCapsuleProps {
  currentOccupancy: number;
  maxCapacity: number;
  availableTrainersCount: number;
  onTap?: () => void;
  className?: string;
}

const CapsuleMetric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => {
  const flashing = useMetricFlash(value);
  return (
    <div className="flex min-w-0 shrink-0 flex-col items-center text-center">
      <p className="flex items-center justify-center whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.12em] text-white/60">
        {label}
      </p>
      <p
        className={`mt-0.5 whitespace-nowrap text-[14px] font-extrabold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${
          flashing ? 'scale-[1.15] text-[#7DEFC6]' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
};

export const GymFloatingCapsule: React.FC<GymFloatingCapsuleProps> = ({
  currentOccupancy,
  maxCapacity,
  availableTrainersCount,
  onTap,
  className = '',
}) => {
  const crowdMetrics = resolveGymCrowdLevel(currentOccupancy, maxCapacity);
  const Wrapper = onTap ? 'button' : 'div';

  return (
    <Wrapper
      type={onTap ? 'button' : undefined}
      onClick={onTap}
      id="gym-floating-capsule"
      aria-label={onTap ? 'Scroll to live gym crowd' : undefined}
      className={`live-scoreboard relative isolate inline-flex w-fit max-w-full items-center gap-2.5 overflow-visible rounded-full px-3.5 py-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_8px_18px_-8px_rgba(6,30,27,0.4)] ${className}`}
      style={{
        background: LIVE_QUEUE_FILL_CAPSULE,
        backdropFilter: 'blur(14px) saturate(160%)',
        WebkitBackdropFilter: 'blur(14px) saturate(160%)',
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full p-px"
        style={{
          background: LIVE_QUEUE_RIM_CAPSULE,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
        aria-hidden="true"
      />
      <span className="live-scoreboard-glow pointer-events-none absolute -right-4 -top-5 h-14 w-14 rounded-full bg-[#5EE0B4]/14 blur-2xl" aria-hidden="true" />
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[55%] rounded-t-full bg-gradient-to-b from-white/[0.12] to-transparent" aria-hidden="true" />

      {/* Live Badge */}
      <span className="relative flex shrink-0 items-center">
        <span className="live-chip-pulse inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#EF4444]/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-white">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Live
        </span>
      </span>

      {/* Metrics Row */}
      <span className="relative flex min-w-0 shrink-0 items-center gap-2.5">
        <CapsuleMetric label="Inside" value={`${currentOccupancy}/${maxCapacity}`} />
        <span className="text-white/30">·</span>
        <CapsuleMetric label="Crowd" value={crowdMetrics.level} />
        <span className="text-white/30">·</span>
        <CapsuleMetric label="Trainers" value={availableTrainersCount} />
      </span>
    </Wrapper>
  );
};
