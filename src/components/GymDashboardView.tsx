import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Dumbbell,
  LayoutDashboard,
  ListOrdered,
  LogIn,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  UserCheck,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import {
  resolveCategoryModules,
  type StaffRole,
} from "../shared/categoryDashboardResolver";
import { gymStaffService, type GymEntryQr } from "../services/gymStaffService";
import type {
  GymClass,
  GymMember,
  GymMembership,
  GymMembershipClaim,
  GymOffering,
  GymPayment,
  GymPtBooking,
  GymState,
  GymTrainer,
} from "../shared/gymBusiness";
import {
  currentMembershipFor,
  daysRemaining,
  membershipDisplayStatus,
  resolveConsistency,
  overviewInsideNow,
  overviewCheckinsToday,
  overviewCollectionToday,
  overviewEndingSoonCount,
  overviewMembersSummary,
  overviewMemberActivity,
  overviewMonthActivity,
  overviewNeedsAttention,
  type NeedsAttentionTarget,
} from "../shared/gymBusiness";
import {
  ACCESS_LABEL,
  CUSTOM_ENTRY_LABEL,
  CUSTOM_ENTRY_OFFERING_ID,
  filterVisits,
  paymentCardState,
  paymentsAwaitingAction,
  resolveAccess,
  sortVisitsForFloor,
  visitPaymentDisplay,
  VISIT_STATUS_OPTIONS,
  type VisitStatusFilter,
} from "../shared/gymLiveFloor";
import {
  formatGymClock,
  formatGymDuration,
  formatGymTimeWithDay,
  gymElapsedLabel,
  gymVisitDurationLabel,
} from "../shared/gymTime";
import { GymCustomerAvatar } from "./GymCustomerAvatar";
import {
  Badge,
  CampaignsPanel,
  Empty,
  FormDialog,
  Panel,
  ReportsPanel,
  dateTime,
  localInput,
  type FormSpec,
} from "./GymBusinessPanels";
import "./GymDashboardView.css";

interface GymDashboardViewProps {
  gymId: string;
  gymName: string;
  role: StaffRole;
  staffName: string;
  activeModule: string;
  onModuleSelect: (id: string) => void;
  onSignOut?: () => void;
  onSetup?: () => void;
  profileIncomplete?: boolean;
  // Rendered inside the hosted TEST preview panel instead of the real
  // full-screen NOQ Business surface: forces the compact/collapsed layout
  // (off-canvas sidebar, internal scroll) regardless of browser width,
  // since the preview panel itself is always narrow. Never set for the
  // real production/Android business app, which keeps its normal
  // viewport-responsive full-screen layout untouched.
  embedded?: boolean;
}
const icons: Record<string, React.ElementType> = {
  overview: LayoutDashboard,
  live_floor: Activity,
  classes: CalendarDays,
  trainers: UserCheck,
  pt_bookings: Dumbbell,
  plans: Tag,
  members: UsersRound,
  reports: ChartNoAxesCombined,
  campaigns: Megaphone,
  settings: Settings,
};
const moduleCopy: Record<string, [string, string]> = {
  overview: [
    "Gym operations dashboard",
    "A clear view of your floor. Every visit, session and opportunity.",
  ],
  live_floor: [
    "Live Floor",
    "Inside, waiting and cash payments — the whole entry flow in one place.",
  ],
  classes: ["Classes", "Plan the schedule and run each session."],
  trainers: ["Trainers", "Your team, their expertise and live availability."],
  pt_bookings: [
    "PT bookings",
    "Schedule personal training without overlapping commitments.",
  ],
  plans: [
    "Plans & Services",
    "The offerings members and visitors can choose — day passes, memberships, PT and class packages.",
  ],
  members: [
    "Members",
    "Membership claims, real member history and consistency at a glance.",
  ],
  reports: [
    "Reports",
    "Understand what happened. Export the records behind it.",
  ],
  campaigns: [
    "Campaigns",
    "Turn a scan into a conversation with your next member.",
  ],
  settings: ["Gym settings", "Operational controls for this business only."],
};

