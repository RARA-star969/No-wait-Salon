import React, { useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';

/**
 * The one reusable "premium live scoreboard" visual language — a glassy
 * teal capsule with a glowing LIVE pulse and a subtle breathing motion.
 * Two call sites use it with two configurations rather than drifting into
 * separate implementations:
 *   - the salon page's sticky floating capsule (Time · Position · Ready chairs)
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

/** Flags a value as "just changed" for ~900ms so the UI can pulse it once. */
function useFlashOnChange(value: React.ReactNode): boolean {
  const previous = useRef(value);
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), 900);
    return () => clearTimeout(timer);
  }, [value]);
  return flashing;
}

const MetricValue: React.FC<{ metric: ScoreboardMetric; compact: boolean }> = ({ metric, compact }) => {
  const flashing = useFlashOnChange(metric.value);
  return (
    <div className="min-w-0 shrink-0">
      <p className={`flex items-center whitespace-nowrap font-bold uppercase tracking-[0.12em] text-white/60 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
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

  return (
    <Wrapper
      type={onTap ? 'button' : undefined}
      onClick={onTap}
      aria-label={onTap ? 'Return to live queue' : undefined}
      className={`live-scoreboard relative isolate overflow-hidden text-left ${
        compact
          ? 'flex items-center gap-3 rounded-full px-3.5 py-2 shadow-[0_10px_28px_-10px_rgba(6,44,40,0.6)]'
          : 'rounded-2xl px-4 py-3.5 shadow-[0_14px_32px_-14px_rgba(6,44,40,0.55)]'
      } ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(11,74,68,0.94), rgba(15,107,98,0.9) 55%, rgba(15,118,110,0.88))',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <span className="live-scoreboard-glow pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-[#5EE0B4]/25 blur-2xl" aria-hidden="true" />

      <span className={`live-chip-pulse relative inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EF4444]/90 font-bold uppercase tracking-[0.08em] text-white ${compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-0.5 text-[9px]'}`}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        Live
      </span>

      <span className={`relative flex min-w-0 flex-1 ${compact ? 'items-center gap-4' : 'mt-2.5 grid gap-2'}`} style={!compact ? { gridTemplateColumns: `repeat(${metrics.length}, minmax(0,1fr))` } : undefined}>
        {metrics.map((metric) => (
          <MetricValue key={metric.key} metric={metric} compact={compact} />
        ))}
      </span>

      {!compact && (
        <span className="relative mt-2.5 flex items-center gap-1 text-[10px] font-semibold text-[#7DEFC6]">
          <Radio className="h-3 w-3 animate-pulse" />
          Updates in real time
        </span>
      )}
    </Wrapper>
  );
};
