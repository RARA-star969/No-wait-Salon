import React from 'react';
import { useMetricFlash } from '../shared/useMetricFlash';
import { liveQueuePosition } from '../shared/liveQueueDisplayMetrics';
import { LIVE_QUEUE_GRADIENT, LIVE_QUEUE_RIM_FULL } from '../shared/liveQueueVisual';
import { TimeValue } from './TimeValue';

/**
 * The hero USP: a premium teal/emerald live-queue card shared by the
 * customer app's salon page and the public QR web page, so both surfaces
 * present the exact same "strongest visual signal" for the live queue.
 *
 * Pure CSS keyframes drive the pulse/waveform/light-sweep motion — no
 * per-frame JS — so this stays cheap on low-end mobile browsers.
 *
 * `variant="salon"` is the richer Salon Detail experience (Time / Position /
 * Chairs, compact proportions, softened rim, periodic light sweep) built up
 * over this session. The default variant is untouched from before, so the
 * public QR page keeps its existing look exactly as-is.
 */

export type LiveQueueCardProps = {
  waitLabel: string;
  peopleAhead: number;
  readyChairs: number;
  totalChairs: number;
  live?: boolean;
  variant?: 'default' | 'salon';
  className?: string;
};

/** Value on top, single-line label below — never a generated/duplicated helper line. */
const Stat: React.FC<{ label: React.ReactNode; value: React.ReactNode; flashing?: boolean; dense?: boolean }> = ({ label, value, flashing, dense }) => (
  <div className="min-w-0 text-center">
    <p
      className={`whitespace-nowrap font-bold leading-none tracking-[-0.02em] text-white transition-transform duration-300 ${
        dense ? 'text-[15px]' : 'text-[22px]'
      } ${flashing ? 'scale-[1.12] text-[#7DEFC6]' : ''}`}
    >
      {value}
    </p>
    <p className="mt-1.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-white/55">{label || ' '}</p>
  </div>
);

export const LiveQueueCard: React.FC<LiveQueueCardProps> = ({
  waitLabel,
  peopleAhead,
  readyChairs,
  totalChairs,
  live = true,
  variant = 'default',
  className = '',
}) => {
  const salon = variant === 'salon';
  const waitFlash = useMetricFlash(waitLabel);
  const aheadFlash = useMetricFlash(peopleAhead);
  const chairsFlash = useMetricFlash(readyChairs);
  // Position carries the "Your Turn"/"Now" moment; Time stays a plain wait label.
  // Computed unconditionally (cheap, pure) so hook order never depends on variant.
  const position = liveQueuePosition(peopleAhead, readyChairs);
  const positionFlash = useMetricFlash(position.positionLabel);

  if (salon) {
    return (
      <section
        id="live-queue-hero-card"
        className={`relative overflow-hidden rounded-[22px] px-4 py-2.5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_20px_rgba(94,224,180,0.06),0_10px_24px_-10px_rgba(6,20,18,0.35),0_20px_42px_-18px_rgba(6,44,40,0.7)] ${className}`}
        style={{ background: LIVE_QUEUE_GRADIENT }}
      >
        {/* Luminous edge — softened, not neon: low-alpha masked gradient rim. */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[22px] p-px"
          style={{
            background: LIVE_QUEUE_RIM_FULL,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
          aria-hidden="true"
        />
        {/* Ambient glow, purely decorative and GPU-cheap. */}
        <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[#5EE0B4]/16 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-14 bottom-0 h-28 w-28 rounded-full bg-[#0AA88C]/14 blur-3xl" aria-hidden="true" />
        {/* Glassy top sheen — premium "live-device" surface highlight, purely decorative. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-white/[0.09] to-transparent" aria-hidden="true" />
        {/* Periodic bulb-glow sweep: a broad, blurred light crossing the
            surface every few seconds — reads as light catching a lens, not a
            metallic shimmer stripe. Pure transform+opacity keyframes. */}
        <div className="light-sweep pointer-events-none absolute -inset-x-[60%] -inset-y-[40%]" aria-hidden="true" />
        {/* Faint scrolling line-graph — full-card-only, unchanged. */}
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
          <Stat label="Time" value={<TimeValue label={waitLabel} />} flashing={waitFlash} />
          <Stat
            label="Position"
            value={<span className={position.state !== 'waiting' ? 'attention-pulse' : ''}>{position.positionLabel}</span>}
            flashing={positionFlash}
            dense={position.state !== 'waiting'}
          />
          <Stat label="Chairs" value={readyChairs} flashing={chairsFlash} />
        </div>
      </section>
    );
  }

  return (
    <section
      id="live-queue-hero-card"
      className={`relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0B4A44] via-[#0F6B62] to-[#0F766E] px-4 py-3.5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_0_1px_rgba(255,255,255,0.05),0_0_26px_-6px_rgba(94,224,180,0.38),0_18px_38px_-18px_rgba(6,44,40,0.65)] ${className}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[#5EE0B4]/25 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-14 bottom-0 h-28 w-28 rounded-full bg-[#0AA88C]/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.08] to-transparent" aria-hidden="true" />
      <svg
        className="queue-waveform-line pointer-events-none absolute inset-x-0 bottom-0 h-12 w-[200%] text-white/[0.08]"
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
        <span className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${live ? 'live-chip-pulse' : ''}`}>
            <span className="relative flex h-1.5 w-1.5">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Live
          </span>
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/55">
          {totalChairs} {totalChairs === 1 ? 'chair' : 'chairs'} today
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-3">
        <Stat label="Waiting" value={<TimeValue label={waitLabel} />} flashing={waitFlash} />
        <Stat label="People Ahead" value={peopleAhead} flashing={aheadFlash} />
        <Stat label="Ready Chairs" value={readyChairs} flashing={chairsFlash} />
      </div>
    </section>
  );
};
