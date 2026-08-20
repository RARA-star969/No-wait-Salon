// Single source of truth for how a duration (always given in minutes) reads
// to a customer. Every screen that shows a service/queue/reservation
// duration imports this instead of formatting minutes inline, so "2 hr 40
// min" never reads as "160 min" on one screen and "2h40" on another.
//
// Internal math (queue estimates, service totals, etc.) stays in minutes
// everywhere else — this function is display-only and never feeds back into
// a calculation.

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * Formats a duration in minutes for customer-facing display.
 *  - 1–60 min      -> "N min"
 *  - 61–719 min    -> "H hr" or "H hr M min" (minutes omitted when 0)
 *  - >= 720 min    -> "D day" / "D day H hr" (days omitted when 0... well,
 *                     days is always >=1 here; hours omitted when 0)
 */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));

  if (minutes <= 60) {
    return `${minutes} min`;
  }

  if (minutes < MINUTES_PER_DAY) {
    // 61–1439 minutes: hours + optional minutes. From 720 min (12 hr) up to
    // a full day this still reads as "H hr [M min]" — a plain hour count is
    // the sensible display right up until a full day is reached.
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const remainderMinutes = minutes % MINUTES_PER_HOUR;
    return remainderMinutes > 0 ? `${hours} hr ${remainderMinutes} min` : `${hours} hr`;
  }

  // >= 1440 minutes (24 hr / 1 day): day + optional hours. Minutes are
  // dropped at this granularity — nobody needs "1 day 2 hr 5 min".
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const remainderHours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  return remainderHours > 0 ? `${days} day ${remainderHours} hr` : `${days} day`;
}
