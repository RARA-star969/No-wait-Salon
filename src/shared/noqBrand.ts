/**
 * Canonical NOQ customer colour system.
 *
 * Category names remain product/data concepts, but they no longer own colour.
 * All customer surfaces consume this one palette through the CSS variables
 * below. Semantic status colours (error/success/warning/live) intentionally
 * live outside this object and remain local to the status they communicate.
 */
export const NOQ_BRAND = Object.freeze({
  base: '#FDFFFF',
  accent: '#3454FD',
  accentHover: '#2746EA',
  accentDeep: '#1D36C9',
  accentLight: '#7890FF',
  ink: '#17213D',
  muted: '#6F7B99',
  border: '#DCE4FF',
  surface: '#FFFFFF',
  surfaceSoft: '#F5F7FF',
  textSubtle: '#8C98B5',
  glass: 'rgba(253,255,255,0.78)',
  glassStrong: 'rgba(253,255,255,0.92)',
  glassBorder: 'rgba(52,84,253,0.18)',
  tint10: 'rgba(52,84,253,0.10)',
  tint20: 'rgba(52,84,253,0.16)',
  glow: 'rgba(52,84,253,0.30)',
  softReflection: 'rgba(120,144,255,0.30)',
  ctaGradient: 'linear-gradient(145deg, #7890FF 0%, #3454FD 52%, #1D36C9 100%)',
  glassGradient: 'linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(245,247,255,0.84) 58%, rgba(220,228,255,0.72) 100%)',
} as const);

/** CSS variables written once onto the customer app root/document root. */
export const NOQ_BRAND_CSS_VARS: Record<string, string> = Object.freeze({
  '--noq-base': NOQ_BRAND.base,
  '--noq-accent': NOQ_BRAND.accent,
  '--noq-accent-hover': NOQ_BRAND.accentHover,
  '--noq-accent-deep': NOQ_BRAND.accentDeep,
  '--noq-accent-light': NOQ_BRAND.accentLight,
  '--noq-ink': NOQ_BRAND.ink,
  '--noq-muted': NOQ_BRAND.muted,
  '--noq-border': NOQ_BRAND.border,
  '--noq-surface': NOQ_BRAND.surface,
  '--noq-surface-soft': NOQ_BRAND.surfaceSoft,
  '--noq-text-subtle': NOQ_BRAND.textSubtle,
  '--noq-glass': NOQ_BRAND.glass,
  '--noq-glass-strong': NOQ_BRAND.glassStrong,
  '--noq-glass-border': NOQ_BRAND.glassBorder,
  '--noq-tint-10': NOQ_BRAND.tint10,
  '--noq-tint-20': NOQ_BRAND.tint20,
  '--noq-glow': NOQ_BRAND.glow,
  '--noq-soft-reflection': NOQ_BRAND.softReflection,
  '--noq-cta-gradient': NOQ_BRAND.ctaGradient,
  '--noq-glass-gradient': NOQ_BRAND.glassGradient,
});
