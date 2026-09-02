import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Radio, Users } from 'lucide-react';
import { useMetricFlash } from '../shared/useMetricFlash';
import { liveQueuePosition } from '../shared/liveQueueDisplayMetrics';
import { TimeValue } from './TimeValue';
import { formatChairCount } from '../shared/chairGrammar';

/**
 * The hero USP: a real-time queue card shared by the customer app's salon
 * page and the public QR web page. The Salon Detail variant uses the lighter
 * NOQ customer surface; the public/default variant keeps its stronger live
 * signal treatment.
 *
 * Pure CSS keyframes drive the pulse/waveform motion — no per-frame JS —
 * so this stays cheap on low-end mobile browsers.
 *
 * `variant="salon"` is the compact Salon Detail presentation (Time /
 * Position / Chairs, softened rim, periodic light sweep), recovered from
 * APK build #45's source. The default variant below is untouched — it's
 * still what the public QR page and Join Queue's public branch render.
 */

export type QueueTrend = 'up' | 'down' | 'steady';

export type LiveQueueCardProps = {
  waitLabel: string;
  waitDeltaLabel?: string;
  peopleAhead: number;
  peopleAheadTrend?: QueueTrend;
  readyChairs: number;
  totalChairs: number;
  activityLabel?: string;
  queueMovingLabel?: string;
  live?: boolean;
  variant?: 'default' | 'salon';
  className?: string;
};

