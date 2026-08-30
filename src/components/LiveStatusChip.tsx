import React from 'react';

export const LiveStatusChip: React.FC<{
  label?: React.ReactNode;
  live?: boolean;
  divider?: boolean;
}> = ({ label = 'Live', live = true, divider = true }) => (
  <span className="inline-flex shrink-0 items-center gap-2" data-live-treatment="premium">
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-gradient-to-b from-[#FF5A64] via-[#E11D48] to-[#B51235] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(99,5,31,0.45),0_3px_8px_-3px_rgba(0,0,0,0.8),0_0_13px_rgba(244,63,94,0.34)] ${live ? 'live-chip-pulse' : ''}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/75" />}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.95)]" />
      </span>
      {label}
    </span>
    {divider && (
      <span
        className="h-5 w-px shrink-0 bg-gradient-to-b from-transparent via-white/30 to-transparent shadow-[0_0_8px_rgba(196,139,255,0.18)]"
        aria-hidden="true"
      />
    )}
  </span>
);
