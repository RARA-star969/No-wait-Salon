import React, { useEffect, useRef, useState } from 'react';
import { Building2, LifeBuoy, Menu, MessageSquareWarning, X } from 'lucide-react';

type CustomerLandingProps = {
  onExplore: () => void;
  onLoginSignup: () => void;
};

/**
 * The path a designer drops the approved full-screen landing artwork at.
 * Until that file exists the screen falls back to an equivalent illustrated
 * scene (logo, headline, storefront/queue art) so the screen never breaks —
 * see the README note in this component for how to wire the real asset in.
 */
const HERO_IMAGE_SRC = '/landing/hero.jpg';

const MENU_ITEMS = [
  {
    icon: Building2,
    label: 'Partner With Us',
    detail: 'Apply to onboard your business',
    href: 'mailto:partners@no-wait-salon.example?subject=Partner%20with%20No-Wait%20Salon',
  },
  {
    icon: MessageSquareWarning,
    label: 'Report an Issue',
    detail: 'Tell us what went wrong',
    href: 'mailto:support@no-wait-salon.example?subject=Issue%20report',
  },
  {
    icon: LifeBuoy,
    label: 'Help & Support',
    detail: 'Get help using the app',
    href: 'mailto:support@no-wait-salon.example?subject=Help%20%26%20Support',
  },
] as const;

/**
 * First screen a customer sees on cold start. Explore Nearby and Login /
 * Sign up hand off entirely into the app's existing onboarding continuation
 * and existing OTP auth flow — this component owns no auth/discovery logic
 * of its own. The top-right menu is self-contained (static contact links);
 * it does not duplicate any existing navigation.
 */
