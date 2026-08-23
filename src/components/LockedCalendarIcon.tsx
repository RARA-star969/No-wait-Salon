import React from 'react';
import { CalendarDays, Lock } from 'lucide-react';

export type LockedCalendarIconSize = 'sm' | 'md' | 'lg';

export type LockedCalendarIconProps = {
  size?: LockedCalendarIconSize;
  className?: string;
};

/**
 * Single source of truth for the master Calendar-with-Lock icon.
 * Preserves the exact shape, glass gold squircle container, dark lock badge,
 * typography/strokes, and visual hierarchy defined by the Salon Detail dock.
 */
export const LockedCalendarIcon: React.FC<LockedCalendarIconProps> = ({ size = 'md', className = '' }) => {
  if (size === 'sm') {
    return (
      <span
        className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[#E7C673]/60 bg-[#8A6A2C]/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_10px_-4px_rgba(90,64,20,0.35)] backdrop-blur-md backdrop-saturate-[1.7] ${className}`}
      >
        <CalendarDays className="relative h-3.5 w-3.5 text-[#3E2D0C]" />
        <span className="absolute -right-1 -top-1 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-[#3B2A08] text-[#F1D68A] shadow-xs">
          <Lock className="h-1.5 w-1.5" />
        </span>
      </span>
    );
  }

  if (size === 'lg') {
    return (
      <span
        className={`relative inline-flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-[#E7C673]/60 bg-[#8A6A2C]/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_18px_-12px_rgba(90,64,20,0.45)] backdrop-blur-md backdrop-saturate-[1.7] ${className}`}
      >
        <CalendarDays className="relative h-4.5 w-4.5 text-[#3E2D0C]" />
        <span className="absolute -right-1 -top-1 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-[#3B2A08] text-[#F1D68A] shadow-sm">
          <Lock className="h-2 w-2" />
        </span>
      </span>
    );
  }

  // Default 'md' (36-44px standard, e.g. for modal header and toggle buttons)
  return (
    <span
      className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E7C673]/60 bg-[#8A6A2C]/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_18px_-10px_rgba(90,64,20,0.45)] backdrop-blur-md backdrop-saturate-[1.7] ${className}`}
    >
      <CalendarDays className="relative h-4.5 w-4.5 text-[#3E2D0C]" />
      <span className="absolute -right-1 -top-1 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-[#3B2A08] text-[#F1D68A] shadow-sm">
        <Lock className="h-2 w-2" />
      </span>
    </span>
  );
};
