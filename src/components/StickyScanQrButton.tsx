import React from 'react';
import { QrCode, House, CalendarCheck, Bell, Menu } from 'lucide-react';
import { NOQ_BRAND, NOQ_BRAND_SOFT } from './CustomerHomeComponents';

export type BottomTab = 'home' | 'bookings' | 'notifications' | 'more';

type Props = {
  /** Which destination is currently on screen, for the highlighted state. */
  activeTab?: BottomTab;
  onScan: () => void;
  /** Tapping Home while already on Home reuses the existing return-to-top glide. */
  onHome?: () => void;
  /** Opens the dedicated, category-agnostic My Bookings screen — the same
   *  component Profile -> My bookings opens. Never the Live Ticket directly. */
  onBookings?: () => void;
  /** Opens the persistent customer Notification inbox screen. */
  onNotifications?: () => void;
  /** Opens the existing Profile screen — the app's catch-all account/settings
   *  surface, reused as the "More" destination. */
  onMore?: () => void;
  /** Unread notification count driving the Alerts badge. 0 hides it. */
  unreadCount?: number;
};

const NavIcon: React.FC<{
  icon: React.FC<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
}> = ({ icon: Icon, label, active, onClick, badge }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={badge ? `${label}, ${badge} unread` : label}
    aria-current={active ? 'page' : undefined}
    className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 transition active:scale-90"
  >
    <span className="relative flex h-6 w-6 items-center justify-center">
      <Icon
        className="h-[19px] w-[19px]"
        style={{ color: active ? NOQ_BRAND_SOFT : 'rgba(148,163,184,0.85)' } as React.CSSProperties}
      />
      {Boolean(badge) && (
        <span
          data-testid="alerts-unread-badge"
          className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black leading-none text-white ring-1 ring-black/50"
        >
          {badge! > 99 ? '99+' : badge}
        </span>
      )}
    </span>
    <span
      className="text-[9px] font-bold uppercase tracking-wide"
      style={{ color: active ? NOQ_BRAND_SOFT : 'rgba(148,163,184,0.75)' }}
    >
      {label}
    </span>
  </button>
);

/**
 * Persistent bottom navigation: Home | Bookings | Scan QR | Notifications |
 * More, with Scan raised as a fixed-size floating center CTA. All four side
 * items route through screens/modals CustomerApp and App.tsx already own
 * (tracking, NotificationCenterModal, profile) — no new routes are added.
 * The bar and the Scan CTA are both a constant size at all times; neither
 * reacts to Home's scroll position, matching the "stays stable while
 * scrolling" requirement. The Scan CTA and the active-tab highlight always
 * use the fixed NOQ brand color (never `--category-*`) — the bottom nav and
 * QR button are part of the fixed brand shell and never recolor with the
 * selected category.
 */
export const StickyScanQrButton: React.FC<Props> = ({
  activeTab = 'home',
  onScan,
  onHome,
  onBookings,
  onNotifications,
  onMore,
  unreadCount = 0,
}) => {
  return (
    <div
      id="sticky-scan-qr"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="relative flex w-full max-w-sm items-end justify-center">
        <div className="pointer-events-auto flex w-full items-center rounded-[26px] border border-white/10 bg-black/60 px-2 shadow-[0_14px_34px_-14px_rgba(0,0,0,.8)] backdrop-blur-2xl">
          <NavIcon icon={House} label="Home" active={activeTab === 'home'} onClick={onHome} />
          <NavIcon icon={CalendarCheck} label="Bookings" active={activeTab === 'bookings'} onClick={onBookings} />
          {/* Reserves the center slot the raised Scan CTA floats above. */}
          <span className="w-16 shrink-0" aria-hidden />
          <NavIcon icon={Bell} label="Alerts" active={activeTab === 'notifications'} onClick={onNotifications} badge={unreadCount} />
          <NavIcon icon={Menu} label="More" active={activeTab === 'more'} onClick={onMore} />
        </div>

        {/* Raised Scan QR CTA — fixed size always, never shrinks/expands with
            Home's scroll; only its own press state animates. The halo is
            deliberately tight (small margin, moderate blur) rather than a
            wide diffuse bloom — this stays the strongest accented element on
            the bar, just without reading as neon. */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -m-1 rounded-full blur-[14px]"
            style={{ backgroundColor: 'rgba(138,92,255,0.28)' }}
          />
          <button
            type="button"
            onClick={onScan}
            aria-label="Scan QR"
            className="pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full border border-white/25 text-slate-950 ring-2 transition-transform duration-150 ease-out active:scale-90"
            style={{
              backgroundImage: `linear-gradient(to bottom right, ${NOQ_BRAND}, ${NOQ_BRAND_SOFT}, ${NOQ_BRAND})`,
              boxShadow: '0 8px 20px -7px rgba(138,92,255,0.5)',
              ['--tw-ring-color' as any]: 'rgba(183,156,255,0.25)',
            }}
          >
            <span className="pointer-events-none absolute inset-x-2 top-2 h-1/3 rounded-full bg-white/40 blur-[2px]" />
            <QrCode className="relative h-7 w-7 drop-shadow-sm" />
          </button>
        </div>
      </div>
    </div>
  );
};
