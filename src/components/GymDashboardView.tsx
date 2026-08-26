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
  Minus,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import {
  resolveCategoryModules,
  type StaffRole,
} from "../shared/categoryDashboardResolver";
import { gymStaffService } from "../services/gymStaffService";
import type {
  GymClass,
  GymMember,
  GymPtBooking,
  GymState,
  GymTrainer,
} from "../shared/gymBusiness";
import {
  Badge,
  CampaignMetrics,
  CampaignsPanel,
  Empty,
  FormDialog,
  Panel,
  ReportsPanel,
  dateTime,
  localDay,
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
}
const icons: Record<string, React.ElementType> = {
  overview: LayoutDashboard,
  capacity: Activity,
  checkin: LogIn,
  queue: ListOrdered,
  classes: CalendarDays,
  trainers: UserCheck,
  pt_bookings: Dumbbell,
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
  capacity: [
    "Live capacity",
    "Keep the floor comfortable and the entry moving.",
  ],
  checkin: [
    "Check-in / Out",
    "Welcome members in. Close visits as they leave.",
  ],
  queue: [
    "Entry queue",
    "A fair, visible line. Admit visitors when space opens.",
  ],
  classes: ["Classes", "Plan the schedule and run each session."],
  trainers: ["Trainers", "Your team, their expertise and live availability."],
  pt_bookings: [
    "PT bookings",
    "Schedule personal training without overlapping commitments.",
  ],
  members: ["Members", "Your gym’s member directory and membership status."],
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

function OccupancyTrend({ state }: { state: GymState }) {
  const points = state.events.filter(
    (e) =>
      localDay(new Date(e.at)) === localDay() &&
      ["occupancy", "checkins"].includes(e.category),
  );
  const max = Math.max(state.maxCapacity, ...points.map((e) => e.capacity), 1);
  const first = points[0]?.at || Date.now();
  const last = Math.max(points.at(-1)?.at || first, first + 1);
  const xy = points
    .map(
      (e) =>
        `${32 + ((e.at - first) / (last - first)) * 536},${150 - (e.occupancy / max) * 115}`,
    )
    .join(" ");
  return (
    <>
      {points.length ? (
        <>
          <svg
            className="gym-trend"
            viewBox="0 0 600 180"
            role="img"
            aria-label={`Today's recorded occupancy: ${points.length} readings, peak ${Math.max(...points.map((e) => e.occupancy))}. Current occupancy ${state.currentOccupancy} of ${state.maxCapacity}.`}
          >
            <line
              x1="32"
              x2="568"
              y1="35"
              y2="35"
              stroke="#a7b7bd"
              strokeDasharray="5 5"
            />
            <line x1="32" x2="568" y1="150" y2="150" stroke="#e5edef" />
            <text x="4" y="39" fill="#71818a" fontSize="11">
              {max}
            </text>
            <text x="12" y="154" fill="#71818a" fontSize="11">
              0
            </text>
            <polyline
              points={xy}
              fill="none"
              stroke="#07898a"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {points.length === 1 && (
              <circle
                cx="32"
                cy={150 - (points[0].occupancy / max) * 115}
                r="4"
                fill="#07898a"
              />
            )}
            <text x="32" y="173" fill="#71818a" fontSize="11">
              {new Date(first).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </text>
            <text x="568" y="173" textAnchor="end" fill="#71818a" fontSize="11">
              {new Date(last).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </text>
          </svg>
          <div className="gym-trend-summary">
            <div>
              <small>Peak recorded today</small>
              <strong>
                {Math.max(...points.map((e) => e.occupancy))}{" "}
                <span>inside</span>
              </strong>
            </div>
            <div>
              <small>Current utilization</small>
              <strong>
                {Math.round((state.currentOccupancy / state.maxCapacity) * 100)}
                <span>%</span>
              </strong>
            </div>
          </div>
        </>
      ) : (
        <Empty>
          <Activity size={26} />
          No occupancy history yet today. Check-ins and capacity updates will
          draw the trend.
        </Empty>
      )}
      <p className="gym-footnote">
        Event readings from this device’s calendar day; no estimated or
        backfilled history.
      </p>
    </>
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
}) => {
  const [state, setState] = useState<GymState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [form, setForm] = useState<FormSpec | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
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
      title: "Update live capacity",
      description: "Manual corrections are audited separately from check-ins.",
      fields: [
        {
          name: "maxCapacity",
          label: "Maximum capacity",
          type: "number",
          value: state.maxCapacity,
          min: 1,
          max: 100000,
        },
        {
          name: "currentOccupancy",
          label: "Inside now",
          type: "number",
          value: state.currentOccupancy,
          min: 0,
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
  const filters = (options: string[]) => (
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
  const todayClasses =
    state?.classesToday
      .filter(
        (c) => c.startsAt && localDay(new Date(c.startsAt)) === localDay(),
      )
      .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!)) || [];
  const trackedInside =
    state?.visits.filter((v) => !v.checkedOutAt).length || 0;
  const metrics = state && (
    <div className="gym-metrics">
      {[
        {
          title: "Inside now",
          value: state.currentOccupancy,
          sub: `of ${state.maxCapacity} capacity`,
          icon: Users,
          target: "capacity",
          action: "Manage capacity",
        },
        {
          title: "Max capacity",
          value: state.maxCapacity,
          sub: "people on the floor",
          icon: Activity,
          target: "capacity",
          action: "Edit capacity",
        },
        {
          title: "Available trainers",
          value: state.availableTrainersCount,
          sub: `${state.trainers.length} on the trainer roster`,
          icon: UserCheck,
          target: "trainers",
          action: "View trainers",
        },
        {
          title:
            role === "trainer"
              ? "Your active PT sessions"
              : "Active PT sessions",
          value: state.ptBookings.filter((p) => p.status === "In Progress")
            .length,
          sub: "in progress right now",
          icon: Dumbbell,
          target: "pt_bookings",
          action: "View PT bookings",
        },
      ].map((m, i) => (
        <section
          className={`gym-metric ${i === 0 ? "featured" : ""}`}
          key={m.title}
        >
          <div className="gym-metric-label">
            {m.title}
            <m.icon size={17} />
          </div>
          <strong>{m.value}</strong>
          <small>{m.sub}</small>
          {i === 0 && operator ? (
            <div className="gym-counter">
              <button
                aria-label="Quick anonymous / untracked check-out"
                disabled={
                  busy ||
                  !state.currentOccupancy ||
                  (state.currentOccupancy <= trackedInside &&
                    !state.visits.some(
                      (v) =>
                        !v.checkedOutAt && !v.memberId && v.name === "Walk-in",
                    ))
                }
                onClick={() =>
                  action(
                    () => gymStaffService.checkOut(gymId),
                    "Visitor checked out",
                  )
                }
              >
                <Minus size={19} />
              </button>
              <button
                aria-label="Quick anonymous check-in"
                disabled={busy || state.currentOccupancy >= state.maxCapacity}
                onClick={() =>
                  action(
                    () => gymStaffService.checkIn(gymId),
                    "Walk-in checked in",
                  )
                }
              >
                <Plus size={19} />
              </button>
            </div>
          ) : (
            <div className="gym-metric-spacer" />
          )}
          {i === 1 && manager ? (
            <button className="gym-link" onClick={editCapacity}>
              Edit capacity
              <ArrowRight size={14} />
            </button>
          ) : (
            go(m.target, m.action)
          )}
        </section>
      ))}
    </div>
  );
  const classList = (items: GymClass[]) =>
    items.length ? (
      <div className="gym-list">
        {items.map((c) => (
          <div className="gym-list-row" key={c.id}>
            <span className="gym-avatar">
              <CalendarDays size={18} />
            </span>
            <div>
              <strong>{c.title}</strong>
              <small>
                {c.startsAt ? dateTime(c.startsAt) : "Needs a date"} ·{" "}
                {c.trainer}
              </small>
            </div>
            <div className="gym-row-end">
              <Badge>{c.status || "Needs schedule"}</Badge>
              <small>
                {c.enrolled} / {c.maxCapacity} enrolled
              </small>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <Empty>No classes scheduled for today.</Empty>
    );
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
    <div className="gym-app">
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
                {m.id === "queue" && !!state?.waitingOutsideCount && (
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
              {["overview", "capacity"].includes(active) && metrics}
              {active === "overview" && (
                <>
                  <section className="gym-quick-actions">
                    <span className="gym-eyebrow">QUICK ACTIONS</span>
                    {operator && (
                      <>
                        <button
                          className="gym-button secondary"
                          disabled={busy}
                          onClick={openCheckin}
                        >
                          <LogIn size={17} />
                          Check in
                        </button>
                        <button
                          className="gym-button secondary"
                          onClick={() => navigate("checkin")}
                        >
                          <LogOut size={17} />
                          Check out
                        </button>
                      </>
                    )}
                    {(manager || role === "reception") && (
                      <button
                        className="gym-button secondary"
                        onClick={() => editSession("pt")}
                      >
                        <Dumbbell size={17} />
                        Add PT booking
                      </button>
                    )}
                    {manager && (
                      <>
                        <button
                          className="gym-button secondary"
                          onClick={() => navigate("classes")}
                        >
                          <CalendarDays size={17} />
                          Start class
                        </button>
                        <button
                          className="gym-button secondary"
                          onClick={editCapacity}
                        >
                          <Activity size={17} />
                          Capacity
                        </button>
                      </>
                    )}
                    {owner && (
                      <button
                        className="gym-button"
                        onClick={() => navigate("campaigns")}
                      >
                        <Plus size={17} />
                        Create campaign
                      </button>
                    )}
                    {!operator && (
                      <p className="gym-muted">
                        View your assigned PT bookings and class schedule from
                        the menu.
                      </p>
                    )}
                  </section>
                  {owner && (
                    <div className="gym-overview-feature">
                      <Panel
                        title="Campaign performance"
                        action={go("campaigns", "Manage campaigns")}
                      >
                        <p className="gym-muted">
                          All recorded activity · active campaigns right now
                        </p>
                        <CampaignMetrics
                          campaigns={state.campaigns}
                          events={state.events}
                        />
                        <p className="gym-footnote">
                          Conversion measures browser reach to recorded
                          interest, not sales.
                        </p>
                        {go("campaigns", "View analytics & export")}
                      </Panel>
                      <section className="gym-promo">
                        <Megaphone size={28} />
                        <span className="gym-eyebrow">
                          MAKE EVERY VISIT COUNT
                        </span>
                        <h2>A reason to come back.</h2>
                        <p>
                          Create scannable offers, gym updates and membership
                          promotions.
                        </p>
                        <button
                          className="gym-button"
                          onClick={() => navigate("campaigns")}
                        >
                          Build a campaign
                          <ArrowRight size={16} />
                        </button>
                      </section>
                    </div>
                  )}
                  <div className="gym-overview-grid">
                    {operator && (
                      <Panel
                        title="Live occupancy trend"
                        action={go("reports", "Reports")}
                      >
                        <OccupancyTrend state={state} />
                      </Panel>
                    )}
                    <Panel title="Today’s classes" action={go("classes")}>
                      {classList(todayClasses)}
                    </Panel>
                    <Panel title="Trainer availability" action={go("trainers")}>
                      {state.trainers.length ? (
                        <div className="gym-list">
                          {state.trainers.slice(0, 5).map((t) => (
                            <div className="gym-list-row" key={t.id}>
                              <span className="gym-avatar">
                                {t.name.charAt(0)}
                              </span>
                              <div>
                                <strong>{t.name}</strong>
                                <small>{t.role}</small>
                              </div>
                              <Badge>{t.status}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty>
                          Add trainers to see their availability here.
                        </Empty>
                      )}
                    </Panel>
                    {operator && (
                      <Panel title="Recent check-ins" action={go("checkin")}>
                        {state.visits.length ? (
                          <div className="gym-list">
                            {state.visits.slice(0, 5).map((v) => (
                              <div className="gym-list-row" key={v.id}>
                                <span className="gym-avatar">
                                  <LogIn size={17} />
                                </span>
                                <div>
                                  <strong>{v.name}</strong>
                                  <small>{dateTime(v.checkedInAt)}</small>
                                </div>
                                <Badge>
                                  {v.checkedOutAt ? "Left" : "Inside"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Empty>
                            Recent visitors appear after your first check-in.
                          </Empty>
                        )}
                      </Panel>
                    )}
                    {operator && (
                      <Panel title="Alerts & activity" action={go("reports")}>
                        {state.currentOccupancy / state.maxCapacity >= 0.85 && (
                          <div className="gym-alert">
                            High occupancy · {state.currentOccupancy} of{" "}
                            {state.maxCapacity} inside
                          </div>
                        )}
                        {state.waitingOutsideCount > 0 && (
                          <div className="gym-alert">
                            {state.waitingOutsideCount} visitors waiting for
                            entry
                          </div>
                        )}
                        {state.events.length ? (
                          <div className="gym-list">
                            {state.events
                              .slice(-5)
                              .reverse()
                              .map((e) => (
                                <div className="gym-list-row" key={e.id}>
                                  <span className="gym-event-marker" />
                                  <div>
                                    <strong>{e.subject}</strong>
                                    <small>
                                      {e.action} · {dateTime(e.at)}
                                    </small>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <Empty>No activity recorded yet.</Empty>
                        )}
                      </Panel>
                    )}
                    {operator && (
                      <Panel title="Today at a glance">
                        <div className="gym-summary-line">
                          <span>Recorded check-ins today</span>
                          <strong>
                            {
                              state.events.filter(
                                (e) =>
                                  e.action === "checkin" &&
                                  localDay(new Date(e.at)) === localDay(),
                              ).length
                            }
                          </strong>
                        </div>
                        <div className="gym-summary-line">
                          <span>Waiting outside</span>
                          <strong>{state.waitingOutsideCount}</strong>
                        </div>
                        <div className="gym-summary-line">
                          <span>Scheduled classes today</span>
                          <strong>{todayClasses.length}</strong>
                        </div>
                        <p className="gym-footnote">
                          Based only on saved records. Existing manual occupancy
                          is not counted as check-in history.
                        </p>
                        {go("reports", "Open operations reports")}
                      </Panel>
                    )}
                  </div>
                </>
              )}
              {active === "capacity" && (
                <div className="gym-two-columns">
                  <Panel title="Floor utilization">
                    <div className="gym-utilization">
                      <strong>
                        {Math.round(
                          (state.currentOccupancy / state.maxCapacity) * 100,
                        )}
                        %
                      </strong>
                      <span>
                        {Math.max(
                          0,
                          state.maxCapacity - state.currentOccupancy,
                        )}{" "}
                        spaces available
                      </span>
                    </div>
                    <progress
                      max={state.maxCapacity}
                      value={state.currentOccupancy}
                      aria-label="Capacity utilization"
                    />
                    {manager && (
                      <div className="gym-inline-actions">
                        <button className="gym-button" onClick={editCapacity}>
                          Edit capacity / count
                        </button>
                        <button
                          className="gym-button secondary"
                          onClick={editCount}
                        >
                          Set available trainers
                        </button>
                      </div>
                    )}
                    <p className="gym-footnote">
                      Use check-in / out for visits. Use count corrections only
                      to reconcile the floor.
                    </p>
                  </Panel>
                  <Panel title="Today’s recorded occupancy">
                    <OccupancyTrend state={state} />
                  </Panel>
                </div>
              )}
              {active === "checkin" && (
                <Panel
                  title="Visitor register"
                  action={
                    <button
                      className="gym-button"
                      onClick={openCheckin}
                      disabled={busy}
                    >
                      <Plus size={17} />
                      Check in
                    </button>
                  }
                >
                  {filters(["Inside", "Left"])}
                  {state.currentOccupancy > trackedInside && (
                    <div className="gym-setup">
                      <p>
                        {state.currentOccupancy - trackedInside} inside from
                        manual counts or earlier activity, without named visits.
                      </p>
                      <button
                        className="gym-button secondary"
                        disabled={busy}
                        onClick={() =>
                          action(
                            () => gymStaffService.checkOut(gymId),
                            "Untracked visitor checked out",
                          )
                        }
                      >
                        Check out one
                      </button>
                    </div>
                  )}
                  {!state.visits.filter((v) =>
                    matches(v.name, v.checkedOutAt ? "Left" : "Inside"),
                  ).length ? (
                    <Empty>
                      No matching visits. Check in a member or walk-in to begin.
                    </Empty>
                  ) : (
                    <div className="gym-list">
                      {state.visits
                        .filter((v) =>
                          matches(v.name, v.checkedOutAt ? "Left" : "Inside"),
                        )
                        .map((v) => (
                          <div className="gym-list-row" key={v.id}>
                            <span className="gym-avatar">
                              {v.name.charAt(0)}
                            </span>
                            <div>
                              <strong>{v.name}</strong>
                              <small>
                                In {dateTime(v.checkedInAt)}
                                {v.checkedOutAt
                                  ? ` · Out ${dateTime(v.checkedOutAt)}`
                                  : ""}
                              </small>
                            </div>
                            {v.checkedOutAt ? (
                              <Badge>Left</Badge>
                            ) : (
                              <button
                                className="gym-button secondary"
                                disabled={busy}
                                onClick={() =>
                                  action(
                                    () => gymStaffService.checkOut(gymId, v.id),
                                    "Visitor checked out",
                                  )
                                }
                              >
                                Check out
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </Panel>
              )}
              {active === "queue" && (
                <Panel
                  title="Waiting for entry"
                  action={
                    <button className="gym-button" onClick={addQueue}>
                      <Plus size={17} />
                      Add visitor
                    </button>
                  }
                >
                  {filters(["Waiting", "Admitted", "Removed"])}
                  {!state.entryQueue.filter((q) => matches(q.name, q.status))
                    .length ? (
                    <Empty>
                      The entry queue is clear. Add visitors when the floor is
                      full.
                    </Empty>
                  ) : (
                    <div className="gym-list">
                      {state.entryQueue
                        .filter((q) => matches(q.name, q.status))
                        .map((q) => (
                          <div className="gym-list-row" key={q.id}>
                            <span className="gym-avatar">
                              <Users size={18} />
                            </span>
                            <div>
                              <strong>{q.name}</strong>
                              <small>Arrived {dateTime(q.arrivedAt)}</small>
                            </div>
                            <Badge>{q.status}</Badge>
                            {q.status === "Waiting" && (
                              <div className="gym-inline-actions">
                                <button
                                  className="gym-button"
                                  disabled={
                                    busy ||
                                    state.currentOccupancy >= state.maxCapacity
                                  }
                                  onClick={() =>
                                    action(
                                      () =>
                                        gymStaffService.operate(
                                          gymId,
                                          "queue",
                                          { id: q.id, action: "admit" },
                                        ),
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
                                        operate("queue", {
                                          id: q.id,
                                          action: "remove",
                                        }),
                                    })
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </Panel>
              )}
              {active === "members" && (
                <Panel
                  title="Member directory"
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
            </>
          )}
          <footer className="gym-page-footer">
            <span>NOQ BUSINESS · GYM OPERATIONS</span>
            <span>
              {updated
                ? `Last synced ${new Date(updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : "Waiting for connection"}
            </span>
          </footer>
        </main>
      </div>
      {form && <FormDialog spec={form} close={() => setForm(null)} />}
    </div>
  );
};
