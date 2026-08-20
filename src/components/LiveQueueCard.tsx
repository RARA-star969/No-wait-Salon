import React, { useEffect, useRef, useState } from 'react';
import { ArmchairIcon, ArrowDown, ArrowUp, Clock } from 'lucide-react';

/**
 * The hero USP: a premium, compact teal/emerald live-queue card shared by the
 * customer app's salon page and the public QR web page, so both surfaces
 * present the exact same "strongest visual signal" for the live queue.
 *
 * Pure CSS keyframes drive the pulse/breathing motion — no per-frame JS —
 * so this stays cheap on low-end mobile browsers.
 */

export type QueueTrend = 'up' | 'down' | 'steady';

export type LiveQueueCardProps = {
  /** Already-formatted duration value only, e.g. "8 min" or "1 hr 15 min" — never "wait". */
  waitLabel: string;
  peopleAhead: number;
  peopleAheadTrend?: QueueTrend;
  readyChairs: number;
  totalChairs: number;
  activityLabel?: string;
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

/** The premium red LIVE chip, reused verbatim by the floating capsule so both match exactly. */
export const LiveChip: React.FC<{ live?: boolean; className?: string }> = ({ live = true, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#F4574B] to-[#D8362A] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white ${live ? 'animate-[live-chip-pulse_2.2s_ease-in-out_infinite]' : ''} ${className}`}
  >
    <span className="relative flex h-1.5 w-1.5">
      {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/85" />}
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
    </span>
    Live
  </span>
);

const TrendBadge: React.FC<{ trend?: QueueTrend }> = ({ trend }) => {
  if (!trend || trend === 'steady') return null;
  const Icon = trend === 'down' ? ArrowDown : ArrowUp;
  const positive = trend === 'down';
  return (
    <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${positive ? 'bg-[#5EE0B4]/20 text-[#5EE0B4]' : 'bg-[#F5B199]/20 text-[#F5B199]'}`}>
      <Icon className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; trend?: QueueTrend; flashing?: boolean; icon?: React.ReactNode }> = ({
  label,
  value,
  trend,
  flashing,
  icon,
}) => (
  <div className="min-w-0">
    <p className="flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/55">
      {icon}
      {label}
    </p>
    <p
      className={`mt-1 flex items-center gap-1.5 text-[19px] font-extrabold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${
        flashing ? 'scale-[1.1] text-[#7DEFC6]' : ''
      }`}
    >
      {value}
      {trend && <TrendBadge trend={trend} />}
    </p>
  </div>
);

export const LiveQueueCard: React.FC<LiveQueueCardProps> = ({
  waitLabel,
  peopleAhead,
  peopleAheadTrend,
  readyChairs,
  totalChairs,
  activityLabel,
  live = true,
  className = '',
}) => {
  const waitFlash = useFlashOnChange(waitLabel);
  const aheadFlash = useFlashOnChange(peopleAhead);
  const chairsFlash = useFlashOnChange(readyChairs);
  const chairsReady = readyChairs > 0;

  return (
    <section
      className={`relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0B4A44] via-[#0F6B62] to-[#0F766E] px-4 py-3.5 text-white shadow-[0_14px_32px_-16px_rgba(6,44,40,0.55)] ${className}`}
    >
      {/* Ambient glow, purely decorative and GPU-cheap. */}
      <div className="pointer-events-none absolute -right-10 -top-14 h-32 w-32 rounded-full bg-[#5EE0B4]/20 blur-3xl" aria-hidden="true" />

      <div className="relative flex items-center justify-between">
        <LiveChip live={live} />
        {activityLabel && (
          <span className="max-w-[55%] truncate text-[10px] font-semibold text-white/65">{activityLabel}</span>
        )}
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2.5 divide-x divide-white/10">
        <Stat label="Time" icon={<Clock className="h-2.5 w-2.5" />} value={waitLabel} flashing={waitFlash} />
        <div className="pl-2.5">
          <Stat label="Ahead" value={peopleAhead} trend={peopleAheadTrend} flashing={aheadFlash} />
        </div>
        <div className="pl-2.5">
          <Stat
            label="Chairs"
            icon={<ArmchairIcon className="h-2.5 w-2.5" />}
            value={
              <span className="flex items-center gap-1.5">
                {readyChairs}/{totalChairs}
                <span className={`h-1.5 w-1.5 rounded-full ${chairsReady ? 'bg-[#5EE0B4]' : 'bg-white/30'}`} />
              </span>
            }
            flashing={chairsFlash}
          />
        </div>
      </div>
    </section>
  );
};
