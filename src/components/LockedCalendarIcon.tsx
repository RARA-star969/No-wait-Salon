import React from 'react';
import { CalendarDays, Lock } from 'lucide-react';

export type LockedCalendarIconSize = 'sm' | 'md' | 'lg';

export type LockedCalendarIconProps = {
  size?: LockedCalendarIconSize;
  className?: string;
};

/**
 * Single source of truth for the master Calendar-with-Lock icon.
 * Preserves the exact shape and glass hierarchy while using NOQ brand color,
 * typography/strokes, and visual hierarchy defined by the Salon Detail dock.
 */
export const LockedCalendarIcon: React.FC<LockedCalendarIconProps> = ({ size = 'md', className = '' }) => {
  if (size === 'sm') {
    return (
      <span
        className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--noq-glass-border)] bg-[var(--noq-tint-10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_10px_-4px_var(--noq-glow)] backdrop-blur-md backdrop-saturate-[1.7] ${className}`}
      >
        <CalendarDays className="relative h-3.5 w-3.5 text-[var(--noq-accent)]" />
        <span className="absolute -right-1 -top-1 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-[var(--noq-accent)] text-white shadow-xs">
          <Lock className="h-1.5 w-1.5" />
        </span>
      </span>
    );
  }

  if (size === 'lg') {
    return (
      <span
        className={`relative inline-flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-[var(--noq-glass-border)] bg-[var(--noq-tint-10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_-12px_var(--noq-glow)] backdrop-blur-md backdrop-saturate-[1.7] ${className}`}
      >
        <CalendarDays className="relative h-4.5 w-4.5 text-[var(--noq-accent)]" />
        <span className="absolute -right-1 -top-1 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-[var(--noq-accent)] text-white shadow-sm">
          <Lock className="h-2 w-2" />
        </span>
      </span>
    );
  }

  // Default 'md' (36-44px standard, e.g. for modal header and toggle buttons)
  return (
    <span
      className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--noq-glass-border)] bg-[var(--noq-tint-10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_-10px_var(--noq-glow)] backdrop-blur-md backdrop-saturate-[1.7] ${className}`}
    >
      <CalendarDays className="relative h-4.5 w-4.5 text-[var(--noq-accent)]" />
      <span className="absolute -right-1 -top-1 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-[var(--noq-accent)] text-white shadow-sm">
        <Lock className="h-2 w-2" />
      </span>
    </span>
  );
};
