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

// The artwork's own pixel dimensions. The "stage" below is sized from this
// exact ratio so the image is never stretched or cropped — only ever
// letterboxed against the dark background, identically at every viewport.
const ARTWORK_WIDTH = 862;
const ARTWORK_HEIGHT = 1825;

// Classic letterbox math: the stage is exactly as large as it can be while
// fitting inside the viewport AND keeping the artwork's ratio, so both
// dimensions are always constrained together — never independently
// stretched. On a portrait phone this fills full width with slim bars top
// and bottom; on a wide/short viewport (or desktop) it fills full height
// with bars left and right, reproducing the same centered phone composition
// instead of stretching across the browser.
const stageStyle: React.CSSProperties = {
  width: `min(100vw, calc(100dvh * ${ARTWORK_WIDTH} / ${ARTWORK_HEIGHT}))`,
  height: `min(100dvh, calc(100vw * ${ARTWORK_HEIGHT} / ${ARTWORK_WIDTH}))`,
};

/**
 * The customer landing screen: full-bleed artwork with functional overlays
 * only. Explore Nearby never requires an account — it hands off to the
 * existing guest location flow. Login / Sign up reuses the same OTP/profile
 * system for customers who want to authenticate up front.
 */
export const LandingScreen: React.FC<Props> = ({ onExploreNearby, onLogin }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    // Fixed to the real viewport (not the parent's padded/card-framed demo
    // shell) so this always measures against the actual screen, not an
    // ancestor's constrained box. The NOQ base fills every pixel; the
    // "stage" inside it is the only part that resizes, always keeping the
    // artwork's exact aspect ratio.
    <div id="customer-landing-screen" className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--noq-base)]">
      <div id="customer-landing-stage" className="relative overflow-hidden text-white" style={stageStyle}>
        <img
          src={landingHero}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-contain hue-rotate-[48deg] saturate-[1.05]"
        />
        {/* Light scrim: mostly clear over the artwork's own text, just enough
            extra contrast at the very top (menu button) and bottom (CTAs). */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--noq-ink)]/90 via-transparent to-[var(--noq-ink)]/20" aria-hidden="true" />

        {/* Every overlay below is a child of the SAME stage, so it holds the
            same position relative to the logo/headline/subtitle/illustration
            no matter the viewport size. */}
        <div className="relative flex h-full flex-col">
          {/* Top-right menu */}
          <div className="flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
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
                    className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-2xl border border-[var(--noq-glass-border)] bg-[var(--noq-glass-strong)] py-1.5 text-[var(--noq-ink)] shadow-2xl backdrop-blur-md"
                  >
                    {MENU_ITEMS.map(({ label, icon: Icon, href }) => (
                      <a
                        key={label}
                        role="menuitem"
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[var(--noq-ink)] transition hover:bg-[var(--noq-tint-10)]"
                      >
                        <Icon className="h-4 w-4 text-[var(--noq-accent)]" />
                        {label}
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom action area: Explore Nearby, then Login / Sign up
              directly below it, anchored near the bottom so neither ever
              overlaps the artwork's logo, headline, subtitle, or
              illustration above them. */}
          <div className="mt-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
            <button
              type="button"
              id="landing-explore-nearby-btn"
              onClick={onExploreNearby}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--noq-accent)] text-[15px] font-bold text-white shadow-[0_12px_30px_-8px_var(--noq-glow)] transition active:scale-[0.99]"
            >
              <MapPin className="h-4.5 w-4.5" />
              Explore Nearby
            </button>

            <button
              type="button"
              id="landing-login-signup-btn"
              onClick={onLogin}
              className="mt-2.5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/5 text-sm font-bold text-white backdrop-blur-sm transition active:scale-[0.99]"
            >
              <LogIn className="h-4 w-4" />
              Login / Sign up
            </button>

            <p className="mt-2.5 text-center text-[11px] leading-4 text-white/60">
              No account needed to browse salons and live queues nearby.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
