export type GymTrainer = {
  id: string;
  name: string;
  role: string;
  status: string;
  staffId?: string;
};
export type GymClass = {
  id: string;
  title: string;
  trainer: string;
  trainerId?: string;
  time: string;
  startsAt?: string;
  durationMinutes?: number;
  enrolled: number;
  maxCapacity: number;
  status?: string;
};
export type GymMember = {
  id: string;
  name: string;
  phone: string;
  membership: string;
  status: "Active" | "Paused";
  createdAt: number;
};
export type GymVisit = {
  id: string;
  name: string;
  memberId?: string;
  checkedInAt: number;
  checkedOutAt?: number;
  // Real membership + payment architecture (additive — legacy walk-in
  // visits above never set these fields).
  customerId?: string;
  offeringId?: string;
  membershipId?: string;
  paymentId?: string;
  purpose?: "member" | "visitor";
  entryMethod?: "qr" | "staff_manual";
  checkedInBy?: string;
  checkedOutBy?: string;
  // Who closed this visit — additive; absent on legacy rows (render a
  // neutral fallback instead of guessing which one it was).
  checkoutSource?: "staff" | "customer";
  // Free staff-verified entry with no GymOffering and no payment behind it
  // ("Custom Entry — Free" on Add Visitor). Deliberately a flag rather than a
  // synthetic ₹0 offering/payment, so nothing downstream ever mistakes it for
  // a real transaction. Always a visit, never a membership.
  customEntry?: boolean;
  // Contact number captured by a staff-entered walk-in (Add Visitor). Additive
  // and optional — legacy and QR-sourced visits never set it.
  mobile?: string;
  // Resolved at serve time from customer_profile for visits linked to a real
  // authenticated customer — never persisted into GymState, so a later photo
  // change is reflected immediately and no image data is duplicated here.
  customerPhotoUrl?: string;
};
export type GymQueueEntry = {
  id: string;
  name: string;
  memberId?: string;
  customerId?: string;
  arrivedAt: number;
  status: string;
  // Set only when this queue entry was created by the capacity-full fallback
  // on Add Visitor / Accept Payment (never by the plain "Add to entry queue"
  // flow): a payment was already accepted and, for memberships, the
  // membership already created — carried here so admitting this entry later
  // produces the same real GymVisit that would have been created at
  // check-in time, instead of a bare walk-in row.
  offeringId?: string;
  membershipId?: string;
  paymentId?: string;
  purpose?: "member" | "visitor";
  entryMethod?: "qr" | "staff_manual";
  customEntry?: boolean;
  mobile?: string;
};

// --- Membership, Offering & Payment domain ---------------------------------
// Payment ≠ Access ≠ Check-in: an offering purchase creates a payment; a paid
// membership offering creates/renews a GymMembership; a valid entry (QR scan
// or staff manual admit) creates a GymVisit. None of these three steps
// implies another — buying a plan never increases Inside Now by itself.

export type GymOfferingType =
  | "visitor_pass"
  | "membership"
  | "pt"
  | "class_package"
  | "custom";
