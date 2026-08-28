import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode, House, UserRound } from 'lucide-react';

/** Idle delay before a collapsed button expands back into the full pill. */
const IDLE_EXPAND_MS = 3500;
/** Below this scroll offset the expanded pill is always preferred. */
const NEAR_TOP_PX = 24;

type Props = {
  /** The Home scroll container this button reacts to. */
  scrollRef: React.RefObject<HTMLElement | null>;
  onScan: () => void;
  /** Opens the existing Profile screen — same navigation CustomerApp already
   *  wires from the header's ProfileButton, just also reachable from here. */
  onProfile?: () => void;
};

/**
 * Bottom-centered Scan QR action, presented on a persistent bottom shelf
 * (Home/Profile either side) so the lower composition reads as a bottom
 * navigation bar. Home and Profile route through CustomerApp's existing
 * screen state — no new routes or screens are introduced. The Scan pill
 * itself is expanded by default, collapses to a compact circle while the
 * customer scrolls or touches, and expands again once idle. Triggers the
 * same scanner as the header QR icon.
 */
export const StickyScanQrButton: React.FC<Props> = ({ scrollRef, onScan, onProfile }) => {
  const [expanded, setExpanded] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current !== null) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const scheduleExpand = () => {
      clearIdleTimer();
      idleTimer.current = setTimeout(() => setExpanded(true), IDLE_EXPAND_MS);
    };

    const collapseForInteraction = () => {
      // Near the top the expanded pill is the preferred resting state.
      if (scroller.scrollTop <= NEAR_TOP_PX) {
        clearIdleTimer();
        setExpanded(true);
        return;
      }
      setExpanded(false);
      scheduleExpand();
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        collapseForInteraction();
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('touchstart', collapseForInteraction, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('touchstart', collapseForInteraction);
      clearIdleTimer();
    };
  }, [scrollRef, clearIdleTimer]);

  return (
    <div
      id="sticky-scan-qr"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="relative flex w-full max-w-sm items-center justify-between">
        {/* Persistent bottom shelf — Home/Profile flank the floating Scan
            CTA, giving the lower composition a bottom-nav feel while reusing
            the screens CustomerApp already has. */}
        <div className="pointer-events-auto flex h-14 flex-1 items-center justify-between rounded-full border border-white/10 bg-black/55 px-5 shadow-[0_14px_34px_-14px_rgba(0,0,0,.75)] backdrop-blur-2xl">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full"
            aria-current="page"
            style={{ color: 'var(--category-accent, #22D3EE)' }}
          >
            <House className="h-5 w-5" />
          </span>
          <span className="w-12 shrink-0" aria-hidden />
          <button
            type="button"
            onClick={onProfile}
            aria-label="Open profile"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-200 active:scale-90"
          >
            <UserRound className="h-5 w-5" />
          </button>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[calc(50%+10px)]">
          {/* Neon glow halo behind the capsule */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 -m-2 rounded-full blur-xl transition-opacity duration-300 ${
              expanded ? 'opacity-100' : 'opacity-70'
            }`}
            style={{ backgroundColor: 'var(--category-tint-20, rgba(34,211,238,0.4))' }}
          />
          <button
            type="button"
            onClick={onScan}
            aria-label="Scan QR"
            aria-expanded={expanded}
            className={`pointer-events-auto relative flex h-14 items-center justify-center gap-2.5 overflow-hidden rounded-full border border-white/25 text-slate-950 ring-2 transition-[width,padding] duration-300 ease-out active:scale-95 ${
              expanded ? 'w-[11rem] px-5' : 'w-14 px-0'
            }`}
            style={{
              backgroundImage: 'linear-gradient(to bottom right, var(--category-primary, #22D3EE), var(--category-accent, #2DD4BF), var(--category-primary, #22D3EE))',
              boxShadow: `0 12px 32px -6px var(--category-glow, rgba(34,211,238,0.65))`,
              ['--tw-ring-color' as any]: 'var(--category-tint-20, rgba(103,232,249,0.3))',
            }}
          >
            <span className="pointer-events-none absolute inset-x-2 top-1.5 h-1/3 rounded-full bg-white/40 blur-[2px]" />
            <QrCode className="relative h-[22px] w-[22px] shrink-0 drop-shadow-sm" />
            <span
              aria-hidden={!expanded}
              className={`relative whitespace-nowrap text-sm font-black tracking-[-0.01em] transition-opacity duration-200 ${
                expanded ? 'opacity-100 delay-75' : 'w-0 opacity-0'
              }`}
            >
              Scan QR
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
