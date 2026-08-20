// Single source of truth for turning a duration in minutes into the label
// customers see ("45 min", "1 hr 15 min"). Every surface that prints a
// service or session duration should route through this, so the wording
// never drifts between the salon page, join sheet and reservation flow.

export function formatDurationLabel(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const hourLabel = `${hours} hr`;
  return remainder === 0 ? hourLabel : `${hourLabel} ${remainder} min`;
}
