import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';

/** Idle delay before a collapsed button expands back into the full pill. */
const IDLE_EXPAND_MS = 3500;
/** Below this scroll offset the expanded pill is always preferred. */
const NEAR_TOP_PX = 24;

type Props = {
  /** The Home scroll container this button reacts to. */
  scrollRef: React.RefObject<HTMLElement | null>;
  onScan: () => void;
};

/**
 * Bottom-centered Scan QR action. Expanded by default, collapses to a compact
 * circle while the customer scrolls or touches, and expands again once they
 * have been idle. Triggers the same scanner as the header QR icon.
 */
export const StickyScanQrButton: React.FC<Props> = ({ scrollRef, onScan }) => {
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
      className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4"
    >
      <button
        type="button"
        onClick={onScan}
        aria-label="Scan QR"
        aria-expanded={expanded}
        className={`pointer-events-auto flex h-14 items-center justify-center gap-2.5 overflow-hidden rounded-full bg-[#0F766E] text-white shadow-[0_10px_28px_-6px_rgba(15,118,110,0.55)] ring-1 ring-black/5 transition-[width,padding] duration-300 ease-out active:scale-95 ${
          expanded ? 'w-[10.5rem] px-5' : 'w-14 px-0'
        }`}
      >
        <QrCode className="h-[22px] w-[22px] shrink-0" />
        <span
          aria-hidden={!expanded}
          className={`whitespace-nowrap text-sm font-bold tracking-[-0.01em] transition-opacity duration-200 ${
            expanded ? 'opacity-100 delay-75' : 'w-0 opacity-0'
          }`}
        >
          Scan QR
        </span>
      </button>
    </div>
  );
};
