import React from 'react';
import { useMetricFlash } from '../shared/useMetricFlash';
import { LIVE_QUEUE_FILL_CAPSULE, LIVE_QUEUE_RIM_CAPSULE } from '../shared/liveQueueVisual';

/**
 * The Salon Detail page's floating scoreboard capsule — a glassy teal pill
 * with a glowing LIVE pulse and a subtle breathing motion, showing the same
 * Time / Position / Chairs triple as the full LiveQueueCard so the two
 * surfaces can never disagree.
 */

export type ScoreboardMetric = {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
};

/** Color-only override — omitted, this reproduces the existing Salon teal
 *  capsule exactly, so Salon gets zero behavior/visual change. */
export type ScoreboardPalette = {
  fill: string;
  rim: string;
  glow: string;
};

type Props = {
  metrics: ScoreboardMetric[];
  onTap?: () => void;
  className?: string;
  palette?: ScoreboardPalette;
};

const MetricValue: React.FC<{ metric: ScoreboardMetric }> = ({ metric }) => {
  const flashing = useMetricFlash(metric.value);
  return (
    <div className="flex min-w-0 shrink-0 flex-col items-center text-center">
      <p className="flex items-center justify-center whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.12em] text-white/60">
        {metric.label}
      </p>
      <p
        className={`mt-0.5 whitespace-nowrap text-[15px] font-bold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${
          flashing ? 'scale-[1.15] text-[#7DEFC6]' : ''
        }`}
      >
        {metric.value}
      </p>
    </div>
  );
};

export const LiveQueueScoreboard: React.FC<Props> = ({ metrics, onTap, className = '', palette }) => {
  const Wrapper = onTap ? 'button' : 'div';
  const fill = palette?.fill ?? LIVE_QUEUE_FILL_CAPSULE;
  const rim = palette?.rim ?? LIVE_QUEUE_RIM_CAPSULE;
  const glow = palette?.glow ?? '#5EE0B4';
  return (
    <Wrapper
      type={onTap ? 'button' : undefined}
      onClick={onTap}
      aria-label={onTap ? 'Return to live queue' : undefined}
      className={`live-scoreboard relative isolate inline-flex w-fit max-w-full items-center gap-2.5 overflow-visible rounded-full px-3 py-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.24),inset_0_0_10px_rgba(94,224,180,0.06),0_0_0_1px_rgba(255,255,255,0.1),0_8px_18px_-8px_rgba(6,30,27,0.4)] ${className}`}
      style={{ background: fill, backdropFilter: 'blur(14px) saturate(160%)', WebkitBackdropFilter: 'blur(14px) saturate(160%)' }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full p-px"
        style={{
          background: rim,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
        aria-hidden="true"
      />
      <span className="live-scoreboard-glow pointer-events-none absolute -right-4 -top-5 h-14 w-14 rounded-full blur-2xl" style={{ backgroundColor: `${glow}24` }} aria-hidden="true" />
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[55%] rounded-t-full bg-gradient-to-b from-white/[0.12] to-transparent" aria-hidden="true" />

      <span className="relative flex shrink-0 items-center">
        <span className="live-chip-pulse inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#EF4444]/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-white">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Live
        </span>
      </span>

      <span className="relative flex min-w-0 shrink-0 items-center gap-2.5">
        {metrics.map((metric) => (
          <MetricValue key={metric.key} metric={metric} />
        ))}
      </span>
    </Wrapper>
  );
};
