import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Radio, Users } from 'lucide-react';

/**
 * The hero USP: a premium teal/emerald live-queue card shared by the
 * customer app's salon page and the public QR web page, so both surfaces
 * present the exact same "strongest visual signal" for the live queue.
 *
 * Pure CSS keyframes drive the pulse/waveform motion — no per-frame JS —
 * so this stays cheap on low-end mobile browsers.
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
    <p className={`mt-1 text-[22px] font-bold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${flashing ? 'scale-[1.12] text-[#7DEFC6]' : ''}`}>
      {value}
    </p>
    {delta && <div className="mt-1">{delta}</div>}
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
  className = '',
}) => {
  const waitFlash = useFlashOnChange(waitLabel);
  const aheadFlash = useFlashOnChange(peopleAhead);
  const chairsFlash = useFlashOnChange(readyChairs);
  const chairsReady = readyChairs > 0;

  return (
    <section
      className={`relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0B4A44] via-[#0F6B62] to-[#0F766E] p-5 text-white shadow-[0_18px_40px_-16px_rgba(6,44,40,0.55)] ${className}`}
    >
      {/* Ambient glow, purely decorative and GPU-cheap. */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#5EE0B4]/25 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-14 bottom-0 h-32 w-32 rounded-full bg-[#0AA88C]/25 blur-3xl" aria-hidden="true" />

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

      <div className="relative mt-4 grid grid-cols-3 gap-3">
        <Stat label="Approx. wait" value={waitLabel} flashing={waitFlash} delta={waitDeltaLabel && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-[#7DEFC6]">{waitDeltaLabel}</span>} />
        <Stat
          label="People ahead"
          value={peopleAhead}
          flashing={aheadFlash}
          delta={<TrendBadge trend={peopleAheadTrend} label={peopleAheadTrend === 'down' ? '↓ moving' : peopleAheadTrend === 'up' ? '↑ busier' : undefined} />}
        />
        <Stat
          label="Ready chairs"
          value={readyChairs}
          flashing={chairsFlash}
          delta={<span className={`inline-flex h-2 w-2 rounded-full ${chairsReady ? 'bg-[#5EE0B4]' : 'bg-white/30'}`} />}
        />
      </div>

      {/* Lightweight waveform: a looping CSS animation, not a per-frame canvas. */}
      <div className="relative mt-4 h-10 overflow-hidden rounded-xl bg-black/10">
        <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="h-full w-[200%] animate-[queue-waveform_3.2s_linear_infinite]">
          <path
            d="M0 20 C 8 8, 16 32, 24 20 S 40 8, 48 20 S 64 32, 72 20 S 88 8, 96 20 S 112 32, 120 20 S 136 8, 144 20 S 160 32, 168 20 S 184 8, 192 20 S 200 20, 200 20"
            fill="none"
            stroke="#7DEFC6"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/25" aria-hidden="true" />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#7DEFC6]" aria-hidden="true" />
      </div>

      <div className="relative mt-4 flex items-center justify-between text-[11px] font-semibold text-white/75">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {activityLabel || `${totalChairs} ${totalChairs === 1 ? 'chair' : 'chairs'} · ${readyChairs} ready`}
        </span>
        <span className="flex items-center gap-1 text-[#7DEFC6]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7DEFC6]" />
          Queue moving · {queueMovingLabel}
        </span>
      </div>
    </section>
  );
};
