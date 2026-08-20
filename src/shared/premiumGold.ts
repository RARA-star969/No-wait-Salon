// The one place that defines "premium gold" for the customer app. Every
// premium-gated surface (the reservation entry point, its lock badges, the
// sticky-bar locked CTA, the reservation calendar control) imports these
// tokens instead of inventing its own gold — so a customer sees exactly one
// gold language across the app, not several close-but-different ones.
//
// Deliberately a richer, denser metallic gold (deep amber → bronze) rather
// than the pale butter/mustard tone this replaces, so it reads as premium
// rather than washed out.

/** Metallic gold surface used for premium entry points and locked CTAs. */
export const GOLD_SURFACE_CLASS =
  'relative overflow-hidden border border-[#D4AF6A]/70 bg-[linear-gradient(135deg,#8A5A16_0%,#B4761C_28%,#E8C766_52%,#B4761C_76%,#6B4712_100%)] text-[#2A1B04] shadow-[0_10px_28px_-12px_rgba(90,58,12,0.55)]';

/** Compact gold pill/badge (lock chips, "Premium" tags). */
export const GOLD_BADGE_CLASS =
  'relative overflow-hidden border border-[#D4AF6A]/80 bg-[linear-gradient(135deg,#6B4712_0%,#B4761C_30%,#E8C766_55%,#8A5A16_100%)] text-[#2A1B04]';

/** Soft gold panel background for premium-locked info cards (less dense than the CTA surface). */
export const GOLD_PANEL_CLASS =
  'border border-[#D9BE84] bg-[linear-gradient(160deg,#F3E3B8_0%,#E8C766_100%)] text-[#5A3C0E]';

/** Text color for copy sitting on the dense metallic gold surfaces. */
export const GOLD_TEXT_STRONG = 'text-[#2A1B04]';

/**
 * A subtle shimmer sweep, GPU-cheap (pure CSS transform/opacity), meant to be
 * layered as an absolutely-positioned child of an element using
 * GOLD_SURFACE_CLASS / GOLD_BADGE_CLASS (which are `relative overflow-hidden`).
 * Kept as a single shared class (`.premium-gold-shimmer`, defined in
 * index.css) so every gold surface gets the identical animation, never a
 * one-off per component.
 */
export const GOLD_SHIMMER_CLASS = 'premium-gold-shimmer';
