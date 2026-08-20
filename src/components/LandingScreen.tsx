import React, { useState } from 'react';
import { Handshake, HelpCircle, LogIn, MapPin, MessageSquareWarning, MoreVertical, X } from 'lucide-react';
import landingHero from '../assets/landing-hero.png';

type Props = {
  onExploreNearby: () => void;
  onLogin: () => void;
};

const MENU_ITEMS = [
  { label: 'Partner With Us', icon: Handshake, href: 'mailto:partners@nowaitsalon.app?subject=Partner%20with%20No-Wait%20Salon' },
  { label: 'Report an Issue', icon: MessageSquareWarning, href: 'mailto:support@nowaitsalon.app?subject=Issue%20report' },
  { label: 'Help & Support', icon: HelpCircle, href: 'mailto:support@nowaitsalon.app?subject=Help%20request' },
] as const;

/**
 * The customer landing screen: full-bleed artwork with functional overlays
 * only. Explore Nearby never requires an account — it hands off to the
 * existing guest location flow. Login / Sign up reuses the same OTP/profile
 * system for customers who want to authenticate up front.
 */
export const LandingScreen: React.FC<Props> = ({ onExploreNearby, onLogin }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div id="customer-landing-screen" className="relative flex min-h-full flex-col overflow-hidden bg-[#050B0F] text-white">
      <img
        src={landingHero}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050B0F] via-[#050B0F]/10 to-[#050B0F]/40" aria-hidden="true" />

      {/* Top-right menu */}
      <div className="relative z-10 flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="relative">
          <button
            type="button"
            id="landing-menu-btn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="More options"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition active:scale-95"
          >
            {menuOpen ? <X className="h-4.5 w-4.5" /> : <MoreVertical className="h-4.5 w-4.5" />}
          </button>

          {menuOpen && (
            <>
              <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-10 cursor-default" />
              <div
                role="menu"
                id="landing-menu-panel"
                className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0E1A20]/95 py-1.5 shadow-2xl backdrop-blur-md"
              >
                {MENU_ITEMS.map(({ label, icon: Icon, href }) => (
                  <a
                    key={label}
                    role="menuitem"
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                  >
                    <Icon className="h-4 w-4 text-[#5EEAD4]" />
                    {label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom action area */}
      <div className="relative z-10 mt-auto px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-10">
        <button
          type="button"
          id="landing-explore-nearby-btn"
          onClick={onExploreNearby}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#14B8A6] text-[15px] font-bold text-[#02201B] shadow-[0_12px_30px_-8px_rgba(20,184,166,0.55)] transition active:scale-[0.99]"
        >
          <MapPin className="h-4.5 w-4.5" />
          Explore Nearby
        </button>
        <p className="mt-2.5 text-center text-[11px] leading-4 text-white/60">
          No account needed to browse salons and live queues nearby.
        </p>

        <button
          type="button"
          id="landing-login-signup-btn"
          onClick={onLogin}
          className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/5 text-sm font-bold text-white backdrop-blur-sm transition active:scale-[0.99]"
        >
          <LogIn className="h-4 w-4" />
          Login / Sign up
        </button>
      </div>
    </div>
  );
};
