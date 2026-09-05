import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { CancelBookingSheet } from './CancelBookingSheet';
import { QueueBookingCard } from './QueueBookingCard';
import { BookingRecordCard } from './BookingRecordCard';
import {
  BOOKING_TABS,
  applyFilters,
  grossSummary,
  isCancelled,
  isCompleted,
  isLive,
  isReserved,
  isUpcoming,
  type BookingFilters,
  type BookingTab,
} from '../shared/bookingBuckets';
import { businessNotificationService } from '../services/businessNotificationService';
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
  Power,
  Search,
  CalendarClock,
  Star,
  Eye,
  EyeOff,
  BarChart3,
  Clock,
  Pencil,
} from 'lucide-react';
import { QueueItem, Barber, Salon, SalonOffer, ServiceItem } from '../types';
import { WalkInModal } from './WalkInModal';
import { ui, ModalShell } from './ui';
import { fetchStaffPerformance, type StaffPerformanceRow, type StaffPerformanceRange } from '../services/staffPerformanceService';
import {
  fetchOwnerServices,
  createOwnerService,
  updateOwnerService,
  setOwnerServiceVisibility,
  type OwnerService,
  type ServiceDraft,
} from '../services/staffServicesService';
import { setBusinessOpenStatus } from '../services/businessOpenStatusService';
// Shared owner Manage Profile surface (business logo, basic info, gallery,
// amenities, quick actions, social links) — historically Gym-only, now
// reused here so Salon owners get the same single profile-editing system
// instead of a second one. It is generic under the hood (the same
// /api/staff/business/* endpoints, scoped by the caller's own session), so
// nothing Gym-specific runs when a Salon owner opens it.
import { GymManageProfile } from './GymManageProfile';
import { CustomersModule } from './CustomersModule';
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
    specificBarberIndex?: number,
    /** Chosen only by the Live Salon Payment Confirmation sheet, on 'Complete'.
     *  Absent for every other action and every other call site. */
    paymentMethod?: 'cash' | 'online'
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
  reports: {
    title: 'Reports',
    body: "Today's activity counts already live in Bookings. A dedicated Reports module with real revenue needs per-booking pricing first.",
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
  const [openStatusPending, setOpenStatusPending] = useState(false);
  const [openStatusError, setOpenStatusError] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Escape closes the drawer for web/TEST keyboard use — unrelated to the
  // native Android hardware-back handling below.
  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  // Android/Capacitor hardware back button — same established pattern as
  // CustomerApp's `handleHardwareBack`: deepest overlay closes first and
  // consumes the event, nothing else is handled here since this is the
  // dashboard's own root. On web/iOS the 'backButton' event never fires, so
  // browser Escape/back above stays the only web/TEST behavior; this never
  // touches browser history, so repeatedly opening/closing the drawer never
  // accumulates history entries.
  const handleHardwareBack = useCallback((): boolean => {
    if (cancelTarget) { setCancelTarget(null); return true; }
    if (isWalkinModalOpen) { setIsWalkinModalOpen(false); return true; }
    if (navOpen) { setNavOpen(false); return true; }
    return false;
  }, [cancelTarget, isWalkinModalOpen, navOpen]);

  // Always call the latest handler without resubscribing the native listener
  // on every state change.
  const handleHardwareBackRef = useRef(handleHardwareBack);
  useEffect(() => { handleHardwareBackRef.current = handleHardwareBack; }, [handleHardwareBack]);
  useEffect(() => {
    const listenerHandle = CapacitorApp.addListener('backButton', () => {
      const handled = handleHardwareBackRef.current();
      if (!handled) void CapacitorApp.exitApp();
    });
    return () => { void listenerHandle.then((handle) => handle.remove()); };
  }, []);

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
  // Bookings tile counts — same buckets the tabs below already render from,
  // so a tile can never disagree with the list under it.
  const liveTileCount = queue.filter((item) => isLive(item, now)).length;
  const upcomingTileCount = queue.filter(isUpcoming).length;
  const completedTileCount = completedList.filter(isCompleted).length;
  const cancelledTileCount = completedList.filter(isCancelled).length;

  const isDeactivated = salon.platformStatus === 'deactivated';

  // Owner/manager Open Now / Closed Now control. `salon.isOpen` is the real,
  // server-persisted source of truth (synced over the same SSE snapshot the
  // live queue already rides) — never local-only state. Admin's platform
  // status (deactivated, above) already overrides this: a deactivated
  // business never reaches this control at all.
  const handleToggleOpenStatus = async () => {
    setOpenStatusPending(true);
    setOpenStatusError('');
    try {
      await setBusinessOpenStatus(!salon.isOpen);
    } catch (error) {
      setOpenStatusError(error instanceof Error ? error.message : 'Could not update business status.');
    } finally {
      setOpenStatusPending(false);
    }
  };

  if (isDeactivated) {
    return (
      <div id="staff-deactivated-blocking-overlay" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-5 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-2xl space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
            <XCircle className="h-9 w-9" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-[#17201F] tracking-tight">Your account has been deactivated</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6F7C7A]">
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
      sub: 'Resolve in Staff Members',
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
    warn: 'bg-amber-50 text-amber-600',
    danger: 'bg-rose-50 text-rose-600',
    neutral: 'bg-[#3454FD]/10 text-[#3454FD]',
  };

  return (
    // A bounded height is required for <main>'s overflow-y-auto to be the
    // one real scroll container (see the Salon scroll-bug note in git
    // history): h-dvh when this owns the whole screen, or plain h-full when
    // `embedded` inside the hosted TEST panel's already-bounded wrapper.
    <div className={`relative flex w-full flex-col bg-[#F8FAFA] text-[#17201F] ${embedded ? 'h-full' : 'h-dvh'}`}>
      {/* Off-canvas navigation drawer — same interaction pattern as Gym's
          sidebar: overlays/dims the active screen, lists every module the
          authenticated role is allowed, closes on selection / backdrop / X. */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="absolute inset-0 z-40 bg-black/40"
        />
      )}
      <aside
        id="salon-navigation"
        className={`absolute inset-y-0 left-0 z-50 flex w-[78%] max-w-[280px] flex-col border-r border-[#E1E7E6] bg-white shadow-2xl transition-transform duration-200 ease-out ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between px-4 pt-5 pb-3">
          <div>
            <div className="font-sans text-base font-extrabold tracking-tight text-[#17201F]">
              NOQ<span className="text-[#3454FD]">BUSINESS</span>
            </div>
            <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7A8785]">
              Workspace &middot; Salon
            </div>
          </div>
          <button
            id="salon-drawer-close"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[#E1E7E6] bg-[#F4F7F6] text-[#6F7C7A]"
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
                  isActive ? 'bg-[#3454FD]/10 text-[#3454FD]' : 'text-[#6F7C7A] hover:bg-[#F4F7F6]'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[#3454FD]' : ''}`} />
                <span className="flex-1">{mod.label}</span>
                {isConcept && (
                  <span className="shrink-0 rounded-md border border-[#E1E7E6] bg-[#F4F7F6] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-[#7A8785]">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2.5 border-t border-[#E1E7E6] px-4 py-3.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#7A8785]" />
          <div className="min-w-0 text-[9.5px] font-semibold leading-relaxed text-[#7A8785]">
            Business ID &middot; {salon.id}
            <br />
            Modules shown for role: <b className="text-[#6F7C7A]">{role}</b>
          </div>
        </div>
      </aside>

      {/* Top header — hamburger (left), business identity (middle),
          business logo/avatar (right). No LIVE badge, no Sign Out here —
          Sign Out lives only in Settings, reachable by every role. */}
      <header className="flex shrink-0 items-center gap-2.5 border-b border-[#E1E7E6] bg-white px-3.5 py-3">
        <button
          id="salon-hamburger"
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="salon-navigation"
          onClick={() => setNavOpen(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#E1E7E6] bg-[#F4F7F6] text-[#17201F]"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-[#17201F]">{salon.name}</div>
          <div className="truncate text-[10px] font-semibold text-[#7A8785]">Salon workspace &middot; {role}</div>
        </div>
        {salon.logoImageUrl ? (
          <img
            id="salon-header-logo"
            src={salon.logoImageUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#3454FD] to-[#1D36C9] font-sans text-xs font-extrabold text-white">
            {salon.name.charAt(0).toUpperCase()}
          </div>
        )}
      </header>

      {profileIncomplete && (
        <div id="salon-profile-incomplete-banner" className="flex shrink-0 items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-[11px] font-semibold text-amber-700">
          <span>Business profile incomplete</span>
          <button onClick={onSetup} className="font-bold underline">Complete setup</button>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto">
        {/* ---------------- OVERVIEW ---------------- */}
        {active === 'overview' && (
          <div className="space-y-5 p-4 pb-8">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#17201F]">Overview</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[#6F7C7A]">Your salon command center</p>
            </div>

            {/* Real owner Open Now / Closed Now control — the physical,
                live-operations status, never the Admin platform Active/
                Inactive listing control. `salon.isOpen` is the persisted,
                server-synced source of truth. */}
            <div id="overview-open-status" className={`rounded-2xl border p-3.5 ${salon.isOpen ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${salon.isOpen ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}>
                    <Power className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <div className={`text-xs font-extrabold uppercase tracking-wide ${salon.isOpen ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {salon.isOpen ? 'Open now' : 'Closed now'}
                    </div>
                    <div className="mt-0.5 text-[10.5px] font-semibold text-[#6F7C7A]">
                      {salon.isOpen ? 'Customers can join the live queue.' : 'New queue joins are blocked. Existing bookings stay untouched.'}
                    </div>
                  </div>
                </div>
                {isOwnerOrManager && (
                  <button
                    id="overview-open-status-toggle"
                    onClick={handleToggleOpenStatus}
                    disabled={openStatusPending}
                    className={`shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-50 ${
                      salon.isOpen ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    {openStatusPending ? 'Saving…' : salon.isOpen ? 'Close Business' : 'Open Business'}
                  </button>
                )}
              </div>
              {openStatusError && <p className="mt-2 text-[10.5px] font-semibold text-rose-700">{openStatusError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div id="overview-kpi-inservice" className="rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
                <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#7A8785]">
                  <Scissors className="h-3 w-3 text-[#3454FD]" /> Inside Service
                </div>
                <div className="mt-1.5 text-2xl font-extrabold text-[#17201F]">{servingCount}</div>
              </div>
              <div id="overview-kpi-waiting" className="rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
                <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#7A8785]">
                  <Users className="h-3 w-3 text-[#3454FD]" /> Waiting
                </div>
                <div className="mt-1.5 text-2xl font-extrabold text-[#17201F]">{waitingCount}</div>
                {calledCount > 0 && <div className="mt-0.5 text-[9.5px] font-bold text-amber-600">+{calledCount} called</div>}
              </div>
              <div id="overview-kpi-staff" className="rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
                <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#7A8785]">
                  <UserCheck className="h-3 w-3 text-[#3454FD]" /> Staff Available
                </div>
                <div className="mt-1.5 text-2xl font-extrabold text-[#17201F]">{availableBarbers}/{activeBarbers}</div>
              </div>
              <div id="overview-kpi-bookings" className="rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
                <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#7A8785]">
                  <CalendarDays className="h-3 w-3 text-[#3454FD]" /> Today&apos;s Bookings
                </div>
                <div className="mt-1.5 text-2xl font-extrabold text-[#17201F]">{summary.total}</div>
              </div>
              {/* Today's Collection is intentionally omitted: the queue has no
                  reliable per-booking price yet, so no revenue KPI is shown
                  rather than a fabricated or placeholder figure. */}
            </div>

            <div>
              <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#7A8785]">Quick actions</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="overview-qa-walkin"
                  onClick={() => setIsWalkinModalOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#3454FD] px-3 py-3 text-xs font-bold text-white active:scale-[0.98]"
                >
                  <UserPlus className="h-4 w-4" /> Add Walk-in
                </button>
                <button
                  id="overview-qa-live"
                  onClick={() => navigate('live')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#E1E7E6] bg-white px-3 py-3 text-xs font-bold text-[#17201F] active:scale-[0.98]"
                >
                  <Zap className="h-4 w-4 text-[#3454FD]" /> Open Live Salon
                </button>
                <button
                  id="overview-qa-bookings"
                  onClick={() => navigate('bookings')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#E1E7E6] bg-white px-3 py-3 text-xs font-bold text-[#17201F] active:scale-[0.98]"
                >
                  <CalendarDays className="h-4 w-4 text-[#3454FD]" /> Bookings
                </button>
                {isOwnerOrManager && (
                  <button
                    id="overview-qa-staff"
                    onClick={() => navigate('staff')}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[#E1E7E6] bg-white px-3 py-3 text-xs font-bold text-[#17201F] active:scale-[0.98]"
                  >
                    <Users className="h-4 w-4 text-[#3454FD]" /> Staff Members
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7A8785]">Needs attention</span>
                {needsAttention.length > 0 && (
                  <span className="rounded-full bg-[#F4F7F6] px-2 py-0.5 text-[10px] font-bold text-[#6F7C7A]">{needsAttention.length}</span>
                )}
              </div>
              {needsAttention.length === 0 ? (
                <div id="overview-attention-empty" className="rounded-2xl border border-dashed border-[#E1E7E6] bg-[#F8FAFA] p-4 text-center text-[11px] font-semibold text-[#7A8785]">
                  All caught up — nothing needs attention right now.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {needsAttention.map((item) => (
                    <button
                      key={item.id}
                      id={`overview-attention-${item.id}`}
                      onClick={item.onClick}
                      className="flex w-full items-center gap-3 rounded-xl border border-[#E1E7E6] bg-white px-3 py-2.5 text-left"
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${attentionTone[item.tone]}`}>
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-[#17201F]">{item.label}</span>
                        <span className="block truncate text-[10px] font-semibold text-[#7A8785]">{item.sub}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#7A8785]" />
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
              <h2 className="text-lg font-extrabold tracking-tight text-[#17201F]">Live Salon</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[#6F7C7A]">Real-time queue &amp; chair floor</p>
            </div>

            <div className="rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#17201F]">Team &amp; chairs</span>
                <span className="text-[10px] font-semibold text-[#7A8785]">Tap to toggle duty status</span>
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
                          ? 'cursor-not-allowed border-amber-300 bg-amber-50 text-amber-700 opacity-90'
                          : isAvailable
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-[#E1E7E6] bg-[#F8FAFA] text-[#6F7C7A] hover:bg-[#EEF3F2]'
                      }`}
                      title={isBusy ? `Currently serving: ${barber.currentCustomerName || 'Customer'}` : 'Toggle available/off-duty'}
                    >
                      <span className={`h-2 w-2 rounded-full ${isBusy ? 'animate-pulse bg-amber-500' : isAvailable ? 'bg-emerald-500' : 'bg-[#7A8785]'}`} />
                      <span>{barber.name}</span>
                      <span className="rounded bg-black/10 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                        {isBusy ? 'In Chair' : isAvailable ? 'Available' : 'Off-duty'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              {/* No count in the heading: the total already lives in the
                  summary strip directly below, derived from the same queue. */}
              <span className="text-[11px] font-bold text-[#17201F]">Today&apos;s Live Queue</span>
              <button
                id="add-walkin-popup-btn"
                onClick={() => setIsWalkinModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#3454FD] px-3 py-2 text-xs font-bold text-white active:scale-[0.98]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>+ Add Walk-in</span>
              </button>
            </div>

            {/* Queue summary strip — the owner's one-glance operational
                counts. Purely derived from `queue`, same source the cards
                below render from, so it can never disagree with them. */}
            <div id="live-queue-summary" className="rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
              <div className="grid grid-cols-4 gap-2">
                <div className="min-w-0 text-center">
                  <div className="truncate text-[9px] font-extrabold uppercase tracking-wider text-[#7A8785]">Total in Queue</div>
                  {/* Bare number only, and always the sum of the three
                      operational counts below — all four are derived from
                      this same `queue` array the cards render from, so the
                      total can never disagree with them. */}
                  <div className="mt-1 text-lg font-extrabold text-[#17201F]">{servingCount + calledCount + waitingCount}</div>
                </div>
                <div className="min-w-0 text-center">
                  <div className="truncate text-[9px] font-extrabold uppercase tracking-wider text-[#7A8785]">In Service</div>
                  <div className="mt-1 text-lg font-extrabold text-[#3454FD]">{servingCount}</div>
                </div>
                <div className="min-w-0 text-center">
                  <div className="truncate text-[9px] font-extrabold uppercase tracking-wider text-[#7A8785]">Called</div>
                  <div className="mt-1 text-lg font-extrabold text-amber-600">{calledCount}</div>
                </div>
                <div className="min-w-0 text-center">
                  <div className="truncate text-[9px] font-extrabold uppercase tracking-wider text-[#7A8785]">Waiting</div>
                  <div className="mt-1 text-lg font-extrabold text-[#17201F]">{waitingCount}</div>
                </div>
              </div>
            </div>

            {queueAlert && (
              <div id="staff-queue-alert" className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{queueAlert}</span>
              </div>
            )}

            <div className="space-y-2.5">
              {queue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E1E7E6] bg-[#F8FAFA] p-8 text-center">
                  <Users className="mx-auto mb-2 h-8 w-8 text-[#7A8785]" />
                  <p className="text-sm font-bold text-[#17201F]">Queue is currently empty</p>
                  <p className="mb-3 mt-0.5 text-xs text-[#6F7C7A]">Add a walk-in or wait for a Customer App / QR join.</p>
                  <button
                    onClick={() => setIsWalkinModalOpen(true)}
                    className="rounded-xl bg-[#3454FD] px-3.5 py-2 text-xs font-semibold text-white"
                  >
                    + Add Walk-In Customer
                  </button>
                </div>
              ) : (
                queue.map((item, index) => (
                  <QueueBookingCard
                    key={item.id}
                    item={item}
                    position={index + 1}
                    now={now}
                    onAction={(actionItem, action, paymentMethod) => onQueueAction(actionItem, action, undefined, undefined, paymentMethod)}
                    onCancelChair={setCancelTarget}
                    catalog={salon.services}
                  />
                ))
              )}
              <p className="pt-1 text-[11px] leading-relaxed text-[#7A8785]">
                <b className="text-[#6F7C7A]">Start</b> seats the customer; <b className="text-[#6F7C7A]">Complete</b> frees the chair.
                <b className="text-[#6F7C7A]"> Cancel Chair</b> records why the salon dropped a booking, <b className="text-[#6F7C7A]">No-show</b> means they never arrived.
              </p>
            </div>
          </div>
        )}

        {/* ---------------- BOOKINGS ---------------- */}
        {active === 'bookings' && (
          <div className="space-y-3 p-4 pb-8">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#17201F]">Bookings</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[#6F7C7A]">Track customer bookings, queue activity &amp; history</p>
            </div>

            {/* Four lightweight operational tiles — activity counts only,
                same source data the tabs below already render from, never a
                Reports-style analytics figure. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { id: 'live' as const, label: 'Live', count: liveTileCount, icon: Users },
                  { id: 'upcoming' as const, label: 'Upcoming', count: upcomingTileCount, icon: CalendarClock },
                  { id: 'completed' as const, label: 'Completed', count: completedTileCount, icon: CheckCircle },
                  { id: 'cancelled' as const, label: 'Cancelled', count: cancelledTileCount, icon: XCircle },
                ]
              ).map((tile) => {
                const isActive = bookingTab === tile.id;
                const Icon = tile.icon;
                return (
                  <button
                    key={tile.id}
                    id={`bookings-tile-${tile.id}`}
                    onClick={() => setBookingTab(tile.id)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      isActive ? 'border-[#3454FD]/40 bg-[#3454FD]/10' : 'border-[#E1E7E6] bg-white'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-[#3454FD]' : 'text-[#7A8785]'}`} />
                    <div className={`mt-1.5 text-[10.5px] font-bold ${isActive ? 'text-[#3454FD]' : 'text-[#6F7C7A]'}`}>{tile.label}</div>
                    <div className="text-xl font-extrabold text-[#17201F]">{tile.count}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {BOOKING_TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`bookings-tab-${tab.id}`}
                  onClick={() => setBookingTab(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                    bookingTab === tab.id ? 'bg-[#3454FD] text-white' : 'border border-[#E1E7E6] bg-white text-[#6F7C7A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {bookingTab !== 'gross' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['today', '7d', '30d', 'all'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setFilters((current) => ({ ...current, range }))}
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                        filters.range === range ? 'bg-[#3454FD]/10 text-[#3454FD]' : 'border border-[#E1E7E6] bg-white text-[#6F7C7A]'
                      }`}
                    >
                      {range === 'today' ? 'Today' : range === 'all' ? 'All' : range}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['all', 'customer_app', 'qr_web', 'walk_in'] as const).map((source) => (
                    <button
                      key={source}
                      onClick={() => setFilters((current) => ({ ...current, source }))}
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                        filters.source === source ? 'bg-[#3454FD]/10 text-[#3454FD]' : 'border border-[#E1E7E6] bg-white text-[#6F7C7A]'
                      }`}
                    >
                      {source === 'all' ? 'All sources' : source === 'qr_web' ? 'Web QR' : source === 'walk_in' ? 'Walk-in' : 'App'}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7A8785]" />
                  <input
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Search customer, token or service"
                    className="h-9 w-full rounded-xl border border-[#E1E7E6] bg-white pl-8 pr-3 text-[12px] text-[#17201F] outline-none placeholder:text-[#7A8785] focus:border-[#3454FD]/50"
                  />
                </div>
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
                        <div key={label} className="rounded-xl border border-[#E1E7E6] bg-white p-3">
                          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#7A8785]">{label}</p>
                          <p className="mt-1 text-lg font-bold text-[#17201F]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-[#7A8785]">
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
                    <div className="rounded-2xl border border-[#E1E7E6] bg-[#F8FAFA] p-8 text-center">
                      <CheckCircle className="mx-auto mb-2 h-8 w-8 text-[#3454FD] opacity-60" />
                      <p className="text-xs text-[#6F7C7A]">
                        {bookingTab === 'reserved' ? 'Reserved bookings are not supported yet.' : 'Nothing in this view for the selected filters.'}
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2.5">
                    {rows.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="space-y-1">
                        <BookingRecordCard item={item} tab={bookingTab} now={now} catalog={salon.services} />
                        {/* Only a genuinely completed visit can be asked for a
                            review. The server re-proves that (and that it was
                            not already asked or already reviewed) before
                            anything is sent, so this button is an affordance,
                            never the check. */}
                        {bookingTab === 'completed' && isCompleted(item) && (
                          <div className="flex justify-end px-1">
                            <RequestReviewButton item={item} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ---------------- STAFF MEMBERS ---------------- */}
        {active === 'staff' && isOwnerOrManager && (
          <div className="p-4 pb-8">
            <StaffMembersPanel barbers={barbers} allServices={salon.services} onSave={onSaveStaff} />
          </div>
        )}

        {/* ---------------- SERVICES & PRICING ---------------- */}
        {active === 'services' && isOwnerOrManager && (
          <div className="p-4 pb-8">
            <ServicesPricingPanel />
          </div>
        )}

        {/* ---------------- OFFERS & CAMPAIGNS ---------------- */}
        {active === 'offers' && isOwnerOrManager && (
          <div className="p-4 pb-8">
            <h2 className="mb-0.5 text-lg font-extrabold tracking-tight text-[#17201F]">Offers &amp; Campaigns</h2>
            <p className="mb-3 text-[11px] font-semibold text-[#6F7C7A]">Same records Price Breakdown reads</p>
            <ManageOffers offers={salon.offers || []} allServices={salon.services} onSave={onSaveOffers} />
            <p className="mt-3 text-[10px] leading-relaxed text-[#7A8785]">
              <b className="text-[#6F7C7A]">Campaigns</b> (scheduled, multi-step promos) has no backend yet — only the Offers above are real and interactive.
            </p>
          </div>
        )}

        {/* ---------------- CUSTOMERS ---------------- */}
        {active === 'customers' && isOwnerOrManager && <CustomersModule role={role} />}

        {/* ---------------- BUSINESS PROFILE (shared profile editor) ---------------- */}
        {active === 'profile' && isOwnerOrManager && (
          <GymManageProfile gymId={salon.id} gymName={salon.name} onClose={() => navigate('overview')} />
        )}

        {/* ---------------- SETTINGS (reachable by every authenticated
             role — see resolveCategoryModules — so Sign Out, the one
             control this screen carries, is never out of reach. Carries
             no privileged control: sensitive owner/manager settings stay
             on their own owner/manager-gated modules elsewhere in this
             drawer.) ---------------- */}
        {active === 'settings' && (
          <div className="space-y-4 p-4 pb-8">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#17201F]">Settings</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[#6F7C7A]">Account &amp; workspace</p>
            </div>
            <div className="rounded-2xl border border-[#E1E7E6] bg-white p-4">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7A8785]">Signed in as</div>
              <div className="mt-1 text-sm font-bold text-[#17201F]">{salon.name}</div>
              <div className="mt-0.5 text-[11px] font-semibold text-[#6F7C7A]">Role &middot; {role}</div>
              <div className="mt-0.5 text-[11px] font-semibold text-[#6F7C7A]">Business ID &middot; {salon.id}</div>
            </div>
            <div className="rounded-2xl border border-dashed border-[#E1E7E6] bg-[#F8FAFA] p-4 text-[11.5px] leading-relaxed text-[#6F7C7A]">
              No salon-facing settings endpoint exists yet beyond what Business Profile already covers — this section activates further once its scope is defined and built.
            </div>
            {onSignOut && (
              <button
                id="salon-settings-signout"
                onClick={onSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white transition hover:bg-rose-500 active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            )}
          </div>
        )}

        {/* ---------------- CONCEPT / BACKEND-DEPENDENT MODULES ---------------- */}
        {CONCEPT_MODULES[active] && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#E1E7E6] bg-[#F4F7F6] text-[#7A8785]">
              {React.createElement(moduleIcons[active] || LayoutDashboard, { className: 'h-6 w-6' })}
            </div>
            <b className="text-sm text-[#17201F]">{CONCEPT_MODULES[active].title}</b>
            <p className="max-w-[34ch] text-[11.5px] leading-relaxed text-[#6F7C7A]">{CONCEPT_MODULES[active].body}</p>
            <span className="mt-1 rounded-full border border-[#E1E7E6] bg-[#F4F7F6] px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-wide text-[#7A8785]">
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

/**
 * "Request Review" for one completed visit.
 *
 * Neutral by construction: staff choose only *which* completed visit to ask
 * about — the message wording is authored server-side, so the ask can never
 * be conditioned on the rating the owner hopes for. The server also refuses a
 * second request for the same visit, and refuses one where the customer has
 * already reviewed, so repeated taps can never spam a customer.
 */
const RequestReviewButton: React.FC<{ item: QueueItem }> = ({ item }) => {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'blocked'>('idle');
  const [message, setMessage] = useState('');

  // A walk-in with no linked NOQ account has no inbox to receive the request.
  if (!item.customerId) return null;

  const send = async () => {
    setState('sending');
    setMessage('');
    try {
      await businessNotificationService.requestReview(item.id);
      setState('sent');
    } catch (error) {
      setState('blocked');
      setMessage(error instanceof Error ? error.message : 'Unable to send the review request.');
    }
  };

  if (state === 'sent') {
    return <span className="text-[10px] font-bold text-emerald-700">Review requested</span>;
  }

  return (
    <span className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={send}
        disabled={state === 'sending'}
        className="rounded-full border border-[#3454FD]/30 bg-[#3454FD]/5 px-2.5 py-1 text-[10px] font-bold text-[#3454FD] transition disabled:opacity-60"
      >
        {state === 'sending' ? 'Sending…' : 'Request review'}
      </button>
      {state === 'blocked' && message && (
        <span className="max-w-[180px] text-right text-[9px] leading-tight text-amber-700">{message}</span>
      )}
    </span>
  );
};

type DutyFilter = 'all' | 'available' | 'in_service' | 'off_duty';

const DUTY_META: Record<Barber['status'], { label: string; dot: string; pill: string }> = {
  available: { label: 'Available', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
  busy: { label: 'In Service', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700' },
  unavailable: { label: 'Off Duty', dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-600' },
};

const matchesDutyFilter = (barber: Barber, filter: DutyFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'available') return barber.status === 'available';
  if (filter === 'in_service') return barber.status === 'busy';
  return barber.status === 'unavailable';
};

const matchesStaffSearch = (barber: Barber, query: string, allServices: ServiceItem[]): boolean => {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  if ((barber.name || '').toLowerCase().includes(term)) return true;
  if ((barber.role || '').toLowerCase().includes(term)) return true;
  if ((barber.specialties || []).some((s) => s.toLowerCase().includes(term))) return true;
  const serviceNames = (barber.serviceIds || [])
    .map((id) => allServices.find((service) => service.id === id)?.name || '')
    .filter(Boolean);
  return serviceNames.some((name) => name.toLowerCase().includes(term));
};

const formatInr = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;

type ServiceVisibilityFilter = 'all' | 'active' | 'hidden';

const emptyServiceDraft = (category?: string): ServiceDraft => ({
  name: '',
  category: category || '',
  description: '',
  priceInr: 0,
  durationMin: 30,
  imageUrl: '',
});

/**
 * "Services & Pricing" — a real owner/manager CRUD module over the exact
 * salon_service rows Customer App, Join Queue and Staff Members already
 * read. There is no second service catalog: adding, editing or hiding a
 * service here is immediately what customers can (or can't) book. Session
 * Time is treated as a first-class field because it directly feeds the NOQ
 * queue ETA — never cosmetic metadata.
 */
const ServicesPricingPanel: React.FC = () => {
  const [services, setServices] = useState<OwnerService[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<ServiceVisibilityFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<OwnerService | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchOwnerServices()
      .then((rows) => setServices(rows))
      .catch((error) => setLoadError(error.message || 'Could not load services.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = Array.from(new Set((services || []).map((s) => s.category).filter(Boolean))).sort();

  const visible = (services || []).filter((service) => {
    if (visibilityFilter === 'active' && !service.active) return false;
    if (visibilityFilter === 'hidden' && service.active) return false;
    if (category !== 'all' && service.category !== category) return false;
    if (search && !`${service.name} ${service.category} ${service.description}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const total = services?.length || 0;
  const activeCount = (services || []).filter((s) => s.active).length;
  const hiddenCount = total - activeCount;

  const handleToggleVisibility = async (service: OwnerService) => {
    setBusyId(service.id);
    setActionError(null);
    try {
      await setOwnerServiceVisibility(service.id, !service.active);
      setServices((prev) => (prev || []).map((s) => (s.id === service.id ? { ...s, active: !s.active } : s)));
    } catch (error: any) {
      setActionError(error.message || 'Could not update visibility.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSave = async (id: string | null, draft: ServiceDraft) => {
    const saved = id ? await updateOwnerService(id, draft) : await createOwnerService(draft);
    setServices((prev) => {
      const rows = prev || [];
      return id ? rows.map((s) => (s.id === id ? saved : s)) : [...rows, saved];
    });
    setEditing(null);
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-[#17201F]">Services &amp; Pricing</h2>
          <p className="mt-0.5 max-w-[38ch] text-[11px] font-semibold text-[#6F7C7A]">
            Manage what customers can book, how much it costs, and how long it takes.
          </p>
        </div>
        <button
          id="add-service-btn"
          onClick={() => setEditing('new')}
          className={`${ui.primaryButton} flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs`}
        >
          <Plus className="h-3.5 w-3.5" /> Add Service
        </button>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{loadError}</div>
      )}
      {actionError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{actionError}</div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {([
          ['all', 'Total Services', total],
          ['active', 'Active', activeCount],
          ['hidden', 'Hidden', hiddenCount],
        ] as const).map(([key, label, value]) => (
          <button
            key={key}
            onClick={() => setVisibilityFilter(key)}
            className={`${ui.card} p-3 text-left transition ${visibilityFilter === key ? 'ring-2 ring-[#3454FD]/50' : ''}`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">{label}</div>
            <b className="mt-1 block font-sans text-xl font-bold text-[#17201F]">{value}</b>
          </button>
        ))}
        <div className={`${ui.card} p-3 text-left`}>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">Categories</div>
          <b className="mt-1 block font-sans text-xl font-bold text-[#17201F]">{categories.length}</b>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7A8785]" />
        <input
          id="service-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services..."
          className="h-9 w-full rounded-xl border border-[#E1E7E6] bg-white pl-8 pr-2.5 text-xs font-medium text-[#17201F] outline-none focus:border-[#3454FD]/50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[#E1E7E6] bg-[#EEF3F2] p-1">
          {([
            ['all', 'All'],
            ['active', 'Active'],
            ['hidden', 'Hidden'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setVisibilityFilter(key)}
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${visibilityFilter === key ? 'bg-white text-[#3454FD] ring-1 ring-[#D8E4E2]' : 'text-[#6F7C7A] hover:text-[#17201F]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {categories.length > 0 && (
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[#E1E7E6] bg-[#EEF3F2] p-1">
            <button
              onClick={() => setCategory('all')}
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${category === 'all' ? 'bg-white text-[#3454FD] ring-1 ring-[#D8E4E2]' : 'text-[#6F7C7A] hover:text-[#17201F]'}`}
            >
              All categories
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${category === c ? 'bg-white text-[#3454FD] ring-1 ring-[#D8E4E2]' : 'text-[#6F7C7A] hover:text-[#17201F]'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {services === null && !loadError ? (
          <div className="rounded-2xl border border-dashed border-[#E1E7E6] bg-white p-8 text-center text-xs text-[#6F7C7A]">Loading services…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E1E7E6] bg-white p-8 text-center">
            <Receipt className="mx-auto mb-2 h-8 w-8 text-[#6F7C7A]" />
            <p className="text-xs text-[#6F7C7A]">No services match this view.</p>
          </div>
        ) : (
          visible.map((service) => (
            <div key={service.id} className={`${ui.card} p-3.5 ${!service.active ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="truncate text-sm font-bold text-[#17201F]">{service.name}</b>
                    {service.category && (
                      <span className="shrink-0 rounded-md border border-[#E1E7E6] bg-[#F4F7F6] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#7A8785]">
                        {service.category}
                      </span>
                    )}
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${service.active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F4F7F6] text-[#7A8785]'}`}>
                      {service.active ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  {service.description && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-[#6F7C7A]">{service.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] font-bold text-[#17201F]">
                    <span>{formatInr(service.priceInr)}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#6F7C7A]">
                      <Clock className="h-3.5 w-3.5" /> {service.durationMin} min
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <button
                    onClick={() => setEditing(service)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E1E7E6] px-2 py-1 text-[10.5px] font-bold text-[#3454FD] hover:bg-[#EEF1FE]"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    disabled={busyId === service.id}
                    onClick={() => handleToggleVisibility(service)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E1E7E6] px-2 py-1 text-[10.5px] font-bold text-[#6F7C7A] hover:bg-[#F4F7F6] disabled:opacity-50"
                  >
                    {service.active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {service.active ? 'Hide' : 'Restore'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <ServiceEditorModal
          service={editing === 'new' ? null : editing}
          defaultCategory={category !== 'all' ? category : ''}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

const ServiceEditorModal: React.FC<{
  service: OwnerService | null;
  defaultCategory: string;
  onClose: () => void;
  onSave: (id: string | null, draft: ServiceDraft) => Promise<void>;
}> = ({ service, defaultCategory, onClose, onSave }) => {
  const [draft, setDraft] = useState<ServiceDraft>(
    service
      ? { name: service.name, category: service.category, description: service.description, priceInr: service.priceInr, durationMin: service.durationMin, imageUrl: service.imageUrl }
      : emptyServiceDraft(defaultCategory)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(service?.id || null, draft);
    } catch (err: any) {
      setError(err.message || 'Could not save service.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} labelledBy="service-editor-title" className="max-w-md">
      <div className="max-h-[85vh] overflow-y-auto p-5">
        <h3 id="service-editor-title" className="text-base font-extrabold text-[#17201F]">
          {service ? 'Edit Service' : 'Add Service'}
        </h3>

        <div className="mt-4 space-y-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7A8785]">Service Details</div>
          <div>
            <label className={ui.label}>Name</label>
            <input className={ui.field} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Haircut" />
          </div>
          <div>
            <label className={ui.label}>Category</label>
            <input className={ui.field} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="e.g. Hair Care" />
          </div>
          <div>
            <label className={ui.label}>Description</label>
            <textarea className={ui.field} rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional" />
          </div>

          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7A8785]">Pricing &amp; Timing</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ui.label}>Price (₹)</label>
              <input
                type="number"
                min={0}
                className={ui.field}
                value={draft.priceInr}
                onChange={(e) => setDraft({ ...draft, priceInr: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={ui.label}>Session Time (min)</label>
              <input
                type="number"
                min={5}
                max={600}
                className={ui.field}
                value={draft.durationMin}
                onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="text-[10.5px] leading-relaxed text-[#7A8785]">
            Used to calculate live customer wait time and predicted chair availability.
          </p>

          {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className={`${ui.secondaryButton} flex-1 py-2.5 text-xs`}>Cancel</button>
            <button disabled={saving || !draft.name.trim()} onClick={submit} className={`${ui.primaryButton} flex-1 py-2.5 text-xs`}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

/**
 * "Staff Members" — real team + individual performance management for the
 * SAME salon_staff records the customer-facing stylist list reads. Roster
 * writes (add/edit/remove) go through the save_staff command, same as
 * before; performance metrics (revenue, completed bookings, top services)
 * come from the durable customer_booking table via GET staff-performance,
 * never from owner-typed fields.
 */
const StaffMembersPanel: React.FC<{ barbers: Barber[]; allServices: ServiceItem[]; onSave: (staff: Barber[]) => void }> = ({ barbers, allServices, onSave }) => {
  const [filter, setFilter] = useState<DutyFilter>('all');
  const [search, setSearch] = useState('');
  const [performance, setPerformance] = useState<StaffPerformanceRow[] | null>(null);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [viewPerformanceId, setViewPerformanceId] = useState<string | null>(null);
  const [manageProfileId, setManageProfileId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStaffPerformance('30d')
      .then((res) => { if (!cancelled) setPerformance(res.staff); })
      .catch((error) => { if (!cancelled) setPerformanceError(error.message || 'Could not load performance data.'); });
    return () => { cancelled = true; };
  }, [barbers.length]);

  const total = barbers.length;
  const availableNow = barbers.filter((b) => b.status === 'available').length;
  const inService = barbers.filter((b) => b.status === 'busy').length;
  const offDuty = barbers.filter((b) => b.status === 'unavailable').length;

  const visibleStaff = barbers.filter((b) => matchesDutyFilter(b, filter) && matchesStaffSearch(b, search, allServices));
  const viewPerformanceStaff = viewPerformanceId ? barbers.find((b) => b.id === viewPerformanceId) || null : null;
  const manageProfileStaff = manageProfileId ? barbers.find((b) => b.id === manageProfileId) || null : null;

  const saveStaff = (nextStaff: Barber) => {
    const exists = barbers.some((b) => b.id === nextStaff.id);
    onSave(exists ? barbers.map((b) => (b.id === nextStaff.id ? nextStaff : b)) : [...barbers, nextStaff]);
  };

  const removeStaff = (id: string) => {
    onSave(barbers.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-[#17201F]">Staff Members</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[#6F7C7A]">Manage your team, roles, services &amp; performance</p>
        </div>
        <button
          id="add-staff-btn"
          onClick={() => setShowAdd(true)}
          className={`${ui.primaryButton} flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs`}
        >
          <Plus className="h-3.5 w-3.5" /> Add Staff
        </button>
      </div>

      {/* Summary tiles — click to filter */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {([
          ['all', 'Total Staff', total, Users, '#17201F'],
          ['available', 'Available Now', availableNow, UserCheck, '#059669'],
          ['in_service', 'In Service', inService, Zap, '#D97706'],
          ['off_duty', 'Off Duty', offDuty, XCircle, '#E11D48'],
        ] as const).map(([key, label, value, Icon, color]) => (
          <button
            key={key}
            id={`staff-summary-${key}`}
            onClick={() => setFilter(key)}
            className={`${ui.card} p-3 text-left transition ${filter === key ? 'ring-2 ring-[#3454FD]/50' : ''}`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">
              <Icon className="h-3.5 w-3.5" style={{ color }} />
              <span className="truncate">{label}</span>
            </div>
            <b className="mt-1 block font-sans text-xl font-bold text-[#17201F]">{value}</b>
          </button>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[#E1E7E6] bg-[#EEF3F2] p-1">
          {([
            ['all', 'All'],
            ['available', 'Available'],
            ['in_service', 'In Service'],
            ['off_duty', 'Off Duty'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              id={`staff-filter-${key}`}
              onClick={() => setFilter(key)}
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${filter === key ? 'bg-white text-[#3454FD] ring-1 ring-[#D8E4E2]' : 'text-[#6F7C7A] hover:text-[#17201F]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7A8785]" />
          <input
            id="staff-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff member"
            className="h-9 w-full rounded-xl border border-[#E1E7E6] bg-white pl-8 pr-2.5 text-xs font-medium text-[#17201F] outline-none focus:border-[#3454FD]/50"
          />
        </div>
      </div>

      {performanceError && (
        <p className="text-[10px] text-amber-700">{performanceError}</p>
      )}

      {/* Staff cards */}
      <div className="space-y-2.5">
        {visibleStaff.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E1E7E6] bg-white p-8 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-[#6F7C7A]" />
            <p className="text-xs text-[#6F7C7A]">No staff members match this view.</p>
          </div>
        ) : (
          visibleStaff.map((staff) => (
            <StaffCard
              key={staff.id}
              staff={staff}
              perf={performance?.find((p) => p.staffId === staff.id) || null}
              onViewPerformance={() => setViewPerformanceId(staff.id)}
              onManageProfile={() => setManageProfileId(staff.id)}
            />
          ))
        )}
      </div>

      {viewPerformanceStaff && (
        <ViewPerformanceSheet
          staff={viewPerformanceStaff}
          onClose={() => setViewPerformanceId(null)}
        />
      )}

      {manageProfileStaff && (
        <ManageProfileModal
          staff={manageProfileStaff}
          allServices={allServices}
          onClose={() => setManageProfileId(null)}
          onSave={(updated) => { saveStaff(updated); setManageProfileId(null); }}
          onRemove={() => { removeStaff(manageProfileStaff.id); setManageProfileId(null); }}
        />
      )}

      {showAdd && (
        <ManageProfileModal
          staff={null}
          allServices={allServices}
          onClose={() => setShowAdd(false)}
          onSave={(created) => { saveStaff(created); setShowAdd(false); }}
        />
      )}
    </div>
  );
};

const StaffCard: React.FC<{
  staff: Barber;
  perf: StaffPerformanceRow | null;
  onViewPerformance: () => void;
  onManageProfile: () => void;
}> = ({ staff, perf, onViewPerformance, onManageProfile }) => {
  const meta = DUTY_META[staff.status] || DUTY_META.available;
  const topServices = perf?.topServices || [];
  const shownServices = topServices.slice(0, 3);
  const extraCount = Math.max(0, topServices.length - shownServices.length);

  return (
    <div id={`staff-card-${staff.id}`} className={`${ui.card} p-3.5 ${staff.active === false ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {staff.photoUrl ? (
            <img src={staff.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#173B38] to-[#3F746D] text-sm font-bold text-white">
              {(staff.name || '?').slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <b className="block truncate font-sans text-sm font-bold text-[#17201F]">{staff.name || 'Unnamed staff'}</b>
            <span className="block text-[11px] text-[#6F7C7A]">{staff.role || 'Barber'}</span>
            <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.pill}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {perf?.verifiedRating != null ? (
            <div className="flex items-center justify-end gap-1 text-xs font-bold text-[#17201F]">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {perf.verifiedRating.toFixed(1)}
              <span className="font-medium text-[#6F7C7A]">&middot; {perf.verifiedReviewCount ?? 0} reviews</span>
            </div>
          ) : null}
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#6F7C7A]">
            {staff.active === false ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {staff.active === false ? 'Hidden from customers' : 'Visible to customers'}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#EEF3F2] pt-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-[#8A9895]">Revenue</p>
          <p className="text-sm font-bold text-[#17201F]">
            {perf ? (perf.revenueInr != null ? formatInr(perf.revenueInr) : 'Unavailable') : '…'}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-[#8A9895]">Bookings</p>
          <p className="text-sm font-bold text-[#17201F]">{perf ? perf.completedBookings : '…'}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-[#8A9895]">Experience</p>
          <p className="text-sm font-bold text-[#17201F]">{staff.experienceYears != null ? `${staff.experienceYears} yrs` : '—'}</p>
        </div>
      </div>

      {shownServices.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[#8A9895]">Top services</span>
          {shownServices.map((s) => (
            <span key={s.name} className="rounded-full bg-[#EEF3F2] px-2 py-0.5 text-[10px] font-semibold text-[#43504E]">{s.name}</span>
          ))}
          {extraCount > 0 && <span className="text-[10px] font-semibold text-[#8A9895]">+{extraCount} more</span>}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          id={`staff-view-performance-${staff.id}`}
          onClick={onViewPerformance}
          className={`${ui.secondaryButton} flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs`}
        >
          <BarChart3 className="h-3.5 w-3.5" /> View Performance
        </button>
        <button
          id={`staff-manage-profile-${staff.id}`}
          onClick={onManageProfile}
          className={`${ui.primaryButton} flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs`}
        >
          <UserCheck className="h-3.5 w-3.5" /> Manage Profile
        </button>
      </div>
    </div>
  );
};

const PERFORMANCE_RANGES: Array<{ id: StaffPerformanceRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
];

const ViewPerformanceSheet: React.FC<{ staff: Barber; onClose: () => void }> = ({ staff, onClose }) => {
  const [range, setRange] = useState<StaffPerformanceRange>('30d');
  const [row, setRow] = useState<StaffPerformanceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStaffPerformance(range)
      .then((res) => {
        if (cancelled) return;
        setRow(res.staff.find((s) => s.staffId === staff.id) || null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load performance data.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [staff.id, range]);

  return (
    <ModalShell onClose={onClose} labelledBy="view-performance-title" className="max-w-md max-h-[85vh] overflow-y-auto p-5">
      <h3 id="view-performance-title" className="pr-6 text-base font-bold text-[#17201F]">{staff.name}</h3>
      <p className="text-[11px] text-[#6F7C7A]">{staff.role || 'Barber'} &middot; Individual performance</p>

      <div className="mt-3 inline-flex gap-1 rounded-xl border border-[#E1E7E6] bg-[#EEF3F2] p-1">
        {PERFORMANCE_RANGES.map((r) => (
          <button
            key={r.id}
            id={`performance-range-${r.id}`}
            onClick={() => setRange(r.id)}
            className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${range === r.id ? 'bg-white text-[#3454FD] ring-1 ring-[#D8E4E2]' : 'text-[#6F7C7A] hover:text-[#17201F]'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

      {loading ? (
        <p className="mt-4 text-xs text-[#6F7C7A]">Loading performance…</p>
      ) : row ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`${ui.card} p-3`}>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#8A9895]">Completed Services</p>
              <p className="mt-1 text-lg font-bold text-[#17201F]">{row.completedBookings}</p>
            </div>
            <div className={`${ui.card} p-3`}>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#8A9895]">Revenue Generated</p>
              <p className="mt-1 text-lg font-bold text-[#17201F]">{row.revenueInr != null ? formatInr(row.revenueInr) : 'Unavailable'}</p>
            </div>
            <div className={`${ui.card} p-3`}>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#8A9895]">Average Ticket</p>
              <p className="mt-1 text-lg font-bold text-[#17201F]">{row.averageTicketInr != null ? formatInr(row.averageTicketInr) : 'Unavailable'}</p>
            </div>
            <div className={`${ui.card} p-3`}>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#8A9895]">Customer Rating</p>
              <p className="mt-1 text-sm font-bold text-[#17201F]">
                {row.verifiedRating != null ? `★ ${row.verifiedRating.toFixed(1)} · ${row.verifiedReviewCount ?? 0} reviews` : 'No verified staff reviews yet'}
              </p>
            </div>
          </div>

          {(row.cancelledCount > 0 || row.noShowCount > 0) && (
            <div className="flex gap-4 text-[11px] text-[#6F7C7A]">
              <span><b className="text-[#17201F]">{row.cancelledCount}</b> cancelled</span>
              <span><b className="text-[#17201F]">{row.noShowCount}</b> no-shows</span>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">Top Services by Count</p>
            {row.topServices.length === 0 ? (
              <p className="text-xs text-[#6F7C7A]">No completed services in this period.</p>
            ) : (
              <div className="space-y-1.5">
                {row.topServices.map((s) => (
                  <div key={s.name} className="flex items-center justify-between rounded-lg border border-[#E1E7E6] bg-white px-2.5 py-1.5 text-xs">
                    <span className="font-semibold text-[#17201F]">{s.name}</span>
                    <span className="font-bold text-[#3454FD]">{s.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-[#6F7C7A]">No performance data for this period.</p>
      )}
    </ModalShell>
  );
};

const ManageProfileModal: React.FC<{
  staff: Barber | null;
  allServices: ServiceItem[];
  onClose: () => void;
  onSave: (staff: Barber) => void;
  onRemove?: () => void;
}> = ({ staff, allServices, onClose, onSave, onRemove }) => {
  const [form, setForm] = useState<Barber>(
    staff || { id: `new-${Date.now()}`, name: '', role: 'Barber', status: 'available', active: true, serviceIds: [] }
  );
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const isNew = !staff;

  const patch = (fields: Partial<Barber>) => setForm((current) => ({ ...current, ...fields }));

  const toggleService = (serviceId: string) => {
    const current = form.serviceIds || [];
    patch({ serviceIds: current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId] });
  };

  const canSave = form.name.trim().length > 0 && (form.role || '').trim().length > 0;

  return (
    <ModalShell onClose={onClose} labelledBy="manage-profile-title" className="max-w-lg max-h-[88vh] overflow-y-auto p-5">
      <h3 id="manage-profile-title" className="pr-6 text-base font-bold text-[#17201F]">{isNew ? 'Add Staff' : 'Manage Profile'}</h3>
      <p className="text-[11px] text-[#6F7C7A]">Same salon_staff record customers see in Join Queue.</p>

      <div className="mt-4 space-y-4">
        <section>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">Basic Profile</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className={ui.label}>Name
              <input value={form.name} onChange={(e) => patch({ name: e.target.value })} className={`${ui.field} mt-1 normal-case`} placeholder="Full name" />
            </label>
            <label className={ui.label}>Role / title
              <input value={form.role || ''} onChange={(e) => patch({ role: e.target.value })} className={`${ui.field} mt-1 normal-case`} placeholder="Senior Barber" />
            </label>
            <label className={`${ui.label} sm:col-span-2`}>Profile Photo — Image URL
              <input value={form.photoUrl || ''} onChange={(e) => patch({ photoUrl: e.target.value })} className={`${ui.field} mt-1 normal-case`} placeholder="https://…" />
            </label>
            <label className={ui.label}>Experience (years)
              <input type="number" min={0} value={form.experienceYears ?? ''} onChange={(e) => patch({ experienceYears: e.target.value ? parseInt(e.target.value, 10) : undefined })} className={`${ui.field} mt-1`} placeholder="5" />
            </label>
          </div>
        </section>

        <section className="border-t border-[#EEF3F2] pt-3.5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">Availability</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className={ui.label}>Duty status
              <select value={form.status} onChange={(e) => patch({ status: e.target.value as Barber['status'] })} className={`${ui.field} mt-1 normal-case`}>
                <option value="available">Available</option>
                <option value="busy">In Service</option>
                <option value="unavailable">Off duty</option>
              </select>
            </label>
            <label className="mt-1 flex items-center gap-2 self-end text-[12px] font-bold text-[#17201F]">
              <input type="checkbox" checked={form.active !== false} onChange={(e) => patch({ active: e.target.checked })} className="h-4 w-4 accent-[#3454FD]" />
              Visible to customers
            </label>
          </div>
        </section>

        <section className="border-t border-[#EEF3F2] pt-3.5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">Skills &amp; Services</p>
          {allServices.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {allServices.map((service) => {
                const on = (form.serviceIds || []).includes(service.id);
                return (
                  <button key={service.id} type="button" onClick={() => toggleService(service.id)} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${on ? 'bg-[#3454FD] text-white' : 'bg-[#EEF3F2] text-[#6F7C7A]'}`}>
                    {service.name}
                  </button>
                );
              })}
            </div>
          )}
          <label className={ui.label}>Specialties (comma-separated)
            <input
              value={(form.specialties || []).join(', ')}
              onChange={(e) => patch({ specialties: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              className={`${ui.field} mt-1 normal-case`}
              placeholder="Skin Fade Specialist, Beard Sculpting, Hot Towel"
            />
          </label>
        </section>

        <section className="border-t border-[#EEF3F2] pt-3.5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6F7C7A]">Public Profile</p>
          <label className={ui.label}>Bio
            <textarea rows={3} value={form.bio || ''} onChange={(e) => patch({ bio: e.target.value })} className={`${ui.field} mt-1 normal-case`} placeholder="Short bio describing expertise and styling focus..." />
          </label>
        </section>
      </div>

      <div className="mt-5 flex gap-2">
        <button onClick={onClose} className={`${ui.secondaryButton} flex-1 px-3 py-2.5 text-xs`}>Cancel</button>
        <button
          id="manage-profile-save-btn"
          disabled={!canSave}
          onClick={() => onSave(form)}
          className={`${ui.primaryButton} flex-1 px-3 py-2.5 text-xs disabled:opacity-40`}
        >
          Save Changes
        </button>
      </div>

      {!isNew && onRemove && (
        <div className="mt-4 border-t border-[#EEF3F2] pt-4">
          <button
            id="remove-staff-member-btn"
            onClick={() => (confirmingRemove ? onRemove() : setConfirmingRemove(true))}
            className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
          >
            {confirmingRemove ? 'Tap again to confirm removal' : 'Remove Staff Member'}
          </button>
        </div>
      )}
    </ModalShell>
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
                  <input type="checkbox" checked={offer.active !== false} onChange={(e) => update(offer.id, { active: e.target.checked })} className="h-4 w-4 accent-[#3454FD]" />
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
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${on ? 'bg-[#3454FD] text-white' : 'bg-[#EEF3F2] text-[#6F7C7A]'}`}
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
        <button id="manage-offers-add-btn" onClick={addOffer} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#3454FD]/40 py-3 text-xs font-bold text-[#3454FD]">
          <Plus className="h-3.5 w-3.5" /> Add offer
        </button>
      </div>
    </div>
  );
};