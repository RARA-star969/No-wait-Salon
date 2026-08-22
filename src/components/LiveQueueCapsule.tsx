import React from 'react';

/**
 * Compact top-center stand-in for LiveQueueCard once it scrolls out of
 * view — same teal mirror family, same three facts (Time / Position /
 * Chairs), no waveform. Deliberately dumb: SalonDetailPage owns visibility
 * (via IntersectionObserver on the full card) and mount lifetime (it only
 * exists while the salon screen is mounted, so it disappears the moment the
 * Live Ticket screen takes over).
 */
export type LiveQueueCapsuleProps = {
  waitLabel: string;
  peopleAhead: number;
  readyChairs: number;
};

export const LiveQueueCapsule: React.FC<LiveQueueCapsuleProps> = ({ waitLabel, peopleAhead, readyChairs }) => (
  <div
    id="live-queue-capsule"
    className="pointer-events-auto flex animate-[capsule-morph-in_420ms_cubic-bezier(0.22,1,0.36,1)] items-center gap-3 rounded-full bg-gradient-to-br from-[#0B4A44] via-[#0F6B62] to-[#0F766E] px-4 py-2 text-white shadow-[0_12px_28px_-10px_rgba(6,44,40,0.55)] ring-1 ring-white/10"
  >
    <span className="relative flex h-1.5 w-1.5 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
    </span>
    <CapsuleStat label="Time" value={waitLabel} />
    <span className="h-6 w-px shrink-0 bg-white/15" aria-hidden="true" />
    <CapsuleStat label="Position" value={String(peopleAhead)} />
    <span className="h-6 w-px shrink-0 bg-white/15" aria-hidden="true" />
    <CapsuleStat label="Chairs" value={String(readyChairs)} />
  </div>
);

const CapsuleStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span className="flex items-baseline gap-1.5 whitespace-nowrap">
    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/60">{label}</span>
    <span className="text-[13px] font-bold leading-none tracking-[-0.01em]">{value}</span>
  </span>
);