/** Flags a value as "just changed" for ~900ms so the UI can pulse it once. */
function useFlashOnChange<T>(value: T): boolean {
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

const TrendBadge: React.FC<{ trend?: QueueTrend; label?: string }> = ({ trend, label }) => {
  if (!trend || trend === 'steady' || !label) return null;
  const Icon = trend === 'down' ? ArrowDown : ArrowUp;
  const positive = trend === 'down';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${positive ? 'text-[#5EE0B4]' : 'text-[#F5B199]'}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; delta?: React.ReactNode; flashing?: boolean }> = ({ label, value, delta, flashing }) => (
  <div className="min-w-0">
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/55">{label}</p>
    <p className={`mt-1 text-[22px] font-bold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${flashing ? 'scale-[1.12] text-[var(--noq-accent-light)]' : ''}`}>
      {value}
    </p>
    {delta && <div className="mt-1">{delta}</div>}
  </div>
);

/** Salon Detail's compact card: value on top, single-line label below. */
const SalonStat: React.FC<{ label: React.ReactNode; value: React.ReactNode; flashing?: boolean; dense?: boolean }> = ({ label, value, flashing, dense }) => (
  <div className="min-w-0 text-center">
    <p
      className={`whitespace-nowrap font-bold leading-none tracking-[-0.02em] text-[#0D1676] transition-transform duration-300 ${
        dense ? 'text-[15px]' : 'text-[22px]'
      } ${flashing ? 'scale-[1.08] text-[var(--noq-accent)]' : ''}`}
    >
      {value}
    </p>
    <p className="mt-1.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--noq-muted)]">{label || ' '}</p>
  </div>
);

export const LiveQueueCard: React.FC<LiveQueueCardProps> = ({
  waitLabel,
  waitDeltaLabel,
  peopleAhead,
  peopleAheadTrend,
  readyChairs,
  totalChairs,
  activityLabel,
  queueMovingLabel = 'Steady',
  live = true,
  variant = 'default',
  className = '',
}) => {
  const waitFlash = useFlashOnChange(waitLabel);
  const aheadFlash = useFlashOnChange(peopleAhead);
  const chairsFlash = useFlashOnChange(readyChairs);
  const chairsReady = readyChairs > 0;

  // Salon Detail variant hooks (always called, so hook order never depends
  // on which variant renders — cheap and unused by the default branch).
  const salonWaitFlash = useMetricFlash(waitLabel);
  const salonChairsFlash = useMetricFlash(readyChairs);
  const position = liveQueuePosition(peopleAhead, readyChairs);
  const positionFlash = useMetricFlash(position.positionLabel);

  if (variant === 'salon') {
    return (
      <section
        id="live-queue-hero-card"
        className={`noq-glass-surface relative overflow-hidden rounded-[22px] border px-4 py-3 text-[var(--noq-ink)] ${className}`}
      >
        {/* Luminous edge — softened, not neon: low-alpha masked gradient rim. */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[22px] p-px"
          style={{
            background: 'linear-gradient(120deg, rgba(255,255,255,.95), rgba(52,84,253,.22), rgba(255,255,255,.5))',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute -right-12 -top-16 h-32 w-32 rounded-full bg-[var(--noq-accent)]/[0.07] blur-3xl" aria-hidden="true" />

        <div className="relative flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${live ? 'bg-[#EF4444]/90 text-white live-chip-pulse' : 'bg-[var(--noq-surface-soft)] text-[var(--noq-muted)]'}`}>
            <span className="relative flex h-1.5 w-1.5">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${live ? 'bg-white' : 'bg-[var(--noq-muted)]'}`} />
            </span>
            {live ? 'Live' : 'Updating'}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--noq-muted)]">
            {formatChairCount(totalChairs)} TODAY
          </span>
        </div>

        <div className="relative mt-2.5 grid grid-cols-3 gap-3">
          <SalonStat label="Time" value={<TimeValue label={waitLabel} />} flashing={salonWaitFlash} />
          <SalonStat
            label="Position"
            value={<span className={position.state !== 'waiting' ? 'attention-pulse' : ''}>{position.positionLabel}</span>}
            flashing={positionFlash}
            dense={position.state !== 'waiting'}
          />
          <SalonStat label="Ready" value={readyChairs} flashing={salonChairsFlash} />
        </div>
      </section>
    );
  }

  return (
    <section
      className={`relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[var(--noq-accent-light)] via-[var(--noq-accent)] to-[var(--noq-accent-deep)] p-4 text-white shadow-[0_16px_34px_-16px_rgba(52,84,253,0.30)] ${className}`}
    >
      {/* Ambient glow, purely decorative and GPU-cheap. */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[var(--noq-accent-light)]/25 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-14 bottom-0 h-32 w-32 rounded-full bg-[var(--noq-accent)]/25 blur-3xl" aria-hidden="true" />
      {/* Subtle periodic light sweep — a broad, soft diagonal band drifting
          across the card every ~6s. Pure CSS transform, GPU-cheap, and
          respects reduced-motion via the shared guard in index.css. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]" aria-hidden="true">
        <div className="absolute -inset-y-10 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[queue-light-sweep_6s_ease-in-out_infinite]" />
      </div>

      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]">
          <span className="relative flex h-1.5 w-1.5">
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Live
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
          Updates in real time
          <Radio className="h-3 w-3 animate-pulse" />
        </span>
      </div>

      <div className="relative mt-3.5 grid grid-cols-3 gap-3">
        <Stat label="Time" value={waitLabel} flashing={waitFlash} delta={waitDeltaLabel && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--noq-accent-light)]">{waitDeltaLabel}</span>} />
        <Stat
          label="Position"
          value={peopleAhead}
          flashing={aheadFlash}
          delta={<TrendBadge trend={peopleAheadTrend} label={peopleAheadTrend === 'down' ? '↓ moving' : peopleAheadTrend === 'up' ? '↑ busier' : undefined} />}
        />
        <Stat
          label="Chairs"
          value={readyChairs}
          flashing={chairsFlash}
          delta={<span className={`inline-flex h-2 w-2 rounded-full ${chairsReady ? 'bg-[#5EE0B4]' : 'bg-white/30'}`} />}
        />
      </div>

      {/* Lightweight waveform: a looping CSS animation, not a per-frame canvas.
          Lives only in the full card — the capsule never shows it. */}
      <div className="relative mt-3.5 h-8 overflow-hidden rounded-xl bg-black/10">
        <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="h-full w-[200%] animate-[queue-waveform_3.2s_linear_infinite]">
          <path
            d="M0 20 C 8 8, 16 32, 24 20 S 40 8, 48 20 S 64 32, 72 20 S 88 8, 96 20 S 112 32, 120 20 S 136 8, 144 20 S 160 32, 168 20 S 184 8, 192 20 S 200 20, 200 20"
            fill="none"
            stroke="var(--noq-accent-light)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/25" aria-hidden="true" />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[var(--noq-accent-light)]" aria-hidden="true" />
      </div>

      <div className="relative mt-3 flex items-center justify-between text-[11px] font-semibold text-white/75">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {activityLabel || `${totalChairs} ${totalChairs === 1 ? 'chair' : 'chairs'} · ${readyChairs} ready`}
        </span>
        <span className="flex items-center gap-1 text-[var(--noq-accent-light)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--noq-accent-light)]" />
          Queue moving · {queueMovingLabel}
        </span>
      </div>
    </section>
  );
};
