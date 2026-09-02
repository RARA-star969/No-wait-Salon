import React from 'react';
import { useMetricFlash } from '../shared/useMetricFlash';
import { NOQ_CUSTOMER_LIVE_QUEUE_GRADIENT, NOQ_CUSTOMER_LIVE_QUEUE_RIM_FULL } from '../shared/liveQueueVisual';
import { LiveStatusChip } from './LiveStatusChip';

export interface CategoryMetric {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  dense?: boolean;
}

/** Color-only override, layout/content untouched. Defaults reproduce the
 *  existing Salon teal exactly, so LiveQueueCard gets zero behavior change. */
export interface CategoryLiveCardPalette {
  gradient?: string;
  rim?: string;
  glowColorA?: string;
  glowColorB?: string;
  flashColor?: string;
}

export interface CategoryLiveCardProps {
  id?: string;
  live?: boolean;
  liveLabel?: string;
  topRightLabel?: React.ReactNode;
  metrics: CategoryMetric[];
  className?: string;
  palette?: CategoryLiveCardPalette;
  premiumLive?: boolean;
}

const CategoryStat: React.FC<{ label: React.ReactNode; value: React.ReactNode; dense?: boolean; flashColor: string }> = ({
  label,
  value,
  dense,
  flashColor,
}) => {
  const flashing = useMetricFlash(value);
  return (
    <div className="min-w-0 text-center">
      <p
        className={`whitespace-nowrap font-bold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${
          dense ? 'text-[15px]' : 'text-[22px]'
        } ${flashing ? 'scale-[1.12]' : ''}`}
        style={flashing ? { color: flashColor } : undefined}
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
  palette,
  premiumLive = false,
}) => {
  const gradient = palette?.gradient ?? NOQ_CUSTOMER_LIVE_QUEUE_GRADIENT;
  const rim = palette?.rim ?? NOQ_CUSTOMER_LIVE_QUEUE_RIM_FULL;
  const glowColorA = palette?.glowColorA ?? '#7890FF';
  const glowColorB = palette?.glowColorB ?? '#3454FD';
  const flashColor = palette?.flashColor ?? '#DCE4FF';
  return (
    <section
      id={id}
      className={`relative overflow-hidden rounded-[22px] border border-white/[0.14] px-4 py-2.5 text-white shadow-[0_10px_24px_-10px_rgba(29,54,201,0.28),0_20px_42px_-18px_rgba(52,84,253,0.42)] ${className}`}
      style={{ background: gradient }}
    >
      {/* Luminous edge — softened, low-alpha masked gradient rim */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[22px] p-px"
        style={{
          background: rim,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full blur-3xl" style={{ backgroundColor: `${glowColorA}29` }} aria-hidden="true" />
      <div className="pointer-events-none absolute -left-14 bottom-0 h-28 w-28 rounded-full blur-3xl" style={{ backgroundColor: `${glowColorB}24` }} aria-hidden="true" />
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

      {/* Top Header Row — the live badge and secondary label are both
          intentionally small: they're context, not the content. The three
          metrics below stay the strongest visual element on the card. */}
      <div className="relative flex items-center justify-between gap-2">
        {premiumLive ? (
          <LiveStatusChip label="Live" live={live} />
        ) : (
          <span
            className={`inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-1.5 py-[3px] text-[8px] font-bold uppercase tracking-[0.08em] text-white/70 ${
              live ? 'live-chip-pulse' : ''
            }`}
          >
            <span className="relative flex h-1 w-1">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/80" />}
              <span className="relative inline-flex h-1 w-1 rounded-full bg-rose-400" />
            </span>
            {liveLabel}
          </span>
        )}
        {topRightLabel && (
          <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-white/45">
            {topRightLabel}
          </span>
        )}
      </div>

      {/* 3 Metrics Row */}
      <div className="relative mt-2.5 grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <CategoryStat key={m.key} label={m.label} value={m.value} dense={m.dense} flashColor={flashColor} />
        ))}
      </div>
    </section>
  );
};