export type GymOffering = {
  id: string;
  name: string;
  type: GymOfferingType;
  priceInr: number;
  durationValue: number;
  durationUnit: "day" | "week" | "month" | "quarter" | "year" | "session";
  description: string;
  active: boolean;
  customerVisible: boolean;
  paymentOptions: ("online" | "cash")[];
  // Owner-controlled "Recommend this plan" toggle (Plans & Services form).
  // The ONLY source for the customer-facing "Recommended for you" section —
  // when no offering at this gym has it set, that section is not rendered at
  // all rather than auto-picking one.
  recommended?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type GymMembershipStatus = "active" | "expired" | "cancelled";
export type GymMembershipSource = "claim" | "purchase" | "manual";
export type GymMembership = {
  id: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  offeringId?: string;
  planName: string;
  source: GymMembershipSource;
  status: GymMembershipStatus;
  joinedDate: string; // ISO date (yyyy-mm-dd)
  expiryDate: string; // ISO date (yyyy-mm-dd)
  previousMembershipId?: string; // renewal chain — history is never overwritten
  createdAt: number;
  updatedAt: number;
};

export type GymMembershipClaimStatus = "pending" | "approved" | "rejected";
export type GymMembershipClaim = {
  id: string;
  customerId: string;
  name: string;
  mobile: string;
  joiningDate: string;
  expiryDate: string;
  planText: string;
  status: GymMembershipClaimStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  resultingMembershipId?: string;
  createdAt: number;
};

export type GymPaymentMethod = "online" | "cash";
export type GymPaymentStatus = "pending" | "paid" | "failed" | "refunded" | "declined";
export type GymPaymentDeclineReasonCode =
  | "no_payment"
  | "duplicate"
  | "cancelled"
  | "other";
export type GymPayment = {
  id: string;
  customerId?: string;
  customerName: string;
  customerMobile: string;
  offeringId: string;
  offeringName: string;
  amountInr: number;
  method: GymPaymentMethod;
  status: GymPaymentStatus;
  visitId?: string;
  membershipId?: string;
  acceptedBy?: string;
  acceptedAt?: number;
  createdAt: number;
  updatedAt: number;
  // Decline audit — additive, only ever set when status === "declined".
  // Never overwritten: a declined payment is terminal, same as a paid one.
  reasonCode?: GymPaymentDeclineReasonCode;
  reasonText?: string;
  declinedAt?: number;
  declinedBy?: string;
};
export type GymPtBooking = {
  id: string;
  clientName: string;
  trainer: string;
  trainerId: string;
  service: string;
  time: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
  createdAt: number;
};
export type GymCampaign = {
  id: string;
  token: string;
  title: string;
  message: string;
  type: "Offer" | "Alert" | "Announcement" | "Membership promotion";
  startsAt: string;
  endsAt: string;
  status: "Draft" | "Active" | "Paused" | "Archived";
  createdAt: number;
};
export type GymEvent = {
  id: string;
  at: number;
  category:
    | "occupancy"
    | "checkins"
    | "pt"
    | "trainers"
    | "classes"
    | "campaigns"
    | "members"
    | "queue";
  action: string;
  subject: string;
  actor: string;
  occupancy: number;
  capacity: number;
  availableTrainers: number;
  campaignId?: string;
  visitorId?: string;
  trainer?: string;
  enrolled?: number;
  classCapacity?: number;
  durationMinutes?: number;
};
export type GymState = {
  gymId: string;
  currentOccupancy: number;
  maxCapacity: number;
  availableTrainersCount: number;
  waitingOutsideCount: number;
  checkinsTodayCount: number;
  classesToday: GymClass[];
  trainers: GymTrainer[];
  entryQueue: GymQueueEntry[];
  members: GymMember[];
  visits: GymVisit[];
  ptBookings: GymPtBooking[];
  campaigns: GymCampaign[];
  events: GymEvent[];
  historyStartedAt: number;
  revision: number;
  offerings: GymOffering[];
  memberships: GymMembership[];
  membershipClaims: GymMembershipClaim[];
  payments: GymPayment[];
};
export type GymReportCategory = "all" | GymEvent["category"];
export function campaignIsLive(c: GymCampaign, now = Date.now()) {
  return (
    c.status === "Active" &&
    Date.parse(c.startsAt) <= now &&
    Date.parse(c.endsAt) >= now
  );
}
export function campaignAnalytics(
  campaigns: GymCampaign[],
  events: GymEvent[],
  now = Date.now(),
) {
  const scans = events.filter(
    (e) => e.category === "campaigns" && e.action === "scan",
  );
  const actions = events.filter(
    (e) => e.category === "campaigns" && e.action === "action",
  );
  const reach = new Set(scans.map((e) => e.visitorId).filter(Boolean)).size;
  const converted = new Set(actions.map((e) => e.visitorId).filter(Boolean));
  const reachedAndConverted = new Set(
    scans.filter((e) => converted.has(e.visitorId)).map((e) => e.visitorId),
  ).size;
  return {
    active: campaigns.filter((c) => campaignIsLive(c, now)).length,
    scans: scans.length,
    actions: actions.length,
    reach,
    conversion: reach
      ? Math.round((reachedAndConverted / reach) * 1000) / 10
      : 0,
  };
}
export function filterGymEvents(
  events: GymEvent[],
  from: number,
  to: number,
  category: GymReportCategory = "all",
  campaignId = "",
) {
  return events.filter(
    (e) =>
      e.at >= from &&
      e.at <= to &&
      (category === "all" ||
        e.category === category ||
        (category === "occupancy" && e.category === "checkins") ||
        (category === "trainers" &&
          ["pt", "classes"].includes(e.category) &&
          ["In Progress", "Completed", "Cancelled"].includes(e.action))) &&
      (!campaignId || e.campaignId === campaignId),
  );
}
// Quote every cell and neutralize spreadsheet formulas in user-entered names/messages.
export function gymEventsCsv(events: GymEvent[]) {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return (
      '"' +
      (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""') +
      '"'
    );
  };
  const rows: unknown[][] = [
    [
      "Event ID",
      "Timestamp (UTC)",
      "Category",
      "Action",
      "Subject",
      "Recorded by",
      "Inside now",
      "Max capacity",
      "Available trainers",
      "Campaign ID",
      "Trainer",
      "Class enrollment",
      "Class capacity",
      "Session duration (minutes)",
    ],
  ];
  for (const e of events)
    rows.push([
      e.id,
      new Date(e.at).toISOString(),
      e.category,
      e.action,
      e.subject,
      e.actor,
      e.occupancy,
      e.capacity,
      e.availableTrainers,
      e.campaignId || "",
      e.trainer || "",
      e.enrolled ?? "",
      e.classCapacity ?? "",
      e.durationMinutes ?? "",
    ]);
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

// --- Membership + attendance analytics --------------------------------
// Centralized here (not duplicated per-component) so the Customer detail
// tile, the Owner Members list, and the retention/consistency resolver can
// never disagree about what "expiring soon" or "consistent" means.

export type MembershipDisplayStatus =
  | "active"
  | "expiring_soon"
  | "expires_today"
  | "expired";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 7;

/** Whole days remaining until (positive) or since (negative) expiryDate, from local midnight. */
export function daysRemaining(expiryDate: string, now = Date.now()): number {
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiryDate}T00:00:00`);
  return Math.round((+expiry - +todayMidnight) / DAY_MS);
}

export function membershipDisplayStatus(
  membership: Pick<GymMembership, "status" | "expiryDate">,
  now = Date.now(),
): MembershipDisplayStatus {
  if (membership.status !== "active") return "expired";
  const remaining = daysRemaining(membership.expiryDate, now);
  if (remaining < 0) return "expired";
  if (remaining === 0) return "expires_today";
  if (remaining <= EXPIRING_SOON_DAYS) return "expiring_soon";
  return "active";
}

/** The membership that currently represents this customer's relationship with
 * the gym: the active one with the furthest expiry, or \u2014 if none are active \u2014
 * the most recently expired one (so an expired member still sees "Renew"). */
export function currentMembershipFor(
  memberships: GymMembership[],
  customerId: string,
): GymMembership | undefined {
  const mine = memberships.filter((m) => m.customerId === customerId);
  const active = mine
    .filter((m) => m.status === "active")
    .sort((a, b) => b.expiryDate.localeCompare(a.expiryDate));
  if (active.length) return active[0];
  return mine.sort((a, b) => b.expiryDate.localeCompare(a.expiryDate))[0];
}

/** Lazily flips memberships whose expiry date has passed into "expired" \u2014 call
 * before reading membership status so an old row is never silently stale. */
export function reconcileExpiredMemberships(
  memberships: GymMembership[],
  now = Date.now(),
): boolean {
  let changed = false;
  for (const m of memberships) {
    if (m.status === "active" && daysRemaining(m.expiryDate, now) < 0) {
      m.status = "expired";
      changed = true;
    }
  }
  return changed;
}

const dayKey = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type MonthlyAttendance = {
  month: string; // yyyy-mm
  visits: number;
};

/** One row per calendar day a customer attended this gym, most recent visit
 * of that day only \u2014 the source for monthly counts, streaks and calendars. */
function attendedDays(visits: GymVisit[], customerId: string): string[] {
  const days = new Set(
    visits
      .filter((v) => v.customerId === customerId)
      .map((v) => dayKey(v.checkedInAt)),
  );
  return Array.from(days).sort();
}

export function monthlyAttendance(
  visits: GymVisit[],
  customerId: string,
): MonthlyAttendance[] {
  const counts = new Map<string, number>();
  for (const day of attendedDays(visits, customerId)) {
    const month = day.slice(0, 7);
    counts.set(month, (counts.get(month) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([month, count]) => ({ month, visits: count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function visitsInMonth(
  visits: GymVisit[],
  customerId: string,
  monthYm: string,
): number {
  return attendedDays(visits, customerId).filter((d) =>
    d.startsWith(monthYm),
  ).length;
}

/** Current streak = consecutive attended days ending today or yesterday (a
 * missed "today" doesn't break an in-progress streak until the day ends).
 * Best streak = longest run of consecutive attended days ever recorded. */
export function attendanceStreaks(
  visits: GymVisit[],
  customerId: string,
  now = Date.now(),
) {
  const days = attendedDays(visits, customerId);
  if (!days.length) return { current: 0, best: 0, lastVisit: undefined as number | undefined };
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(`${days[i - 1]}T00:00:00`);
    const cur = new Date(`${days[i]}T00:00:00`);
    if (+cur - +prev === DAY_MS) {
      run++;
    } else {
      best = Math.max(best, run);
      run = 1;
    }
  }
  best = Math.max(best, run);

  const today = dayKey(now);
  const yesterday = dayKey(now - DAY_MS);
  const lastDay = days[days.length - 1];
  let current = 0;
  if (lastDay === today || lastDay === yesterday) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      const cur = new Date(`${days[i]}T00:00:00`);
      const prev = new Date(`${days[i - 1]}T00:00:00`);
      if (+cur - +prev === DAY_MS) current++;
      else break;
    }
  }
  const lastVisitDays = visits.filter((v) => v.customerId === customerId);
  const lastVisit = lastVisitDays.length
    ? Math.max(...lastVisitDays.map((v) => v.checkedInAt))
    : undefined;
  return { current, best, lastVisit };
}

export function averageVisitsPerWeek(
  visits: GymVisit[],
  customerId: string,
  windowDays = 30,
  now = Date.now(),
): number {
  const since = now - windowDays * DAY_MS;
  const count = attendedDays(visits, customerId).filter(
    (d) => +new Date(`${d}T00:00:00`) >= since,
  ).length;
  return Math.round((count / (windowDays / 7)) * 10) / 10;
}

export type ConsistencyStatus =
  | "highly_consistent"
  | "regular"
  | "low_activity"
  | "at_risk";

/** Centralized consistency resolver \u2014 thresholds live in one place so they can
 * be tuned later without hunting through the dashboard for duplicated logic. */
export function resolveConsistency(
  visits: GymVisit[],
  customerId: string,
  now = Date.now(),
): { status: ConsistencyStatus; last30DayVisits: number; avgPerWeek: number } {
  const last30DayVisits = attendedDays(visits, customerId).filter(
    (d) => +new Date(`${d}T00:00:00`) >= now - 30 * DAY_MS,
  ).length;
  const avgPerWeek = averageVisitsPerWeek(visits, customerId, 30, now);
  const { lastVisit } = attendanceStreaks(visits, customerId, now);
  const daysSinceLastVisit = lastVisit
    ? Math.floor((now - lastVisit) / DAY_MS)
    : Infinity;

  let status: ConsistencyStatus;
  if (daysSinceLastVisit > 21 || last30DayVisits === 0) status = "at_risk";
  else if (avgPerWeek >= 3) status = "highly_consistent";
  else if (avgPerWeek >= 1) status = "regular";
  else status = "low_activity";

  return { status, last30DayVisits, avgPerWeek };
}

// --- Overview (Gym) — real-data-only derivation --------------------------
// Every function here reads straight off GymState (visits/payments/
// memberships/etc.) and nothing else: no placeholders, no synthetic trend
// lines. Kept as pure functions (rather than inline JSX) so the Overview
// numbers can be unit-tested without spinning up the dashboard component.

/** One row per customer that currently has a real membership relationship
 * with this gym — the same "current membership" rule used everywhere else
 * (`currentMembershipFor`), applied once here so every Overview stat agrees
 * with the Members list on who counts. */
export function currentMemberships(
  memberships: GymMembership[],
): GymMembership[] {
  return Array.from(new Set(memberships.map((m) => m.customerId)))
    .map((customerId) => currentMembershipFor(memberships, customerId))
    .filter((m): m is GymMembership => Boolean(m));
}

export type InsideNowSummary = { total: number; members: number; visitors: number };

/** Inside Now — real currently-active GymVisits only, split by purpose.
 * Deliberately independent of the manual `currentOccupancy` counter (a
 * legacy quick +/- control): Overview shows only what real visit rows say. */
export function overviewInsideNow(visits: GymVisit[]): InsideNowSummary {
  const inside = visits.filter((v) => !v.checkedOutAt);
  const members = inside.filter((v) => v.purpose === "member").length;
  return { total: inside.length, members, visitors: inside.length - members };
}

export type CheckinsTodaySummary = { today: number; yesterday?: number };

/** Real check-in event counts for today, with yesterday's count included
 * only when the recorded event history actually reaches back that far —
 * never a fabricated "0" or omitted comparison dressed up as data. */
export function overviewCheckinsToday(
  events: GymEvent[],
  historyStartedAt: number,
  now = Date.now(),
): CheckinsTodaySummary {
  const isCheckin = (e: GymEvent) => e.category === "checkins" && e.action === "checkin";
  const today = events.filter((e) => isCheckin(e) && dayKey(e.at) === dayKey(now)).length;
  const yesterdayAt = now - DAY_MS;
  const yesterdayStart = new Date(yesterdayAt);
  yesterdayStart.setHours(0, 0, 0, 0);
  if (historyStartedAt > +yesterdayStart) return { today };
  const yesterday = events.filter((e) => isCheckin(e) && dayKey(e.at) === dayKey(yesterdayAt)).length;
  return { today, yesterday };
}

export type CollectionSummary = { paidToday: number; cashPendingTotal: number };

/** Today's real collected amount (paid payments accepted today) kept
 * strictly separate from real pending cash — the two are never merged into
 * a single headline number. */
export function overviewCollectionToday(
  payments: GymPayment[],
  now = Date.now(),
): CollectionSummary {
  const today = dayKey(now);
  const paidToday = payments
    .filter((p) => p.status === "paid" && p.acceptedAt && dayKey(p.acceptedAt) === today)
    .reduce((sum, p) => sum + p.amountInr, 0);
  const cashPendingTotal = payments
    .filter((p) => p.status === "pending" && p.method === "cash")
    .reduce((sum, p) => sum + p.amountInr, 0);
  return { paidToday, cashPendingTotal };
}

/** Real memberships expiring within the next 7 days (or today) — same
 * threshold `membershipDisplayStatus` already uses for "expiring soon". */
export function overviewEndingSoonCount(
  memberships: GymMembership[],
  now = Date.now(),
): number {
  return currentMemberships(memberships).filter((m) => {
    const status = membershipDisplayStatus(m, now);
    return status === "expiring_soon" || status === "expires_today";
  }).length;
}

export type MembersSummary = {
  active: number;
  newThisMonth: number;
  expired: number;
  endingSoon: number;
};

export function overviewMembersSummary(
  memberships: GymMembership[],
  now = Date.now(),
): MembersSummary {
  const current = currentMemberships(memberships);
  const thisMonth = new Date(now).toISOString().slice(0, 7);
  let active = 0,
    newThisMonth = 0,
    expired = 0,
    endingSoon = 0;
  for (const m of current) {
    const status = membershipDisplayStatus(m, now);
    if (status === "expired") expired++;
    else {
      active++;
      if (status === "expiring_soon" || status === "expires_today") endingSoon++;
    }
    if (m.joinedDate.slice(0, 7) === thisMonth) newThisMonth++;
  }
  return { active, newThisMonth, expired, endingSoon };
}

export type MemberActivityBucket = "very_active" | "regular" | "not_visiting";
export type MemberActivitySummary = Record<MemberActivityBucket, number>;

/** Buckets real members into the same three plain-language groups shown on
 * Overview and Members — built directly on `resolveConsistency`, the one
 * consistency engine in this codebase, rather than a second copy of the
 * thresholds. `low_activity` and `at_risk` both read as "not visiting
 * recently" here; nothing here is ever labeled "retention". */
export function overviewMemberActivity(
  memberships: GymMembership[],
  visits: GymVisit[],
  now = Date.now(),
): MemberActivitySummary {
  const summary: MemberActivitySummary = { very_active: 0, regular: 0, not_visiting: 0 };
  for (const m of currentMemberships(memberships)) {
    const { status } = resolveConsistency(visits, m.customerId, now);
    if (status === "highly_consistent") summary.very_active++;
    else if (status === "regular") summary.regular++;
    else summary.not_visiting++;
  }
  return summary;
}

export type MonthActivitySummary = {
  visitsThisMonth: number;
  vsLastMonthPct?: number;
  bestDay?: string;
  busiestTime?: string;
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
// Enough real check-ins for a day-of-week / time-of-day breakdown to mean
// something, rather than one or two visits masquerading as a pattern.
const MIN_VISITS_FOR_PATTERN = 20;

function timeOfDayBucket(hour: number): string {
  if (hour < 6) return "Early morning (12–6am)";
  if (hour < 12) return "Morning (6am–12pm)";
  if (hour < 17) return "Afternoon (12–5pm)";
  if (hour < 21) return "Evening (5–9pm)";
  return "Night (9pm–12am)";
}

/** This month's real visit total, with a month-over-month percentage shown
 * only when recorded history actually reaches into last month, and a
 * best-day / busiest-time pattern shown only once there's enough real
 * history to compute one honestly. */
export function overviewMonthActivity(
  visits: GymVisit[],
  historyStartedAt: number,
  now = Date.now(),
): MonthActivitySummary {
  const monthKey = (t: number) => new Date(t).toISOString().slice(0, 7);
  const thisMonth = monthKey(now);
  const lastMonthAnchor = new Date(now);
  lastMonthAnchor.setDate(1);
  lastMonthAnchor.setMonth(lastMonthAnchor.getMonth() - 1);
  const lastMonth = monthKey(+lastMonthAnchor);
  const lastMonthStart = new Date(
    lastMonthAnchor.getFullYear(),
    lastMonthAnchor.getMonth(),
    1,
  ).getTime();

  const visitsThisMonth = visits.filter((v) => monthKey(v.checkedInAt) === thisMonth).length;
  const summary: MonthActivitySummary = { visitsThisMonth };

  if (historyStartedAt <= lastMonthStart) {
    const visitsLastMonth = visits.filter((v) => monthKey(v.checkedInAt) === lastMonth).length;
    if (visitsLastMonth > 0) {
      summary.vsLastMonthPct =
        Math.round(((visitsThisMonth - visitsLastMonth) / visitsLastMonth) * 1000) / 10;
    }
  }

  if (visits.length >= MIN_VISITS_FOR_PATTERN) {
    const dayCounts = new Map<string, number>();
    const timeCounts = new Map<string, number>();
    for (const v of visits) {
      const d = new Date(v.checkedInAt);
      const dayName = WEEKDAY_NAMES[d.getDay()];
      dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
      const bucket = timeOfDayBucket(d.getHours());
      timeCounts.set(bucket, (timeCounts.get(bucket) || 0) + 1);
    }
    summary.bestDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    summary.busiestTime = [...timeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  return summary;
}

export type NeedsAttentionTarget =
  | "live_floor_payments"
  | "members"
  | "members_expiring"
  | "members_not_visiting"
  | "live_floor_waiting";

export type NeedsAttentionItem = {
  id: string;
  label: string;
  target: NeedsAttentionTarget;
  count: number;
};

/** Compact "Needs Attention" list — every item is generated only when the
 * underlying real count is greater than zero; nothing is fabricated just to
 * have content, and an empty result means the caller should render
 * "Everything looks good" instead. */
export function overviewNeedsAttention(
  state: Pick<
    GymState,
    "payments" | "membershipClaims" | "memberships" | "visits" | "entryQueue"
  >,
  now = Date.now(),
): NeedsAttentionItem[] {
  const items: NeedsAttentionItem[] = [];
  const cashPending = state.payments.filter(
    (p) => p.status === "pending" && p.method === "cash",
  ).length;
  if (cashPending > 0)
    items.push({
      id: "cash_pending",
      label: `${cashPending} cash payment${cashPending === 1 ? "" : "s"} waiting`,
      target: "live_floor_payments",
      count: cashPending,
    });

  const approvalsWaiting = state.membershipClaims.filter((c) => c.status === "pending").length;
  if (approvalsWaiting > 0)
    items.push({
      id: "approvals_waiting",
      label: `${approvalsWaiting} membership approval${approvalsWaiting === 1 ? "" : "s"} waiting`,
      target: "members",
      count: approvalsWaiting,
    });

  const endingSoon = overviewEndingSoonCount(state.memberships, now);
  if (endingSoon > 0)
    items.push({
      id: "ending_soon",
      label: `${endingSoon} membership${endingSoon === 1 ? "" : "s"} ending this week`,
      target: "members_expiring",
      count: endingSoon,
    });

  const notVisiting = overviewMemberActivity(state.memberships, state.visits, now).not_visiting;
  if (notVisiting > 0)
    items.push({
      id: "not_visiting",
      label: `${notVisiting} member${notVisiting === 1 ? "" : "s"} not visiting recently`,
      target: "members_not_visiting",
      count: notVisiting,
    });

  const waiting = state.entryQueue.filter((q) => q.status === "Waiting").length;
  if (waiting > 0)
    items.push({
      id: "waiting_entry",
      label: `${waiting} ${waiting === 1 ? "person" : "people"} waiting for entry`,
      target: "live_floor_waiting",
      count: waiting,
    });

  return items;
}
