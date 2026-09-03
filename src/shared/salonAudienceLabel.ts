export type SalonAudienceValue = 'men' | 'women' | 'unisex';

/**
 * Salon listing subtitle derived from the persisted `audience` field —
 * never from the freeform `category` string. A missing/unrecognized value
 * defaults to 'unisex', matching the same fallback the Men/Women discovery
 * filter already uses.
 */
export function resolveSalonAudienceLabel(audience?: string | null): string {
  switch (audience) {
    case 'men':
      return "Men's Salon";
    case 'women':
      return "Women's Salon";
    default:
      return 'Unisex Salon';
  }
}
