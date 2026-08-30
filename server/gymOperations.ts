import express from "express";
import { randomUUID } from "node:crypto";
import {
  campaignIsLive,
  filterGymEvents,
  gymEventsCsv,
  gymMemberReportCsv,
  gymMemberReportRows,
  reconcileExpiredMemberships,
  unclaimedCustomerId,
  isUnclaimedCustomerId,
  daysRemaining,
  type GymState,
  type GymEvent,
  type GymCampaign,
  type GymOffering,
  type GymMembership,
  type GymPayment,
} from "../src/shared/gymBusiness.ts";
import { normalizePhone } from "../src/shared/phone.ts";
import { CUSTOM_ENTRY_OFFERING_ID } from "../src/shared/gymLiveFloor.ts";
import { qrSvgDataUrl } from "./qrRendering.ts";

type Session = {
  businessId: string;
  mainCategoryId: string;
  role: string;
  staffId: string;
  name: string;
};
type Dependencies = {
  get: (id: string) => GymState;
  save: (id: string, state: GymState) => void;
  session: (req: express.Request) => Session | undefined;
  active: (id: string) => boolean;
  trainerAccounts: (id: string) => { id: string; name: string }[];
  flush: () => Promise<unknown>;
  /** customerId -> URL a Gym staff session can load that customer's existing
   * profile photo from. Resolved at serve time only and never written into
   * GymState: GymVisit stores no image data, just the customerId link. */
  customerPhotos?: (gymId: string, customerIds: string[]) => Map<string, string>;
  /** Resolve a normalized 10-digit mobile number to an already-verified
   * customer_account id, if one exists. Lets a staff-created membership
   * attach directly to the real customer identity the moment staff types a
   * phone number that already belongs to a verified account, instead of
   * always falling back to a synthetic walk-in id. Independent of whatever
   * OTP provider verified that phone. */
  resolveCustomerIdByPhone: (normalizedPhone: string) => string | undefined;
};
const operators = ["owner", "manager", "staff", "reception"];
const managers = ["owner", "manager"];
export function normalizeGymState(
  raw: Partial<GymState>,
  gymId: string,
): GymState {
  return {
    gymId,
    maxCapacity: 80,
    currentOccupancy: 0,
    waitingOutsideCount: 0,
    checkinsTodayCount: 0,
    classesToday: [],
    trainers: [],
    entryQueue: [],
    ...raw,
    availableTrainersCount:
      raw.availableTrainersCount ??
      (raw.trainers || []).filter((t) => t.status === "Available").length,
    members: raw.members || [],
    visits: raw.visits || [],
    ptBookings: raw.ptBookings || [],
    campaigns: raw.campaigns || [],
    events: raw.events || [],
    historyStartedAt: raw.historyStartedAt || Date.now(),
    revision: raw.revision || 0,
    offerings: raw.offerings || [],
    memberships: raw.memberships || [],
    membershipClaims: raw.membershipClaims || [],
    payments: raw.payments || [],
  };
}
export function gymEvent(
  state: GymState,
  category: GymEvent["category"],
  action: string,
  subject: string,
  actor: string,
  extra: Partial<GymEvent> = {},
) {
  state.events.push({
    id: randomUUID(),
    at: Date.now(),
    category,
    action,
    subject,
    actor,
    occupancy: state.currentOccupancy,
    capacity: state.maxCapacity,
    availableTrainers: state.availableTrainersCount,
    ...extra,
  });
}
export function publicGymState(state: GymState) {
  // Keep the legacy public contract, never expose the new member/visit/campaign audit records.
  const activeVisits = state.visits.filter((v) => !v.checkedOutAt);
  return {
    gymId: state.gymId,
    currentOccupancy: state.currentOccupancy,
    maxCapacity: state.maxCapacity,
    availableTrainersCount: state.availableTrainersCount,
    waitingOutsideCount: state.entryQueue.filter((q) => q.status === "Waiting")
      .length,
    checkinsTodayCount: state.checkinsTodayCount,
    classesToday: state.classesToday,
    trainers: state.trainers.map(
      ({ staffId: _staffId, ...trainer }) => trainer,
    ),
    entryQueue: [],
    // Inside Now = real active Visits, broken down by purpose. Offerings are
    // public so the Customer Gym page can render "Choose Access" without a
    // second, duplicated plan list.
    insideMembersCount: activeVisits.filter((v) => v.purpose === "member")
      .length,
    insideVisitorsCount: activeVisits.filter((v) => v.purpose !== "member")
      .length,
    // `recommended` rides along untouched so the customer Access/Upgrade
    // sheets read the owner's real toggle. No client-side substitute exists:
    // if nothing here is flagged, the sheet shows no Recommended section.
    offerings: state.offerings.filter((o) => o.active && o.customerVisible),
  };
}
/** Inside Now is always the count of real active Visits — never a hand-edited
 * counter. Manual corrections (the +/- quick actions) work by creating or
 * closing a staff-attributed Visit, so they flow through this same recompute
 * instead of a parallel source of truth. */
export function recomputeOccupancy(state: GymState) {
  state.currentOccupancy = state.visits.filter((v) => !v.checkedOutAt).length;
}
function requireText(value: unknown, label: string, max = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`${label} is required (maximum ${max} characters).`);
  return value.trim();
}
function integer(value: unknown, label: string, min = 0, max = 100000) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
function date(value: unknown, label: string) {
  const text = requireText(value, label, 40);
  if (!Number.isFinite(Date.parse(text)))
    throw new Error(`${label} is invalid.`);
  return new Date(text).toISOString();
}
function choice(value: unknown, choices: string[], label: string) {
  if (!choices.includes(String(value))) throw new Error(`Invalid ${label}.`);
  return String(value);
}
/** yyyy-mm-dd + a duration -> the resulting yyyy-mm-dd expiry date. */
function addDuration(
  startDate: string,
  value: number,
  unit: "day" | "week" | "month" | "quarter" | "year" | "session",
): string {
  const d = new Date(`${startDate}T00:00:00`);
  if (unit === "day") d.setDate(d.getDate() + value);
  else if (unit === "week") d.setDate(d.getDate() + value * 7);
  else if (unit === "month") d.setMonth(d.getMonth() + value);
  else if (unit === "quarter") d.setMonth(d.getMonth() + value * 3);
  else if (unit === "year") d.setFullYear(d.getFullYear() + value);
  else d.setDate(d.getDate() + 1); // "session"-based offerings still need a nominal access window
  return d.toISOString().slice(0, 10);
}
/** Server-enforced single-active-visit rule (never merely hidden in the UI):
 * one authenticated customer can hold at most one open GymVisit per gym at a
 * time. Every path that could open a second one — staff Add Visitor, Custom
 * Entry, Accept Payment / Confirm Check-In, queue admit, QR scan — routes
 * through this. Checking out clears it, so buying another pass afterwards is
 * allowed again. */
