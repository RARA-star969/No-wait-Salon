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
