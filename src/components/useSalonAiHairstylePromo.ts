import React from 'react';
import {
  resolveSalonAiHairstylePromo,
  SALON_AI_HAIRSTYLE_PROMO_FALLBACK,
  type SalonAiHairstylePromoRecord,
  type SalonAiHairstylePromoRenderProps,
} from '../shared/salonAiHairstylePromo';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Fetches the admin-managed "Try hairstyle with AI" promo config for the
 * Salon category page. Any failure (network error, bad JSON, disabled row,
 * or the endpoint being unreachable) resolves to the same safe checked-in
 * fallback so the Salon page never breaks — an admin's image/copy change
 * only ever adds content, it can never take the card into a broken state.
 */
export function useSalonAiHairstylePromo(): SalonAiHairstylePromoRenderProps {
  const [record, setRecord] = React.useState<SalonAiHairstylePromoRecord>(SALON_AI_HAIRSTYLE_PROMO_FALLBACK);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/salon/ai-hairstyle-promo`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.promo && typeof data.promo === 'object') setRecord(data.promo);
      })
      .catch(() => { /* keep the fallback already in state */ });
    return () => { cancelled = true; };
  }, []);

  return React.useMemo(() => resolveSalonAiHairstylePromo(record), [record]);
}
