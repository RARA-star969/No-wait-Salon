/**
 * Compact neighborhood/locality label for a listing card, replacing the
 * full street address (kept, in full, on the Detail page). Prefers the
 * business's own `area` field; when that isn't set (true for most
 * demo/seed businesses today), derives a plausible locality from the
 * address string instead of falling back to the whole address — for
 * "742, 12th Main Road, Indiranagar, Bengaluru 560038" that's the
 * second-to-last comma-separated segment, "Indiranagar".
 */
export function deriveLocalityLabel(business: { area?: string; address: string; city?: string }): string {
  if (business.area) return business.area;
  const segments = business.address
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length >= 2) return segments[segments.length - 2];
  if (business.city) return business.city;
  return business.address;
}
