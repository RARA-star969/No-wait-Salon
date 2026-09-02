import React from 'react';

/**
 * High-definition 3D vector icons for Explore Services categories.
 * Tactile multi-stop gradients, metallic chrome bevels, brand pivot studs,
 * and dimensional drop shadows aligned with the brand aesthetic.
 */

export const HairCare3DIcon: React.FC<{ className?: string }> = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hc-blade-1" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--noq-accent)" />
        <stop offset="0.4" stopColor="var(--noq-accent)" />
        <stop offset="1" stopColor="var(--noq-accent-deep)" />
      </linearGradient>
      <linearGradient id="hc-blade-2" x1="26" y1="6" x2="6" y2="26" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--noq-accent-light)" />
        <stop offset="0.45" stopColor="var(--noq-accent)" />
        <stop offset="1" stopColor="var(--noq-accent)" />
      </linearGradient>
      <linearGradient id="hc-sheen" x1="8" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" stopOpacity="0.9" />
        <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.1" />
        <stop offset="1" stopColor="var(--noq-accent-deep)" stopOpacity="0.5" />
      </linearGradient>
      <radialGradient id="hc-pivot" cx="16" cy="15.5" r="3.5" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" />
        <stop offset="0.6" stopColor="var(--noq-accent-light)" />
        <stop offset="0.9" stopColor="var(--noq-accent)" />
        <stop offset="1" stopColor="var(--noq-accent-deep)" />
      </radialGradient>
      <filter id="hc-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.8" stdDeviation="1.2" floodColor="var(--noq-accent-deep)" floodOpacity="0.28" />
      </filter>
    </defs>
    <g filter="url(#hc-shadow)">
      {/* Left Handle Loop & Beveled Blade */}
      <path
        d="M9.5 26C11.709 26 13.5 24.209 13.5 22C13.5 19.791 11.709 18 9.5 18C7.291 18 5.5 19.791 5.5 22C5.5 24.209 7.291 26 9.5 26Z"
        fill="url(#hc-blade-1)"
        stroke="url(#hc-sheen)"
        strokeWidth="1.4"
      />
      <circle cx="9.5" cy="22" r="2" fill="#E8F6F4" />
      <path
        d="M12.5 19.5L25.5 6C26.2 5.3 27.2 6 26.8 7L15 19"
        fill="url(#hc-blade-1)"
        stroke="var(--noq-accent)"
        strokeWidth="0.8"
      />

      {/* Right Handle Loop & Beveled Blade */}
      <path
        d="M22.5 26C24.709 26 26.5 24.209 26.5 22C26.5 19.791 24.709 18 22.5 18C20.291 18 18.5 19.791 18.5 22C18.5 24.209 20.291 26 22.5 26Z"
        fill="url(#hc-blade-2)"
        stroke="url(#hc-sheen)"
        strokeWidth="1.4"
      />
      <circle cx="22.5" cy="22" r="2" fill="#E8F6F4" />
      <path
        d="M19.5 19.5L6.5 6C5.8 5.3 4.8 6 5.2 7L17 19"
        fill="url(#hc-blade-2)"
        stroke="var(--noq-accent)"
        strokeWidth="0.8"
      />

      {/* 3D brand pivot stud */}
      <circle cx="16" cy="15.5" r="2.4" fill="url(#hc-pivot)" stroke="#FFFBEB" strokeWidth="0.7" />
      <circle cx="15.5" cy="14.8" r="0.6" fill="#FFFFFF" opacity="0.8" />
    </g>
  </svg>
);

export const Beard3DIcon: React.FC<{ className?: string }> = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bd-handle" x1="6" y1="26" x2="20" y2="12" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--noq-accent-deep)" />
        <stop offset="0.45" stopColor="var(--noq-accent)" />
        <stop offset="1" stopColor="var(--noq-accent)" />
      </linearGradient>
      <linearGradient id="bd-blade" x1="12" y1="4" x2="28" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" />
        <stop offset="0.25" stopColor="#F1F5F9" />
        <stop offset="0.7" stopColor="#94A3B8" />
        <stop offset="1" stopColor="#334155" />
      </linearGradient>
      <linearGradient id="bd-edge" x1="14" y1="4" x2="27" y2="17" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--noq-accent)" />
        <stop offset="0.5" stopColor="var(--noq-accent)" />
        <stop offset="1" stopColor="var(--noq-accent-deep)" />
      </linearGradient>
      <radialGradient id="bd-pivot" cx="16.5" cy="15.5" r="3" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" />
        <stop offset="0.6" stopColor="var(--noq-accent-light)" />
        <stop offset="1" stopColor="var(--noq-accent-deep)" />
      </radialGradient>
      <filter id="bd-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.8" stdDeviation="1.2" floodColor="var(--noq-accent-deep)" floodOpacity="0.28" />
      </filter>
    </defs>
    <g filter="url(#bd-shadow)">
      {/* Straight Razor Ergonomic Handle */}
      <path
        d="M5.5 24C4.8 26 6.2 27.2 8 26.5L18.5 16C19.2 15.3 18.6 14 17.5 14L6.8 22.2L5.5 24Z"
        fill="url(#bd-handle)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="0.9"
      />

      {/* 3D Pivot Stud */}
      <circle cx="16.5" cy="15.5" r="2.2" fill="url(#bd-pivot)" stroke="#FFFBEB" strokeWidth="0.6" />
      <circle cx="16" cy="14.8" r="0.5" fill="#FFFFFF" opacity="0.8" />

      {/* Polished Chrome Blade */}
      <path
        d="M17 14L26 4.8C27.2 3.6 28.5 4.5 27.8 6.2L22 16.5C21.4 17.5 20 17.8 19 17.2L17 14Z"
        fill="url(#bd-blade)"
        stroke="#CBD5E1"
        strokeWidth="0.8"
      />

      {/* Precision Honed Edge */}
      <path
        d="M26 4.8L18.2 13.8"
        stroke="url(#bd-edge)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Blade Cutout Slot */}
      <rect x="20.5" y="7.5" width="4.5" height="1.2" rx="0.6" transform="rotate(45 20.5 7.5)" fill="var(--noq-accent)" opacity="0.75" />
    </g>
  </svg>
);