export function assertNoOpenVisit(s: GymState, customerId: string) {
  if (s.visits.some((v) => v.customerId === customerId && !v.checkedOutAt))
    throw new Error(
      "This customer already has an open visit at this gym. Check them out first, or use Upgrade.",
    );
}
/** Finds this person's currently-active membership at THIS gym only — never
 * across gyms, and never by name. Matched by the real customerId once a
 * phone resolves to a verified account; otherwise by the same normalized
 * mobile number on a still-unclaimed (staff-created) membership row. An
 * expired membership never matches (reconcileExpiredMemberships already
 * flips status before this runs via commit()), so Add Visitor always offers
 * Add as Visitor / Renew / Sell Access for an expired member instead of
 * treating them as active. */
function findActiveMembershipForIdentity(
  s: GymState,
  customerId: string | undefined,
  normalizedMobile: string,
): GymMembership | undefined {
  return s.memberships.find((m) => {
    if (m.status !== "active") return false;
    if (customerId) return m.customerId === customerId;
    return (
      normalizedMobile.length === 10 &&
      m.customerMobileNormalized === normalizedMobile &&
      isUnclaimedCustomerId(m.customerId)
    );
  });
}
/** The confirmation payload Add Visitor returns instead of creating a
 * duplicate visitor/membership when this phone already has an active
 * membership here — the owner must explicitly confirm "Check in as Member"
 * (or Cancel) before anything is created. */
function existingMemberConfirmation(s: GymState, membership: GymMembership) {
  return {
    ok: true as const,
    requiresConfirmation: true as const,
    // Matched by membershipId, not customerId: an unclaimed (pre-verification)
    // membership's own visits never carry a customerId (there is no real
    // account to attach one to yet), so membershipId is the only identity
    // link guaranteed to be set on both claimed and unclaimed members.
    alreadyCheckedIn: s.visits.some(
      (v) => v.membershipId === membership.id && !v.checkedOutAt,
    ),
    existingMember: {
      membershipId: membership.id,
      customerId: membership.customerId,
      name: membership.customerName,
      planName: membership.planName,
      expiryDate: membership.expiryDate,
      daysRemaining: daysRemaining(membership.expiryDate),
      sessionsTotal: membership.sessionsTotal,
      sessionsRemaining:
        membership.sessionsTotal === undefined
          ? undefined
          : Math.max(membership.sessionsTotal - (membership.sessionsUsed || 0), 0),
    },
  };
}
/** Usage-bound plans only (offering.durationUnit === "session"): consumes
 * exactly one session on a successful NEW physical check-in. Never called
 * for a queue "join" — only once the visit actually opens (direct check-in,
 * confirm_checkin, queue admit, or confirm_member_checkin) — so a duplicate
 * or still-open visit can never consume twice. Date-based memberships have
 * no sessionsTotal and are left untouched: attendance only, expiry unchanged. */
