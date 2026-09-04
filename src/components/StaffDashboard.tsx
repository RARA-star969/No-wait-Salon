import React, { useEffect, useState } from 'react';
import { CancelBookingSheet } from './CancelBookingSheet';
import { QueueBookingCard } from './QueueBookingCard';
import {
  BOOKING_TABS,
  applyFilters,
  grossSummary,
  isCancelled,
  isCompleted,
  isLive,
  isReserved,
  isUpcoming,
  outcomeBadge,
  sourceLabel,
  type BookingFilters,
  type BookingTab,
} from '../shared/bookingBuckets';
import {
  Users,
  UserCheck,
  Scissors,
  Plus,
  Phone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserPlus,
  History,
  Trash2,
  Tag,
  Menu,
  X,
  ChevronRight,
  LayoutDashboard,
  Zap,
  CalendarDays,
  UsersRound,
  Receipt,
  ChartNoAxesCombined,
  Building2,
  Settings,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { QueueItem, Barber, Salon, SalonOffer, ServiceItem } from '../types';
import { WalkInModal } from './WalkInModal';
import { ui } from './ui';
// Shared owner Manage Profile surface (business logo, basic info, gallery,
// amenities, quick actions, social links) — historically Gym-only, now
// reused here so Salon owners get the same single profile-editing system
// instead of a second one. It is generic under the hood (the same
// /api/staff/business/* endpoints, scoped by the caller's own session), so
// nothing Gym-specific runs when a Salon owner opens it.
import { GymManageProfile } from './GymManageProfile';
import { resolveCategoryModules, StaffRole } from '../shared/categoryDashboardResolver';

interface StaffDashboardProps {
  salon: Salon;
  queue: QueueItem[];
  barbers: Barber[];
  completedList: QueueItem[];
  onBarberToggle: (barberIndex: number) => void;
  onAddWalkin: (
    name: string,
    phone: string,
    service: string,
    startImmediately?: boolean,
    selectedBarberIndex?: number
  ) => void;
  onQueueAction: (
    item: QueueItem,
    action: 'Call' | 'Acknowledge' | 'Start' | 'Complete' | 'No-show' | 'Remove' | 'Cancel-chair',
    reason?: { code: string; text: string },
    specificBarberIndex?: number
  ) => void;
  queueAlert: string;
  onSaveStaff: (staff: Barber[]) => void;
  onSaveOffers: (offers: SalonOffer[]) => void;
  /** Authenticated staff role from session.staff.role — never a local default.
   *  Drives every module's visibility and every sensitive action gate. */
  role: StaffRole;
  /** Lifted into StaffAppShell, same pattern as Gym's `gymModule`, so the
   *  selected screen survives independent of this component's own state. */
  activeModule: string;
  onModuleSelect: (moduleId: string) => void;
  onSignOut?: () => void;
  onSetup?: () => void;
  profileIncomplete?: boolean;
  /** Rendered inside the hosted TEST Staff preview panel rather than as the
   *  full-screen business surface — layout only, no behavior change. */
  embedded?: boolean;
}

const moduleIcons: Record<string, React.ElementType> = {
  overview: LayoutDashboard,
  live: Zap,
  bookings: CalendarDays,
  customers: UsersRound,
  staff: Users,
  services: Receipt,
  offers: Tag,
  reports: ChartNoAxesCombined,
  profile: Building2,
  settings: Settings,
};

/** Screens with no backend support yet — listed in the drawer (so the IA is
 *  visible and the resolver/clamp logic is real) but never fake data or a
 *  working write. */
const CONCEPT_MODULES: Record<string, { title: string; body: string }> = {
  customers: {
    title: 'Customers',
    body: 'A staff-scoped customer directory needs its own endpoint — today only an admin-only listing exists. This screen activates once that ships.',
  },
  services: {
    title: 'Services & Pricing',
    body: 'Services are read-only from the staff side today — there is no save path yet for editing them here. This screen activates once that ships.',
  },
  reports: {
    title: 'Reports',
    body: "Today's activity counts already live in Bookings. A dedicated Reports module with real revenue needs per-booking pricing first.",
  },
  settings: {
    title: 'Settings',
    body: 'No salon-facing settings endpoint exists yet — this screen activates once its scope is defined and built.',
  },
};

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  salon,
  queue,
  barbers,
  completedList,
  onBarberToggle,
  onAddWalkin,
  onQueueAction,
  queueAlert,
  onSaveStaff,
  onSaveOffers,
  role,
  activeModule,
  onModuleSelect,
  onSignOut,
  onSetup,
  profileIncomplete,
  embedded,
}) => {
  // Single ticking clock so every CALLED countdown re-renders each second.
  const [now, setNow] = useState(() => Date.now());
  const [cancelTarget, setCancelTarget] = useState<QueueItem | null>(null);
  const [bookingTab, setBookingTab] = useState<BookingTab>('live');
  const [filters, setFilters] = useState<BookingFilters>({ range: 'today', source: 'all', search: '' });
  const [navOpen, setNavOpen] = useState(false);
  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Android hardware Back closes the drawer first, never the dashboard.
  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    const onPopState = () => setNavOpen(false);
    window.history.pushState({ salonDrawer: true }, '');
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
    };
  }, [navOpen]);

  const categoryModules = resolveCategoryModules('salon', role);
  // Never trust an out-of-registry / no-longer-authorized module id — a role
  // downgrade mid-session or stale nav state falls back to Overview, exactly
  // like GymDashboardView's clamp.
  const active = categoryModules.some((m) => m.id === activeModule) ? activeModule : 'overview';
  const isOwner = role === 'owner';
  const isOwnerOrManager = isOwner || role === 'manager';

  const navigate = (moduleId: string) => {
    onModuleSelect(moduleId);
    setNavOpen(false);
  };

  const waitingCount = queue.filter((x) => x.status === 'Waiting').length;
  const servingCount = queue.filter((x) => x.status === 'Serving').length;
  const calledCount = queue.filter((x) => x.status === 'Called').length;
  const activeBarbers = barbers.filter((b) => b.status !== 'unavailable').length;
  const availableBarbers = barbers.filter((b) => b.status === 'available').length;
  const offDutyCount = barbers.filter((b) => b.status === 'unavailable').length;
  const summary = grossSummary(queue, completedList, now);

  const isDeactivated = salon.platformStatus === 'deactivated';

  if (isDeactivated) {
    return (
      <div id="staff-deactivated-blocking-overlay" className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 p-5 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-[#121A19] p-7 text-center shadow-2xl space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20">
            <XCircle className="h-9 w-9" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Your account has been deactivated</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Your business dashboard is currently unavailable. Please contact Support to resume your account.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="mailto:support@nowaitsalon.app?subject=Account%20Deactivation%20Support"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-500 active:scale-95"
            >
              <Phone className="h-4 w-4" />
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  const needsAttention: { id: string; label: string; sub: string; tone: 'warn' | 'danger' | 'neutral'; onClick: () => void }[] = [];
  if (calledCount > 0) {
    needsAttention.push({
      id: 'called',
      label: `${calledCount} customer${calledCount > 1 ? 's' : ''} called, awaiting arrival`,
      sub: 'Tap to open Live Salon',
      tone: 'warn',
      onClick: () => navigate('live'),
    });
  }
  if (offDutyCount > 0) {
    needsAttention.push({
      id: 'offduty',
      label: `${offDutyCount} staff off duty`,
      sub: 'Resolve in Staff & Chairs',
      tone: 'danger',
      onClick: () => navigate('staff'),
    });
  }
  if (summary.noShow > 0) {
    needsAttention.push({
      id: 'noshow',
      label: `${summary.noShow} no-show${summary.noShow > 1 ? 's' : ''} recorded`,
      sub: 'View in Bookings',
      tone: 'danger',
      onClick: () => {
        setBookingTab('cancelled');
        navigate('bookings');
      },
    });
  }
  if (queueAlert) {
    needsAttention.push({
      id: 'alert',
      label: 'Live sync needs attention',
      sub: queueAlert,
      tone: 'warn',
      onClick: () => navigate('live'),
    });
  }

  const attentionTone: Record<string, string> = {
    warn: 'bg-amber-500/15 text-amber-400',
    danger: 'bg-rose-500/15 text-rose-400',
    neutral: 'bg-[#2A7BFF]/15 text-[#7EB4FF]',
  };

  return (
    <div className={`relative flex w-full flex-col bg-[#0D1118] text-[#E6E8F0] ${embedded ? 'h-full' : 'h-full min-h-screen'}`}>
      {/* Off-canvas navigation drawer — same interaction pattern as Gym's
          sidebar: overlays/dims the active screen, lists every module the
          authenticated role is allowed, closes on selection / backdrop / X. */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="absolute inset-0 z-40 bg-black/60"
        />
      )}
      <aside
        id="salon-navigation"
        className={`absolute inset-y-0 left-0 z-50 flex w-[78%] max-w-[280px] flex-col border-r border-white/10 bg-[#141A24] shadow-2xl transition-transform duration-200 ease-out ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between px-4 pt-5 pb-3">
          <div>
            <div className="font-sans text-base font-extrabold tracking-tight text-[#E6E8F0]">
              NOQ<span className="text-[#2A7BFF]">BUSINESS</span>
            </div>
            <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#5E6779]">
              Workspace &middot; Salon
            </div>
          </div>
          <button
            id="salon-drawer-close"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-[#97A0B5]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <nav aria-label="Salon dashboard" className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-2">
          {categoryModules.map((mod) => {
            const Icon = moduleIcons[mod.id] || LayoutDashboard;
            const isActive = active === mod.id;
            const isConcept = Boolean(CONCEPT_MODULES[mod.id]);
            return (
              <button
                key={mod.id}
                id={`salon-drawer-item-${mod.id}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(mod.id)}
                className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition ${
                  isActive ? 'bg-[#2A7BFF]/15 text-[#8EBBFF]' : 'text-[#97A0B5] hover:bg-white/5'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[#2A7BFF]' : ''}`} />
                <span className="flex-1">{mod.label}</span>
                {isConcept && (
                  <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-[#5E6779]">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2.5 border-t border-white/10 px-4 py-3.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#5E6779]" />
          <div className="min-w-0 text-[9.5px] font-semibold leading-relaxed text-[#5E6779]">
            Business ID &middot; {salon.id}
            <br />
            Modules shown for role: <b className="text-[#97A0B5]">{role}</b>
          </div>
        </div>
      </aside>

      {/* Top header — hamburger, business identity, live status. */}
      <header className="flex shrink-0 items-center gap-2.5 border-b border-white/10 bg-[#0D1118] px-3.5 py-3">
        <button
          id="salon-hamburger"
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="salon-navigation"
          onClick={() => setNavOpen(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-[#E6E8F0]"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#2A7BFF] to-[#1857B8] font-sans text-xs font-extrabold text-white">
          {salon.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-[#E6E8F0]">{salon.name}</div>
          <div className="truncate text-[10px] font-semibold text-[#5E6779]">Salon workspace &middot; {role}</div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Live
        </span>
        {onSignOut && (
          <button
            id="salon-signout"
            aria-label="Sign out"
            onClick={onSignOut}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-[#97A0B5]"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      {profileIncomplete && (
        <div id="salon-profile-incomplete-banner" className="flex shrink-0 items-center justify-between gap-3 bg-amber-500/10 px-4 py-2 text-[11px] font-semibold text-amber-300">
          <span>Business profile incomplete</span>
          <button onClick={onSetup} className="font-bold underline">Complete setup</button>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto">
        {/* ---------------- OVERVIEW ---------------- */}
        {active === 'overview' && (
          <div className="space-y-5 p-4 pb-8">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#E6E8F0]">Overview</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[#97A0B5]">Your salon command center</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div id="overview-kpi-inservice" className="rounded-2xl border border-white/10 bg-[#141A24] p-3.5">
                <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#5E6779]">
                  <Scissors className="h-3 w-3 text-[#2A7BFF]" /> Inside Service
                </div>
                <div className="mt-1.5 text-2xl font-extrabold text-[#E6E8F0]">{servingCount}</div>
              </div>
              <div id="overview-kpi-waiting" className="rounded-2xl border border-white/10 bg-[#141A24] p-3.5">
                <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#5E6779]">
                  <Users className="h-3 w-3 text-[#2A7BFF]" /> Waiting
                </div>
                <div className="mt-1.5 text-2xl font-extrabold text-[#E6E8F0]">{waitingCount}</div>
                {calledCount > 0 && <div className="mt-0.5 text-[9.5px] font-bold text-amber-400">+{calledCount} called</div>}
              </div>
              <div id="overview-kpi-staff" className="rounded-2xl border border-white/10 bg-[#141A24] p-3.5">
                <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#5E6779]">
                  <UserCheck className="h-3 w-3 text-[#2A7BFF]" /> Staff Available
                </div>
                <div className="mt-1.5 text-2xl font-extrabold text-[#E6E8F0]">{availableBarbers}/{activeBarbers}</div>
              </div>
              <div id="overview-kpi-bookings" className="rounded-2xl border border-white/10 bg-[#141A24] p-3.5">
                <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#5E6779]">
                  <CalendarDays className="h-3 w-3 text-[#2A7BFF]" /> Today&apos;s Bookings
                </div>
                <div className="mt-1.5 text-2xl font-extrabold text-[#E6E8F0]">{summary.total}</div>
              </div>
              {/* Today's Collection is intentionally omitted: the queue has no
                  reliable per-booking price yet, so no revenue KPI is shown
                  rather than a fabricated or placeholder figure. */}
            </div>

            <div>
              <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#5E6779]">Quick actions</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="overview-qa-walkin"
                  onClick={() => setIsWalkinModalOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#2A7BFF] px-3 py-3 text-xs font-bold text-white active:scale-[0.98]"
                >
                  <UserPlus className="h-4 w-4" /> Add Walk-in
                </button>
                <button
                  id="overview-qa-live"
                  onClick={() => navigate('live')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-bold text-[#E6E8F0] active:scale-[0.98]"
                >
                  <Zap className="h-4 w-4 text-[#2A7BFF]" /> Open Live Salon
                </button>
                <button
                  id="overview-qa-bookings"
                  onClick={() => navigate('bookings')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-bold text-[#E6E8F0] active:scale-[0.98]"
                >
                  <CalendarDays className="h-4 w-4 text-[#2A7BFF]" /> Bookings
                </button>
                {isOwnerOrManager && (
                  <button
                    id="overview-qa-staff"
                    onClick={() => navigate('staff')}
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-bold text-[#E6E8F0] active:scale-[0.98]"
                  >
                    <Users className="h-4 w-4 text-[#2A7BFF]" /> Staff & Chairs
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5E6779]">Needs attention</span>
                {needsAttention.length > 0 && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-[#97A0B5]">{needsAttention.length}</span>
                )}
              </div>
              {needsAttention.length === 0 ? (
                <div id="overview-attention-empty" className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-[11px] font-semibold text-[#5E6779]">
                  All caught up — nothing needs attention right now.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {needsAttention.map((item) => (
                    <button
                      key={item.id}
                      id={`overview-attention-${item.id}`}
                      onClick={item.onClick}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#141A24] px-3 py-2.5 text-left"
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${attentionTone[item.tone]}`}>
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-[#E6E8F0]">{item.label}</span>
                        <span className="block truncate text-[10px] font-semibold text-[#5E6779]">{item.sub}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#5E6779]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- LIVE SALON ---------------- */}
        {active === 'live' && (
          <div className="space-y-4 p-4 pb-8">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#E6E8F0]">Live Salon</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[#97A0B5]">Real-time queue &amp; chair floor</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#141A24] p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#E6E8F0]">Team &amp; chairs</span>
                <span className="text-[10px] font-semibold text-[#5E6779]">Tap to toggle duty status</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {barbers.map((barber, index) => {
                  const isBusy = barber.status === 'busy';
                  const isAvailable = barber.status === 'available';
                  return (
                    <button
                      key={barber.id}
                      id={`barber-btn-${barber.id}`}
                      onClick={() => onBarberToggle(index)}
                      disabled={isBusy}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        isBusy
                          ? 'cursor-not-allowed border-amber-500/30 bg-amber-500/10 text-amber-300 opacity-90'
                          : isAvailable
                            ? 'border-[#2A7BFF]/30 bg-[#2A7BFF]/10 text-[#8EBBFF] hover:bg-[#2A7BFF]/15'
                            : 'border-white/10 bg-white/5 text-[#97A0B5] hover:bg-white/10'
                      }`}
                      title={isBusy ? `Currently serving: ${barber.currentCustomerName || 'Customer'}` : 'Toggle available/off-duty'}
                    >
                      <span className={`h-2 w-2 rounded-full ${isBusy ? 'animate-pulse bg-amber-400' : isAvailable ? 'bg-[#2A7BFF]' : 'bg-[#5E6779]'}`} />
                      <span>{barber.name}</span>
                      <span className="rounded bg-black/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                        {isBusy ? 'In Chair' : isAvailable ? 'Available' : 'Off-duty'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#E6E8F0]">Today&apos;s Live Queue ({queue.length})</span>
              <button
                id="add-walkin-popup-btn"
                onClick={() => setIsWalkinModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#2A7BFF] px-3 py-2 text-xs font-bold text-white active:scale-[0.98]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>+ Add Walk-in</span>
              </button>
            </div>

            {queueAlert && (
              <div id="staff-queue-alert" className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>{queueAlert}</span>
              </div>
            )}

            <div className="space-y-2.5">
              {queue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
                  <Users className="mx-auto mb-2 h-8 w-8 text-[#5E6779]" />
                  <p className="text-sm font-bold text-[#E6E8F0]">Queue is currently empty</p>
                  <p className="mb-3 mt-0.5 text-xs text-[#97A0B5]">Add a walk-in or wait for a Customer App / QR join.</p>
                  <button
                    onClick={() => setIsWalkinModalOpen(true)}
                    className="rounded-xl bg-[#2A7BFF] px-3.5 py-2 text-xs font-semibold text-white"
                  >
                    + Add Walk-In Customer
                  </button>
                </div>
              ) : (
                queue.map((item, index) => (
                  <QueueBookingCard key={item.id} item={item} position={index + 1} now={now} onAction={onQueueAction} onCancelChair={setCancelTarget} />
                ))
              )}
              <p className="pt-1 text-[11px] leading-relaxed text-[#5E6779]">
                <b className="text-[#97A0B5]">Start</b> seats the customer; <b className="text-[#97A0B5]">Complete</b> frees the chair.
                <b className="text-[#97A0B5]"> Cancel Chair</b> records why the salon dropped a booking, <b className="text-[#97A0B5]">No-show</b> means they never arrived.
              </p>
            </div>
          </div>
        )}

        {/* ---------------- BOOKINGS ---------------- */}
        {active === 'bookings' && (
          <div className="space-y-3 p-4 pb-8">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#E6E8F0]">Bookings</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[#97A0B5]">All queue activity &amp; history</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {BOOKING_TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`bookings-tab-${tab.id}`}
                  onClick={() => setBookingTab(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                    bookingTab === tab.id ? 'bg-[#2A7BFF] text-white' : 'border border-white/10 bg-white/5 text-[#97A0B5]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {bookingTab !== 'gross' && (
              <div className="flex flex-wrap items-center gap-1.5">
                {(['today', '7d', '30d', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setFilters((current) => ({ ...current, range }))}
                    className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                      filters.range === range ? 'bg-[#2A7BFF]/15 text-[#8EBBFF]' : 'border border-white/10 bg-white/5 text-[#97A0B5]'
                    }`}
                  >
                    {range === 'today' ? 'Today' : range === 'all' ? 'All' : range}
                  </button>
                ))}
                {(['all', 'customer_app', 'qr_web'] as const).map((source) => (
                  <button
                    key={source}
                    onClick={() => setFilters((current) => ({ ...current, source }))}
                    className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                      filters.source === source ? 'bg-[#2A7BFF]/15 text-[#8EBBFF]' : 'border border-white/10 bg-white/5 text-[#97A0B5]'
                    }`}
                  >
                    {source === 'all' ? 'All sources' : source === 'qr_web' ? 'Web QR' : 'App'}
                  </button>
                ))}
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Search customer or service"
                  className="h-7 min-w-[10rem] flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] text-[#E6E8F0] outline-none placeholder:text-[#5E6779] focus:border-[#2A7BFF]/50"
                />
              </div>
            )}

            {bookingTab === 'gross' ? (
              (() => {
                const tiles = [
                  ['Total bookings', String(summary.total)],
                  ['Live now', String(summary.live)],
                  ['Completed', String(summary.completed)],
                  ['No-shows', String(summary.noShow)],
                  ['Cancelled (customer)', String(summary.cancelledCustomer)],
                  ['Cancelled (salon)', String(summary.cancelledStaff)],
                  ['Completion rate', `${summary.completionRate}%`],
                  ['No-show rate', `${summary.noShowRate}%`],
                  ['Avg call attempts', String(summary.averageCallAttempts)],
                  ['From App', String(summary.fromApp)],
                  ['From Web QR', String(summary.fromWebQr)],
                ] as const;
                return (
                  <div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {tiles.map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-white/10 bg-[#141A24] p-3">
                          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#5E6779]">{label}</p>
                          <p className="mt-1 text-lg font-bold text-[#E6E8F0]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-[#5E6779]">
                      Activity counts only. Revenue is not shown because the queue does not carry a reliable per-booking price yet.
                    </p>
                  </div>
                );
              })()
            ) : (
              (() => {
                const source =
                  bookingTab === 'live'
                    ? queue.filter((item) => isLive(item, now))
                    : bookingTab === 'upcoming'
                      ? queue.filter(isUpcoming)
                      : bookingTab === 'reserved'
                        ? queue.filter(isReserved)
                        : bookingTab === 'completed'
                          ? completedList.filter(isCompleted)
                          : completedList.filter(isCancelled);
                const rows = applyFilters(source, filters, now);
                if (rows.length === 0) {
                  return (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                      <CheckCircle className="mx-auto mb-2 h-8 w-8 text-[#2A7BFF] opacity-60" />
                      <p className="text-xs text-[#97A0B5]">
                        {bookingTab === 'reserved' ? 'Reserved bookings are not supported yet.' : 'Nothing in this view for the selected filters.'}
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {rows.map((item, idx) => {
                      const badge = outcomeBadge(item);
                      const closed = bookingTab === 'completed' || bookingTab === 'cancelled';
                      const tone =
                        badge.tone === 'good'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : badge.tone === 'bad'
                            ? 'text-rose-300 bg-rose-500/10 border border-rose-500/20'
                            : 'text-amber-300 bg-amber-500/10 border border-amber-500/20';
                      return (
                        <div key={`${item.id}-${idx}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#141A24] p-3.5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <b className="font-sans text-sm font-bold text-[#E6E8F0]">{item.name}</b>
                              <span className="rounded bg-[#2A7BFF]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#8EBBFF]">
                                {sourceLabel(item)}
                                {(item.callAttempt || 0) > 1 ? ` · Call ${item.callAttempt}` : ''}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#97A0B5]">
                              {item.service}
                              {item.barberName ? ` · ${item.barberName}` : ''}
                              {item.cancelReasonCode ? ` · ${item.cancelReasonCode.replace(/_/g, ' ')}` : ''}
                            </div>
                          </div>
                          {closed ? (
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>{badge.label}</span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-[#97A0B5]">{item.status}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ---------------- STAFF & CHAIRS ---------------- */}
        {active === 'staff' && isOwnerOrManager && (
          <div className="p-4 pb-8">
            <h2 className="mb-0.5 text-lg font-extrabold tracking-tight text-[#E6E8F0]">Staff &amp; Chairs</h2>
            <p className="mb-3 text-[11px] font-semibold text-[#97A0B5]">Same records Customer App reads</p>
            <ManageStaff barbers={barbers} allServices={salon.services} onSave={onSaveStaff} />
          </div>
        )}

        {/* ---------------- OFFERS & CAMPAIGNS ---------------- */}
        {active === 'offers' && isOwnerOrManager && (
          <div className="p-4 pb-8">
            <h2 className="mb-0.5 text-lg font-extrabold tracking-tight text-[#E6E8F0]">Offers &amp; Campaigns</h2>
            <p className="mb-3 text-[11px] font-semibold text-[#97A0B5]">Same records Price Breakdown reads</p>
            <ManageOffers offers={salon.offers || []} allServices={salon.services} onSave={onSaveOffers} />
            <p className="mt-3 text-[10px] leading-relaxed text-[#5E6779]">
              <b className="text-[#97A0B5]">Campaigns</b> (scheduled, multi-step promos) has no backend yet — only the Offers above are real and interactive.
            </p>
          </div>
        )}

        {/* ---------------- BUSINESS PROFILE (shared profile editor) ---------------- */}
        {active === 'profile' && isOwnerOrManager && (
          <GymManageProfile gymId={salon.id} gymName={salon.name} onClose={() => navigate('overview')} />
        )}

        {/* ---------------- CONCEPT / BACKEND-DEPENDENT MODULES ---------------- */}
        {CONCEPT_MODULES[active] && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-[#5E6779]">
              {React.createElement(moduleIcons[active] || LayoutDashboard, { className: 'h-6 w-6' })}
            </div>
            <b className="text-sm text-[#E6E8F0]">{CONCEPT_MODULES[active].title}</b>
            <p className="max-w-[34ch] text-[11.5px] leading-relaxed text-[#97A0B5]">{CONCEPT_MODULES[active].body}</p>
            <span className="mt-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-wide text-[#5E6779]">
              Coming next
            </span>
          </div>
        )}
      </main>

      <CancelBookingSheet
        open={Boolean(cancelTarget)}
        audience="staff"
        title="Cancel chair"
        onClose={() => setCancelTarget(null)}
        onConfirm={(code, text) => {
          if (cancelTarget) onQueueAction(cancelTarget, 'Cancel-chair', { code, text });
          setCancelTarget(null);
        }}
      />

      <WalkInModal isOpen={isWalkinModalOpen} onClose={() => setIsWalkinModalOpen(false)} salon={salon} barbers={barbers} onAddWalkin={onAddWalkin} />
    </div>
  );
};

let manageStaffDraftId = 0;

/**
 * Operational staff management for the SAME salon_staff records the
 * customer-facing stylist list reads — writes go through the save_staff
 * command, which reconciles into the live queue state immediately, so a
 * change here reaches Customer App without a queue reset.
 */
const ManageStaff: React.FC<{ barbers: Barber[]; allServices: ServiceItem[]; onSave: (staff: Barber[]) => void }> = ({ barbers, allServices, onSave }) => {
  const [draft, setDraft] = useState<Barber[]>(barbers);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(barbers);
  }, [barbers, dirty]);

  const update = (id: string, patch: Partial<Barber>) => {
    setDraft((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setDirty(true);
  };

  const toggleSkill = (id: string, serviceId: string) => {
    setDraft((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const current = row.serviceIds || [];
      const next = current.includes(serviceId) ? current.filter((sid) => sid !== serviceId) : [...current, serviceId];
      return { ...row, serviceIds: next };
    }));
    setDirty(true);
  };

  const addStaff = () => {
    manageStaffDraftId += 1;
    setDraft((rows) => [...rows, { id: `new-${Date.now()}-${manageStaffDraftId}`, name: '', role: 'Barber', status: 'available', active: true, serviceIds: [] }]);
    setDirty(true);
  };

  const removeStaff = (id: string) => {
    setDraft((rows) => rows.filter((row) => row.id !== id));
    setDirty(true);
  };

  const save = () => {
    onSave(draft);
    setDirty(false);
  };

  return (
    <div className="space-y-3">
      <div className={`${ui.card} p-4`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="block text-xs font-bold text-[#17201F]">Staff profiles</span>
            <span className="mt-0.5 block text-[10px] text-[#6F7C7A]">Same records customers see in Join Queue &middot; photo, role, skills, duty status</span>
          </div>
          <button
            id="manage-staff-save-btn"
            onClick={save}
            disabled={!dirty}
            className={`${ui.primaryButton} px-3 py-2 text-xs disabled:opacity-40`}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {draft.map((staff) => (
          <div key={staff.id} id={`manage-staff-row-${staff.id}`} className={`${ui.card} p-3.5 ${staff.active === false ? 'opacity-55' : ''}`}>
            <div className="flex items-start gap-3">
              {staff.photoUrl ? (
                <img src={staff.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#173B38] to-[#3F746D] text-sm font-bold text-white">
                  {(staff.name || '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                  Name
                  <input value={staff.name} onChange={(e) => update(staff.id, { name: e.target.value })} className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F] normal-case" placeholder="Full name" />
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                  Role / title
                  <input value={staff.role || ''} onChange={(e) => update(staff.id, { role: e.target.value })} className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F] normal-case" placeholder="Senior Barber" />
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A] sm:col-span-2">
                  Photo URL
                  <input value={staff.photoUrl || ''} onChange={(e) => update(staff.id, { photoUrl: e.target.value })} className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F] normal-case" placeholder="https://…" />
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                  Duty status
                  <select value={staff.status} onChange={(e) => update(staff.id, { status: e.target.value as Barber['status'] })} className="h-9 rounded-lg border border-[#E1E7E6] px-2 text-xs font-bold text-[#17201F] normal-case">
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="unavailable">Off duty</option>
                  </select>
                </label>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-[#17201F]">
                    <input type="checkbox" checked={staff.active !== false} onChange={(e) => update(staff.id, { active: e.target.checked })} className="h-4 w-4 accent-[#0F766E]" />
                    Visible to customers
                  </label>
                  <button id={`manage-staff-remove-${staff.id}`} onClick={() => removeStaff(staff.id)} aria-label={`Remove ${staff.name || 'staff member'}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#E1E7E6] text-rose-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                  Rating (1.0 - 5.0)
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={staff.rating ?? 4.8}
                    onChange={(e) => update(staff.id, { rating: parseFloat(e.target.value) || 4.8 })}
                    className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F] normal-case"
                    placeholder="4.8"
                  />
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                  Review Count
                  <input
                    type="number"
                    min="0"
                    value={staff.reviewCount ?? 0}
                    onChange={(e) => update(staff.id, { reviewCount: parseInt(e.target.value, 10) || 0 })}
                    className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F] normal-case"
                    placeholder="98"
                  />
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A] sm:col-span-2">
                  Experience (Years)
                  <input
                    type="number"
                    min="0"
                    value={staff.experienceYears ?? 3}
                    onChange={(e) => update(staff.id, { experienceYears: parseInt(e.target.value, 10) || 0 })}
                    className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F] normal-case"
                    placeholder="5"
                  />
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A] sm:col-span-2">
                  Specialties (comma-separated)
                  <input
                    value={(staff.specialties || []).join(', ')}
                    onChange={(e) =>
                      update(staff.id, {
                        specialties: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F] normal-case"
                    placeholder="Skin Fade Specialist, Beard Sculpting, Hot Towel"
                  />
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A] sm:col-span-2">
                  About / Bio
                  <textarea
                    rows={2}
                    value={staff.bio || ''}
                    onChange={(e) => update(staff.id, { bio: e.target.value })}
                    className="rounded-lg border border-[#E1E7E6] p-2.5 text-xs font-medium text-[#17201F] normal-case"
                    placeholder="Short bio describing expertise and styling focus..."
                  />
                </label>
              </div>
            </div>
            {allServices.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#EEF3F2] pt-3">
                {allServices.map((service) => {
                  const on = (staff.serviceIds || []).includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleSkill(staff.id, service.id)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${on ? 'bg-[#0F766E] text-white' : 'bg-[#EEF3F2] text-[#6F7C7A]'}`}
                    >
                      {service.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        <button id="manage-staff-add-btn" onClick={addStaff} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#0F766E]/40 py-3 text-xs font-bold text-[#0F766E]">
          <Plus className="h-3.5 w-3.5" /> Add staff member
        </button>
      </div>
    </div>
  );
};

let manageOffersDraftId = 0;

/**
 * Operational offer/coupon management for the SAME salon_offer records
 * Admin's salon editor and the customer-facing price breakdown read — writes
 * go through the save_offers command, so an offer activated here is what
 * the customer applies, same as ManageStaff above for the staff roster.
 */
const ManageOffers: React.FC<{ offers: SalonOffer[]; allServices: ServiceItem[]; onSave: (offers: SalonOffer[]) => void }> = ({ offers, allServices, onSave }) => {
  const [draft, setDraft] = useState<SalonOffer[]>(offers);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(offers);
  }, [offers, dirty]);

  const update = (id: string, patch: Partial<SalonOffer>) => {
    setDraft((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setDirty(true);
  };

  const toggleEligibleService = (id: string, serviceId: string) => {
    setDraft((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const current = row.eligibleServiceIds || [];
      const next = current.includes(serviceId) ? current.filter((sid) => sid !== serviceId) : [...current, serviceId];
      return { ...row, eligibleServiceIds: next };
    }));
    setDirty(true);
  };

  const addOffer = () => {
    manageOffersDraftId += 1;
    setDraft((rows) => [
      ...rows,
      { id: `new-${Date.now()}-${manageOffersDraftId}`, title: '', discount: '', code: '', discountType: 'percent', discountValue: 0, minimumBillInr: 0, active: true, eligibleServiceIds: [] },
    ]);
    setDirty(true);
  };

  const removeOffer = (id: string) => {
    setDraft((rows) => rows.filter((row) => row.id !== id));
    setDirty(true);
  };

  const save = () => {
    onSave(draft);
    setDirty(false);
  };

  return (
    <div className="space-y-3">
      <div className={`${ui.card} p-4`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="block text-xs font-bold text-[#17201F]">Offers &amp; discounts</span>
            <span className="mt-0.5 block text-[10px] text-[#6F7C7A]">Same records customers see in Price breakdown &middot; percent or fixed ₹, minimum bill, validity</span>
          </div>
          <button
            id="manage-offers-save-btn"
            onClick={save}
            disabled={!dirty}
            className={`${ui.primaryButton} px-3 py-2 text-xs disabled:opacity-40`}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {draft.map((offer) => (
          <div key={offer.id} id={`manage-offer-row-${offer.id}`} className={`${ui.card} p-3.5 ${offer.active === false ? 'opacity-55' : ''}`}>
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                Title
                <input value={offer.title} onChange={(e) => update(offer.id, { title: e.target.value })} className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F] normal-case" placeholder="Festive Special" />
              </label>
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                Code (optional)
                <input value={offer.code || ''} onChange={(e) => update(offer.id, { code: e.target.value.toUpperCase() })} className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-bold uppercase text-[#17201F]" placeholder="FEST20" />
              </label>
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                Discount type
                <select value={offer.discountType || 'percent'} onChange={(e) => update(offer.id, { discountType: e.target.value as 'percent' | 'fixed' })} className="h-9 rounded-lg border border-[#E1E7E6] px-2 text-xs font-bold text-[#17201F] normal-case">
                  <option value="percent">Percentage %</option>
                  <option value="fixed">Fixed ₹</option>
                </select>
              </label>
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                Discount value
                <input type="number" min={0} value={offer.discountValue ?? 0} onChange={(e) => update(offer.id, { discountValue: Number(e.target.value) })} className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F]" />
              </label>
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                Minimum bill ₹
                <input type="number" min={0} value={offer.minimumBillInr ?? 0} onChange={(e) => update(offer.id, { minimumBillInr: Number(e.target.value) })} className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F]" />
              </label>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[11px] font-bold text-[#17201F]">
                  <input type="checkbox" checked={offer.active !== false} onChange={(e) => update(offer.id, { active: e.target.checked })} className="h-4 w-4 accent-[#0F766E]" />
                  Active
                </label>
                <button id={`manage-offer-remove-${offer.id}`} onClick={() => removeOffer(offer.id)} aria-label={`Remove ${offer.title || 'offer'}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#E1E7E6] text-rose-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                Start date
                <input type="date" value={offer.startDate || ''} onChange={(e) => update(offer.id, { startDate: e.target.value })} className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F]" />
              </label>
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
                End date
                <input type="date" value={offer.endDate || ''} onChange={(e) => update(offer.id, { endDate: e.target.value })} className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F]" />
              </label>
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A] sm:col-span-2">
                Terms (optional)
                <input value={offer.terms || ''} onChange={(e) => update(offer.id, { terms: e.target.value })} className="h-9 rounded-lg border border-[#E1E7E6] px-2.5 text-xs font-medium text-[#17201F] normal-case" placeholder="Not combinable with other offers" />
              </label>
            </div>
            {allServices.length > 0 && (
              <div className="mt-3 border-t border-[#EEF3F2] pt-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">Eligible services (none checked = all services)</p>
                <div className="flex flex-wrap gap-1.5">
                  {allServices.map((service) => {
                    const on = (offer.eligibleServiceIds || []).includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleEligibleService(offer.id, service.id)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${on ? 'bg-[#0F766E] text-white' : 'bg-[#EEF3F2] text-[#6F7C7A]'}`}
                      >
                        {service.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        <button id="manage-offers-add-btn" onClick={addOffer} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#0F766E]/40 py-3 text-xs font-bold text-[#0F766E]">
          <Plus className="h-3.5 w-3.5" /> Add offer
        </button>
      </div>
    </div>
  );
};
