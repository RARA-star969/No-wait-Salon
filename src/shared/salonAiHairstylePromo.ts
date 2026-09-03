/**
 * Pure, DB-agnostic helpers for the admin-managed "Try hairstyle with AI"
 * promo on the Salon category page. The server and the customer UI both
 * import these so "what counts as a safe, renderable promo" is defined
 * exactly once and is trivially unit-testable without a database or network.
 */

/** Shape returned by the public/admin API for the promo's singleton config. */
export interface SalonAiHairstylePromoRecord {
  enabled: boolean;
  title?: string | null;
  subtitle?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaLink?: string | null;
  updatedAt?: number;
}

/** The checked-in creative shown until an admin uploads a replacement, and
 *  the safe fallback used whenever the remote config is unavailable or
 *  malformed — the Salon page must never break for a missing promo. */
export const SALON_AI_HAIRSTYLE_PROMO_FALLBACK: SalonAiHairstylePromoRecord = {
  enabled: true,
  title: 'Try hairstyle with AI',
  subtitle: 'Preview styles before you visit',
  imageUrl: '/static-defaults/ai-hairstyle-promo-default.svg',
  ctaLabel: '',
  ctaLink: '',
  updatedAt: 0,
};

/** Render-ready props for the promo card — never `null`/`undefined`. */
export interface SalonAiHairstylePromoRenderProps {
  visible: boolean;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaLink: string;
}

/**
 * Resolves a (possibly missing/malformed) promo record into props the
 * Salon category card can render directly. A disabled promo, a missing
 * record, or a record without an image all resolve to `visible: false` so
 * the card simply doesn't render rather than showing something broken.
 */
export function resolveSalonAiHairstylePromo(
  record: SalonAiHairstylePromoRecord | null | undefined
): SalonAiHairstylePromoRenderProps {
  const safe = record ?? SALON_AI_HAIRSTYLE_PROMO_FALLBACK;
  const imageUrl = String(safe.imageUrl || '').trim();
  const enabled = safe.enabled !== false;
  return {
    visible: enabled && imageUrl.length > 0,
    title: String(safe.title || '').trim() || SALON_AI_HAIRSTYLE_PROMO_FALLBACK.title!,
    subtitle: String(safe.subtitle || '').trim() || SALON_AI_HAIRSTYLE_PROMO_FALLBACK.subtitle!,
    imageUrl,
    ctaLabel: String(safe.ctaLabel || '').trim(),
    ctaLink: String(safe.ctaLink || '').trim(),
  };
}
