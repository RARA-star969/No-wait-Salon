import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Radio, Users } from 'lucide-react';
import { useMetricFlash } from '../shared/useMetricFlash';
import { liveQueuePosition } from '../shared/liveQueueDisplayMetrics';
import { NOQ_CUSTOMER_LIVE_QUEUE_GRADIENT, NOQ_CUSTOMER_LIVE_QUEUE_RIM_FULL } from '../shared/liveQueueVisual';
import { TimeValue } from './TimeValue';

/**
 * The hero USP: a premium teal/emerald live-queue card shared by the
 * customer app's salon page and the public QR web page, so both surfaces
 * present the exact same "strongest visual signal" for the live queue.
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
      className={`whitespace-nowrap font-bold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${
        dense ? 'text-[15px]' : 'text-[22px]'
      } ${flashing ? 'scale-[1.12] text-[var(--noq-accent-light)]' : ''}`}
    >
      {value}
    </p>
    <p className="mt-1.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-white/55">{label || ' '}</p>
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
        className={`relative overflow-hidden rounded-[22px] px-4 py-2.5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_20px_rgba(94,224,180,0.06),0_10px_24px_-10px_rgba(6,20,18,0.35),0_20px_42px_-18px_rgba(6,44,40,0.7)] ${className}`}
        style={{ background: NOQ_CUSTOMER_LIVE_QUEUE_GRADIENT }}
      >
        {/* Luminous edge — softened, not neon: low-alpha masked gradient rim. */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[22px] p-px"
          style={{
            background: NOQ_CUSTOMER_LIVE_QUEUE_RIM_FULL,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[var(--noq-accent-light)]/16 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-14 bottom-0 h-28 w-28 rounded-full bg-[var(--noq-accent)]/14 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-white/[0.09] to-transparent" aria-hidden="true" />
        {/* Periodic bulb-glow sweep: a broad, blurred light crossing the
            surface every few seconds — reads as light catching a lens. */}
        <div className="light-sweep pointer-events-none absolute -inset-x-[60%] -inset-y-[40%]" aria-hidden="true" />
        {/* Faint scrolling line-graph — full-card-only. */}
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

        <div className="relative flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${live ? 'live-chip-pulse' : ''}`}>
            <span className="relative flex h-1.5 w-1.5">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Live
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/55">
            {totalChairs} {totalChairs === 1 ? 'chair' : 'chairs'} today
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
          <SalonStat label="Chairs" value={readyChairs} flashing={salonChairsFlash} />
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
