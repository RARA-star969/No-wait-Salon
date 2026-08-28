// Multi-service selection helpers shared by the customer app's salon page and
// the public QR web page, so "3 services · ₹650 · 45 min" is computed once
// and never drifts between the two surfaces.

import type { SalonProfileService } from './salonProfile';

export type ServiceFilter = 'All' | 'Male' | 'Female' | 'Packages';
export const SERVICE_FILTERS: ServiceFilter[] = ['All', 'Male', 'Female', 'Packages'];

/**
 * Services don't carry a gender/package field yet, so the filter is a
 * best-effort read of the name/description until the admin schema grows one.
 * "All" always shows everything, so the filter row is safe to ship now and
 * sharpen later without breaking anyone's selection.
 */
export function serviceFilterTags(service: SalonProfileService): ServiceFilter[] {
  const text = `${service.name} ${service.description || ''}`.toLowerCase();
  const tags: ServiceFilter[] = [];
  if (text.includes('package') || text.includes('combo') || text.includes('bundle')) tags.push('Packages');
  if (/\b(women|woman|female|bridal|her)\b/.test(text)) tags.push('Female');
  if (/\b(men|man|male|beard|shave|his)\b/.test(text)) tags.push('Male');
  return tags;
}

export function filterServices(services: SalonProfileService[], filter: ServiceFilter): SalonProfileService[] {
  if (filter === 'All') return services;
  return services.filter((service) => serviceFilterTags(service).includes(filter));
}

export type ServiceSelectionTotals = {
  count: number;
  totalPriceInr: number;
  totalDurationMin: number;
  names: string[];
};

export function selectionTotals(services: SalonProfileService[], selectedIds: ReadonlySet<string> | string[]): ServiceSelectionTotals {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  const chosen = services.filter((service) => ids.has(service.id));
  return {
    count: chosen.length,
    totalPriceInr: chosen.reduce((sum, service) => sum + (Number(service.priceInr) || 0), 0),
    totalDurationMin: chosen.reduce((sum, service) => sum + (Number(service.durationMin) || 0), 0),
    names: chosen.map((service) => service.name),
  };
}

export const combinedServiceLabel = (names: string[]): string => (names.length ? names.join(' + ') : '');

/**
 * Broad, glanceable label for one service name — used only to build the
 * listing card's compact summary below. Deliberately coarser than the
 * Salon Detail page's own category grouping (kept local to that page); this
 * one exists purely to keep listing cards a fixed height regardless of how
 * many services a salon has.
 */
function listingServiceLabel(name: string): string {
  const value = name.toLowerCase();
  if (value.includes('beard')) return 'Beard';
  if (value.includes('massage') || value.includes('spa')) return 'Grooming';
  if (value.includes('colour') || value.includes('color')) return 'Hair Colour';
  if (value.includes('facial')) return 'Facial';
  if (value.includes('hair') || value.includes('cut') || value.includes('trim') || value.includes('shave') || value.includes('style')) return 'Haircut';
  return 'Grooming';
}

/**
 * Compact "Haircut · Beard · Grooming +2 more" summary for a salon listing
 * card. Always at most `max` labels plus an optional "+N more" — never the
 * full services list — so the card height never grows with the catalog
 * size. The full catalog stays on the Salon Detail page.
 */
export function summarizeServiceLabels(services: Pick<SalonProfileService, 'name'>[], max = 3): string {
  if (!services.length) return '';
  const uniqueLabels: string[] = [];
  for (const service of services) {
    const label = listingServiceLabel(service.name);
    if (!uniqueLabels.includes(label)) uniqueLabels.push(label);
  }
  const shown = uniqueLabels.slice(0, max);
  const remaining = services.length - shown.length;
  const summary = shown.join(' · ');
  return remaining > 0 ? `${summary} +${remaining} more` : summary;
}
