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
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserPlus,
  Sparkles,
  History,
  Trash2,
  Tag,
  Dumbbell,
  LayoutDashboard,
  Search,
  Star,
  Eye,
  EyeOff,
  BarChart3,
} from 'lucide-react';
import { QueueItem, Barber, Salon, SalonOffer, ServiceItem } from '../types';
import { WalkInModal } from './WalkInModal';
import { ui, ModalShell } from './ui';
import { realtimeQueueService, type StaffPerformanceRow, type StaffPerformanceRange } from '../services/realtimeQueueService';
import {
  resolveCategoryModules,
  resolveCategoryCapabilities,
  StaffRole,
  MainCategoryType,
  CategoryModuleConfig,
} from '../shared/categoryDashboardResolver';
import { GymDashboardView } from './GymDashboardView';

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
  onTestSwitchBusiness?: (businessId: string, role?: string) => void;
}

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
  onTestSwitchBusiness,
}) => {
  // Single ticking clock so every CALLED countdown re-renders each second.
  const [now, setNow] = useState(() => Date.now());
  const [cancelTarget, setCancelTarget] = useState<QueueItem | null>(null);
  const [bookingTab, setBookingTab] = useState<BookingTab>('live');
  const [filters, setFilters] = useState<BookingFilters>({ range: 'today', source: 'all', search: '' });
  const [staffRole, setStaffRole] = useState<StaffRole>('owner');
  const [gymModule, setGymModule] = useState<string>('overview');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'history' | 'staff' | 'offers'>('live');

  const mainCategoryId = (salon.mainCategoryId || 'salon').toLowerCase();
  const isGymCategory = mainCategoryId === 'gym';
  const isTestEnv =
    import.meta.env.DEV ||
    import.meta.env.MODE === 'test' ||
    process.env.NODE_ENV !== 'production' ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname.includes('127.0.0.1') ||
        window.location.hostname.includes('web-test.onrender.com') ||
        window.location.search.includes('test=1')));
  const categoryModules = resolveCategoryModules(mainCategoryId, staffRole);

  const waitingCount = queue.filter((x) => x.status === 'Waiting').length;
  const servingCount = queue.filter((x) => x.status === 'Serving').length;
  const calledCount = queue.filter((x) => x.status === 'Called').length;
  const activeBarbers = barbers.filter((b) => b.status !== 'unavailable').length;
  const availableBarbers = barbers.filter((b) => b.status === 'available').length;

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

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#F8FAFA] text-[#17201F]">
      <div className="space-y-5 p-5">
        {/* Test Business Switcher (Test / Dev Environment Only) */}
        {isTestEnv && (
          <div id="test-business-switcher-banner" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0F766E]/25 bg-[#E7F5F2] px-3.5 py-2 text-xs text-[#0F766E] shadow-sm">
            <div className="flex items-center gap-2">
              <span className="font-extrabold uppercase tracking-wider text-[10px] text-[#0F766E]">Testing as:</span>
              <select
                id="test-business-switcher"
                aria-label="Test Business Switcher"
                value={`${salon.id}:${staffRole}`}
                onChange={(e) => {
                  const [busId, role] = e.target.value.split(':');
                  setStaffRole((role as StaffRole) || 'owner');
                  if (onTestSwitchBusiness) {
                    onTestSwitchBusiness(busId, role);
                  }
                }}
                className="rounded-lg border border-[#0F766E]/30 bg-white px-2.5 py-1 text-xs font-bold text-[#17201F] shadow-sm focus:outline-none"
              >
                <option value="salon-1:owner">Sharpcut Studio — Salon (Owner)</option>
                <option value="salon-2:owner">Royal Man Salon — Salon (Owner)</option>
                <option value="gym-1:owner">Iron House Gym — Gym (Owner)</option>
                <option value="gym-1:trainer">Iron House Gym — Gym (Coach Vikram - Trainer)</option>
                <option value="gym-2:owner">Velocity Fitness Studio — Gym (Owner)</option>
              </select>
            </div>
            <span className="text-[10px] font-semibold text-[#5C6E6B]">(Test tool only — disabled in production)</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={ui.eyebrow}>{isGymCategory ? 'Fitness & Strength Facility' : 'Today at the salon'}</span>
            <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[#17201F]">{salon.name}</h2>
            <p className="mt-0.5 text-[11px] text-[#6F7C7A]">
              {isGymCategory
                ? 'Manage live capacity, member check-ins, classes, and trainers in one place.'
                : 'Manage chairs, arrivals and the live queue in one place.'}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#E7F5F2] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#0F766E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" />
            {isGymCategory ? 'Gym Active' : 'Open'}
          </span>
        </div>

        {/* Dynamic Category Navigation Bar */}
        {false && isGymCategory && (
          <div className="flex snap-x gap-1.5 overflow-x-auto border-b border-[#E1E7E6] pb-2 pt-1">
            {categoryModules.map((mod) => (
              <button
                key={mod.id}
                id={`gym-module-tab-${mod.id}`}
                onClick={() => setGymModule(mod.id)}
                className={`snap-start shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  gymModule === mod.id
                    ? 'bg-[#0F766E] text-white shadow-sm'
                    : 'border border-[#DDE5E3] bg-white text-[#5C6E6B] hover:bg-[#F4F7F6]'
                }`}
              >
                {mod.label}
              </button>
            ))}
          </div>
        )}

        {/* Category Specific View Render */}
        {isGymCategory ? (
          <GymDashboardView
            gymId={salon.id}
            gymName={salon.name}
            role={staffRole}
            staffName={staffRole === 'trainer' ? 'Coach Vikram' : `${salon.name} Owner`}
            activeModule={gymModule}
            onModuleSelect={setGymModule}
          />
        ) : (
          <>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`${ui.card} p-3.5`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#6F7C7A]">
              <Users className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Waiting</span>
            </div>
            <b id="staff-waiting-count" className="block font-sans text-2xl font-bold text-[#17201F] mt-1">
              {waitingCount}
            </b>
            {calledCount > 0 && (
              <span className="text-[10px] font-bold text-[#A66020] block mt-0.5">
                +{calledCount} called
              </span>
            )}
          </div>

          <div className={`${ui.card} p-3.5`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#6F7C7A]">
              <Scissors className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>In Chair</span>
            </div>
            <b id="staff-serving-count" className="block font-sans text-2xl font-bold text-[#17201F] mt-1">
              {servingCount}
            </b>
            <span className="text-[10px] text-[#6F7C7A] block mt-0.5">Serving now</span>
          </div>

          <div className={`${ui.card} p-3.5`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#6F7C7A]">
              <UserCheck className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Barbers</span>
            </div>
            <b id="staff-barber-count" className="block font-sans text-2xl font-bold text-[#17201F] mt-1 truncate">
              {availableBarbers}/{activeBarbers} <span className="text-xs font-sans font-medium text-[#6F7C7A]">free</span>
            </b>
            <span className="text-[10px] text-[#6F7C7A] block mt-0.5">Shop capacity</span>
          </div>
        </div>

        {/* Barber Availability Section */}
        <div className={`${ui.card} p-4`}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <span className="block text-xs font-bold text-[#17201F]">Team &amp; chairs</span>
              <span className="mt-0.5 block text-[10px] text-[#6F7C7A]">Tap an available barber to change duty status</span>
            </div>
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
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition cursor-pointer ${
                    isBusy
                      ? 'bg-[#FAF0E6] text-[#A66020] border-[#A66020]/30 cursor-not-allowed opacity-90'
                      : isAvailable
                        ? 'bg-[#E7F5F2] text-[#0F766E] border-[#0F766E]/30 hover:bg-[#DDECE0]'
                        : 'bg-[#F8FAFA] text-[#6F7C7A] border-[#E1E7E6] hover:bg-[#EAEAE5]'
                  }`}
                  title={isBusy ? `Currently serving: ${barber.currentCustomerName || 'Customer'}` : 'Toggle available/off-duty'}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isBusy ? 'bg-[#A66020] animate-pulse' : isAvailable ? 'bg-[#0F766E]' : 'bg-[#6F7C7A]'
                    }`}
                  />
                  <span>{barber.name}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/70">
                    {isBusy ? 'In Chair' : isAvailable ? 'Available' : 'Off-duty'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Queue Header & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1E7E6] pb-3 pt-1">
          <div className="inline-flex rounded-xl border border-[#E1E7E6] bg-[#EEF3F2] p-1">
            <button
              id="staff-tab-live"
              onClick={() => setActiveTab('live')}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'live'
                  ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]'
                  : 'text-[#6F7C7A] hover:text-[#17201F]'
              }`}
            >
              Today's Live Queue ({queue.length})
            </button>
            <button
              id="staff-tab-history"
              onClick={() => setActiveTab('history')}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'history'
                  ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]'
                  : 'text-[#6F7C7A] hover:text-[#17201F]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Bookings</span>
            </button>
            <button
              id="staff-tab-manage-staff"
              onClick={() => setActiveTab('staff')}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'staff'
                  ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]'
                  : 'text-[#6F7C7A] hover:text-[#17201F]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Staff Members</span>
            </button>
            <button
              id="staff-tab-offers"
              onClick={() => setActiveTab('offers')}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'offers'
                  ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]'
                  : 'text-[#6F7C7A] hover:text-[#17201F]'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Offers</span>
            </button>
          </div>

          {activeTab !== 'staff' && activeTab !== 'offers' && (
            <button
              id="add-walkin-popup-btn"
              onClick={() => setIsWalkinModalOpen(true)}
              className={`${ui.primaryButton} flex items-center gap-1.5 px-3 py-2 text-xs`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ ADD WALK-IN</span>
            </button>
          )}
        </div>

        {/* Alert message */}
        {queueAlert && (
          <div
            id="staff-queue-alert"
            className="p-3 bg-[#FAF0E6] border border-[#A66020]/40 rounded-2xl text-xs font-semibold text-[#A66020] flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-[#A66020] shrink-0" />
            <span>{queueAlert}</span>
          </div>
        )}

        {/* Tab 1: Live Queue Entries */}
        {activeTab === 'live' && (
          <div className="space-y-2.5">
            {queue.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-[#E1E7E6]">
                <Users className="w-8 h-8 text-[#6F7C7A] mx-auto mb-2" />
                <p className="text-sm font-bold text-[#17201F]">Queue is currently empty</p>
                <p className="text-xs text-[#6F7C7A] mt-0.5 mb-3">
                  Click "+ ADD WALK-IN" or join via Customer App to test live queue flow.
                </p>
                <button
                  onClick={() => setIsWalkinModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white text-xs font-semibold transition cursor-pointer"
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
                  onAction={onQueueAction}
                  onCancelChair={setCancelTarget}
                />
              ))
            )}

            <p className="pt-2 text-center text-[11px] leading-relaxed text-[#6F7C7A] sm:text-left">
              💡 <b>Start</b> seats the customer in the chair; <b>Complete</b> finishes the service and frees the barber in real time.
              <b> Cancel Chair</b> records why the salon dropped a booking, while <b>No-show</b> means the customer was called and never arrived.
            </p>
          </div>
        )}

        {/* Tab 2: Completed History */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {/* Bookings tabs. Classification comes from shared/bookingBuckets so
                Completed can only ever mean a real completed service. */}
            <div className="flex flex-wrap gap-1.5">
              {BOOKING_TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`bookings-tab-${tab.id}`}
                  onClick={() => setBookingTab(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                    bookingTab === tab.id
                      ? 'bg-[#0F766E] text-white'
                      : 'bg-white text-[#6F7C7A] border border-[#E1E7E6] hover:text-[#17201F]'
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
                      filters.range === range ? 'bg-[#E7F5F2] text-[#0F766E]' : 'bg-white text-[#6F7C7A] border border-[#E1E7E6]'
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
                      filters.source === source ? 'bg-[#E7F5F2] text-[#0F766E]' : 'bg-white text-[#6F7C7A] border border-[#E1E7E6]'
                    }`}
                  >
                    {source === 'all' ? 'All sources' : source === 'qr_web' ? 'Web QR' : 'App'}
                  </button>
                ))}
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Search customer or service"
                  className="h-7 min-w-[10rem] flex-1 rounded-lg border border-[#E1E7E6] px-2 text-[11px] outline-none focus:border-[#62AAA3]"
                />
              </div>
            )}

            {bookingTab === 'gross' ? (
              (() => {
                const summary = grossSummary(queue, completedList, now);
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
                    <p className="mt-2 text-[10px] leading-4 text-[#6F7C7A]">
                      Activity counts only. Revenue is not shown because the queue does not carry a reliable
                      per-booking price yet.
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
                    <div className="p-8 text-center bg-white rounded-2xl border border-[#E1E7E6]">
                      <CheckCircle className="w-8 h-8 text-[#0F766E] mx-auto mb-2 opacity-60" />
                      <p className="text-xs text-[#6F7C7A]">
                        {bookingTab === 'reserved'
                          ? 'Reserved bookings are not supported yet.'
                          : 'Nothing in this view for the selected filters.'}
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
                          ? 'text-[#0F766E] bg-[#E7F5F2]'
                          : badge.tone === 'bad'
                            ? 'text-rose-700 bg-rose-50 border border-rose-200/60'
                            : 'text-[#8A6516] bg-[#FFF8EC] border border-[#F0DFBE]';
                      return (
                        <div
                          key={`${item.id}-${idx}`}
                          className="p-3.5 rounded-2xl bg-white border border-[#E1E7E6] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <b className="font-sans text-sm font-bold text-[#17201F]">{item.name}</b>
                              <span className="text-[9px] font-bold uppercase bg-[#0F766E]/10 text-[#0F766E] px-1.5 py-0.5 rounded">
                                {sourceLabel(item)}
                                {(item.callAttempt || 0) > 1 ? ` · Call ${item.callAttempt}` : ''}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#6F7C7A] mt-0.5">
                              {item.service}
                              {item.barberName ? ` · ${item.barberName}` : ''}
                              {item.cancelReasonCode ? ` · ${item.cancelReasonCode.replace(/_/g, ' ')}` : ''}
                            </div>
                          </div>
                          {closed ? (
                            <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${tone}`}>{badge.label}</span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#E1E7E6]/60 text-[#6F7C7A]">
                              {item.status}
                            </span>
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

        {activeTab === 'staff' && (
          <StaffMembersPanel salonId={salon.id} barbers={barbers} allServices={salon.services} onSave={onSaveStaff} />
        )}
        {activeTab === 'offers' && (
          <ManageOffers offers={salon.offers || []} allServices={salon.services} onSave={onSaveOffers} />
        )}
        </>
        )}
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
      </div>

      {/* Dedicated Walk-in Popup Modal */}
      <WalkInModal
        isOpen={isWalkinModalOpen}
        onClose={() => setIsWalkinModalOpen(false)}
        salon={salon}
        barbers={barbers}
        onAddWalkin={onAddWalkin}
      />
    </div>
  );
};

type DutyFilter = 'all' | 'available' | 'in_service' | 'off_duty';

const DUTY_META: Record<Barber['status'], { label: string; dot: string; pill: string }> = {
  available: { label: 'Available', dot: 'bg-[#0F766E]', pill: 'bg-[#E7F5F2] text-[#0F766E]' },
  busy: { label: 'In Service', dot: 'bg-[#A66020]', pill: 'bg-[#FAF0E6] text-[#A66020]' },
  unavailable: { label: 'Off Duty', dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-600' },
};

const matchesDutyFilter = (barber: Barber, filter: DutyFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'available') return barber.status === 'available';
  if (filter === 'in_service') return barber.status === 'busy';
  return barber.status === 'unavailable';
};

const matchesSearch = (barber: Barber, query: string, allServices: ServiceItem[]): boolean => {
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

/**
 * "Staff Members" — real team + individual performance management for the
 * SAME salon_staff records the customer-facing stylist list reads. Roster
 * writes (add/edit/remove) go through the save_staff command, same as
 * before; performance metrics (revenue, completed bookings, top services)
 * come from the durable customer_booking table via GET staff-performance,
 * never from owner-typed fields.
 */
const StaffMembersPanel: React.FC<{ salonId: string; barbers: Barber[]; allServices: ServiceItem[]; onSave: (staff: Barber[]) => void }> = ({ salonId, barbers, allServices, onSave }) => {
  const [filter, setFilter] = useState<DutyFilter>('all');
  const [search, setSearch] = useState('');
  const [performance, setPerformance] = useState<StaffPerformanceRow[] | null>(null);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [viewPerformanceId, setViewPerformanceId] = useState<string | null>(null);
  const [manageProfileId, setManageProfileId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    realtimeQueueService
      .getStaffPerformance(salonId, '30d')
      .then((res) => { if (!cancelled) setPerformance(res.staff); })
      .catch((error) => { if (!cancelled) setPerformanceError(error.message || 'Could not load performance data.'); });
    return () => { cancelled = true; };
  }, [salonId, barbers.length]);

  const total = barbers.length;
  const availableNow = barbers.filter((b) => b.status === 'available').length;
  const inService = barbers.filter((b) => b.status === 'busy').length;
  const offDuty = barbers.filter((b) => b.status === 'unavailable').length;

  const visibleStaff = barbers.filter((b) => matchesDutyFilter(b, filter) && matchesSearch(b, search, allServices));
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
          <h3 className="text-base font-bold text-[#17201F]">Staff Members</h3>
          <p className="mt-0.5 text-[11px] text-[#6F7C7A]">Manage your team, roles, services &amp; performance</p>
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
          ['available', 'Available Now', availableNow, UserCheck, '#0F766E'],
          ['in_service', 'In Service', inService, Clock, '#A66020'],
          ['off_duty', 'Off Duty', offDuty, XCircle, '#BE185D'],
        ] as const).map(([key, label, value, Icon, color]) => (
          <button
            key={key}
            id={`staff-summary-${key}`}
            onClick={() => setFilter(key)}
            className={`${ui.card} p-3 text-left transition ${filter === key ? 'ring-2 ring-[#0F766E]/50' : ''}`}
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
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${filter === key ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]' : 'text-[#6F7C7A] hover:text-[#17201F]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8A9895]" />
          <input
            id="staff-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff member"
            className="h-9 w-full rounded-xl border border-[#E1E7E6] bg-white pl-8 pr-2.5 text-xs font-medium text-[#17201F] outline-none focus:border-[#62AAA3]"
          />
        </div>
      </div>

      {performanceError && (
        <p className="text-[10px] text-[#A66020]">{performanceError}</p>
      )}

      {/* Staff cards */}
      <div className="space-y-2.5">
        {visibleStaff.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-[#E1E7E6]">
            <Users className="w-8 h-8 text-[#6F7C7A] mx-auto mb-2" />
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
          salonId={salonId}
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

const ViewPerformanceSheet: React.FC<{ salonId: string; staff: Barber; onClose: () => void }> = ({ salonId, staff, onClose }) => {
  const [range, setRange] = useState<StaffPerformanceRange>('30d');
  const [row, setRow] = useState<StaffPerformanceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    realtimeQueueService
      .getStaffPerformance(salonId, range)
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
  }, [salonId, staff.id, range]);

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
            className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${range === r.id ? 'bg-white text-[#0F766E] ring-1 ring-[#D8E4E2]' : 'text-[#6F7C7A] hover:text-[#17201F]'}`}
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
                    <span className="font-bold text-[#0F766E]">{s.count}</span>
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
              <input type="checkbox" checked={form.active !== false} onChange={(e) => patch({ active: e.target.checked })} className="h-4 w-4 accent-[#0F766E]" />
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
                  <button key={service.id} type="button" onClick={() => toggleService(service.id)} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${on ? 'bg-[#0F766E] text-white' : 'bg-[#EEF3F2] text-[#6F7C7A]'}`}>
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