export function CustomerLanding({ onExplore, onLoginSignup }: CustomerLandingProps) {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const showFallback = !heroLoaded || heroFailed;

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-[#050B12] text-white">
      {/* Preload the real hero asset in the background; swap to it the instant it's available. */}
      <img
        src={HERO_IMAGE_SRC}
        alt=""
        aria-hidden="true"
        onLoad={() => setHeroLoaded(true)}
        onError={() => setHeroFailed(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          showFallback ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {showFallback && (
        <>
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-[#14B8A6]/25 blur-[70px]" />
            <div className="absolute bottom-0 left-1/2 h-64 w-[120%] -translate-x-1/2 rounded-[100%] bg-[#0F766E]/20 blur-[60px]" />
          </div>
          <div className="relative z-10 px-6 pt-8 text-center">
            <span className="mx-auto block bg-gradient-to-b from-[#7FEFE1] to-[#14B8A6] bg-clip-text text-2xl font-extrabold tracking-[-0.03em] text-transparent drop-shadow-[0_0_18px_rgba(20,184,166,0.55)]">
              noq
            </span>
            <h1 className="mx-auto mt-6 max-w-[320px] text-[30px] font-extrabold leading-[1.12] tracking-[-0.03em] text-white">
              No more waiting
              <br />
              <span className="bg-gradient-to-r from-[#5EEAD4] to-[#2DD4BF] bg-clip-text text-transparent">
                in long lines.
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-[280px] text-[13px] leading-6 text-white/60">
              Join live queues from anywhere.
              <br />
              For every business you visit.
            </p>
          </div>
          <div className="relative z-10 mt-4 flex flex-1 items-center justify-center px-4">
            <CitySkylineIllustration />
          </div>
        </>
      )}

      {/* Scrim so the top-right menu and bottom actions stay legible over any photo. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-black/55 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-56 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true" />

      {/* Top-right menu, anchored, not part of the artwork. */}
      <div ref={menuRef} className="absolute right-4 top-[max(1.1rem,env(safe-area-inset-top))] z-20">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
        >
          {menuOpen ? <X className="h-[18px] w-[18px]" strokeWidth={2.25} /> : <Menu className="h-[18px] w-[18px]" strokeWidth={2.25} />}
        </button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="More options"
            className="absolute right-0 top-12 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#0B1620]/95 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {MENU_ITEMS.map(({ icon: Icon, label, detail, href }) => (
              <a
                key={label}
                role="menuitem"
                href={href}
                onClick={() => setMenuOpen(false)}
                className="flex items-start gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-[#5EEAD4]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-white">{label}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-white/55">{detail}</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="relative z-10 mt-auto px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onExplore}
          className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#2DD4BF] to-[#0F9C8F] px-4 py-4 text-[15px] font-bold text-[#03211D] shadow-[0_10px_35px_rgba(20,184,166,0.45)] transition active:scale-[0.99]"
        >
          Explore Nearby
        </button>
        <button
          type="button"
          onClick={onLoginSignup}
          className="mt-4 block w-full text-center text-[13px] font-semibold text-white/80 transition hover:text-white"
        >
          Login / Sign up
        </button>
      </div>
    </div>
  );
}

function CitySkylineIllustration() {
  return (
    <svg viewBox="0 0 320 220" role="img" aria-label="People queuing outside glowing storefronts in a dark city" className="w-full max-w-[360px]">
      <defs>
        <linearGradient id="noq-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B1622" />
          <stop offset="100%" stopColor="#050B12" />
        </linearGradient>
        <radialGradient id="noq-glow" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="320" height="220" fill="url(#noq-sky)" rx="18" />
      <ellipse cx="160" cy="70" rx="140" ry="70" fill="url(#noq-glow)" />

      <g opacity="0.5" fill="#0F2531">
        <rect x="10" y="70" width="22" height="90" />
        <rect x="40" y="50" width="18" height="110" />
        <rect x="250" y="55" width="20" height="105" />
        <rect x="280" y="75" width="24" height="85" />
        <rect x="150" y="35" width="16" height="125" />
      </g>
      <g fill="#2DD4BF" opacity="0.5">
        <rect x="14" y="80" width="3" height="3" />
        <rect x="20" y="90" width="3" height="3" />
        <rect x="45" y="65" width="3" height="3" />
        <rect x="45" y="85" width="3" height="3" />
        <rect x="255" y="70" width="3" height="3" />
        <rect x="285" y="90" width="3" height="3" />
        <rect x="154" y="55" width="3" height="3" />
        <rect x="154" y="75" width="3" height="3" />
      </g>

      <g>
        <rect x="30" y="150" width="60" height="45" rx="4" fill="#0D2A2E" stroke="#1D4E4A" strokeWidth="1" />
        <rect x="42" y="160" width="36" height="20" rx="2" fill="#14B8A6" opacity="0.35" />
        <rect x="130" y="140" width="64" height="55" rx="4" fill="#0D2A2E" stroke="#1D4E4A" strokeWidth="1" />
        <rect x="144" y="150" width="36" height="26" rx="2" fill="#14B8A6" opacity="0.45" />
        <rect x="232" y="150" width="60" height="45" rx="4" fill="#0D2A2E" stroke="#1D4E4A" strokeWidth="1" />
        <rect x="244" y="160" width="36" height="20" rx="2" fill="#14B8A6" opacity="0.35" />
      </g>

      <rect x="0" y="195" width="320" height="25" fill="#08131A" />
      <rect x="20" y="200" width="280" height="2" fill="#14B8A6" opacity="0.3" />

      <g fill="#0B1F24" stroke="#2DD4BF" strokeWidth="0.75">
        {[46, 66, 86, 106, 155, 175, 195, 215, 235, 255, 275].map((x, i) => (
          <g key={x} transform={`translate(${x} 178)`}>
            <circle cx="0" cy="-2" r="4.5" fill={i % 3 === 0 ? '#123A38' : '#0B1F24'} />
            <path d="M -5 20 C -5 8 5 8 5 20 Z" fill={i % 3 === 0 ? '#123A38' : '#0B1F24'} />
          </g>
        ))}
      </g>
    </svg>
  );
}