export const MassageSpa3DIcon: React.FC<{ className?: string }> = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ms-base" x1="8" y1="19" x2="24" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--noq-accent-deep)" />
        <stop offset="0.5" stopColor="var(--noq-accent)" />
        <stop offset="1" stopColor="var(--noq-accent-deep)" />
      </linearGradient>
      <linearGradient id="ms-mid" x1="10" y1="13" x2="22" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--noq-accent)" />
        <stop offset="0.5" stopColor="var(--noq-accent)" />
        <stop offset="1" stopColor="var(--noq-accent)" />
      </linearGradient>
      <linearGradient id="ms-essence" x1="16" y1="3" x2="16" y2="15" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" />
        <stop offset="0.4" stopColor="var(--noq-accent)" />
        <stop offset="1" stopColor="var(--noq-accent)" />
      </linearGradient>
      <filter id="ms-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.8" stdDeviation="1.2" floodColor="var(--noq-accent-deep)" floodOpacity="0.28" />
      </filter>
    </defs>
    <g filter="url(#ms-shadow)">
      {/* Large Base Zen Stone */}
      <ellipse cx="16" cy="24" rx="10.5" ry="4.2" fill="url(#ms-base)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.9" />
      <ellipse cx="15.5" cy="23.1" rx="7.5" ry="2.2" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" opacity="0.8" />

      {/* Upper Balanced Zen Stone */}
      <ellipse cx="16" cy="17.5" rx="7.5" ry="3.2" fill="url(#ms-mid)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.9" />
      <ellipse cx="15.5" cy="16.8" rx="5" ry="1.6" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.6" opacity="0.9" />

      {/* Radiant Lotus / Calming Essence Droplet */}
      <path
        d="M16 3.5C16 3.5 11 9.5 11 12.5C11 15.2 13.2 17.2 16 17.2C18.8 17.2 21 15.2 21 12.5C21 9.5 16 3.5 16 3.5Z"
        fill="url(#ms-essence)"
        stroke="#FFFFFF"
        strokeWidth="1"
      />
      {/* Essence Core Light Sparkle */}
      <circle cx="16" cy="12" r="1.2" fill="#FFFFFF" />
      <circle cx="15.5" cy="11.4" r="0.4" fill="var(--noq-accent-light)" />
    </g>
  </svg>
);

export const HairColour3DIcon: React.FC<{ className?: string }> = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hc-pal-base" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--noq-accent-light)" />
        <stop offset="0.5" stopColor="var(--noq-accent)" />
        <stop offset="1" stopColor="var(--noq-accent-deep)" />
      </linearGradient>
      <filter id="hc-pal-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.8" stdDeviation="1.2" floodColor="var(--noq-accent-deep)" floodOpacity="0.28" />
      </filter>
    </defs>
    <g filter="url(#hc-pal-shadow)">
      <path
        d="M16 6C10.48 6 6 10.48 6 16C6 21.52 10.48 26 16 26C17.38 26 18.5 24.88 18.5 23.5C18.5 22.86 18.25 22.28 17.86 21.84C17.48 21.41 17.25 20.85 17.25 20.25C17.25 18.87 18.37 17.75 19.75 17.75H22C24.21 17.75 26 15.96 26 13.75C26 9.47 21.52 6 16 6Z"
        fill="url(#hc-pal-base)"
        stroke="#FFFFFF"
        strokeWidth="0.9"
      />
      <circle cx="10.5" cy="13.5" r="1.6" fill="var(--noq-accent)" />
      <circle cx="14.5" cy="10.5" r="1.6" fill="var(--noq-accent)" />
      <circle cx="19.5" cy="11.5" r="1.6" fill="var(--noq-accent-light)" />
    </g>
  </svg>
);

export const Facial3DIcon: React.FC<{ className?: string }> = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fc-glow" x1="16" y1="4" x2="16" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--noq-accent)" />
        <stop offset="0.6" stopColor="var(--noq-accent)" />
        <stop offset="1" stopColor="var(--noq-accent-deep)" />
      </linearGradient>
      <filter id="fc-glow-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.8" stdDeviation="1.2" floodColor="var(--noq-accent-deep)" floodOpacity="0.28" />
      </filter>
    </defs>
    <g filter="url(#fc-glow-shadow)">
      <circle cx="16" cy="16" r="10.5" fill="url(#fc-glow)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.9" />
      <path d="M11.5 15.5C11.5 15.5 13.2 17.5 16 17.5C18.8 17.5 20.5 15.5 20.5 15.5" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="12.5" cy="12.5" r="1.2" fill="#FFFFFF" />
      <circle cx="19.5" cy="12.5" r="1.2" fill="#FFFFFF" />
    </g>
  </svg>
);
