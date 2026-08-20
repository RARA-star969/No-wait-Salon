import React from 'react';
import { ArmchairIcon, Clock } from 'lucide-react';
import { LiveChip, type QueueTrend } from './LiveQueueCard';

type Props = {
  visible: boolean;
  waitLabel: string;
  peopleAhead: number;
  readyChairs: number;
  totalChairs: number;
  peopleAheadTrend?: QueueTrend;
  live?: boolean;
};

/**
 * The salon page's live card morphs into this once it scrolls out of view —
 * a compact, glassy scoreboard that keeps the same numbers visible, in the
 * exact same LIVE-chip language, without re-showing the full hero card.
 * Only data that already exists on the page is surfaced here.
 */
export const LiveQueueCapsule: React.FC<Props> = ({ visible, waitLabel, peopleAhead, readyChairs, totalChairs, live = true }) => {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4"
      style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
      aria-hidden={!visible}
    >
      <div
        className={`pointer-events-auto flex items-center gap-3 rounded-full border border-white/25 bg-[#0B4A44]/80 py-2 pl-2.5 pr-4 text-white shadow-[0_10px_28px_-10px_rgba(6,26,24,0.55)] backdrop-blur-xl transition-[opacity,transform] duration-300 ${
          visible ? '[animation:capsule-in_360ms_cubic-bezier(0.22,1,0.36,1)]' : 'pointer-events-none opacity-0 [animation:capsule-out_220ms_ease-in_forwards]'
        }`}
      >
        <LiveChip live={live} />
        <span className="h-4 w-px shrink-0 bg-white/20" />
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-white/70" />
          <span className="text-[13px] font-extrabold tracking-[-0.01em]">{waitLabel}</span>
        </span>
        <span className="h-4 w-px shrink-0 bg-white/20" />
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-white/85">
          {peopleAhead} ahead
        </span>
        <span className="h-4 w-px shrink-0 bg-white/20" />
        <span className="flex items-center gap-1 text-[12px] font-bold text-white/85">
          <ArmchairIcon className="h-3.5 w-3.5 text-white/70" />
          {readyChairs}/{totalChairs}
        </span>
      </div>
    </div>
  );
};
