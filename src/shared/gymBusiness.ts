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
};
export type GymQueueEntry = {
  id: string;
  name: string;
  memberId?: string;
  arrivedAt: number;
  status: string;
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
