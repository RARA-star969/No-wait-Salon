// Single source of truth for every clock time and every visit duration shown
// anywhere in the Gym experience — Live Floor (Inside / Left / Waiting /
// Payments cards), the Customer Gym page, and the Customer Profile "Gym
// Activity" area all import from here. Nothing in Gym UI formats a time or
// derives a duration on its own.
//
// Two rules this module exists to enforce:
//   1. 12-hour AM/PM everywhere ("11:50 PM", "27 Aug, 11:50 PM"). No 24-hour
//      clock appears in any Gym surface.
//   2. A visit's duration is ALWAYS derived from the server timestamps on the
//      GymVisit record (`checkedInAt` / `checkedOutAt`) and a "now" the caller
//      passes in — never from when a component mounted, never from a
//      client-stored elapsed counter. That is what makes the number survive a
//      page reload and makes all three surfaces agree to the minute.

const MINUTES_PER_HOUR = 60;

export type VisitTimestamps = {
  checkedInAt: number;
  checkedOutAt?: number | null;
};

/** "11:50 PM" — 12-hour, always with AM/PM, never 24-hour. */
export function formatGymClock(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = new Date(value);
  if (!Number.isFinite(+date)) return "—";
  return date
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** "27 Aug, 11:50 PM" — used wherever the day matters (Left/history cards). */
export function formatGymDateTime(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = new Date(value);
  if (!Number.isFinite(+date)) return "—";
  const day = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${day}, ${formatGymClock(date.getTime())}`;
}

/** Same as {@link formatGymDateTime} but collapses to just the clock time when
 * the timestamp falls on the same calendar day as `now` — so an Inside card
 * reads "11:50 PM" while a visit from last week reads "21 Aug, 7:05 AM". */
export function formatGymTimeWithDay(
  value: number | string | null | undefined,
  now: number = Date.now(),
): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = new Date(value);
  if (!Number.isFinite(+date)) return "—";
  const today = new Date(now);
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay ? formatGymClock(date.getTime()) : formatGymDateTime(date.getTime());
}

/** "8 min" / "47 min" / "1 hr 24 min" — minute resolution only. Seconds are
 * deliberately never shown: a gym visit ticking by the second is noise, and
 * hiding them also keeps the label stable between poll intervals. */
export function formatGymDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainder = minutes % MINUTES_PER_HOUR;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

/** Whole minutes this visit has lasted. Open visit → now - checkedInAt (so it
 * recomputes from the server timestamp on every render and after any reload).
 * Closed visit → the frozen checkedOutAt - checkedInAt, which never moves
 * again no matter how much later it is read. */
export function gymVisitDurationMinutes(
  visit: VisitTimestamps,
  now: number = Date.now(),
): number {
  const end = visit.checkedOutAt ? visit.checkedOutAt : now;
  return Math.max(0, Math.floor((end - visit.checkedInAt) / 60_000));
}

/** The label every surface prints for a visit's duration. */
export function gymVisitDurationLabel(
  visit: VisitTimestamps,
  now: number = Date.now(),
): string {
  return formatGymDuration(gymVisitDurationMinutes(visit, now));
}

/** Elapsed-since label for non-visit timestamps that still need the same
 * wording (queue waiting time, "pending since" on a payment card). */
export function gymElapsedLabel(since: number, now: number = Date.now()): string {
  return formatGymDuration(Math.max(0, Math.floor((now - since) / 60_000)));
}
