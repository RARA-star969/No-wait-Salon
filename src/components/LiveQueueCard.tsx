import React, { useEffect, useRef, useState } from 'react';
import { LiveSignalBlip } from './LiveSignalBlip';

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

/** Value on top, single-line label below — never a generated/duplicated helper line. */
const Stat: React.FC<{ label: string; value: React.ReactNode; flashing?: boolean }> = ({ label, value, flashing }) => (
  <div className="min-w-0 text-center">
    <p className={`text-[22px] font-bold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${flashing ? 'scale-[1.12] text-[#7DEFC6]' : ''}`}>
      {value}
    </p>
    <p className="mt-1.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-white/55">{label}</p>
  </div>
);

export const LiveQueueCard: React.FC<LiveQueueCardProps> = ({
  waitLabel,
  peopleAhead,
  readyChairs,
  totalChairs,
  live = true,
  className = '',
}) => {
  const waitFlash = useFlashOnChange(waitLabel);
  const aheadFlash = useFlashOnChange(peopleAhead);
  const chairsFlash = useFlashOnChange(readyChairs);

  return (
    <section
      id="live-queue-hero-card"
      className={`relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0B4A44] via-[#0F6B62] to-[#0F766E] px-4 py-3.5 text-white shadow-[0_18px_38px_-18px_rgba(6,44,40,0.65)] ring-1 ring-white/[0.06] ${className}`}
    >
      {/* Ambient glow, purely decorative and GPU-cheap. */}
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[#5EE0B4]/25 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-14 bottom-0 h-28 w-28 rounded-full bg-[#0AA88C]/20 blur-3xl" aria-hidden="true" />

      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${live ? 'live-chip-pulse' : ''}`}>
            <span className="relative flex h-1.5 w-1.5">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Live
          </span>
          {live && <LiveSignalBlip />}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/55">
          {totalChairs} {totalChairs === 1 ? 'chair' : 'chairs'} today
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-3">
        <Stat label="Wait Time" value={waitLabel} flashing={waitFlash} />
        <Stat label="People Ahead" value={peopleAhead} flashing={aheadFlash} />
        <Stat label="Ready Chairs" value={readyChairs} flashing={chairsFlash} />
      </div>
    </section>
  );
};
