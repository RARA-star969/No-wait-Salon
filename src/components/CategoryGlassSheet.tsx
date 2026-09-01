import React from 'react';
import { X } from 'lucide-react';

const GLASS_SURFACE =
  'relative overflow-hidden border border-[var(--noq-glass-border)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_20px_60px_-28px_var(--noq-glow)] backdrop-blur-2xl backdrop-saturate-150';

// Every overlay reads the same canonical NOQ glass material.
const GLASS_BACKGROUND = {
  background: 'var(--noq-glass-gradient)',
};

/**
 * ONE reusable category glass surface for the overlays introduced in this
 * pass (Payment, Purchase success) — translucent + blurred + a
 * brand-blue glow, never a big opaque white card. Reused instead of
 * duplicated per-sheet so the "premium mirror glass" language stays
 * consistent across every customer overlay.
 */
export const CategoryGlassSheet: React.FC<{
  children: React.ReactNode;
  onClose?: () => void;
  variant?: 'sheet' | 'modal';
  className?: string;
}> = ({ children, onClose, variant = 'sheet', className = '' }) => (
  <div
    className={`fixed inset-0 z-[60] flex ${variant === 'sheet' ? 'items-end' : 'items-center'} justify-center bg-black/55 backdrop-blur-sm animate-in fade-in`}
    onClick={(event) => { if (onClose && event.target === event.currentTarget) onClose(); }}
  >
    <div
      className={`w-full max-w-md text-[var(--noq-ink)] ${
        variant === 'sheet'
          ? 'rounded-t-[28px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300'
          : 'mx-4 rounded-[28px] p-5 text-center animate-in zoom-in-95 duration-200'
      } ${GLASS_SURFACE} ${className}`}
      style={GLASS_BACKGROUND}
    >
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden="true" />
      {variant === 'sheet' && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--noq-tint-20)]" />}
      {children}
      {onClose && variant === 'modal' && (
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--noq-tint-10)] text-[var(--noq-muted)]">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  </div>
);
