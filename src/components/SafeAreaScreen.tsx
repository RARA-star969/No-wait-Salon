import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * The customer app's safe-area shell.
 *
 * Rather than sprinkling `env(safe-area-inset-*)` padding onto every
 * component (which is how competing/duplicated insets and double-padded
 * headers appear), a screen composes this once:
 *
 *   <SafeAreaScreen header={<SafeAreaHeader … />} bottomInset="nav">…</SafeAreaScreen>
 *
 * Responsibilities, deliberately kept in one place:
 *  - the sticky header clears the Android status bar / display cutout via
 *    `max(padding, env(safe-area-inset-top))`, so back buttons and titles are
 *    never under the notch at any width;
 *  - the scroll region is the ONE scroll owner for the screen (no nested
 *    competing scrollers), with `overscroll-contain` so a rubber-band at the
 *    end never chains to an ancestor;
 *  - the bottom pad reserves real space for the fixed bottom nav and/or a
 *    sticky CTA plus the gesture-nav inset, so the last row of content is
 *    always reachable rather than sitting under the bar.
 *
 * The background is allowed to run edge-to-edge (that is intentional); only
 * interactive/content elements are inset.
 */

export const BOTTOM_INSETS = ['none', 'safe', 'nav', 'cta'] as const;
export type BottomInset = (typeof BOTTOM_INSETS)[number];

/** Height reserved above the safe-area inset for each bottom furniture kind. */
const BOTTOM_RESERVE: Record<BottomInset, string> = {
  none: '0px',
  safe: '0.5rem',
  // The floating bottom nav bar plus its raised Scan CTA.
  nav: '6.25rem',
  // A sticky action bar sitting above the nav.
  cta: '10rem',
};

export const safeAreaBottomPadding = (inset: BottomInset | string): string =>
  `calc(env(safe-area-inset-bottom) + ${BOTTOM_RESERVE[inset as BottomInset] || BOTTOM_RESERVE.safe})`;

export interface SafeAreaScreenProps {
  children: React.ReactNode;
  /** Rendered above the scroll region, already cleared of the status bar. */
  header?: React.ReactNode;
  /** Rendered pinned to the bottom, above the safe-area inset. */
  footer?: React.ReactNode;
  bottomInset?: BottomInset;
  className?: string;
  id?: string;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  scrollRef?: React.Ref<HTMLDivElement>;
}

export const SafeAreaScreen: React.FC<SafeAreaScreenProps> = ({
  children,
  header,
  footer,
  bottomInset = 'nav',
  className = '',
  id,
  onScroll,
  scrollRef,
}) => (
  <div id={id} className={`flex h-full min-h-0 flex-col ${className}`}>
    {header}
    <div
      ref={scrollRef}
      onScroll={onScroll}
      // The single scroll owner. `min-h-0` is what actually lets it shrink
      // inside the flex column instead of overflowing its parent.
      // `safe-area-scroll` / `safe-area-header` are stable hooks so the
      // device-width verification harness can find and re-measure the shell's
      // inset regions without depending on DOM shape.
      className="safe-area-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-y]"
      style={{ paddingBottom: safeAreaBottomPadding(bottomInset) }}
    >
      {children}
    </div>
    {footer}
  </div>
);

export interface SafeAreaHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Right-aligned actions (filters, counters, settings). */
  actions?: React.ReactNode;
  tone?: 'dark' | 'light';
}

/**
 * The shared screen header. Its top padding is `max(0.75rem, safe-area-top)`,
 * which is what keeps the back arrow and title clear of the status bar and of
 * a display cutout on tall/narrow devices without over-padding a device that
 * reports no inset at all.
 */
export const SafeAreaHeader: React.FC<SafeAreaHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  actions,
  tone = 'light',
}) => {
  // The historical `dark` option is retained for API compatibility, but the
  // customer brand is now deliberately light across every destination.
  void tone;
  const dark = false;
  return (
    <header
      className={`safe-area-header sticky top-0 z-30 shrink-0 border-b px-4 pb-3 backdrop-blur-xl ${
        dark ? '' : 'border-[var(--noq-glass-border)] bg-[var(--noq-glass-strong)] text-[var(--noq-ink)] shadow-[0_12px_30px_-28px_var(--noq-glow)]'
      }`}
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${
              dark ? '' : 'border-[var(--noq-glass-border)] bg-white/75 text-[var(--noq-accent)] shadow-[inset_0_1px_0_white]'
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-[-0.02em]">{title}</h1>
          {subtitle && (
            <p className={`truncate text-[11px] font-medium ${dark ? '' : 'text-[var(--noq-muted)]'}`}>{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};