function recordSessionUsage(s: GymState, membershipId: string | undefined) {
  if (!membershipId) return;
  const membership = s.memberships.find((m) => m.id === membershipId);
  if (!membership || membership.sessionsTotal === undefined) return;
  membership.sessionsUsed = (membership.sessionsUsed || 0) + 1;
  membership.updatedAt = Date.now();
  if (membership.sessionsUsed >= membership.sessionsTotal)
    membership.status = "expired";
}
function find<T extends { id: string }>(
  items: T[],
  id: unknown,
  label: string,
) {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`${label} not found.`);
  return item;
}
function syncAvailability(state: GymState) {
  state.availableTrainersCount = state.trainers.filter(
    (t) => t.status === "Available",
  ).length;
}
function overlaps(
  start: string,
  duration: number,
  otherStart: string,
  otherDuration: number,
) {
  return (
    Date.parse(start) < Date.parse(otherStart) + otherDuration * 60000 &&
    Date.parse(otherStart) < Date.parse(start) + duration * 60000
  );
}
function checkTrainerSlot(
  s: GymState,
  trainerId: string,
  startsAt: string,
  duration: number,
  except = "",
) {
  if (
    s.ptBookings.some(
      (p) =>
        p.id !== except &&
        p.trainerId === trainerId &&
        !["Cancelled", "Completed"].includes(p.status) &&
        overlaps(startsAt, duration, p.startsAt, p.durationMinutes),
    ) ||
    s.classesToday.some(
      (c) =>
        c.id !== except &&
        c.trainerId === trainerId &&
        c.startsAt &&
        !["Cancelled", "Completed"].includes(c.status || "") &&
        overlaps(startsAt, duration, c.startsAt, c.durationMinutes || 60),
    )
  )
    throw new Error(
      "Trainer already has a class or PT booking in this time window.",
    );
}
export function mountGymOperations(app: express.Express, deps: Dependencies) {
  // Serializes read/modify/save/flush across the Gym endpoints on this server.
  let pending: Promise<unknown> = Promise.resolve();
  const serial = (fn: () => Promise<void>) => {
    const next = pending.then(fn);
    pending = next.catch(() => {});
    return next;
  };
  const route = (
    method: "get" | "post" | "put",
    path: string,
    roles: string[],
    work: (
      req: express.Request,
      res: express.Response,
      s: GymState,
      session: Session,
    ) => void | Promise<void>,
  ) => {
    app[method](`/api/gym/:gymId/${path}`, (req, res) => {
      void serial(async () => {
        res.set("Cache-Control", "no-store");
        const session = deps.session(req);
        const id = String(req.params.gymId);
        if (
          !session ||
          session.businessId !== id ||
          session.mainCategoryId !== "gym"
        ) {
          res.status(403).json({
            error: "Valid Gym staff session required for this business.",
          });
          return;
        }
        if (roles.length && !roles.includes(session.role)) {
          res
            .status(403)
            .json({ error: "Your role cannot perform this action." });
          return;
        }
        if (method !== "get" && !deps.active(id)) {
          res.status(403).json({ error: "Business deactivated." });
          return;
        }
        try {
          await work(req, res, deps.get(id), session);
        } catch (error) {
          if (!res.headersSent)
            res.status(400).json({
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to complete operation.",
            });
        }
      }).catch(() => {
        if (!res.headersSent)
          res
            .status(503)
            .json({ error: "Gym storage unavailable. Please retry." });
      });
    });
  };
  const commit = async (res: express.Response, s: GymState) => {
    s.revision++;
    s.waitingOutsideCount = s.entryQueue.filter(
      (q) => q.status === "Waiting",
    ).length;
    const today = new Date().toISOString().slice(0, 10);
    s.checkinsTodayCount = s.events.filter(
      (e) =>
        e.category === "checkins" &&
        e.action === "checkin" &&
        new Date(e.at).toISOString().startsWith(today),
    ).length;
    recomputeOccupancy(s);
    reconcileExpiredMemberships(s.memberships);
    deps.save(s.gymId, s);
    try {
      await deps.flush();
    } catch {
      res.status(503).json({
        error:
          "Saved locally, but durable storage sync failed. Refresh before retrying this action.",
      });
      return;
    }
    res.json({ ok: true, state: s });
  };
  route("get", "overview", [], (_req, res, s, session) => {
    const today = new Date().toISOString().slice(0, 10);
    s.checkinsTodayCount = s.events.filter(
      (e) =>
        e.category === "checkins" &&
        e.action === "checkin" &&
        new Date(e.at).toISOString().startsWith(today),
    ).length;
    s.waitingOutsideCount = s.entryQueue.filter(
      (q) => q.status === "Waiting",
    ).length;
    // Trainer accounts cannot read member contact details, campaigns or owner reports.
    if (session.role === "trainer") {
      s.members = [];
      s.visits = [];
      s.entryQueue = [];
      s.campaigns = [];
      s.events = [];
      s.ptBookings = s.ptBookings.filter(
        (p) =>
          s.trainers.find((t) => t.id === p.trainerId)?.staffId ===
          session.staffId,
      );
    } else if (session.role !== "owner") {
      s.campaigns = [];
      s.events = s.events.filter((e) => e.category !== "campaigns");
    }
    // Profile photos are attached to the response only — never persisted into
    // GymState — so a customer changing their photo is reflected on the next
    // poll and no image data is ever duplicated into a GymVisit row. Only the
    // photo URL crosses over; no other private profile field does.
    const linkedCustomerIds = [
      ...new Set(
        [...s.visits, ...s.memberships]
          .map((row) => row.customerId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const photos = linkedCustomerIds.length
      ? deps.customerPhotos?.(s.gymId, linkedCustomerIds)
      : undefined;
    const payload =
      photos && photos.size
        ? {
            ...s,
            visits: s.visits.map((v) =>
              v.customerId && photos.has(v.customerId)
                ? { ...v, customerPhotoUrl: photos.get(v.customerId) }
                : v,
            ),
            memberships: s.memberships.map((membership) =>
              photos.has(membership.customerId)
                ? {
                    ...membership,
                    customerPhotoUrl: photos.get(membership.customerId),
                  }
                : membership,
            ),
          }
        : s;
    res.set("Cache-Control", "no-store").json(payload);
  });
  for (const action of ["checkin", "checkout"] as const)
    route("post", action, operators, async (req, res, s, session) => {
      if (action === "checkin") {
        if (s.currentOccupancy >= s.maxCapacity)
          throw new Error(
            "Gym is at maximum capacity. Add this visitor to the entry queue.",
          );
        const member = req.body.memberId
          ? find(s.members, req.body.memberId, "Member")
          : undefined;
        if (member?.status === "Paused")
          throw new Error("Membership is paused.");
        if (
          member &&
          s.visits.some((v) => v.memberId === member.id && !v.checkedOutAt)
        )
          throw new Error("Member is already checked in.");
        if (
          member &&
          s.entryQueue.some(
            (q) => q.memberId === member.id && q.status === "Waiting",
          )
        )
          throw new Error(
            "This member is waiting. Admit them from the entry queue.",
          );
        const name =
          member?.name ||
          (req.body.name ? requireText(req.body.name, "Name") : "Walk-in");
        s.currentOccupancy++;
        s.visits.unshift({
          id: randomUUID(),
          memberId: member?.id,
          name,
          checkedInAt: Date.now(),
        });
        gymEvent(s, "checkins", action, name, session.name);
      } else {
        if (!s.currentOccupancy) throw new Error("No visitors are inside.");
        const visit = req.body.visitId
          ? find(s.visits, req.body.visitId, "Visit")
          : s.currentOccupancy <= s.visits.filter((v) => !v.checkedOutAt).length
            ? s.visits.find(
                (v) => !v.checkedOutAt && !v.memberId && v.name === "Walk-in",
              )
            : undefined;
        if (visit?.checkedOutAt)
          throw new Error("This visit is already checked out.");
        const trackedInside = s.visits.filter((v) => !v.checkedOutAt).length;
        if (!visit && s.currentOccupancy <= trackedInside)
          throw new Error("Select a checked-in visitor to check out.");
        if (visit) {
          visit.checkedOutAt = Date.now();
          visit.checkedOutBy = session.name;
          visit.checkoutSource = "staff";
        }
        s.currentOccupancy--;
        gymEvent(
          s,
          "checkins",
          action,
          visit?.name || "Untracked visitor",
          session.name,
        );
      }
      await commit(res, s);
    });
  const core = async (
    req: express.Request,
    res: express.Response,
    s: GymState,
    session: Session,
  ) => {
    // Inside Now is derived from real active Visits (see recomputeOccupancy)
    // and is never settable here directly — the +/- quick actions and "Add
    // Visitor" create/close an actual Visit instead, so every correction to
    // the live count carries a timestamp and staff attribution.
    const b = req.body;
    const capacity =
      b.maxCapacity === undefined
        ? s.maxCapacity
        : integer(b.maxCapacity, "Capacity", 1);
    const trackedInside = s.visits.filter((v) => !v.checkedOutAt).length;
    if (trackedInside > capacity)
      throw new Error(
        "Check out visitors before reducing capacity below the current inside count.",
      );
    // currentOccupancy is accepted only for validation compatibility — the
    // real value always comes from recomputeOccupancy() in commit(), never
    // from this field, so a manual number here can never drift from the
    // actual set of active Visits.
    if (b.currentOccupancy !== undefined) {
      const occupancy = integer(b.currentOccupancy, "Inside now");
      if (occupancy > capacity) throw new Error("Occupancy cannot exceed capacity.");
      if (occupancy < trackedInside)
        throw new Error(
          "Check out visitors before reducing the inside count below the current tracked total.",
        );
    }
    s.maxCapacity = capacity;
    if (b.availableTrainersCount !== undefined)
      s.availableTrainersCount = integer(
        b.availableTrainersCount,
        "Available trainers",
        0,
        10000,
      );
    gymEvent(
      s,
      "occupancy",
      "adjustment",
      b.availableTrainersCount !== undefined
        ? "Core state updated (manual trainer count)"
        : "Capacity / inside count updated",
      session.name,
    );
    await commit(res, s);
  };
  route("put", "core-state", managers, core);
  route("post", "settings", managers, core);
  route("get", "trainer-accounts", managers, (_req, res, s) => {
    res.json(deps.trainerAccounts(s.gymId));
  });
  route("post", "trainer-status", managers, async (req, res, s, session) => {
    const trainer = find(s.trainers, req.body.trainerId, "Trainer");
    trainer.status = choice(
      req.body.status,
      ["Available", "In Session", "On Break", "Off Duty"],
      "trainer status",
    );
    if (
      trainer.status !== "In Session" &&
      (s.ptBookings.some(
        (p) => p.trainerId === trainer.id && p.status === "In Progress",
      ) ||
        s.classesToday.some(
          (c) => c.trainerId === trainer.id && c.status === "In Progress",
        ))
    )
      throw new Error(
        "Complete the active session before changing trainer availability.",
      );
    syncAvailability(s);
    gymEvent(s, "trainers", trainer.status, trainer.name, session.name);
    await commit(res, s);
  });
  route(
    "post",
    "operations/:kind",
    ["owner", "manager", "staff", "reception"],
    async (req, res, s, session) => {
      // commit() also reconciles expiry, but that runs at the very end —
      // too late for the existing-active-member checks below, which must
      // never mistake a calendar-expired membership for active just because
      // reconciliation hasn't run yet this request.
      reconcileExpiredMemberships(s.memberships);
      const b = req.body;
      const kind = String(req.params.kind);
      if (
        ["trainers", "classes", "pt"].includes(kind) &&
        !managers.includes(session.role) &&
        !(kind === "pt" && session.role === "reception")
      ) {
        res.status(403).json({ error: "Your role cannot manage this module." });
        return;
      }
      if (kind === "members") {
        const existing = b.id ? find(s.members, b.id, "Member") : undefined;
        const member = {
          id: existing?.id || randomUUID(),
          name: requireText(b.name, "Member name"),
          phone: typeof b.phone === "string" ? b.phone.trim().slice(0, 40) : "",
          membership: requireText(b.membership, "Membership", 80),
          status: choice(
            b.status,
            ["Active", "Paused"],
            "membership status",
          ) as "Active" | "Paused",
          createdAt: existing?.createdAt || Date.now(),
        };
        if (existing) Object.assign(existing, member);
        else s.members.unshift(member);
        gymEvent(
          s,
          "members",
          existing ? "updated" : "created",
          member.name,
          session.name,
        );
      } else if (kind === "queue") {
        if (b.action === "add") {
          const member = b.memberId
            ? find(s.members, b.memberId, "Member")
            : undefined;
          if (
            member &&
            (s.entryQueue.some(
              (q) => q.memberId === member.id && q.status === "Waiting",
            ) ||
              s.visits.some((v) => v.memberId === member.id && !v.checkedOutAt))
          )
            throw new Error("Member is already waiting or inside.");
          const name = member?.name || requireText(b.name, "Visitor name");
          s.entryQueue.push({
            id: randomUUID(),
            name,
            memberId: member?.id,
            arrivedAt: Date.now(),
            status: "Waiting",
          });
          gymEvent(s, "queue", "joined", name, session.name);
        } else {
          const q = find(s.entryQueue, b.id, "Queue entry");
          if (q.status !== "Waiting")
            throw new Error("Queue entry has already been processed.");
          choice(b.action, ["admit", "remove"], "queue action");
          if (b.action === "admit") {
            if (
              q.memberId &&
              s.visits.some((v) => v.memberId === q.memberId && !v.checkedOutAt)
            )
              throw new Error("Member is already inside.");
            if (s.currentOccupancy >= s.maxCapacity)
              throw new Error("Gym is at maximum capacity.");
            if (
              q.memberId &&
              s.members.find((m) => m.id === q.memberId)?.status === "Paused"
            )
              throw new Error("Membership is paused.");
            if (q.customerId) assertNoOpenVisit(s, q.customerId);
            s.currentOccupancy++;
            const admittedVisit = {
              id: randomUUID(),
              name: q.name,
              memberId: q.memberId,
              checkedInAt: Date.now(),
              customerId: q.customerId,
              mobile: q.mobile,
              offeringId: q.offeringId,
              membershipId: q.membershipId,
              paymentId: q.paymentId,
              purpose: q.purpose,
              entryMethod: q.entryMethod,
              customEntry: q.customEntry,
              checkedInBy: session.name,
            };
            s.visits.unshift(admittedVisit);
            // Entries created by the capacity-full Add Visitor / Accept
            // Payment fallback already have a paid payment — link it to the
            // visit it was actually waiting for, same as the direct path.
            if (q.paymentId) {
              const linked = s.payments.find((p) => p.id === q.paymentId);
              if (linked) linked.visitId = admittedVisit.id;
            }
            recordSessionUsage(s, admittedVisit.membershipId);
            gymEvent(s, "checkins", "checkin", q.name, session.name);
          }
          q.status = b.action === "admit" ? "Admitted" : "Removed";
          gymEvent(s, "queue", q.status, q.name, session.name);
        }
      } else if (kind === "trainers") {
        const existing = b.id ? find(s.trainers, b.id, "Trainer") : undefined;
        if (
          b.staffId &&
          !deps.trainerAccounts(s.gymId).some((a) => a.id === b.staffId)
        )
          throw new Error("Choose a trainer account from this business.");
        if (
          b.staffId &&
          s.trainers.some(
            (t) => t.id !== existing?.id && t.staffId === b.staffId,
          )
        )
          throw new Error("This staff account is already linked to a trainer.");
        const trainer = {
          id: existing?.id || randomUUID(),
          name: requireText(b.name, "Trainer name"),
          role: requireText(b.role, "Specialty"),
          status: existing?.status || "Available",
          staffId:
            typeof b.staffId === "string"
              ? b.staffId || undefined
              : existing?.staffId,
        };
        if (existing) Object.assign(existing, trainer);
        else s.trainers.push(trainer);
        syncAvailability(s);
        gymEvent(
          s,
          "trainers",
          existing ? "updated" : "created",
          trainer.name,
          session.name,
        );
      } else if (kind === "classes" || kind === "pt") {
        const isClass = kind === "classes";
        const items: (
          | GymState["classesToday"][number]
          | GymState["ptBookings"][number]
        )[] = isClass ? s.classesToday : s.ptBookings;
        const existing = b.id
          ? find(items, b.id, isClass ? "Class" : "PT booking")
          : undefined;
        if (b.action === "status") {
          if (!existing) throw new Error("Booking is required.");
          const status = choice(
            b.status,
            ["In Progress", "Completed", "Cancelled"],
            "session status",
          );
          if (["Completed", "Cancelled"].includes(existing.status || ""))
            throw new Error("This session is already closed.");
          if (status === "Completed" && existing.status !== "In Progress")
            throw new Error("Start the session before completing it.");
          const trainer = s.trainers.find((t) => t.id === existing.trainerId);
          if (status === "In Progress") {
            if (!existing.startsAt)
              throw new Error(
                "Schedule this legacy session before starting it.",
              );
            if (existing.status === "In Progress")
              throw new Error("Session is already in progress.");
            if (!trainer || trainer.status !== "Available")
              throw new Error("Trainer must be available to start a session.");
            trainer.status = "In Session";
          } else if (trainer && existing.status === "In Progress")
            trainer.status = "Available";
          existing.status = status;
          syncAvailability(s);
          gymEvent(
            s,
            isClass ? "classes" : "pt",
            status,
            "title" in existing ? existing.title : existing.clientName,
            session.name,
            {
              trainer: existing.trainer,
              durationMinutes: existing.durationMinutes,
              ...("enrolled" in existing
                ? {
                    enrolled: existing.enrolled,
                    classCapacity: existing.maxCapacity,
                  }
                : {}),
            },
          );
        } else {
          if (
            existing &&
            ["In Progress", "Completed", "Cancelled"].includes(
              existing.status || "",
            )
          )
            throw new Error("Only upcoming sessions can be edited.");
          const trainer = find(s.trainers, b.trainerId, "Trainer");
          const startsAt = date(b.startsAt, "Start time");
          const durationMinutes = integer(
            b.durationMinutes,
            "Duration",
            15,
            480,
          );
          checkTrainerSlot(
            s,
            trainer.id,
            startsAt,
            durationMinutes,
            existing?.id,
          );
          const common = {
            id: existing?.id || randomUUID(),
            trainerId: trainer.id,
            trainer: trainer.name,
            startsAt,
            time: startsAt,
            durationMinutes,
            status: "Scheduled",
          };
          if (isClass) {
            const enrolled = integer(b.enrolled ?? 0, "Enrolled");
            const maxCapacity = integer(b.maxCapacity, "Class capacity", 1);
            if (enrolled > maxCapacity)
              throw new Error("Enrollment exceeds class capacity.");
            const row = {
              ...common,
              title: requireText(b.title, "Class title"),
              enrolled,
              maxCapacity,
            };
            if (existing) Object.assign(existing, row);
            else s.classesToday.push(row);
            gymEvent(
              s,
              "classes",
              existing ? "updated" : "scheduled",
              row.title,
              session.name,
              {
                trainer: row.trainer,
                enrolled: row.enrolled,
                classCapacity: row.maxCapacity,
                durationMinutes,
              },
            );
          } else {
            const row = {
              ...common,
              clientName: requireText(b.clientName, "Client name"),
              service: requireText(b.service, "Session type"),
              createdAt:
                existing && "createdAt" in existing
                  ? existing.createdAt
                  : Date.now(),
            };
            if (existing) Object.assign(existing, row);
            else s.ptBookings.push(row);
            gymEvent(
              s,
              "pt",
              existing ? "updated" : "booked",
              row.clientName,
              session.name,
              { trainer: row.trainer, durationMinutes },
            );
          }
        }
      } else if (kind === "offerings") {
        if (!managers.includes(session.role)) {
          res
            .status(403)
            .json({ error: "Your role cannot manage Plans & Services." });
          return;
        }
        const existing = b.id ? find(s.offerings, b.id, "Offering") : undefined;
        const paymentOptions = (
          Array.isArray(b.paymentOptions) ? b.paymentOptions : ["online", "cash"]
        ).filter((o: unknown) => o === "online" || o === "cash");
        const offering: GymOffering = {
          id: existing?.id || randomUUID(),
          name: requireText(b.name, "Offering name", 80),
          type: choice(
            b.type,
            ["visitor_pass", "membership", "pt", "class_package", "custom"],
            "offering type",
          ) as GymOffering["type"],
          priceInr: integer(b.priceInr, "Price", 0, 1000000),
          durationValue: integer(b.durationValue, "Duration", 1, 3650),
          durationUnit: choice(
            b.durationUnit,
            ["day", "week", "month", "quarter", "year", "session"],
            "duration unit",
          ) as GymOffering["durationUnit"],
          description:
            typeof b.description === "string"
              ? b.description.trim().slice(0, 2000)
              : "",
          active: b.active === undefined ? true : Boolean(b.active),
          customerVisible:
            b.customerVisible === undefined ? true : Boolean(b.customerVisible),
          paymentOptions: paymentOptions.length ? paymentOptions : ["cash"],
          // Owner-only "Recommend this plan" toggle. Scoped to this gym's own
          // state record (the route already proved the session owns this
          // business), so it can never leak across businesses. Absent in the
          // body -> keep whatever the existing row had, rather than silently
          // clearing a recommendation on an unrelated edit.
          recommended:
            b.recommended === undefined
              ? existing?.recommended === true
              : Boolean(b.recommended),
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
        if (existing) Object.assign(existing, offering);
        else s.offerings.unshift(offering);
        gymEvent(
          s,
          "members",
          existing ? "offering_updated" : "offering_created",
          offering.name,
          session.name,
        );
      } else if (kind === "membership_claims") {
        if (!managers.includes(session.role)) {
          res
            .status(403)
            .json({ error: "Your role cannot review membership claims." });
          return;
        }
        const claim = find(s.membershipClaims, b.id, "Membership claim");
        if (claim.status !== "pending")
          throw new Error("This claim has already been reviewed.");
        const decision = choice(b.action, ["approve", "reject"], "decision");
        claim.reviewedBy = session.name;
        claim.reviewedAt = Date.now();
        if (decision === "reject") {
          claim.status = "rejected";
          gymEvent(s, "members", "claim_rejected", claim.name, session.name);
        } else {
          const name =
            typeof b.name === "string" && b.name.trim()
              ? requireText(b.name, "Name")
              : claim.name;
          const joinedDate = b.joiningDate
            ? date(b.joiningDate, "Joining date").slice(0, 10)
            : claim.joiningDate;
          const expiryDate = b.expiryDate
            ? date(b.expiryDate, "Expiry date").slice(0, 10)
            : claim.expiryDate;
          const normalizedMobile = normalizePhone(claim.mobile);
          // The same person may already exist here as an unclaimed,
          // staff-created membership (Add Visitor, before this customer had
          // an account) with the same mobile number. Re-point that row at
          // the real customerId instead of minting a second membership —
          // preserves its original joinedDate/payment/visit history rather
          // than orphaning it next to a fresh duplicate.
          const existingUnclaimed = normalizedMobile
            ? s.memberships.find(
                (m) =>
                  isUnclaimedCustomerId(m.customerId) &&
                  m.customerMobileNormalized === normalizedMobile,
              )
            : undefined;
          let membershipId: string;
          if (existingUnclaimed) {
            existingUnclaimed.customerId = claim.customerId;
            existingUnclaimed.customerName = name;
            existingUnclaimed.updatedAt = Date.now();
            membershipId = existingUnclaimed.id;
            for (const p of s.payments)
              if (!p.customerId && p.membershipId === membershipId) p.customerId = claim.customerId;
            for (const v of s.visits)
              if (!v.customerId && v.membershipId === membershipId) v.customerId = claim.customerId;
            for (const q of s.entryQueue)
              if (!q.customerId && q.membershipId === membershipId) q.customerId = claim.customerId;
          } else {
            const membership: GymMembership = {
              id: randomUUID(),
              customerId: claim.customerId,
              customerName: name,
              customerMobile: claim.mobile,
              customerMobileNormalized: normalizedMobile || undefined,
              planName: claim.planText || "Existing membership",
              source: "claim",
              status: "active",
              joinedDate,
              expiryDate,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            s.memberships.unshift(membership);
            membershipId = membership.id;
          }
          claim.status = "approved";
          claim.resultingMembershipId = membershipId;
          gymEvent(s, "members", "claim_approved", claim.name, session.name);
        }
      } else if (
        kind === "add_visitor" &&
        b.offeringId === CUSTOM_ENTRY_OFFERING_ID
      ) {
        // Custom Entry — Free. A staff member is physically standing with this
        // person, so their presence IS the verification: no GymOffering, no
        // GymPayment, no membership, no Accept Payment step. Deliberately not
        // modelled as a ₹0 "paid" transaction — a fake transaction would show
        // up in collections, reports and the Payments tab as if money moved.
        // The visit simply carries customEntry: true.
        const name = requireText(b.name, "Visitor name");
        const mobile =
          typeof b.mobile === "string" ? b.mobile.trim().slice(0, 20) : "";
        const normalizedMobile = normalizePhone(mobile);
        if (normalizedMobile.length !== 10)
          throw new Error(
            "A valid 10-digit mobile number is required to add a visitor.",
          );
        const customerId =
          (typeof b.customerId === "string" && b.customerId
            ? b.customerId
            : undefined) || deps.resolveCustomerIdByPhone(normalizedMobile);
        // Never identify by name alone: this phone (or the resolved real
        // identity behind it) already has an active membership here — stop
        // before creating a visitor row and ask the owner to confirm instead.
        const existingActive = findActiveMembershipForIdentity(
          s,
          customerId,
          normalizedMobile,
        );
        if (existingActive) {
          res.json(existingMemberConfirmation(s, existingActive));
          return;
        }
        if (customerId) assertNoOpenVisit(s, customerId);
        const base = {
          name,
          customerId,
          mobile,
          purpose: "visitor" as const,
          entryMethod: "staff_manual" as const,
          customEntry: true,
        };
        if (s.currentOccupancy >= s.maxCapacity) {
          s.entryQueue.push({
            id: randomUUID(),
            ...base,
            arrivedAt: Date.now(),
            status: "Waiting",
          });
          gymEvent(s, "queue", "joined", name, session.name);
        } else {
          s.visits.unshift({
            id: randomUUID(),
            ...base,
            checkedInAt: Date.now(),
            checkedInBy: session.name,
          });
          gymEvent(s, "checkins", "checkin", name, session.name);
        }
      } else if (kind === "add_visitor" || kind === "accept_payment") {
        let payment: (typeof s.payments)[number];
        let offering: GymOffering;
        if (kind === "accept_payment") {
          payment = find(s.payments, b.paymentId, "Payment");
          if (payment.status !== "pending")
            throw new Error("This payment has already been processed.");
          offering = find(s.offerings, payment.offeringId, "Offering");
        } else {
          offering = find(s.offerings, b.offeringId, "Offering");
          if (!offering.active) throw new Error("This offering is inactive.");
          const name = requireText(b.name, "Visitor name");
          const mobile =
            typeof b.mobile === "string" ? b.mobile.trim().slice(0, 20) : "";
          const normalizedMobile = normalizePhone(mobile);
          if (normalizedMobile.length !== 10)
            throw new Error(
              "A valid 10-digit mobile number is required to add a visitor.",
            );
          const resolvedCustomerId =
            (typeof b.customerId === "string" && b.customerId
              ? b.customerId
              : undefined) || deps.resolveCustomerIdByPhone(normalizedMobile);
          // Never identify by name alone: check for an existing active
          // membership at THIS gym before any payment/visitor is created,
          // regardless of which offering staff picked.
          const existingActive = findActiveMembershipForIdentity(
            s,
            resolvedCustomerId,
            normalizedMobile,
          );
          if (existingActive) {
            res.json(existingMemberConfirmation(s, existingActive));
            return;
          }
          const method = choice(b.method || "cash", ["online", "cash"], "payment method") as
            | "online"
            | "cash";
          payment = {
            id: randomUUID(),
            customerId: resolvedCustomerId,
            customerName: name,
            customerMobile: mobile,
            offeringId: offering.id,
            offeringName: offering.name,
            amountInr: offering.priceInr,
            method,
            status: "pending",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          s.payments.unshift(payment);
        }
        payment.status = "paid";
        payment.acceptedBy = session.name;
        payment.acceptedAt = Date.now();
        payment.updatedAt = Date.now();
        let membershipId: string | undefined;
        if (offering.type === "membership") {
          // Identity bridge: the mobile number is the one thing staff always
          // has, whether or not this customer has ever verified it yet.
          // Normalize it the same way OTP verification does, so a later
          // login with the same number (in any formatting) finds this row.
          const normalizedMobile = normalizePhone(payment.customerMobile);
          // Case A — the phone already belongs to a verified customer
          // account: attach the membership (and the payment behind it)
          // straight to that real customerId, no manual claim needed.
          if (!payment.customerId && normalizedMobile.length === 10) {
            const resolved = deps.resolveCustomerIdByPhone(normalizedMobile);
            if (resolved) payment.customerId = resolved;
          }
          // Duplicate prevention: this identity (real customerId, or the
          // same normalized mobile still unclaimed) already has an active
          // membership at this gym — don't mint a second one.
          const existingActive = s.memberships.find((m) => {
            if (m.status !== "active") return false;
            if (payment.customerId) return m.customerId === payment.customerId;
            return (
              normalizedMobile.length === 10 &&
              m.customerMobileNormalized === normalizedMobile &&
              isUnclaimedCustomerId(m.customerId)
            );
          });
          if (existingActive) {
            throw new Error(
              `${payment.customerName} already has an active membership (${existingActive.planName}, expires ${existingActive.expiryDate}). Renew the existing membership instead of adding a new one.`,
            );
          }
          const isSessionPackage = offering.durationUnit === "session";
          const expiryDate = isSessionPackage
            // Session packages are usage-bound, not calendar-bound: consuming
            // is tracked by sessionsUsed below, so give a full year to use
            // the sessions up rather than addDuration()'s incidental 1-day
            // nominal window for "session".
            ? addDuration(new Date().toISOString().slice(0, 10), 365, "day")
            : addDuration(
                new Date().toISOString().slice(0, 10),
                offering.durationValue,
                offering.durationUnit,
              );
          // Case B — no verified account yet: created "unclaimed", carrying
          // the normalized mobile so a future OTP verification (this
          // provider or any other) can find and re-point it automatically.
          const membership: GymMembership = {
            id: randomUUID(),
            customerId: payment.customerId || unclaimedCustomerId(payment.id),
            customerName: payment.customerName,
            customerMobile: payment.customerMobile,
            customerMobileNormalized: normalizedMobile || undefined,
            offeringId: offering.id,
            planName: offering.name,
            source: "purchase",
            status: "active",
            joinedDate: new Date().toISOString().slice(0, 10),
            expiryDate,
            sessionsTotal: isSessionPackage ? offering.durationValue : undefined,
            sessionsUsed: isSessionPackage ? 0 : undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          s.memberships.unshift(membership);
          membershipId = membership.id;
          payment.membershipId = membershipId;
        }
        const purpose = (offering.type === "membership" ? "member" : "visitor") as
          | "member"
          | "visitor";
        // Gym is full right now: route into the real Waiting queue instead of
        // over-capacity checking them in, or failing the payment that was
        // just collected. Reuses the same GymQueueEntry mechanism "Add to
        // entry queue" uses, carrying the payment/offering/membership
        // through so admitting this entry later produces the same check-in
        // it would have made if there had been room.
        if (s.currentOccupancy >= s.maxCapacity) {
          const alreadyQueued =
            !!payment.customerId &&
            (s.entryQueue.some(
              (q) => q.status === "Waiting" && q.customerId === payment.customerId,
            ) ||
              s.visits.some(
                (v) => !v.checkedOutAt && v.customerId === payment.customerId,
              ));
          if (!alreadyQueued) {
            s.entryQueue.push({
              id: randomUUID(),
              name: payment.customerName,
              customerId: payment.customerId,
              offeringId: offering.id,
              membershipId,
              paymentId: payment.id,
              purpose,
              entryMethod: "staff_manual",
              arrivedAt: Date.now(),
              status: "Waiting",
            });
            gymEvent(s, "queue", "joined", payment.customerName, session.name);
          }
        } else {
          // Server-enforced: accepting a payment for someone who is already
          // inside must never open a second concurrent visit.
          if (payment.customerId) assertNoOpenVisit(s, payment.customerId);
          const visit = {
            id: randomUUID(),
            name: payment.customerName,
            checkedInAt: Date.now(),
            customerId: payment.customerId,
            offeringId: offering.id,
            membershipId,
            paymentId: payment.id,
            purpose,
            entryMethod: "staff_manual" as const,
            checkedInBy: session.name,
          };
          s.visits.unshift(visit);
          payment.visitId = visit.id;
          recordSessionUsage(s, membershipId);
          gymEvent(
            s,
            "checkins",
            "checkin",
            payment.customerName,
            session.name,
            {},
          );
        }
      } else if (kind === "confirm_checkin") {
        // Payment != physical entry. A payment that genuinely reached `paid`
        // (today: only via staff Accept; an online gateway would land here
        // too) still does not put anyone on the floor. This is the explicit
        // staff confirmation that they are physically present, and the only
        // thing that opens their GymVisit. It never mutates payment.status —
        // the money side is already settled and stays untouched.
        const payment = find(s.payments, b.paymentId, "Payment");
        if (payment.status !== "paid")
          throw new Error(
            "Only a paid payment can be confirmed for check-in.",
          );
        if (payment.visitId)
          throw new Error("This payment has already been checked in.");
        if (payment.customerId) assertNoOpenVisit(s, payment.customerId);
        const offering = find(s.offerings, payment.offeringId, "Offering");
        const purpose = (
          offering.type === "membership" ? "member" : "visitor"
        ) as "member" | "visitor";
        if (s.currentOccupancy >= s.maxCapacity) {
          s.entryQueue.push({
            id: randomUUID(),
            name: payment.customerName,
            customerId: payment.customerId,
            offeringId: offering.id,
            membershipId: payment.membershipId,
            paymentId: payment.id,
            purpose,
            entryMethod: "staff_manual",
            arrivedAt: Date.now(),
            status: "Waiting",
          });
          gymEvent(s, "queue", "joined", payment.customerName, session.name);
        } else {
          const visit = {
            id: randomUUID(),
            name: payment.customerName,
            checkedInAt: Date.now(),
            customerId: payment.customerId,
            offeringId: offering.id,
            membershipId: payment.membershipId,
            paymentId: payment.id,
            purpose,
            entryMethod: "staff_manual" as const,
            checkedInBy: session.name,
          };
          s.visits.unshift(visit);
          payment.visitId = visit.id;
          payment.updatedAt = Date.now();
          recordSessionUsage(s, payment.membershipId);
          gymEvent(s, "checkins", "checkin", payment.customerName, session.name);
        }
      } else if (kind === "confirm_member_checkin") {
        // The owner confirmed "Check in as Member" on the existing-member
        // dialog Add Visitor returned instead of creating a duplicate
        // visitor/membership. Uses the existing customer/membership
        // identity as-is — never mints a new customer, membership or
        // payment — and opens exactly one physical GymVisit.
        const membership = find(s.memberships, b.membershipId, "Membership");
        if (membership.status !== "active")
          throw new Error("This membership is not active.");
        // Matched by membershipId, not customerId: an unclaimed membership's
        // own visits never carry a customerId, so membershipId is the only
        // identity link guaranteed to be set either way.
        if (
          s.visits.some(
            (v) => v.membershipId === membership.id && !v.checkedOutAt,
          )
        )
          throw new Error("Already checked in.");
        // Never write a synthetic "walkin-..." id onto customerId — every
        // other visit-creation path in this file only sets customerId to a
        // real, resolved customer_account id and leaves it undefined
        // otherwise; membershipId alone carries the link until this person
        // verifies their phone and reconcileUnclaimedMembershipsForPhone
        // re-points the membership (and this visit) at their real account.
        const linkedCustomerId = isUnclaimedCustomerId(membership.customerId)
          ? undefined
          : membership.customerId;
        const purpose = "member" as const;
        if (s.currentOccupancy >= s.maxCapacity) {
          s.entryQueue.push({
            id: randomUUID(),
            name: membership.customerName,
            customerId: linkedCustomerId,
            membershipId: membership.id,
            purpose,
            entryMethod: "staff_manual",
            arrivedAt: Date.now(),
            status: "Waiting",
          });
          gymEvent(s, "queue", "joined", membership.customerName, session.name);
        } else {
          const visit = {
            id: randomUUID(),
            name: membership.customerName,
            customerId: linkedCustomerId,
            membershipId: membership.id,
            purpose,
            entryMethod: "staff_manual" as const,
            checkedInAt: Date.now(),
            checkedInBy: session.name,
          };
          s.visits.unshift(visit);
          recordSessionUsage(s, membership.id);
          gymEvent(
            s,
            "checkins",
            "checkin",
            membership.customerName,
            session.name,
          );
        }
      } else if (kind === "decline_payment") {
        const payment = find(s.payments, b.paymentId, "Payment");
        if (payment.status !== "pending")
          throw new Error(
            payment.status === "declined"
              ? "This payment has already been declined."
              : "This payment has already been processed.",
          );
        const reasonCode = choice(
          b.reasonCode,
          ["no_payment", "duplicate", "cancelled", "other"],
          "decline reason",
        ) as GymPayment["reasonCode"];
        const reasonText =
          reasonCode === "other"
            ? requireText(b.reasonText, "Reason", 500)
            : typeof b.reasonText === "string" && b.reasonText.trim()
              ? b.reasonText.trim().slice(0, 500)
              : undefined;
        payment.status = "declined";
        payment.reasonCode = reasonCode;
        payment.reasonText = reasonText;
        payment.declinedAt = Date.now();
        payment.declinedBy = session.name;
        payment.updatedAt = Date.now();
        gymEvent(
          s,
          "members",
          "payment_declined",
          payment.customerName,
          session.name,
        );
      } else throw new Error("Unknown operation.");
      await commit(res, s);
    },
  );
  route("post", "campaigns", ["owner"], async (req, res, s, session) => {
    const b = req.body;
    const existing = b.id ? find(s.campaigns, b.id, "Campaign") : undefined;
    const startsAt = date(b.startsAt, "Start date");
    const endsAt = date(b.endsAt, "End date");
    if (endsAt <= startsAt)
      throw new Error("End date must be after start date.");
    const c: GymCampaign = {
      id: existing?.id || randomUUID(),
      token: existing?.token || randomUUID(),
      title: requireText(b.title, "Title"),
      message: requireText(b.message, "Message", 2000),
      type: choice(
        b.type,
        ["Offer", "Alert", "Announcement", "Membership promotion"],
        "campaign type",
      ) as GymCampaign["type"],
      status: choice(
        b.status,
        ["Draft", "Active", "Paused", "Archived"],
        "campaign status",
      ) as GymCampaign["status"],
      startsAt,
      endsAt,
      createdAt: existing?.createdAt || Date.now(),
    };
    if (existing) Object.assign(existing, c);
    else s.campaigns.unshift(c);
    gymEvent(
      s,
      "campaigns",
      existing ? "updated" : "created",
      c.title,
      session.name,
      { campaignId: c.id },
    );
    await commit(res, s);
  });
  route("get", "campaigns/:id/identity", ["owner"], (req, res, s) => {
    const c = find(s.campaigns, req.params.id, "Campaign");
    // Relative URL keeps QR codes on the API deployment that served this dashboard.
    const url = `${req.protocol}://${req.get("host")}/api/gym-campaign/${encodeURIComponent(s.gymId)}/${c.token}`;
    res.json({ url, code: c.token, qr: qrSvgDataUrl(url) });
  });
  route("get", "reports", managers, (req, res, s, session) => {
    const from = Date.parse(String(req.query.from || ""));
    const to = Date.parse(String(req.query.to || ""));
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to)
      throw new Error("Choose a valid start and end date.");
    const category = choice(
      req.query.category || "all",
      [
        "all",
        "occupancy",
        "checkins",
        "pt",
        "trainers",
        "classes",
        "campaigns",
        "members",
        "queue",
      ],
      "report",
    );
    if (category === "campaigns" && session.role !== "owner") {
      res.status(403).json({ error: "Campaign reports require owner access." });
      return;
    }
    const events = filterGymEvents(
      s.events,
      from,
      to,
      category as any,
      String(req.query.campaignId || ""),
    ).filter((e) => session.role === "owner" || e.category !== "campaigns");
    if (req.query.format === "csv")
      res
        .type("text/csv")
        .set("Content-Disposition", 'attachment; filename="gym-report.csv"')
        .send(gymEventsCsv(events));
    else res.json({ events, historyStartedAt: s.historyStartedAt });
  });
  route("get", "members-report", managers, (req, res, s) => {
    const fromText = String(req.query.from || "");
    const toText = String(req.query.to || "");
    const from = Date.parse(`${fromText}T00:00:00`);
    const to = Date.parse(`${toText}T23:59:59.999`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fromText) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(toText) ||
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from > to
    )
      throw new Error("Choose a valid start and end date.");
    const rows = gymMemberReportRows(s, from, to);
    if (req.query.format === "csv")
      res
        .type("text/csv")
        .set(
          "Content-Disposition",
          `attachment; filename="gym-members-${fromText}-to-${toText}.csv"`,
        )
        .send(gymMemberReportCsv(rows));
    else res.json({ rows, from: fromText, to: toText });
  });
  const escape = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  const page = (title: string, message: string, action = "") =>
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | NOQ</title><style>body{font:17px system-ui;background:#f3f7f6;color:#162e31;margin:0;padding:24px}main{max-width:520px;margin:8vh auto;background:white;padding:32px;border-radius:24px;overflow-wrap:anywhere}p{white-space:pre-wrap;line-height:1.6}button{background:#087e81;color:white;border:0;border-radius:12px;padding:16px 24px;font:inherit;width:100%}</style><main><b>NOQ · GYM CAMPAIGN</b><h1>${escape(title)}</h1><p>${escape(message)}</p>${action}</main></html>`;
  const publicTraffic = new Map<string, { count: number; expires: number }>();
  for (const method of ["get", "post"] as const)
    app[method]("/api/gym-campaign/:gymId/:token", (req, res) => {
      void serial(async () => {
        const now = Date.now();
        for (const [key, record] of publicTraffic)
          if (record.expires < now) publicTraffic.delete(key);
        const trafficKey = req.ip || "unknown";
        const traffic = publicTraffic.get(trafficKey) || {
          count: 0,
          expires: now + 10 * 60000,
        };
        if (
          traffic.count >= 120 ||
          (publicTraffic.size >= 5000 && !publicTraffic.has(trafficKey))
        ) {
          res
            .status(429)
            .send("Too many campaign requests. Please try again later.");
          return;
        }
        traffic.count++;
        publicTraffic.set(trafficKey, traffic);
        if (
          method === "post" &&
          req.get("origin") &&
          req.get("origin") !== req.protocol + "://" + req.get("host")
        ) {
          res
            .status(403)
            .send("Open the campaign on this site before recording an action.");
          return;
        }
        const s = deps.get(String(req.params.gymId));
        const c = s.campaigns.find((c) => c.token === req.params.token);
        res
          .set("Cache-Control", "no-store")
          .set("Referrer-Policy", "no-referrer");
        if (!c || !deps.active(s.gymId) || !campaignIsLive(c)) {
          res
            .status(404)
            .type("html")
            .send(
              page(
                "Campaign unavailable",
                "This campaign is not currently active. Please ask the gym team for current offers.",
              ),
            );
          return;
        }
        const cookieName = `noq_gym_${Buffer.from(s.gymId).toString("hex")}`;
        const cookieValue = (req.headers.cookie || "")
          .split(";")
          .map((x) => x.trim())
          .find((x) => x.startsWith(cookieName + "="))
          ?.split("=")[1];
        const visitorId =
          cookieValue && /^[a-f0-9-]{36}$/.test(cookieValue)
            ? cookieValue
            : randomUUID();
        const scans = s.events.filter(
          (e) =>
            e.campaignId === c.id &&
            e.visitorId === visitorId &&
            e.action === "scan",
        );
        if (method === "post" && !scans.length) {
          res
            .status(400)
            .type("html")
            .send(
              page(
                "Open the campaign first",
                "Open the QR link in your browser before recording interest. Cookies must be enabled.",
              ),
            );
          return;
        }
        if (method === "get") {
          res.cookie(cookieName, visitorId, {
            httpOnly: true,
            sameSite: "lax",
            secure: req.secure,
            maxAge: 365 * 86400000,
          });
          if (!scans.some((e) => e.at > Date.now() - 30 * 60000))
            gymEvent(s, "campaigns", "scan", c.title, "Campaign visitor", {
              campaignId: c.id,
              visitorId,
            });
        } else if (
          !s.events.some(
            (e) =>
              e.campaignId === c.id &&
              e.visitorId === visitorId &&
              e.action === "action",
          )
        )
          gymEvent(s, "campaigns", "action", c.title, "Campaign visitor", {
            campaignId: c.id,
            visitorId,
          });
        deps.save(s.gymId, s);
        await deps.flush();
        res
          .type("html")
          .send(
            page(
              c.title,
              method === "post"
                ? `${c.message}\n\nYour interest is recorded. Show this confirmation to reception. This is not a payment or membership purchase.`
                : c.message,
              method === "get"
                ? '<form method="post"><button type="submit">I’m interested · Record my action</button></form><p>Opening this link records a campaign visit. A browser cookie measures repeat visits. No contact details are collected.</p>'
                : "<p>✓ Action recorded</p>",
            ),
          );
      }).catch(() => {
        if (!res.headersSent)
          res.status(503).send("Campaign storage unavailable. Please retry.");
      });
    });
}
