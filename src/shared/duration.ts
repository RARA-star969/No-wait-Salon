// Single source of truth for how a duration in minutes is worded anywhere in
// the customer app — the salon live card, the reserve screen, the service
// menu, the sticky dock and the price sheet all defer to this so "1 hr 15
// min" never reads as "75 min" on one screen and "1h15" on another.

/**
 * Formats a duration in minutes as:
 *  - under 60 min  -> "N min"
 *  - 60 min        -> "1 hr"
 *  - 61-719 min    -> "H hr M min" (M omitted when 0)
 *  - 12+ hours     -> converts to days once a whole day is reached
 */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes} min`;

  const days = Math.floor(minutes / 1440);
  const remAfterDays = minutes % 1440;
  const hours = Math.floor(remAfterDays / 60);
  const mins = remAfterDays % 60;

  if (days > 0) {
    const hourPart = hours > 0 ? ` ${hours} hr` : '';
    return `${days} ${days === 1 ? 'day' : 'days'}${hourPart}`;
  }
  if (hours === 1 && mins === 0) return '1 hr';
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

/** Compact form for tight spaces (capsules, chips): drops the leading "approx." style wording. */
export const formatDurationCompact = formatDuration;