// Reads the same Admin-provisioned business entry QR (gymStaffService ->
// GET /api/gym/:gymId/entry-qr -> ensureBusinessQr()) — never generates a
// second token client- or server-side. Owner-only regeneration is
// intentionally not offered here: the current permission model keeps QR
// regeneration Admin-only.
function EntryQrPanel({ gymId, gymName }: { gymId: string; gymName: string }) {
  const [qr, setQr] = useState<GymEntryQr | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    setQr(null);
    gymStaffService
      .getEntryQr(gymId)
      .then((data) => {
        if (!active) return;
        setQr(data.qr);
        setLoadState("ready");
      })
      .catch((e) => {
        if (!active) return;
        setLoadState(
          e instanceof Error && /not been created|not found/i.test(e.message)
            ? "missing"
            : "error",
        );
      });
    return () => {
      active = false;
    };
  }, [gymId]);

  const filename = `${gymName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "gym"}-entry-qr.png`;

  const share = async () => {
    if (!qr) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${gymName} entry QR`, url: qr.publicUrl });
      } else {
        await navigator.clipboard?.writeText(qr.publicUrl);
      }
    } catch {
      /* user cancelled or share unavailable — no-op */
    }
  };

  return (
    <Panel title="Your Gym Entry QR">
      <p className="gym-footnote">
        Members and visitors scan this at your front desk to check themselves
        in. It's the same code Admin issued for this business — printing,
        sharing or downloading it here never creates a new one.
      </p>
      {loadState === "loading" && <Empty>Loading your entry code…</Empty>}
      {loadState === "error" && (
        <Empty>Unable to load your entry code right now. Try again shortly.</Empty>
      )}
      {loadState === "missing" && (
        <Empty>Entry code has not been created yet.</Empty>
      )}
      {loadState === "ready" && qr && (
        <div className="gym-entry-qr">
          <img
            src={qr.previewImageUrl}
            alt={`${gymName} entry QR`}
            className="gym-entry-qr-image"
          />
          <div className="gym-entry-qr-meta">
            <div className="gym-summary-line">
              <span>Gym</span>
              <strong>{gymName}</strong>
            </div>
            <div className="gym-summary-line">
              <span>Business ID</span>
              <strong>{gymId}</strong>
            </div>
            <div className="gym-inline-actions">
              <a
                className="gym-button"
                href={qr.downloadImageUrl}
                download={filename}
              >
                <ArrowDownToLine size={16} />
                Download
              </a>
              <button className="gym-button secondary" onClick={share}>
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
// Decline reasons shown to staff — codes match the server's
// GymPaymentDeclineReasonCode union exactly. "Other" is the only one that
// reveals (and requires) the free-text box.
const DECLINE_REASONS: { code: string; label: string }[] = [
  { code: "no_payment", label: "Customer did not pay" },
  { code: "duplicate", label: "Duplicate / wrong entry" },
  { code: "cancelled", label: "Customer changed mind / cancelled" },
  { code: "other", label: "Other" },
];

function DeclinePaymentDialog({
  gymId,
  payment,
  close,
  onDeclined,
}: {
  gymId: string;
  payment: GymPayment;
  close: () => void;
  onDeclined: (state: GymState) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reasonCode) {
      setError("Choose a reason for declining this payment.");
      return;
    }
    if (reasonCode === "other" && !reasonText.trim()) {
      setError("Add a short reason before confirming.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await gymStaffService.operate(gymId, "decline_payment", {
        paymentId: payment.id,
        reasonCode,
        reasonText: reasonText.trim() || undefined,
      });
      onDeclined(result.state);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to decline this payment.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={ref}
      className="gym-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <form onSubmit={submit}>
        <div className="gym-panel-heading">
          <h2>Decline payment</h2>
          <button
            type="button"
            aria-label="Close form"
            disabled={busy}
            className="gym-icon-button"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <p className="gym-muted">
          {payment.customerName} — {payment.offeringName} · ₹{payment.amountInr}{" "}
          ({payment.method === "online" ? "online" : "cash"}). This cannot be
          undone — the payment will no longer be pending.
        </p>
        <div className="gym-form-fields">
          <label>
            Reason
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              required
            >
              <option value="" disabled>
                Choose a reason
              </option>
              {DECLINE_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {reasonCode === "other" && (
            <label>
              Details
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                required
                maxLength={500}
                rows={3}
                placeholder="What happened?"
              />
            </label>
          )}
        </div>
        {error && (
          <p role="alert" className="gym-error">
            {error}
          </p>
        )}
        <div className="gym-form-actions">
          <button
            type="button"
            className="gym-button secondary"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="gym-button danger" disabled={busy}>
            {busy ? "Declining…" : "Decline payment"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export const GymDashboardView: React.FC<GymDashboardViewProps> = ({
  gymId,
  gymName,
  role,
  staffName,
  activeModule,
  onModuleSelect,
  onSignOut,
  onSetup,
  profileIncomplete,
  embedded,
}) => {
  const [state, setState] = useState<GymState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [form, setForm] = useState<FormSpec | null>(null);
  const [liveFloorTab, setLiveFloorTab] = useState<
    "inside" | "waiting" | "payments"
  >("inside");
  const [declinePayment, setDeclinePayment] = useState<GymPayment | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [membershipQuery, setMembershipQuery] = useState("");
  const [membershipFilter, setMembershipFilter] = useState<
    | "all"
    | "highly_consistent"
    | "regular"
    | "low_activity"
    | "at_risk"
    | "not_visiting"
    | "expiring"
  >("all");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const mutating = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const modules = resolveCategoryModules("gym", role);
  const active = modules.some((m) => m.id === activeModule)
    ? activeModule
    : "overview";
  const owner = role === "owner";
  const manager = owner || role === "manager";
  const operator = ["owner", "manager", "staff", "reception"].includes(role);
  const refresh = useCallback(async () => {
    const requestGeneration = generation.current;
    try {
      const data = await gymStaffService.getOverview(gymId);
      if (
        mounted.current &&
        !mutating.current &&
        generation.current === requestGeneration
      ) {
        setState(data);
        setUpdated(Date.now());
        setError("");
      }
    } catch (e) {
      if (mounted.current && generation.current === requestGeneration)
        setError(e instanceof Error ? e.message : "Unable to sync.");
    }
  }, [gymId]);
  useEffect(() => {
    mounted.current = true;
    generation.current++;
    setState(null);
    setForm(null);
    setError("");
    setUpdated(0);
    void refresh();
    const timer = setInterval(() => {
      if (!mutating.current) void refresh();
    }, 5000);
    return () => {
      mounted.current = false;
      generation.current++;
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  // Drives the live "inside Xm" duration on Live Floor cards without waiting
  // for the next 5s data refresh.
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!navOpen) return;
    const buttons = () =>
      (
        Array.from(
          navigationRef.current?.querySelectorAll<HTMLButtonElement>(
            "button",
          ) || [],
        ) as HTMLButtonElement[]
      ).filter((b) => b.getClientRects().length > 0);
    buttons()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNavOpen(false);
        menuRef.current?.focus();
      }
      if (e.key === "Tab") {
        const list = buttons();
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [navOpen]);
  const navigate = (id: string) => {
    onModuleSelect(id);
    setNavOpen(false);
    setQuery("");
    setStatus("All");
  };
  // Overview's KPI cards / Needs Attention items never render another
  // module's content inline — they only jump to it, pre-filtered where that
  // filter already exists (Members) or to the matching Live Floor tab.
  const goToMembers = (filter: typeof membershipFilter = "all") => {
    setMembershipFilter(filter);
    navigate("members");
  };
  const goToLiveFloorTab = (tab: typeof liveFloorTab) => {
    setLiveFloorTab(tab);
    navigate("live_floor");
  };
  const goToNeedsAttention = (target: NeedsAttentionTarget) => {
    if (target === "live_floor_payments") goToLiveFloorTab("payments");
    else if (target === "live_floor_waiting") goToLiveFloorTab("waiting");
    else if (target === "members_expiring") goToMembers("expiring");
    else if (target === "members_not_visiting") goToMembers("not_visiting");
    else goToMembers("all");
  };
  const mutate = async (
    work: () => Promise<{ state: GymState }>,
    message = "Changes saved",
  ) => {
    if (mutating.current)
      throw new Error("Another action is saving. Please wait.");
    mutating.current = true;
    generation.current++;
    setBusy(true);
    setError("");
    try {
      const result = await work();
      if (mounted.current) {
        setState(result.state);
        setUpdated(Date.now());
        setNotice(message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
      throw e;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  };
  const action = (
    work: () => Promise<{ state: GymState }>,
    message?: string,
  ) => {
    void mutate(work, message).catch(() => {});
  };
  const operate = (kind: string, body: Record<string, unknown>) =>
    mutate(() => gymStaffService.operate(gymId, kind, body));
  const openCheckin = () =>
    state &&
    setForm({
      title: "Check in a visitor",
      description:
        "Choose a member or enter a walk-in name. The inside count updates immediately.",
      fields: [
        {
          name: "memberId",
          label: "Member (optional)",
          optional: true,
          options: state.members
            .filter((m) => m.status === "Active")
            .map((m) => ({ value: m.id, label: m.name })),
        },
        {
          name: "name",
          label: "Walk-in name",
          optional: true,
          help: "Leave blank for an anonymous walk-in.",
        },
      ],
      submit: (v) =>
        mutate(
          () =>
            gymStaffService.checkIn(gymId, {
              name: String(v.name),
              memberId: String(v.memberId) || undefined,
            }),
          "Visitor checked in",
        ),
    });
  const editCapacity = () =>
    state &&
    setForm({
      title: "Update maximum capacity",
      description:
        "Inside Now always reflects real active visits — use Check in/out or Add Visitor to change who's on the floor.",
      fields: [
        {
          name: "maxCapacity",
          label: "Maximum capacity",
          type: "number",
          value: state.maxCapacity,
          min: 1,
          max: 100000,
        },
      ],
      submit: (v) => mutate(() => gymStaffService.updateCoreState(gymId, v)),
    });
  const editCount = () =>
    state &&
    setForm({
      title: "Available trainer count",
      description:
        "Manual count is retained for existing operations. Updating a trainer or session recalculates availability from the roster.",
      fields: [
        {
          name: "availableTrainersCount",
          label: "Available trainers",
          type: "number",
          min: 0,
          max: 10000,
          value: state.availableTrainersCount,
        },
      ],
      submit: (v) => mutate(() => gymStaffService.updateCoreState(gymId, v)),
    });
  const editMember = (m?: GymMember) =>
    setForm({
      title: m ? "Edit member" : "Add member",
      fields: [
        { name: "name", label: "Full name", value: m?.name },
        {
          name: "phone",
          label: "Phone (optional)",
          type: "tel",
          value: m?.phone,
          optional: true,
        },
        {
          name: "membership",
          label: "Membership / plan",
          value: m?.membership || "Standard",
        },
        {
          name: "status",
          label: "Status",
          value: m?.status || "Active",
          options: ["Active", "Paused"].map((value) => ({
            value,
            label: value,
          })),
        },
      ],
      submit: (v) => operate("members", { ...v, id: m?.id }),
    });
  const editTrainer = async (t?: GymTrainer) => {
    try {
      const accounts = await gymStaffService.trainerAccounts(gymId);
      setForm({
        title: t ? "Edit trainer" : "Add trainer",
        fields: [
          { name: "name", label: "Full name", value: t?.name },
          { name: "role", label: "Specialty", value: t?.role },
          {
            name: "staffId",
            label: "Linked trainer login (optional)",
            value: t?.staffId || "",
            optional: true,
            options: accounts.map((a) => ({ value: a.id, label: a.name })),
            help: "Link an existing trainer account to show only their PT bookings when they sign in.",
          },
        ],
        submit: (v) => operate("trainers", { ...v, id: t?.id }),
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load trainer accounts.",
      );
    }
  };
  const editOffering = (o?: GymOffering) =>
    setForm({
      title: o ? "Edit offering" : "Add plan / service",
      description:
        "Offerings drive both the Customer Gym page and the Add Visitor flow — nothing here is hardcoded.",
      fields: [
        { name: "name", label: "Name", value: o?.name },
        {
          name: "type",
          label: "Type",
          value: o?.type || "visitor_pass",
          options: [
            { value: "visitor_pass", label: "Visitor pass" },
            { value: "membership", label: "Membership" },
            { value: "pt", label: "PT package" },
            { value: "class_package", label: "Class package" },
            { value: "custom", label: "Custom" },
          ],
        },
        {
          name: "priceInr",
          label: "Price (₹)",
          type: "number",
          value: o?.priceInr ?? 0,
          min: 0,
        },
        {
          name: "durationValue",
          label: "Duration",
          type: "number",
          value: o?.durationValue ?? 1,
          min: 1,
        },
        {
          name: "durationUnit",
          label: "Duration unit",
          value: o?.durationUnit || "day",
          options: ["day", "week", "month", "quarter", "year", "session"].map(
            (value) => ({ value, label: value }),
          ),
        },
        {
          name: "description",
          label: "Description",
          type: "textarea",
          value: o?.description,
          optional: true,
        },
        {
          name: "active",
          label: "Status",
          value: o?.active === false ? "false" : "true",
          options: [
            { value: "true", label: "Active" },
            { value: "false", label: "Disabled" },
          ],
        },
        {
          name: "customerVisible",
          label: "Visible to customers",
          value: o?.customerVisible === false ? "false" : "true",
          options: [
            { value: "true", label: "Yes — shown on the Gym page" },
            { value: "false", label: "No — staff use only" },
          ],
        },
        {
          name: "recommended",
          label: "Recommend this plan",
          value: o?.recommended ? "true" : "false",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes — highlight it to customers" },
          ],
          help: "Recommended plans appear under \u201cRecommended for you\u201d in the customer Access and Upgrade sheets. Leave every plan off and that section simply is not shown.",
        },
      ],
      submit: (v) =>
        operate("offerings", {
          ...v,
          id: o?.id,
          active: v.active === "true",
          customerVisible: v.customerVisible === "true",
          recommended: v.recommended === "true",
          paymentOptions: o?.paymentOptions || ["cash"],
        }),
    });
  const openAddVisitor = () => {
    if (!state) return;
    const offerings = state.offerings.filter((o) => o.active);
    // Custom Entry needs no offering at all, so this form is always usable —
    // an empty Plans list no longer blocks letting someone in for free.
    setForm({
      title: "Add visitor",
      description:
        "Staff presence is the physical verification — no QR scan needed. A paid access records the payment and activates any membership; Custom Entry is free and creates the visit immediately with no payment at all.",
      fields: [
        { name: "name", label: "Full name" },
        { name: "mobile", label: "Mobile number", type: "tel", optional: true },
        {
          name: "offeringId",
          label: ACCESS_LABEL,
          value: CUSTOM_ENTRY_OFFERING_ID,
          options: [
            {
              value: CUSTOM_ENTRY_OFFERING_ID,
              label: `${CUSTOM_ENTRY_LABEL} — Free`,
            },
            ...offerings.map((o) => ({
              value: o.id,
              label: `${o.name} — ₹${o.priceInr}`,
            })),
          ],
          help: `${CUSTOM_ENTRY_LABEL} takes no payment and needs no plan — use it for a trial, a guest, or a comped entry.`,
        },
        {
          name: "method",
          label: "Payment collected as",
          value: "cash",
          options: [{ value: "cash", label: "Cash" }],
          help: "Ignored for Custom Entry — nothing is collected and no payment record is created.",
        },
      ],
      submit: (v) => operate("add_visitor", v),
    });
  };
  const openAcceptPayment = (p: GymPayment) =>
    setForm({
      title: "Accept payment & check in",
      description: `${p.customerName} — ${ACCESS_LABEL}: ${p.offeringName} · ₹${p.amountInr} (${p.method === "online" ? "online" : "cash"})`,
      fields: [],
      submit: () => operate("accept_payment", { paymentId: p.id }),
    });
  // Money already settled; this is only the physical-entry confirmation. The
  // payment record is not touched — the visit is what gets created.
  const openConfirmCheckIn = (p: GymPayment) =>
    setForm({
      title: "Confirm check-in",
      description: `${p.customerName} — ${ACCESS_LABEL}: ${p.offeringName} · ₹${p.amountInr} already paid online. Confirm they are physically here to start their visit.`,
      fields: [],
      submit: () => operate("confirm_checkin", { paymentId: p.id }),
    });
  const reviewClaim = (c: GymMembershipClaim, decision: "approve" | "reject") => {
    if (decision === "reject") {
      void action(() => gymStaffService.operate(gymId, "membership_claims", { id: c.id, action: "reject" }), "Claim rejected");
      return;
    }
    setForm({
      title: "Approve membership claim",
      description:
        "Edit any detail before approving — this creates the real membership record.",
      fields: [
        { name: "name", label: "Member name", value: c.name },
        { name: "joiningDate", label: "Joining date", type: "date", value: c.joiningDate },
        { name: "expiryDate", label: "Expiry date", type: "date", value: c.expiryDate },
      ],
      submit: (v) =>
        operate("membership_claims", { ...v, id: c.id, action: "approve" }),
    });
  };
  const editSession = (
    kind: "classes" | "pt",
    item?: GymClass | GymPtBooking,
  ) => {
    if (!state) return;
    if (!state.trainers.length) {
      setNotice("Add a trainer before scheduling a session.");
      if (manager) navigate("trainers");
      return;
    }
    const c = item as GymClass | undefined;
    const p = item as GymPtBooking | undefined;
    setForm({
      title: `${item ? "Edit" : "Add"} ${kind === "classes" ? "class" : "PT booking"}`,
      description: "Trainer scheduling conflicts are checked when you save.",
      fields: [
        ...(kind === "classes"
          ? [{ name: "title", label: "Class title", value: c?.title }]
          : [
              {
                name: "clientName",
                label: "Client name",
                value: p?.clientName,
              },
              {
                name: "service",
                label: "Session type",
                value: p?.service || "Personal training",
              },
            ]),
        {
          name: "trainerId",
          label: "Trainer",
          value: item?.trainerId || state.trainers[0].id,
          options: state.trainers.map((t) => ({ value: t.id, label: t.name })),
        },
        {
          name: "startsAt",
          label: "Start date & time",
          type: "datetime-local",
          value: localInput(item?.startsAt || Date.now()),
        },
        {
          name: "durationMinutes",
          label: "Duration (minutes)",
          type: "number",
          value: item?.durationMinutes || 60,
          min: 15,
          max: 480,
        },
        ...(kind === "classes"
          ? [
              {
                name: "maxCapacity",
                label: "Class capacity",
                type: "number",
                min: 1,
                max: 100000,
                value: c?.maxCapacity || 20,
              },
              {
                name: "enrolled",
                label: "Enrolled members",
                type: "number",
                min: 0,
                max: 100000,
                value: c?.enrolled || 0,
              },
            ]
          : []),
      ],
      submit: (v) => operate(kind, { ...v, id: item?.id }),
    });
  };
  const addQueue = () =>
    state &&
    setForm({
      title: "Add to entry queue",
      fields: [
        { name: "name", label: "Visitor name", optional: true },
        {
          name: "memberId",
          label: "Member (optional)",
          optional: true,
          options: state.members
            .filter((m) => m.status === "Active")
            .map((m) => ({ value: m.id, label: m.name })),
        },
      ],
      submit: (v) => operate("queue", { ...v, action: "add" }),
    });
  // Search + Status share one control pair. The list each module renders
  // applies them together through a shared pure filter (see
  // shared/gymLiveFloor.filterVisits for Live Floor), never by pre-narrowing
  // the source list first — that is what used to make "Left" always empty.
  const filters = (options: readonly string[]) => (
    <div className="gym-filters">
      <label>
        Search
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
        />
      </label>
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {["All", ...options].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
    </div>
  );
  const matches = (name: string, itemStatus: string) =>
    name.toLowerCase().includes(query.toLowerCase()) &&
    (status === "All" || status === itemStatus);
  const go = (id: string, label = "View all") =>
    modules.some((m) => m.id === id) ? (
      <button className="gym-link" onClick={() => navigate(id)}>
        {label}
        <ChevronRight size={14} />
      </button>
    ) : null;
  const trackedInside =
    state?.visits.filter((v) => !v.checkedOutAt).length || 0;
  const insideMembersCount =
    state?.visits.filter((v) => !v.checkedOutAt && v.purpose === "member")
      .length || 0;
  const insideVisitorsCount = trackedInside - insideMembersCount;
  // One row per customer with a real membership: the row's own membership is
  // whichever is "current" for that customer (active with the furthest
  // expiry, or the most recently expired one otherwise) — never a random row
  // from the full renewal history, which is preserved untouched underneath.
  const currentMembers = state
    ? Array.from(
        new Set<string>(state.memberships.map((m) => m.customerId)),
      )
        .map((customerId: string) =>
          currentMembershipFor(state.memberships, customerId),
        )
        .filter((m): m is GymMembership => Boolean(m))
    : [];
  // Overview — every number below comes straight from real GymState rows
  // (visits/events/payments/memberships), computed once here with the
  // shared pure helpers in gymBusiness.ts so nothing on Overview is
  // fabricated or duplicated from another module's own logic.
  const insideNow = state ? overviewInsideNow(state.visits) : null;
  const checkinsToday = state
    ? overviewCheckinsToday(state.events, state.historyStartedAt, nowTick)
    : null;
  const collectionToday = state ? overviewCollectionToday(state.payments, nowTick) : null;
  const endingSoonCount = state ? overviewEndingSoonCount(state.memberships, nowTick) : 0;
  const membersSummary = state ? overviewMembersSummary(state.memberships, nowTick) : null;
  const memberActivity = state
    ? overviewMemberActivity(state.memberships, state.visits, nowTick)
    : null;
  const monthActivity = state
    ? overviewMonthActivity(state.visits, state.historyStartedAt, nowTick)
    : null;
  const needsAttention = state ? overviewNeedsAttention(state, nowTick) : [];
  const sessionButtons = (
    kind: "classes" | "pt",
    item: GymClass | GymPtBooking,
  ) => {
    const closed = ["Completed", "Cancelled"].includes(item.status || "");
    return (
      <div className="gym-inline-actions">
        {!closed && item.status !== "In Progress" && (
          <>
            <button
              className="gym-button secondary"
              onClick={() => editSession(kind, item)}
              disabled={busy}
            >
              Edit
            </button>
            <button
              className="gym-button"
              disabled={busy || !item.startsAt}
              onClick={() =>
                action(() =>
                  gymStaffService.operate(gymId, kind, {
                    id: item.id,
                    action: "status",
                    status: "In Progress",
                  }),
                )
              }
            >
              Start
            </button>
          </>
        )}
        {item.status === "In Progress" && (
          <button
            className="gym-button"
            disabled={busy}
            onClick={() =>
              action(() =>
                gymStaffService.operate(gymId, kind, {
                  id: item.id,
                  action: "status",
                  status: "Completed",
                }),
              )
            }
          >
            <Check size={16} />
            Complete
          </button>
        )}
        {!closed && (
          <button
            className="gym-button secondary"
            disabled={busy}
            onClick={() =>
              setForm({
                title: "Cancel session?",
                description: "This closes the session and retains its history.",
                fields: [],
                submit: () =>
                  operate(kind, {
                    id: item.id,
                    action: "status",
                    status: "Cancelled",
                  }),
              })
            }
          >
            Cancel
          </button>
        )}
      </div>
    );
  };
  return (
    <div className={embedded ? "gym-app gym-app--embedded" : "gym-app"}>
      <aside
        id="gym-navigation"
        ref={navigationRef}
        className={`gym-sidebar ${navOpen ? "open" : ""}`}
      >
        <div className="gym-brand">
          NOQ<span>BUSINESS</span>
          <button
            className="gym-icon-button mobile-only"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={22} />
          </button>
        </div>
        <div className="gym-nav-label">WORKSPACE · GYM</div>
        <nav aria-label="Gym dashboard">
          {modules.map((m) => {
            const Icon = icons[m.id] || Activity;
            return (
              <button
                key={m.id}
                aria-current={active === m.id ? "page" : undefined}
                className={active === m.id ? "active" : ""}
                onClick={() => navigate(m.id)}
              >
                <Icon size={19} />
                <span>{m.id === "settings" ? "Settings" : m.label}</span>
                {m.id === "live_floor" && !!state?.waitingOutsideCount && (
                  <b>{state.waitingOutsideCount}</b>
                )}
              </button>
            );
          })}
        </nav>
        <div className="gym-sidebar-footer">
          <ShieldCheck size={20} />
          <div>
            One business. One live view.<small>Business ID · {gymId}</small>
          </div>
        </div>
      </aside>
      {navOpen && (
        <button
          className="gym-nav-scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <div className="gym-workspace" inert={navOpen ? true : undefined}>
        <header className="gym-topbar">
          <button
            ref={menuRef}
            aria-expanded={navOpen}
            aria-controls="gym-navigation"
            className="gym-icon-button mobile-only"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={23} />
          </button>
          <div className="gym-business">
            <span className="gym-business-icon">
              <Dumbbell size={20} />
            </span>
            <div>
              <strong>{gymName}</strong>
              <small>Gym workspace</small>
            </div>
          </div>
          <div
            className={`gym-sync ${error ? "offline" : ""}`}
            title={updated ? `Last synced ${dateTime(updated)}` : "Connecting"}
          >
            <span />
            {error
              ? "Sync needs attention"
              : updated
                ? "Live sync"
                : "Connecting"}
          </div>
          <button
            className="gym-icon-button"
            disabled={busy}
            onClick={() => void refresh()}
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={17} />
          </button>
          <div className="gym-user">
            <span className="gym-avatar">{staffName.charAt(0)}</span>
            <div>
              <strong>{staffName}</strong>
              <small>{role}</small>
            </div>
          </div>
          {onSignOut && (
            <button
              className="gym-icon-button"
              aria-label="Sign out / switch business"
              onClick={onSignOut}
            >
              <LogOut size={18} />
            </button>
          )}
        </header>
        <main className="gym-main">
          <div className="gym-page-heading">
            <div>
              <p className="gym-eyebrow">YOUR GYM, IN FOCUS</p>
              <h1>{moduleCopy[active][0]}</h1>
              <p>{moduleCopy[active][1]}</p>
            </div>
            <span className="gym-today">
              <CalendarDays size={16} />
              {new Date().toLocaleDateString([], {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          {profileIncomplete && (
            <div className="gym-setup">
              <div>
                <strong>Business profile incomplete</strong>
                <p>
                  Add your public details so members can recognize your gym.
                </p>
              </div>
              <button className="gym-button secondary" onClick={onSetup}>
                Complete setup
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="gym-error">
              {error} {state && "Displayed data may be out of date."}
              <button className="gym-link" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="gym-notice">
              <Check size={17} />
              {notice}
            </div>
          )}
          {!state ? (
            <Panel
              title={
                error ? "Unable to load your gym" : "Connecting to your gym"
              }
            >
              <Empty>
                {error
                  ? "Retry when the connection is available."
                  : "Loading live operations…"}
              </Empty>
            </Panel>
          ) : (
            <>
              {active === "overview" && insideNow && checkinsToday && collectionToday && membersSummary && memberActivity && monthActivity && (
                <>
                  <div className="gym-metrics">
                    <button
                      type="button"
                      className="gym-metric featured"
                      onClick={() => navigate("live_floor")}
                    >
                      <div className="gym-metric-label">
                        Inside now
                        <Users size={17} />
                      </div>
                      <strong>{insideNow.total}</strong>
                      <small>
                        {insideNow.total
                          ? `${insideNow.members} members · ${insideNow.visitors} visitors`
                          : "No one is checked in right now"}
                      </small>
                      <div className="gym-metric-spacer" />
                    </button>
                    <button
                      type="button"
                      className="gym-metric"
                      onClick={() => navigate("reports")}
                    >
                      <div className="gym-metric-label">
                        Check-ins today
                        <LogIn size={17} />
                      </div>
                      <strong>{checkinsToday.today}</strong>
                      <small>
                        {checkinsToday.yesterday === undefined
                          ? "No comparison yet"
                          : `Yesterday: ${checkinsToday.yesterday} ${
                              checkinsToday.today === checkinsToday.yesterday
                                ? "→"
                                : checkinsToday.today > checkinsToday.yesterday
                                  ? "↑"
                                  : "↓"
                            }`}
                      </small>
                      <div className="gym-metric-spacer" />
                    </button>
                    <button
                      type="button"
                      className="gym-metric"
                      onClick={() => navigate("reports")}
                    >
                      <div className="gym-metric-label">
                        Today’s collection
                        <ChartNoAxesCombined size={17} />
                      </div>
                      <strong>₹{collectionToday.paidToday.toLocaleString("en-IN")}</strong>
                      <small>
                        {collectionToday.cashPendingTotal > 0
                          ? `₹${collectionToday.cashPendingTotal.toLocaleString("en-IN")} cash pending`
                          : "No cash pending"}
                      </small>
                      <div className="gym-metric-spacer" />
                    </button>
                    <button
                      type="button"
                      className="gym-metric"
                      onClick={() => goToMembers("expiring")}
                    >
                      <div className="gym-metric-label">
                        Ending soon
                        <UsersRound size={17} />
                      </div>
                      <strong>{endingSoonCount}</strong>
                      <small>Next 7 days</small>
                      <div className="gym-metric-spacer" />
                    </button>
                  </div>
                  <section className="gym-quick-actions">
                    <span className="gym-eyebrow">QUICK LINKS</span>
                    <button className="gym-button secondary" onClick={() => navigate("live_floor")}>
                      <Activity size={17} />
                      Live Floor
                    </button>
                    {(manager || role === "reception") && (
                      <button className="gym-button secondary" onClick={openAddVisitor}>
                        <UsersRound size={17} />
                        Add Visitor
                      </button>
                    )}
                    <button className="gym-button secondary" onClick={() => navigate("members")}>
                      <UserCheck size={17} />
                      Members
                    </button>
                    <button className="gym-button secondary" onClick={() => navigate("reports")}>
                      <ChartNoAxesCombined size={17} />
                      Reports
                    </button>
                  </section>
                  <div className="gym-health-grid">
                    <Panel title="Members">
                      <div className="gym-mini-metrics">
                        <div>
                          <span>Active</span>
                          <strong>{membersSummary.active}</strong>
                        </div>
                        <div>
                          <span>New this month</span>
                          <strong>+{membersSummary.newThisMonth}</strong>
                        </div>
                        <div>
                          <span>Expired</span>
                          <strong>{membersSummary.expired}</strong>
                        </div>
                        <div>
                          <span>Ending soon</span>
                          <strong>{membersSummary.endingSoon}</strong>
                        </div>
                      </div>
                      {go("members", "Open Members")}
                    </Panel>
                    <Panel title="Member activity">
                      <div className="gym-activity-buckets">
                        <button
                          type="button"
                          className="gym-activity-bucket"
                          onClick={() => goToMembers("highly_consistent")}
                        >
                          <strong>{memberActivity.very_active}</strong>
                          <span>Very active</span>
                        </button>
                        <button
                          type="button"
                          className="gym-activity-bucket"
                          onClick={() => goToMembers("regular")}
                        >
                          <strong>{memberActivity.regular}</strong>
                          <span>Regular</span>
                        </button>
                        <button
                          type="button"
                          className="gym-activity-bucket"
                          onClick={() => goToMembers("not_visiting")}
                        >
                          <strong>{memberActivity.not_visiting}</strong>
                          <span>Not visiting recently</span>
                        </button>
                      </div>
                      <p className="gym-footnote">
                        Based on real check-ins over the last 30 days for members with a
                        current membership.
                      </p>
                    </Panel>
                  </div>
                  <Panel title="Month activity">
                    <div className="gym-summary-line">
                      <span>Visits this month</span>
                      <strong>
                        {monthActivity.visitsThisMonth}
                        {monthActivity.vsLastMonthPct !== undefined && (
                          <span className="gym-metric-delta">
                            {" "}
                            {monthActivity.vsLastMonthPct > 0 ? "↑" : monthActivity.vsLastMonthPct < 0 ? "↓" : "→"}{" "}
                            {Math.abs(monthActivity.vsLastMonthPct)}% vs last month
                          </span>
                        )}
                      </strong>
                    </div>
                    {monthActivity.bestDay && monthActivity.busiestTime ? (
                      <>
                        <div className="gym-summary-line">
                          <span>Best day</span>
                          <strong>{monthActivity.bestDay}</strong>
                        </div>
                        <div className="gym-summary-line">
                          <span>Busiest time</span>
                          <strong>{monthActivity.busiestTime}</strong>
                        </div>
                      </>
                    ) : (
                      <p className="gym-muted">
                        Not enough check-in history yet to show a best day or busiest time.
                      </p>
                    )}
                    {go("reports", "Open Reports")}
                  </Panel>
                  <Panel title="Needs attention">
                    {needsAttention.length ? (
                      <div className="gym-list">
                        {needsAttention.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            className="gym-list-row gym-needs-attention-row"
                            onClick={() => goToNeedsAttention(item.target)}
                          >
                            <span className="gym-event-marker" />
                            <div>
                              <strong>{item.label}</strong>
                            </div>
                            <ChevronRight size={16} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="gym-good-state">
                        <Check size={18} />
                        Everything looks good
                      </div>
                    )}
                  </Panel>
                </>
              )}
              {active === "live_floor" && (() => {
                const insideVisits = state.visits.filter((v) => !v.checkedOutAt);
                const waitingQueue = state.entryQueue.filter((q) => q.status === "Waiting");
                // Everything that needs a staff decision: real pending cash /
                // online intents, plus online payments that genuinely reached
                // `paid` and still need the explicit Confirm Check-In step.
                const pendingPayments = paymentsAwaitingAction(state.payments);
                const cashPendingTotal = pendingPayments
                  .filter((p) => p.method === "cash")
                  .reduce((sum, p) => sum + p.amountInr, 0);
                const spacesAvailable = Math.max(
                  0,
                  state.maxCapacity - state.currentOccupancy,
                );
                const longestWaitMinutes = waitingQueue.length
                  ? Math.max(
                      ...waitingQueue.map((q) =>
                        Math.max(0, Math.round((nowTick - q.arrivedAt) / 60000)),
                      ),
                    )
                  : 0;
                const entrySourceLabel = (entryMethod?: string) =>
                  entryMethod === "qr" ? "QR" : entryMethod === "staff_manual" ? "Staff" : "—";
                // Inside AND Left read the same full visits array — historical
                // checked-out rows are never removed from GymState.visits, so
                // "Left" is a filter over the same source, not a second fetch.
                // Status and search compose in one shared pure function.
                // Photo URLs are resolved server-side onto visit rows; payment
                // cards reuse the same resolution via the customer's visit
                // rather than fetching a second time.
                const photoForCustomer = (customerId?: string) =>
                  customerId
                    ? state.visits.find((v) => v.customerId === customerId)?.customerPhotoUrl
                    : undefined;
                const visibleVisits = sortVisitsForFloor(
                  filterVisits(state.visits, {
                    status: status as VisitStatusFilter,
                    query,
                  }),
                );
                return (
                  <>
                    <div className="gym-floor-header">
                      <div>
                        <h2>Live Floor</h2>
                        <p>The whole entry flow — who's in, who's waiting, what's owed.</p>
                      </div>
                      {(manager || role === "reception") && (
                        <button className="gym-button" onClick={openAddVisitor} disabled={busy}>
                          <Plus size={17} />
                          Add Visitor
                        </button>
                      )}
                    </div>
                    <div className="gym-floor-summary">
                      <button
                        type="button"
                        className="gym-floor-summary-card"
                        onClick={() => setLiveFloorTab("inside")}
                      >
                        <span className="gym-floor-summary-label">Inside Now</span>
                        <strong>
                          {state.currentOccupancy}
                          <small>/ {state.maxCapacity}</small>
                        </strong>
                        <span className="gym-floor-summary-note">
                          {spacesAvailable} space{spacesAvailable === 1 ? "" : "s"} available
                        </span>
                      </button>
                      <button
                        type="button"
                        className="gym-floor-summary-card"
                        onClick={() => setLiveFloorTab("waiting")}
                      >
                        <span className="gym-floor-summary-label">Waiting</span>
                        <strong>{waitingQueue.length}</strong>
                        <span className="gym-floor-summary-note">
                          {waitingQueue.length
                            ? `Longest wait ${formatGymDuration(longestWaitMinutes)}`
                            : "Entry queue is clear"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="gym-floor-summary-card"
                        onClick={() => setLiveFloorTab("payments")}
                      >
                        <span className="gym-floor-summary-label">Pending Payments</span>
                        <strong>{pendingPayments.length}</strong>
                        <span className="gym-floor-summary-note">
                          {cashPendingTotal > 0
                            ? `₹${cashPendingTotal.toLocaleString("en-IN")} cash pending`
                            : "Nothing waiting on collection"}
                        </span>
                      </button>
                      <div className="gym-floor-summary-card gym-floor-summary-split">
                        <span className="gym-floor-summary-label">Inside by type</span>
                        <div className="gym-floor-summary-split-row">
                          <div>
                            <strong>{insideMembersCount}</strong>
                            <span>Members</span>
                          </div>
                          <div className="gym-floor-summary-split-divider" />
                          <div>
                            <strong>{insideVisitorsCount}</strong>
                            <span>Visitors</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="gym-floor-tabs" role="tablist">
                      {(
                        [
                          ["inside", "Inside", insideVisits.length],
                          ["waiting", "Waiting", waitingQueue.length],
                          ["payments", "Payments", pendingPayments.length],
                        ] as const
                      ).map(([id, label, count]) => (
                        <button
                          key={id}
                          role="tab"
                          aria-selected={liveFloorTab === id}
                          className={`gym-floor-tab ${liveFloorTab === id ? "active" : ""}`}
                          onClick={() => setLiveFloorTab(id)}
                        >
                          {label}
                          <span className="gym-floor-tab-count">{count}</span>
                        </button>
                      ))}
                    </div>
                    {liveFloorTab === "inside" && filters(VISIT_STATUS_OPTIONS)}
                    {liveFloorTab === "inside" && (
                      visibleVisits.length ? (
                        <div className="gym-floor-cards">
                          {visibleVisits.map((v) => {
                            const left = Boolean(v.checkedOutAt);
                            const access = resolveAccess(v, state.offerings);
                            const paymentState = visitPaymentDisplay(v, state.payments);
                            return (
                              <article
                                className={`gym-floor-card${left ? " left" : ""}`}
                                key={v.id}
                              >
                                <header>
                                  <GymCustomerAvatar name={v.name} photoUrl={v.customerPhotoUrl} />
                                  <div className="gym-floor-card-id">
                                    <strong>{v.name}</strong>
                                    <div className="gym-floor-chips">
                                      <Badge>{v.purpose === "member" ? "Member" : "Visitor"}</Badge>
                                      <Badge>{entrySourceLabel(v.entryMethod)} entry</Badge>
                                      {/* Every card in the combined "All" view
                                          says plainly whether this person is
                                          still on the floor or has left. */}
                                      <Badge>{left ? "Left" : "Currently inside"}</Badge>
                                    </div>
                                  </div>
                                </header>
                                <dl className="gym-floor-card-facts">
                                  {access.kind !== "unknown" && (
                                    <div>
                                      <dt>Access</dt>
                                      <dd>{access.label}</dd>
                                    </div>
                                  )}
                                  {v.purpose === "visitor" && (
                                    <div>
                                      <dt>Payment</dt>
                                      <dd>{paymentState.label}</dd>
                                    </div>
                                  )}
                                  <div>
                                    <dt>Checked in</dt>
                                    <dd>{formatGymTimeWithDay(v.checkedInAt, nowTick)}</dd>
                                  </div>
                                  {left ? (
                                    <>
                                      <div>
                                        <dt>Checked out</dt>
                                        <dd>{formatGymTimeWithDay(v.checkedOutAt, nowTick)}</dd>
                                      </div>
                                      <div>
                                        <dt>Total duration</dt>
                                        <dd>{gymVisitDurationLabel(v, nowTick)}</dd>
                                      </div>
                                    </>
                                  ) : (
                                    <div>
                                      <dt>Duration</dt>
                                      <dd>inside {gymVisitDurationLabel(v, nowTick)}</dd>
                                    </div>
                                  )}
                                </dl>
                                <div className="gym-inline-actions">
                                  {v.memberId && (
                                    <button
                                      className="gym-button secondary"
                                      onClick={() => navigate("members")}
                                    >
                                      View Member
                                    </button>
                                  )}
                                  {/* A left visit is history: it is never
                                      deleted and never offers Check Out. */}
                                  {!left && (
                                    <button
                                      className="gym-button"
                                      disabled={busy}
                                      onClick={() =>
                                        action(
                                          () => gymStaffService.checkOut(gymId, v.id),
                                          "Visitor checked out",
                                        )
                                      }
                                    >
                                      Check Out
                                    </button>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ) : state.visits.length === 0 ? (
                        <Empty>No one is inside right now</Empty>
                      ) : (
                        <Empty>No matching visits. Check in a member or visitor to begin.</Empty>
                      )
                    )}
                    {liveFloorTab === "waiting" && (
                      waitingQueue.length ? (
                        <div className="gym-floor-cards">
                          {waitingQueue.map((q) => (
                            <article className="gym-floor-card" key={q.id}>
                              <header>
                                <span className="gym-avatar">
                                  <Users size={18} />
                                </span>
                                <div className="gym-floor-card-id">
                                  <strong>{q.name}</strong>
                                  <div className="gym-floor-chips">
                                    <Badge>{q.purpose === "member" || q.memberId ? "Member" : "Visitor"}</Badge>
                                    <Badge>{entrySourceLabel(q.entryMethod || (q.customerId ? "qr" : "staff_manual"))} entry</Badge>
                                  </div>
                                </div>
                              </header>
                              <dl className="gym-floor-card-facts">
                                {resolveAccess(q, state.offerings).kind !== "unknown" && (
                                  <div>
                                    <dt>Access</dt>
                                    <dd>{resolveAccess(q, state.offerings).label}</dd>
                                  </div>
                                )}
                                <div>
                                  <dt>Arrived</dt>
                                  <dd>{formatGymTimeWithDay(q.arrivedAt, nowTick)}</dd>
                                </div>
                                <div>
                                  <dt>Waiting</dt>
                                  <dd>{gymElapsedLabel(q.arrivedAt, nowTick)}</dd>
                                </div>
                              </dl>
                              <div className="gym-inline-actions">
                                <button
                                  className="gym-button"
                                  disabled={busy || state.currentOccupancy >= state.maxCapacity}
                                  onClick={() =>
                                    action(
                                      () =>
                                        gymStaffService.operate(gymId, "queue", {
                                          id: q.id,
                                          action: "admit",
                                        }),
                                      "Visitor admitted",
                                    )
                                  }
                                >
                                  Admit
                                </button>
                                <button
                                  className="gym-button secondary"
                                  disabled={busy}
                                  onClick={() =>
                                    setForm({
                                      title: "Remove from queue?",
                                      description: q.name,
                                      fields: [],
                                      submit: () =>
                                        operate("queue", { id: q.id, action: "remove" }),
                                    })
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <Empty>No waiting entries</Empty>
                      )
                    )}
                    {liveFloorTab === "payments" && (
                      pendingPayments.length ? (
                        <div className="gym-floor-cards">
                          {pendingPayments.map((p) => {
                            const card = paymentCardState(p);
                            if (!card) return null;
                            return (
                            <article className="gym-floor-card" key={p.id}>
                              <header>
                                <GymCustomerAvatar name={p.customerName} photoUrl={photoForCustomer(p.customerId)} />
                                <div className="gym-floor-card-id">
                                  <strong>{p.customerName}</strong>
                                  <div className="gym-floor-chips">
                                    <Badge>{card.badge}</Badge>
                                  </div>
                                </div>
                              </header>
                              <dl className="gym-floor-card-facts">
                                <div>
                                  <dt>Access</dt>
                                  <dd>{p.offeringName}</dd>
                                </div>
                                <div>
                                  <dt>Amount</dt>
                                  <dd>₹{p.amountInr}</dd>
                                </div>
                                <div>
                                  <dt>{card.kind === "online_paid" ? "Paid at" : "Requested"}</dt>
                                  <dd>
                                    {formatGymTimeWithDay(
                                      card.kind === "online_paid" ? p.acceptedAt ?? p.updatedAt : p.createdAt,
                                      nowTick,
                                    )}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Waiting</dt>
                                  <dd>{gymElapsedLabel(p.createdAt, nowTick)}</dd>
                                </div>
                              </dl>
                              <div className="gym-inline-actions">
                                {/* Cash: Accept & Check In collects the money
                                    AND opens the visit in one staff action.
                                    Online paid: the money is already settled,
                                    so this is purely the physical-entry
                                    confirmation — and no Decline is offered,
                                    because refunding a captured payment is not
                                    something this system can actually do. */}
                                {card.canAccept && (
                                  <button
                                    className="gym-button"
                                    disabled={busy}
                                    onClick={() =>
                                      card.kind === "online_paid"
                                        ? openConfirmCheckIn(p)
                                        : openAcceptPayment(p)
                                    }
                                  >
                                    {card.kind === "online_paid" ? "Confirm Check-In" : "Accept & Check In"}
                                  </button>
                                )}
                                {card.canDecline && (
                                  <button
                                    className="gym-button secondary danger"
                                    disabled={busy}
                                    onClick={() => setDeclinePayment(p)}
                                  >
                                    Decline
                                  </button>
                                )}
                              </div>
                            </article>
                            );
                          })}
                        </div>
                      ) : (
                        <Empty>No pending cash payments</Empty>
                      )
                    )}
                  </>
                );
              })()}
              {active === "plans" && (
                <Panel
                  title="Plans & services"
                  action={
                    <button className="gym-button" onClick={() => editOffering()}>
                      <Plus size={17} />
                      Add plan
                    </button>
                  }
                >
                  {!state.offerings.length ? (
                    <Empty>
                      No plans yet. Add a Day Pass, a Monthly Membership, or
                      any custom offering — these drive Choose Access on the
                      Customer Gym page and Add Visitor here.
                    </Empty>
                  ) : (
                    <div className="gym-list">
                      {state.offerings.map((o) => (
                        <div className="gym-list-row" key={o.id}>
                          <span className="gym-avatar">
                            <Tag size={18} />
                          </span>
                          <div>
                            <strong>{o.name}</strong>
                            <small>
                              ₹{o.priceInr} · {o.durationValue} {o.durationUnit}
                              {o.durationValue !== 1 ? "s" : ""} ·{" "}
                              {o.type.replace("_", " ")}
                            </small>
                          </div>
                          {o.recommended && <Badge>Recommended</Badge>}
                          <Badge>{o.active ? "Active" : "Disabled"}</Badge>
                          <div className="gym-inline-actions">
                            <button
                              className="gym-button secondary"
                              onClick={() => editOffering(o)}
                            >
                              Edit
                            </button>
                            <button
                              className="gym-button secondary"
                              disabled={busy}
                              onClick={() =>
                                action(() =>
                                  gymStaffService.operate(gymId, "offerings", {
                                    ...o,
                                    id: o.id,
                                    active: !o.active,
                                  }),
                                )
                              }
                            >
                              {o.active ? "Disable" : "Enable"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              )}
              {active === "members" && (
                <>
                  {!!state.membershipClaims.filter((c) => c.status === "pending").length && (
                    <Panel title="Pending membership claims">
                      <div className="gym-list">
                        {state.membershipClaims
                          .filter((c) => c.status === "pending")
                          .map((c) => (
                            <div className="gym-list-row" key={c.id}>
                              <span className="gym-avatar">
                                {c.name.charAt(0)}
                              </span>
                              <div>
                                <strong>{c.name}</strong>
                                <small>
                                  {c.mobile} · Joined {c.joiningDate} · Expires{" "}
                                  {c.expiryDate}
                                  {c.planText ? ` · ${c.planText}` : ""}
                                </small>
                              </div>
                              <Badge>Pending verification</Badge>
                              <div className="gym-inline-actions">
                                <button
                                  className="gym-button secondary"
                                  disabled={busy}
                                  onClick={() => reviewClaim(c, "reject")}
                                >
                                  Reject
                                </button>
                                <button
                                  className="gym-button"
                                  disabled={busy}
                                  onClick={() => reviewClaim(c, "approve")}
                                >
                                  Edit & approve
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </Panel>
                  )}
                  {!!state.payments.filter((p) => p.status === "pending").length && (
                    <Panel title="Pending payments">
                      <div className="gym-list">
                        {state.payments
                          .filter((p) => p.status === "pending")
                          .map((p) => (
                            <div className="gym-list-row" key={p.id}>
                              <span className="gym-avatar">
                                {p.customerName.charAt(0)}
                              </span>
                              <div>
                                <strong>{p.customerName}</strong>
                                <small>
                                  {p.offeringName} · ₹{p.amountInr} ·{" "}
                                  {p.method === "online" ? "Online" : "Pay at gym"}
                                </small>
                              </div>
                              <Badge>Payment pending</Badge>
                              <div className="gym-inline-actions">
                                <button
                                  className="gym-button"
                                  disabled={busy}
                                  onClick={() => openAcceptPayment(p)}
                                >
                                  Accept payment & check in
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </Panel>
                  )}
                  <Panel
                    title="Members"
                    action={
                      <input
                        aria-label="Search members"
                        placeholder="Search by name"
                        value={membershipQuery}
                        onChange={(e) => setMembershipQuery(e.target.value)}
                      />
                    }
                  >
                    <div className="gym-quick-actions" style={{ marginBottom: 12 }}>
                      {(
                        [
                          ["all", "All"],
                          ["highly_consistent", "Very active"],
                          ["regular", "Regular"],
                          ["not_visiting", "Not visiting recently"],
                          ["expiring", "Expiring soon"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          className={`gym-button secondary${membershipFilter === value ? " active" : ""}`}
                          onClick={() => setMembershipFilter(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {!currentMembers.length ? (
                      <Empty>
                        No real members yet — approve a membership claim or
                        sell a membership offering to get started.
                      </Empty>
                    ) : (
                      <div className="gym-list">
                        {currentMembers
                          .filter((m) =>
                            m.customerName
                              .toLowerCase()
                              .includes(membershipQuery.toLowerCase()),
                          )
                          .filter((m) => {
                            if (membershipFilter === "all") return true;
                            if (membershipFilter === "expiring")
                              return (
                                membershipDisplayStatus(m) === "expiring_soon" ||
                                membershipDisplayStatus(m) === "expires_today"
                              );
                            const consistency = resolveConsistency(
                              state.visits,
                              m.customerId,
                            ).status;
                            if (membershipFilter === "not_visiting")
                              return (
                                consistency === "low_activity" ||
                                consistency === "at_risk"
                              );
                            return consistency === membershipFilter;
                          })
                          .map((m) => {
                            const displayStatus = membershipDisplayStatus(m);
                            const remaining = daysRemaining(m.expiryDate);
                            const consistency = resolveConsistency(
                              state.visits,
                              m.customerId,
                            );
                            const expanded = expandedMemberId === m.customerId;
                            const monthly = new Map<string, number>();
                            for (const v of state.visits) {
                              if (v.customerId !== m.customerId) continue;
                              const key = new Date(v.checkedInAt)
                                .toISOString()
                                .slice(0, 7);
                              monthly.set(key, (monthly.get(key) || 0) + 1);
                            }
                            return (
                              <div key={m.customerId}>
                                <button
                                  type="button"
                                  className="gym-list-row"
                                  style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                                  onClick={() =>
                                    setExpandedMemberId(expanded ? null : m.customerId)
                                  }
                                >
                                  <span className="gym-avatar">
                                    {m.customerName.charAt(0)}
                                  </span>
                                  <div>
                                    <strong>{m.customerName}</strong>
                                    <small>
                                      {m.planName} · {m.customerMobile} · Last visit:{" "}
                                      {consistency.avgPerWeek > 0
                                        ? `${consistency.avgPerWeek}/wk avg`
                                        : "No recent visits"}
                                    </small>
                                  </div>
                                  <Badge>
                                    {displayStatus === "expired"
                                      ? "Expired"
                                      : displayStatus === "expires_today"
                                        ? "Expires today"
                                        : displayStatus === "expiring_soon"
                                          ? `${remaining}d left`
                                          : `${remaining}d left`}
                                  </Badge>
                                  <Badge>
                                    {consistency.status === "highly_consistent"
                                      ? "Very active"
                                      : consistency.status === "regular"
                                        ? "Regular"
                                        : "Not visiting recently"}
                                  </Badge>
                                  <ChevronRight size={16} />
                                </button>
                                {expanded && (
                                  <div className="gym-panel" style={{ marginTop: -8, marginBottom: 12 }}>
                                    <div className="gym-summary-line">
                                      <span>Joined</span>
                                      <strong>{m.joinedDate}</strong>
                                    </div>
                                    <div className="gym-summary-line">
                                      <span>Expiry</span>
                                      <strong>{m.expiryDate}</strong>
                                    </div>
                                    <div className="gym-summary-line">
                                      <span>Last 30-day visits</span>
                                      <strong>{consistency.last30DayVisits}</strong>
                                    </div>
                                    <div className="gym-summary-line">
                                      <span>Avg visits / week</span>
                                      <strong>{consistency.avgPerWeek}</strong>
                                    </div>
                                    <p className="gym-eyebrow" style={{ marginTop: 12 }}>
                                      Month by month
                                    </p>
                                    {Array.from(monthly.entries())
                                      .sort((a, b) => b[0].localeCompare(a[0]))
                                      .map(([month, count]) => (
                                        <div className="gym-summary-line" key={month}>
                                          <span>{month}</span>
                                          <strong>{count} visits</strong>
                                        </div>
                                      ))}
                                    {!monthly.size && (
                                      <p className="gym-muted">
                                        No recorded visits yet.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </Panel>
                  <Panel
                    title="Legacy walk-in directory"
                    action={
                      <button className="gym-button" onClick={() => editMember()}>
                        <Plus size={17} />
                        Add member
                      </button>
                    }
                  >
                  {filters(["Active", "Paused"])}
                  {!state.members.filter((m) => matches(m.name, m.status))
                    .length ? (
                    <Empty>
                      No matching members. Add your first member to speed up
                      check-in.
                    </Empty>
                  ) : (
                    <div className="gym-list">
                      {state.members
                        .filter((m) => matches(m.name, m.status))
                        .map((m) => (
                          <div className="gym-list-row" key={m.id}>
                            <span className="gym-avatar">
                              {m.name.charAt(0)}
                            </span>
                            <div>
                              <strong>{m.name}</strong>
                              <small>
                                {m.membership}
                                {m.phone ? ` · ${m.phone}` : ""}
                              </small>
                            </div>
                            <Badge>{m.status}</Badge>
                            <div className="gym-inline-actions">
                              <button
                                className="gym-button secondary"
                                onClick={() => editMember(m)}
                              >
                                Edit
                              </button>
                              <button
                                className="gym-button"
                                disabled={
                                  busy ||
                                  m.status !== "Active" ||
                                  state.visits.some(
                                    (v) =>
                                      v.memberId === m.id && !v.checkedOutAt,
                                  ) ||
                                  state.currentOccupancy >= state.maxCapacity
                                }
                                onClick={() =>
                                  action(
                                    () =>
                                      gymStaffService.checkIn(gymId, {
                                        memberId: m.id,
                                      }),
                                    "Member checked in",
                                  )
                                }
                              >
                                Check in
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                  </Panel>
                </>
              )}
              {active === "trainers" && (
                <Panel
                  title="Trainer roster"
                  action={
                    manager && (
                      <button
                        className="gym-button"
                        onClick={() => editTrainer()}
                      >
                        <Plus size={17} />
                        Add trainer
                      </button>
                    )
                  }
                >
                  {filters(["Available", "In Session", "On Break", "Off Duty"])}
                  {!state.trainers.filter((t) => matches(t.name, t.status))
                    .length ? (
                    <Empty>
                      No matching trainers. Add your team to start scheduling
                      classes and PT.
                    </Empty>
                  ) : (
                    <div className="gym-campaign-grid">
                      {state.trainers
                        .filter((t) => matches(t.name, t.status))
                        .map((t) => (
                          <article className="gym-campaign-card" key={t.id}>
                            <div className="gym-panel-heading">
                              <span className="gym-avatar large">
                                {t.name.charAt(0)}
                              </span>
                              <Badge>{t.status}</Badge>
                            </div>
                            <h3>{t.name}</h3>
                            <p>{t.role}</p>
                            <label className="gym-field-label">
                              Availability
                              <select
                                aria-label={`Availability for ${t.name}`}
                                value={t.status}
                                disabled={busy || !manager}
                                onChange={(e) =>
                                  action(() =>
                                    gymStaffService.updateTrainerStatus(
                                      gymId,
                                      t.id,
                                      e.target.value,
                                    ),
                                  )
                                }
                              >
                                {[
                                  "Available",
                                  "In Session",
                                  "On Break",
                                  "Off Duty",
                                ].map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            </label>
                            {manager && (
                              <button
                                className="gym-link"
                                onClick={() => editTrainer(t)}
                              >
                                Edit trainer
                                <ArrowRight size={15} />
                              </button>
                            )}
                          </article>
                        ))}
                    </div>
                  )}
                  <p className="gym-footnote">
                    Trainer status updates recalculate the available count.
                    Starting a session marks its trainer busy; completing it
                    makes them available.
                  </p>
                </Panel>
              )}
              {(active === "classes" || active === "pt_bookings") && (
                <Panel
                  title={
                    active === "classes"
                      ? "Class schedule"
                      : "Personal training"
                  }
                  action={
                    (manager ||
                      (active === "pt_bookings" && role === "reception")) && (
                      <button
                        className="gym-button"
                        onClick={() =>
                          editSession(active === "classes" ? "classes" : "pt")
                        }
                      >
                        <Plus size={17} />
                        {active === "classes" ? "Add class" : "Add PT booking"}
                      </button>
                    )
                  }
                >
                  {filters([
                    "Scheduled",
                    "Confirmed",
                    "In Progress",
                    "Completed",
                    "Cancelled",
                  ])}
                  {(() => {
                    const isClass = active === "classes";
                    const items = (
                      isClass ? state.classesToday : state.ptBookings
                    )
                      .filter((item) =>
                        matches(
                          ("title" in item ? item.title : item.clientName) +
                            " " +
                            item.trainer,
                          item.status || "Scheduled",
                        ),
                      )
                      .sort(
                        (a, b) =>
                          Date.parse(a.startsAt || "") -
                          Date.parse(b.startsAt || ""),
                      );
                    return items.length ? (
                      <div className="gym-campaign-grid">
                        {items.map((item) => (
                          <article key={item.id} className="gym-campaign-card">
                            <div className="gym-panel-heading">
                              <span className="gym-eyebrow">
                                {item.startsAt
                                  ? dateTime(item.startsAt)
                                  : "Needs a date"}
                              </span>
                              <Badge>{item.status || "Needs schedule"}</Badge>
                            </div>
                            <h3>
                              {"title" in item ? item.title : item.clientName}
                            </h3>
                            <p>
                              {item.trainer} · {item.durationMinutes || 60} min
                            </p>
                            {"enrolled" in item ? (
                              <p>
                                {item.enrolled} / {item.maxCapacity} enrolled
                              </p>
                            ) : (
                              <p>{item.service}</p>
                            )}
                            {(manager || (!isClass && role === "reception")) &&
                              sessionButtons(isClass ? "classes" : "pt", item)}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty>
                        No matching sessions.{" "}
                        {role === "trainer"
                          ? "Only PT sessions linked to your staff account are shown."
                          : "Add a session to build your schedule."}
                      </Empty>
                    );
                  })()}
                </Panel>
              )}
              {active === "reports" && (
                <ReportsPanel
                  gymId={gymId}
                  owner={owner}
                  campaigns={state.campaigns}
                />
              )}
              {active === "campaigns" && owner && (
                <CampaignsPanel
                  gymId={gymId}
                  state={state}
                  openForm={setForm}
                  save={(v) =>
                    mutate(() => gymStaffService.saveCampaign(gymId, v))
                  }
                />
              )}
              {active === "settings" && (
                <Panel title="Facility settings">
                  <div className="gym-summary-line">
                    <span>Business</span>
                    <strong>{gymName}</strong>
                  </div>
                  <div className="gym-summary-line">
                    <span>Business ID</span>
                    <strong>{gymId}</strong>
                  </div>
                  <div className="gym-summary-line">
                    <span>Maximum capacity</span>
                    <strong>{state.maxCapacity}</strong>
                  </div>
                  <div className="gym-inline-actions">
                    <button className="gym-button" onClick={editCapacity}>
                      Edit capacity
                    </button>
                    <button
                      className="gym-button secondary"
                      onClick={editCount}
                    >
                      Set trainer count
                    </button>
                    {profileIncomplete && (
                      <button
                        className="gym-button secondary"
                        onClick={onSetup}
                      >
                        Complete business profile
                      </button>
                    )}
                  </div>
                  <p className="gym-footnote">
                    Settings apply only to this Gym business. Your existing
                    Business-ID login and session remain unchanged.
                  </p>
                </Panel>
              )}
              {active === "settings" && (
                <EntryQrPanel gymId={gymId} gymName={gymName} />
              )}
            </>
          )}
          <footer className="gym-page-footer">
            <span>NOQ BUSINESS · GYM OPERATIONS</span>
            <span>
              {updated
                ? `Last synced ${formatGymClock(updated)}`
                : "Waiting for connection"}
            </span>
          </footer>
        </main>
      </div>
      {form && <FormDialog spec={form} close={() => setForm(null)} />}
      {declinePayment && (
        <DeclinePaymentDialog
          gymId={gymId}
          payment={declinePayment}
          close={() => setDeclinePayment(null)}
          onDeclined={(next) => {
            setState(next);
            setUpdated(Date.now());
            setNotice("Payment declined");
          }}
        />
      )}
    </div>
  );
};
