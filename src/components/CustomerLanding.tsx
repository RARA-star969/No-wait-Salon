import React from 'react';
import { Menu } from 'lucide-react';

type CustomerLandingProps = {
  onExplore: () => void;
  onLoginSignup: () => void;
  onMenu: () => void;
};

/**
 * First screen a customer sees on cold start: a dark, teal-glow splash that
 * hands off into the app's existing onboarding continuation (Explore) or
 * the existing OTP auth flow (Login / Sign up) — it owns no auth/discovery
 * logic of its own.
 */
export function CustomerLanding({ onExplore, onLoginSignup, onMenu }: CustomerLandingProps) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-[#050B12] text-white">
      {/* Ambient teal glow field */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-[#14B8A6]/25 blur-[70px]" />
        <div className="absolute bottom-0 left-1/2 h-64 w-[120%] -translate-x-1/2 rounded-[100%] bg-[#0F766E]/20 blur-[60px]" />
      </div>

      {/* Top bar: logo + menu */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-[max(1.1rem,env(safe-area-inset-top))]">
        <span className="w-10" aria-hidden="true" />
        <div className="flex items-center gap-1.5" aria-label="noq">
          <span className="bg-gradient-to-b from-[#7FEFE1] to-[#14B8A6] bg-clip-text text-2xl font-extrabold tracking-[-0.03em] text-transparent drop-shadow-[0_0_18px_rgba(20,184,166,0.55)]">
            noq
          </span>
        </div>
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/90 transition hover:bg-white/10 active:scale-95"
        >
          <Menu className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </button>
      </div>

      {/* Headline */}
      <div className="relative z-10 px-6 pt-8 text-center">
        <h1 className="mx-auto max-w-[320px] text-[30px] font-extrabold leading-[1.12] tracking-[-0.03em] text-white">
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

      {/* Central illustration */}
      <div className="relative z-10 mt-4 flex flex-1 items-center justify-center px-4">
        <CitySkylineIllustration />
      </div>

      {/* Bottom actions */}
      <div className="relative z-10 px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
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
          className="mt-4 block w-full text-center text-[13px] font-semibold text-white/70 transition hover:text-white"
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

      {/* Distant skyline */}
      <g opacity="0.5" fill="#0F2531">
        <rect x="10" y="70" width="22" height="90" />
        <rect x="40" y="50" width="18" height="110" />
        <rect x="250" y="55" width="20" height="105" />
        <rect x="280" y="75" width="24" height="85" />
        <rect x="150" y="35" width="16" height="125" />
      </g>
      {/* Lit windows */}
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

      {/* Storefronts row */}
      <g>
        <rect x="30" y="150" width="60" height="45" rx="4" fill="#0D2A2E" stroke="#1D4E4A" strokeWidth="1" />
        <rect x="42" y="160" width="36" height="20" rx="2" fill="#14B8A6" opacity="0.35" />
        <rect x="130" y="140" width="64" height="55" rx="4" fill="#0D2A2E" stroke="#1D4E4A" strokeWidth="1" />
        <rect x="144" y="150" width="36" height="26" rx="2" fill="#14B8A6" opacity="0.45" />
        <rect x="232" y="150" width="60" height="45" rx="4" fill="#0D2A2E" stroke="#1D4E4A" strokeWidth="1" />
        <rect x="244" y="160" width="36" height="20" rx="2" fill="#14B8A6" opacity="0.35" />
      </g>

      {/* Ground / street glow */}
      <rect x="0" y="195" width="320" height="25" fill="#08131A" />
      <rect x="20" y="200" width="280" height="2" fill="#14B8A6" opacity="0.3" />

      {/* Queue of people */}
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
