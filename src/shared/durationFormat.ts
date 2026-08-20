// Single source of truth for turning a duration in minutes into the label
// customers see ("45 min", "1 hr 15 min", "1 day 4 hr"). Every surface that
// prints a service, session, or queue duration should route through this, so
// the wording never drifts between the salon page, join sheet and
// reservation flow.
//
// Rules:
//   < 60 min        -> "N min"
//   60 min          -> "1 hr"
//   61-719 min      -> "H hr M min" (drops the minutes if exactly on the hour)
//   720-1439 min    -> "H hr" (12+ hours: minute-level precision stops mattering)
//   1440+ min       -> "D day[s] [H hr]"

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const TWELVE_HOURS_MIN = 12 * MINUTES_PER_HOUR;

export function formatDurationLabel(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));

  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;

  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const remainder = minutes % MINUTES_PER_HOUR;
    // 12+ hours drops the minutes remainder — coarser granularity reads cleaner.
    if (minutes >= TWELVE_HOURS_MIN || remainder === 0) return `${hours} hr`;
    return `${hours} hr ${remainder} min`;
  }

  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const remainingHours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const dayLabel = `${days} day${days === 1 ? '' : 's'}`;
  return remainingHours === 0 ? dayLabel : `${dayLabel} ${remainingHours} hr`;
}
