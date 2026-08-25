import React from 'react';
import { useMetricFlash } from '../shared/useMetricFlash';
import { LIVE_QUEUE_GRADIENT, LIVE_QUEUE_RIM_FULL } from '../shared/liveQueueVisual';

export interface CategoryMetric {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  dense?: boolean;
}

export interface CategoryLiveCardProps {
  id?: string;
  live?: boolean;
  liveLabel?: string;
  topRightLabel?: React.ReactNode;
  metrics: CategoryMetric[];
  className?: string;
}

const CategoryStat: React.FC<{ label: React.ReactNode; value: React.ReactNode; dense?: boolean }> = ({
  label,
  value,
  dense,
}) => {
  const flashing = useMetricFlash(value);
  return (
    <div className="min-w-0 text-center">
      <p
        className={`whitespace-nowrap font-bold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${
          dense ? 'text-[15px]' : 'text-[22px]'
        } ${flashing ? 'scale-[1.12] text-[#7DEFC6]' : ''}`}
      >
        {value}
      </p>
      <p className="mt-1.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-white/55">
        {label || ' '}
      </p>
    </div>
  );
};

export const CategoryLiveCard: React.FC<CategoryLiveCardProps> = ({
  id = 'live-experience-card',
  live = true,
  liveLabel = 'Live',
  topRightLabel,
  metrics,
  className = '',
}) => {
  return (
    <section
      id={id}
      className={`relative overflow-hidden rounded-[22px] px-4 py-2.5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_20px_rgba(94,224,180,0.06),0_10px_24px_-10px_rgba(6,20,18,0.35),0_20px_42px_-18px_rgba(6,44,40,0.7)] ${className}`}
      style={{ background: LIVE_QUEUE_GRADIENT }}
    >
      {/* Luminous edge — softened, low-alpha masked gradient rim */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[22px] p-px"
        style={{
          background: LIVE_QUEUE_RIM_FULL,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[#5EE0B4]/16 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-14 bottom-0 h-28 w-28 rounded-full bg-[#0AA88C]/14 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-white/[0.09] to-transparent" aria-hidden="true" />

      {/* Periodic bulb-glow sweep */}
      <div className="light-sweep pointer-events-none absolute -inset-x-[60%] -inset-y-[40%]" aria-hidden="true" />

      {/* Faint scrolling line-graph / waveform */}
      <svg
        className="queue-waveform-line pointer-events-none absolute inset-x-0 bottom-0 h-9 w-[200%] text-white/[0.08]"
        viewBox="0 0 800 60"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 40 L40 30 L80 44 L120 22 L160 36 L200 16 L240 32 L280 24 L320 42 L360 20 L400 40 L440 30 L480 44 L520 22 L560 36 L600 16 L640 32 L680 24 L720 42 L760 20 L800 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Top Header Row */}
      <div className="relative flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
            live ? 'live-chip-pulse' : ''
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          {liveLabel}
        </span>
        {topRightLabel && (
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/55">
            {topRightLabel}
          </span>
        )}
      </div>

      {/* 3 Metrics Row */}
      <div className="relative mt-2.5 grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <CategoryStat key={m.key} label={m.label} value={m.value} dense={m.dense} />
        ))}
      </div>
    </section>
  );
};
