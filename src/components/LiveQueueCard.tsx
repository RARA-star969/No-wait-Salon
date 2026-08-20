import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

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
  peopleAhead: number;
  peopleAheadTrend?: QueueTrend;
  readyChairs: number;
  totalChairs: number;
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
  peopleAhead,
  peopleAheadTrend,
  readyChairs,
  totalChairs,
  live = true,
  className = '',
}) => {
  const waitFlash = useFlashOnChange(waitLabel);
  const aheadFlash = useFlashOnChange(peopleAhead);
  const chairsFlash = useFlashOnChange(readyChairs);
  const chairsReady = readyChairs > 0;

  return (
    <section
      id="live-queue-hero-card"
      className={`relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0B4A44] via-[#0F6B62] to-[#0F766E] px-4 py-3.5 text-white shadow-[0_14px_32px_-16px_rgba(6,44,40,0.55)] ${className}`}
    >
      {/* Ambient glow, purely decorative and GPU-cheap. */}
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[#5EE0B4]/25 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-14 bottom-0 h-28 w-28 rounded-full bg-[#0AA88C]/20 blur-3xl" aria-hidden="true" />

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

      <div className="relative mt-3 grid grid-cols-3 gap-3">
        <Stat label="Time" value={waitLabel} flashing={waitFlash} />
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
    </section>
  );
};
