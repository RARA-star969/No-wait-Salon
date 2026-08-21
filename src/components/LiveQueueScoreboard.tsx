import React from 'react';
import { Radio } from 'lucide-react';
import { useMetricFlash } from '../shared/useMetricFlash';
import { LIVE_QUEUE_FILL_CAPSULE, LIVE_QUEUE_RIM_CAPSULE } from '../shared/liveQueueVisual';

/**
 * The one reusable "premium live scoreboard" visual language — a glassy
 * teal capsule with a glowing LIVE pulse and a subtle breathing motion.
 * Two call sites use it with two configurations rather than drifting into
 * separate implementations:
 *   - the salon page's sticky floating capsule (Time · Position · Chairs)
 *   - the Join Queue sheet's panel (People Ahead · Position · Est. Time · Chairs)
 */

export type ScoreboardMetric = {
  key: string;
  /** Usually short text; pass an icon element (e.g. a compact Clock glyph) to
   *  replace the label entirely for a metric that reads better as an icon. */
  label: React.ReactNode;
  value: React.ReactNode;
};

type Props = {
  metrics: ScoreboardMetric[];
  /** 'capsule' = compact pill for the sticky header; 'panel' = card for sheets. */
  variant?: 'capsule' | 'panel';
  onTap?: () => void;
  className?: string;
};

/** Value on top, label below (or side-by-side for the compact capsule). */
const MetricValue: React.FC<{ metric: ScoreboardMetric; compact: boolean }> = ({ metric, compact }) => {
  const flashing = useMetricFlash(metric.value);
  return (
    <div className={`min-w-0 shrink-0 ${compact ? 'flex flex-col items-center text-center' : ''}`}>
      <p className={`flex items-center whitespace-nowrap font-bold uppercase tracking-[0.12em] text-white/60 ${compact ? 'justify-center text-[8px]' : 'text-[9px]'}`}>
        {metric.label}
      </p>
      <p
        className={`whitespace-nowrap font-bold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${
          compact ? 'mt-0.5 text-[15px]' : 'mt-1 text-[19px]'
        } ${flashing ? 'scale-[1.15] text-[#7DEFC6]' : ''}`}
      >
        {metric.value}
      </p>
    </div>
  );
};

export const LiveQueueScoreboard: React.FC<Props> = ({ metrics, variant = 'panel', onTap, className = '' }) => {
  const compact = variant === 'capsule';
  const Wrapper = onTap ? 'button' : 'div';

  if (compact) {
    return (
      <Wrapper
        type={onTap ? 'button' : undefined}
        onClick={onTap}
        aria-label={onTap ? 'Return to live queue' : undefined}
        className={`live-scoreboard relative isolate inline-flex w-fit max-w-full items-center gap-2.5 overflow-visible rounded-full px-3 py-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.24),inset_0_0_10px_rgba(94,224,180,0.06),0_0_0_1px_rgba(255,255,255,0.1),0_8px_18px_-8px_rgba(6,30,27,0.4)] ${className}`}
        style={{ background: LIVE_QUEUE_FILL_CAPSULE, backdropFilter: 'blur(14px) saturate(160%)', WebkitBackdropFilter: 'blur(14px) saturate(160%)' }}
      >
        {/* Luminous edge — same technique as the full card, thinner/fainter. */}
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
            <MetricValue key={metric.key} metric={metric} compact />
          ))}
        </span>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      type={onTap ? 'button' : undefined}
      onClick={onTap}
      aria-label={onTap ? 'Return to live queue' : undefined}
      className={`live-scoreboard relative isolate overflow-hidden rounded-2xl px-4 py-3.5 text-left shadow-[0_14px_32px_-14px_rgba(6,44,40,0.55)] ring-1 ring-white/10 ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(11,74,68,0.94), rgba(15,107,98,0.9) 55%, rgba(15,118,110,0.88))',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <span className="live-scoreboard-glow pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-[#5EE0B4]/25 blur-2xl" aria-hidden="true" />

      <span className="relative flex shrink-0 items-center gap-1.5">
        <span className="live-chip-pulse inline-flex items-center gap-1 rounded-full bg-[#EF4444]/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Live
        </span>
      </span>

      <span className="relative mt-2.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0,1fr))` }}>
        {metrics.map((metric) => (
          <MetricValue key={metric.key} metric={metric} compact={false} />
        ))}
      </span>

      <span className="relative mt-2.5 flex items-center gap-1 text-[10px] font-semibold text-[#7DEFC6]">
        <Radio className="h-3 w-3 animate-pulse" />
        Updates in real time
      </span>
    </Wrapper>
  );
};
