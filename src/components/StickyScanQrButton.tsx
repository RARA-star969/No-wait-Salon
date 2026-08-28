import React from 'react';
import { QrCode, House, CalendarCheck, Bell, Menu } from 'lucide-react';

type Props = {
  activeHome?: boolean;
  onScan: () => void;
  /** Tapping Home while already on Home reuses the existing return-to-top glide. */
  onHome?: () => void;
  /** Opens the existing tracking screen — the app's own "my active booking"
   *  view, reused as-is rather than inventing a separate bookings list. */
  onBookings?: () => void;
  /** Opens the existing NotificationCenterModal (App.tsx), unchanged. */
  onNotifications?: () => void;
  /** Opens the existing Profile screen — the app's catch-all account/settings
   *  surface, reused as the "More" destination. */
  onMore?: () => void;
  /** True while an unread/undismissed alert exists, for the small dot. */
  hasNotifications?: boolean;
};

const NavIcon: React.FC<{
  icon: React.FC<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
  dot?: boolean;
}> = ({ icon: Icon, label, active, onClick, dot }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 transition active:scale-90"
  >
    <span className="relative flex h-6 w-6 items-center justify-center">
      <Icon
        className="h-[19px] w-[19px]"
        style={{ color: active ? 'var(--category-accent, #22D3EE)' : 'rgba(148,163,184,0.85)' } as React.CSSProperties}
      />
      {dot && (
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose-400 ring-1 ring-black/40" />
      )}
    </span>
    <span
      className="text-[9px] font-bold uppercase tracking-wide"
      style={{ color: active ? 'var(--category-accent, #22D3EE)' : 'rgba(148,163,184,0.75)' }}
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
 * scrolling" requirement. The Scan CTA's fill/glow/ring read the active
 * category's CSS variables, so it recolors with the selected category.
 */
export const StickyScanQrButton: React.FC<Props> = ({
  activeHome = true,
  onScan,
  onHome,
  onBookings,
  onNotifications,
  onMore,
  hasNotifications,
}) => {
  return (
    <div
      id="sticky-scan-qr"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="relative flex w-full max-w-sm items-end justify-center">
        <div className="pointer-events-auto flex w-full items-center rounded-[26px] border border-white/10 bg-black/60 px-2 shadow-[0_14px_34px_-14px_rgba(0,0,0,.8)] backdrop-blur-2xl">
          <NavIcon icon={House} label="Home" active={activeHome} onClick={onHome} />
          <NavIcon icon={CalendarCheck} label="Bookings" onClick={onBookings} />
          {/* Reserves the center slot the raised Scan CTA floats above. */}
          <span className="w-16 shrink-0" aria-hidden />
          <NavIcon icon={Bell} label="Alerts" onClick={onNotifications} dot={hasNotifications} />
          <NavIcon icon={Menu} label="More" onClick={onMore} />
        </div>

        {/* Raised Scan QR CTA — fixed size always, never shrinks/expands with
            Home's scroll; only its own press state animates. */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -m-2 rounded-full blur-xl"
            style={{ backgroundColor: 'var(--category-tint-20, rgba(34,211,238,0.4))' }}
          />
          <button
            type="button"
            onClick={onScan}
            aria-label="Scan QR"
            className="pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full border border-white/25 text-slate-950 ring-2 transition-transform duration-150 ease-out active:scale-90"
            style={{
              backgroundImage: 'linear-gradient(to bottom right, var(--category-primary, #22D3EE), var(--category-accent, #2DD4BF), var(--category-primary, #22D3EE))',
              boxShadow: '0 12px 32px -6px var(--category-glow, rgba(34,211,238,0.65))',
              ['--tw-ring-color' as any]: 'var(--category-tint-20, rgba(103,232,249,0.3))',
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
