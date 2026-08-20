import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  Scissors,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  ArrowLeft,
  Calendar,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  Navigation,
  ShieldCheck,
  Bell,
  BellRing,
  Radio,
  Check,
  Sparkles,
  Star,
  LocateFixed,
  LoaderCircle,
  Lock,
  QrCode,
} from 'lucide-react';
import { Salon, QueueItem, Barber, CustomerScreen, NearbySalon, CustomerAuthSession, CustomerProfile } from '../types';
import { AVAILABLE_TIME_SLOTS } from '../data/mockData';
import { CallSalonModal } from './CallSalonModal';
import { LandingScreen } from './LandingScreen';
import { LocationDiscovery } from './LocationDiscovery';
import { NotificationPermissionStep } from './NotificationPermissionStep';
import { AccountOnboarding } from './AccountOnboarding';
import { ProfileButton, PromotionalBanner, SalonSearchBar, WalletButton } from './CustomerHomeComponents';
import { CustomerProfileScreen } from './CustomerProfile';
import { SalonDetailPage } from './SalonDetailPage';
import { QrScannerModal } from './QrScannerModal';
import { businessQrService, businessQrToken, type QrBusiness } from '../services/businessQrService';
import { salonDiscoveryService } from '../services/salonDiscoveryService';
import {
  locationPreference,
  readGeolocationPermission,
  resolveStartupPlan,
  type StoredLocationPreference,
} from '../services/locationPreferenceService';
import { LocationSelectorSheet } from './LocationSelectorSheet';
import { callPhase, canCancel, formatCountdown, remainingMs } from '../shared/queueTiming';
import { getNotificationPermissionStatus } from '../services/notificationService';
import { notificationPermission, requestTurnNotifications } from '../services/turnAlertService';
import { resolveAppReadiness } from '../shared/profileReadiness';
import { resolveOnboardingStage } from '../shared/onboardingStage';
import { CancelBookingSheet } from './CancelBookingSheet';
import { StickyScanQrButton } from './StickyScanQrButton';

const CUSTOMER_ONBOARDING_STORAGE_KEY = 'no_wait_salon_customer_onboarding_v1';
const NOTIFICATION_PROMPT_STORAGE_KEY = 'no_wait_salon_customer_notification_prompt_v1';

/**
 * Background discovery refresh for an already-configured location. Uses GPS
 * only when the plan allows it, so a revoked permission never raises a prompt.
 */
async function refreshDiscovery(
  stored: StoredLocationPreference,
  mode: 'gps' | 'area' | 'last-known',
): Promise<NearbySalon[] | null> {
  if (mode === 'area' && stored.area) {
    return (await salonDiscoveryService.byArea(stored.area)).salons;
  }
  if (mode === 'last-known' && stored.latitude !== undefined && stored.longitude !== undefined) {
    return (await salonDiscoveryService.byCoordinates(stored.latitude, stored.longitude)).salons;
  }
  if (mode !== 'gps') return null;
  const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      reject,
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  });
  return (await salonDiscoveryService.byCoordinates(coords.latitude, coords.longitude)).salons;
}

interface CustomerAppProps {
  currentScreen: CustomerScreen;
  setScreen: (screen: CustomerScreen) => void;
  selectedSalon: Salon;
  setSelectedSalon: (salon: Salon) => void;
  selectedService: string;
  setSelectedService: (service: string) => void;
  selectedServiceIds: string[];
  setSelectedServiceIds: (ids: string[]) => void;
  queue: QueueItem[];
  barbers: Barber[];
  userEntry: QueueItem | null;
  completedEntry: QueueItem | null;
  onJoinClick: () => void;
  onSelectSlotClick: (slot: string) => void;
  onCancelQueue: (reason?: { code: string; text: string }) => void;
  customerAuth: CustomerAuthSession | null;
  customerProfile: CustomerProfile | null;
  profileLoading: boolean;
  profileError: string;
  onProfileLogin: () => void;
  onIdentityVerified: (auth: CustomerAuthSession) => void;
  onProfileSaved: (profile: CustomerProfile) => void;
  onProfileLogout: () => void;
  onQrContextChange: (token: string | null) => void;
  queueError: string;
  showTurnPopup: boolean;
  onAcknowledgeTurn: () => void;
}

export const CustomerApp: React.FC<CustomerAppProps> = ({
  currentScreen,
  setScreen,
  selectedSalon,
  setSelectedSalon,
  selectedService,
  setSelectedService,
  selectedServiceIds,
  setSelectedServiceIds,
  queue,
  barbers,
  userEntry,
  completedEntry,
  onJoinClick,
  onSelectSlotClick,
  onCancelQueue,
  customerAuth,
  customerProfile,
  profileLoading,
  profileError,
  onProfileLogin,
  onIdentityVerified,
  onProfileSaved,
  onProfileLogout,
  onQrContextChange,
  queueError,
  showTurnPopup,
  onAcknowledgeTurn,
}) => {
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  // Whether the customer has dismissed the landing screen, via either
  // "Explore Nearby" (guest) or "Login / Sign up" (authenticated). Either
  // path leads to the same guest-accessible Home.
  const [hasEnteredApp, setHasEnteredApp] = useState(
    () => localStorage.getItem(CUSTOMER_ONBOARDING_STORAGE_KEY) === 'complete'
  );
  const [showLoginGate, setShowLoginGate] = useState(false);
  // Set only by an explicit "go back to landing" (visible Back button on
  // Location, or the hardware back button) — never by the persisted
  // hasEnteredApp flag, so it doesn't survive a fresh app launch.
  const [showLandingOverride, setShowLandingOverride] = useState(false);
  const backToLanding = useCallback(() => setShowLandingOverride(true), []);
  // The browser itself remembers a decided (granted/denied) permission — this
  // flag only remembers that we already asked, so a "Not now" is never re-asked.
  const [notificationPrompted, setNotificationPrompted] = useState(
    () => localStorage.getItem(NOTIFICATION_PROMPT_STORAGE_KEY) === 'done'
  );
  // Storage is async on device, so nothing renders until it has been read.
  // Rendering before hydration would flash first-time setup at returning users.
  const [locationHydrated, setLocationHydrated] = useState(false);
  const [storedLocation, setStoredLocation] = useState<StoredLocationPreference | null>(null);
  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const [nearbySalons, setNearbySalons] = useState<NearbySalon[]>([]);
  const [locationLabel, setLocationLabel] = useState('');
  const [isRestoringLocation, setIsRestoringLocation] = useState(false);
  const [salonSearch, setSalonSearch] = useState('');
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  // Advance-reservation date strip: only Today has a real live queue behind
  // it right now, so Tomorrow's windows are clearly labelled as estimates
  // for a future day rather than a confirmed slot.
  const [reservationDay, setReservationDay] = useState<'today' | 'tomorrow'>('today');
  const homeScrollRef = useRef<HTMLDivElement>(null);
  // Drives the server-authoritative arrival countdown. It only ticks while the
  // customer is actually inside a call window, so the app is not re-rendering
  // every second (which previously restarted the QR camera).
  const [nowTick, setNowTick] = useState(() => Date.now());
  const countdownActive = userEntry?.status === 'Called' && Boolean(userEntry.graceExpiresAt);
  useEffect(() => {
    if (!countdownActive) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [countdownActive]);

  // Real notification-permission state for the Live Ticket's "notify me"
  // affordance — the same honest, opt-in surface the public QR web page uses.
  // Never presented as an always-on push subscription.
  const [notifyState, setNotifyState] = useState(notificationPermission());

  // Single scanner controller shared by the header icon and the sticky CTA.
  // Setting it while already open is a no-op, and once open the portal cover
  // hides Home, so neither entry point can be tapped into a second mount.
  const openScanner = useCallback(() => setIsQrScannerOpen(true), []);

  // Stable identity: this is handed to the QR scanner, and a new closure each
  // render used to restart its camera.
  const openQrBusiness = useCallback((token: string, business: QrBusiness) => {
    setSelectedSalon(business);
    setSelectedService(business.services[0]?.name || '');
    setNearbySalons((current) => current?.some((salon) => salon.id === business.id) ? current : [business, ...(current || [])]);
    onQrContextChange(token);
    setScreen('salon');
    setIsQrScannerOpen(false);
  }, [onQrContextChange, setScreen, setSelectedSalon, setSelectedService]);

  useEffect(() => {
    const token = businessQrToken(window.location.href);
    if (!token) return;
    let disposed = false;
    businessQrService.resolve(token).then(({business}) => {
      if (!disposed) openQrBusiness(token, business);
    }).catch(() => { if (!disposed) setIsQrScannerOpen(true); });
    return () => { disposed = true; };
  }, []);

  const enterApp = () => {
    localStorage.setItem(CUSTOMER_ONBOARDING_STORAGE_KEY, 'complete');
    setHasEnteredApp(true);
  };

  // Landing's "Login / Sign up": verify up front for a customer who wants an
  // account before browsing. A customer who is already ready (a restored
  // session) just enters directly, with nothing shown in between.
  const loginGateReadiness = resolveAppReadiness(customerAuth, customerProfile, { profileLoading });
  const openLoginGate = () => {
    if (loginGateReadiness.kind === 'ready') { enterApp(); return; }
    if (loginGateReadiness.kind === 'loading') return;
    setShowLoginGate(true);
  };

  const applyLocation = (salons: NearbySalon[], label: string, preference: StoredLocationPreference) => {
    void locationPreference.save(preference);
    setStoredLocation(preference);
    setNearbySalons(salons);
    setLocationLabel(label);
    setIsChangingLocation(false);
    if (salons.length && !salons.some((salon) => salon.id === selectedSalon.id)) setSelectedSalon(salons[0]);
  };

  // Hydrate persisted setup, then refresh discovery in the background. Home is
  // never blocked, and the OS permission is only ever read, never requested.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await locationPreference.read();
      if (cancelled) return;
      setStoredLocation(stored);
      if (stored) setLocationLabel(stored.label);
      setLocationHydrated(true);
      if (!stored) return;

      const permission = await readGeolocationPermission();
      if (cancelled) return;
      const plan = resolveStartupPlan(stored, permission);
      if (plan.refresh === 'none') return;

      setIsRestoringLocation(true);
      try {
        const salons = await refreshDiscovery(stored, plan.refresh);
        if (!cancelled && salons) setNearbySalons(salons);
      } catch {
        // Home stays usable; the customer can retry from the location row.
      } finally {
        if (!cancelled) setIsRestoringLocation(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeBarbersCount = barbers.filter((b) => b.status !== 'unavailable').length;
  const waitingCustomers = queue.filter((x) => x.status === 'Waiting');
  
  // Calculate ahead count for user or generic
  const peopleAhead = userEntry
    ? queue.filter(
        (x) =>
          x.id !== userEntry.id &&
          ['Waiting', 'Called', 'Serving'].includes(x.status) &&
          x.createdAt < userEntry.createdAt
      ).length
    : waitingCustomers.length;

  const estimatedMinutes = activeBarbersCount > 0
    ? Math.max(5, Math.ceil((peopleAhead * 15) / activeBarbersCount))
    : 0;

  const waitDisplay =
    activeBarbersCount === 0
      ? 'Confirming wait'
      : peopleAhead === 0
        ? 'No wait · Ready now'
        : `${Math.max(5, estimatedMinutes - 5)}–${estimatedMinutes + 5} min`;

  const readyChairs = barbers.filter((b) => b.status === 'available').length;

  // Live Ticket lifecycle: the same derived phase the public QR web page uses,
  // computed from the server-authoritative status + graceExpiresAt so it can
  // never drift from what Staff Dashboard actually did.
  const trackingPhase = userEntry ? callPhase(userEntry, nowTick) : 'waiting';
  const trackingCalled = trackingPhase === 'called';
  const trackingArrivalExpired = trackingPhase === 'call_again';
  const trackingInService = trackingPhase === 'in_service';
  const trackingAcknowledged = Boolean(userEntry?.acknowledgedAt);
  const trackingCountdown = formatCountdown(remainingMs(userEntry || {}, nowTick));

  // The terminal card (screen === 'complete') reads the same phase from
  // whichever entry actually closed, so completed / no-show / cancelled all
  // render distinct, honest copy instead of one generic "complete" message.
  const completedPhase = completedEntry ? callPhase(completedEntry, nowTick) : 'completed';
  const completedCancelledByStaff = completedEntry?.outcome === 'cancelled_staff';
  const completedCancelledByCustomer = completedEntry?.outcome === 'cancelled_customer';
  const completedNoShow = completedPhase === 'no_show';
  const completedCancelled = completedPhase === 'cancelled' || completedCancelledByStaff || completedCancelledByCustomer;

  const normalizedSearch = salonSearch.trim().toLocaleLowerCase();
  const visibleSalons = nearbySalons?.filter((salon) => {
    if (!normalizedSearch) return true;
    return [
      salon.name,
      salon.address,
      ...salon.services.flatMap((service) => [service.name, service.description || '']),
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
  }) || [];

  // The single authoritative pre-Home sequence: landing, then permissions
  // (location, notifications) — only then is the guest-accessible Home
  // reachable. Identity (OTP + profile) is deliberately not part of this
  // sequence: guests browse freely, and verification only gates the moment a
  // booking is actually created (handled at the Join Queue call site).
  const stage = resolveOnboardingStage({
    hasEnteredApp,
    locationHydrated,
    locationSetupCompleted: Boolean(storedLocation?.setupCompleted),
    notificationPromptNeeded: !notificationPrompted && getNotificationPermissionStatus() === 'default',
  });

  // Android/Capacitor hardware back button: navigate one step back through
  // whatever this component is currently showing, mirroring each screen's
  // own visible Back control. Only the true root (landing, nothing behind
  // it) reports "unhandled", which is the sole case allowed to background
  // or exit the app. On web/iOS this listener is installed but the
  // 'backButton' event never fires, so normal browser-back stays untouched.
  const handleHardwareBack = useCallback((): boolean => {
    if (isQrScannerOpen) { setIsQrScannerOpen(false); return true; }
    if (isChangingLocation) { setIsChangingLocation(false); return true; }
    if (cancelSheetOpen) { setCancelSheetOpen(false); return true; }
    if (isCallModalOpen) { setIsCallModalOpen(false); return true; }
    if (showLoginGate) { setShowLoginGate(false); return true; }

    const atLandingRoot = stage === 'landing' || showLandingOverride;
    if (atLandingRoot) return false;

    if (stage === 'location' || stage === 'notifications') { backToLanding(); return true; }
    if (stage !== 'ready') return true;

    if (currentScreen === 'edit-profile') { setScreen('profile'); return true; }
    if (currentScreen === 'slots') { setScreen('salon'); return true; }
    if (currentScreen === 'profile' || currentScreen === 'salon' || currentScreen === 'tracking' || currentScreen === 'complete') {
      setScreen('home');
      return true;
    }
    // currentScreen === 'home': the deepest customer screen backs out to landing.
    backToLanding();
    return true;
  }, [
    isQrScannerOpen, isChangingLocation, cancelSheetOpen, isCallModalOpen, showLoginGate,
    stage, showLandingOverride, backToLanding, currentScreen, setScreen,
  ]);

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

  // A visible/hardware "back to landing" always wins over the persisted
  // hasEnteredApp flag — it's a transient override, not a reset of it, so
  // tapping Explore Nearby again resumes exactly where the normal sequence
  // would have put the customer (straight to Home if location is already set up).
  if (stage === 'landing' || showLandingOverride) {
    return (
      <>
        <LandingScreen
          onExploreNearby={() => { setShowLandingOverride(false); enterApp(); }}
          onLogin={openLoginGate}
        />
        {showLoginGate && loginGateReadiness.kind === 'onboarding_required' && (
          <div className="fixed inset-0 z-[100] bg-[#F8FAFA]">
            <AccountOnboarding
              gate={loginGateReadiness}
              onVerified={onIdentityVerified}
              onProfileSaved={(profile) => { onProfileSaved(profile); setShowLoginGate(false); setShowLandingOverride(false); enterApp(); }}
              onCancel={() => setShowLoginGate(false)}
              intro={{
                eyebrow: 'Login / Sign up',
                title: 'Welcome back.',
                description: 'Verify your mobile number to sync your bookings and profile across devices.',
              }}
            />
          </div>
        )}
      </>
    );
  }
  if (stage === 'loading') {
    return (
      <div className="grid min-h-full place-items-center bg-[#F8FAFA]">
        <LoaderCircle className="h-6 w-6 animate-spin text-[#0F766E]" />
      </div>
    );
  }
  if (stage === 'location') return <LocationDiscovery onLocated={applyLocation} onBack={backToLanding} />;
  if (stage === 'notifications') {
    return (
      <NotificationPermissionStep
        onDone={() => {
          localStorage.setItem(NOTIFICATION_PROMPT_STORAGE_KEY, 'done');
          setNotificationPrompted(true);
        }}
      />
    );
  }

  if (currentScreen === 'profile' || currentScreen === 'edit-profile') {
    return (
      <CustomerProfileScreen
        mode={currentScreen === 'edit-profile' ? 'edit' : 'profile'}
        auth={customerAuth}
        profile={customerProfile}
        loading={profileLoading}
        error={profileError}
        onBack={() => setScreen(currentScreen === 'edit-profile' ? 'profile' : 'home')}
        onEdit={() => setScreen('edit-profile')}
        onLogin={onProfileLogin}
        onSaved={(profile) => { onProfileSaved(profile); setScreen('profile'); }}
        onLogout={onProfileLogout}
      />
    );
  }

  return (
    <div ref={homeScrollRef} className="flex flex-col h-full bg-[#F8FAFA] text-[#17201F] overflow-y-auto">
      {/* 1. HOME SCREEN - NEARBY SALONS */}
      {currentScreen === 'home' && (
        <div id="customer-home-screen" className="min-h-full bg-[#F8FAFA] animate-in fade-in duration-300">
          <div className="border-b border-[#E7ECEB] bg-[#F8FAFA] px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0F766E] text-white">
                    <Scissors className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-bold tracking-[-0.025em] text-[#17201F]">No-Wait Salon</p>
                    <p className="truncate text-[10px] font-medium text-[#71807E]">Find your chair, skip the wait</p>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={openScanner} aria-label="Scan business QR" className="grid h-10 w-10 place-items-center rounded-xl border border-[#DDE7E5] bg-white text-[#0F766E] transition hover:bg-[#EAF6F4]">
                  <QrCode className="h-[18px] w-[18px]" />
                </button>
                <WalletButton />
                <ProfileButton onClick={() => setScreen('profile')} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsChangingLocation(true)}
              className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl px-1 py-2 text-left transition hover:bg-[#F0F6F5]"
              aria-label="Change current location"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E5F3F1] text-[#0F766E]">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[#7A8785]">Your location</span>
                  <span className="block truncate text-xs font-semibold text-[#25302F]">{locationLabel}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#E5F3F1] px-2.5 py-1.5 text-[10px] font-bold text-[#0F766E]">
                <LocateFixed className="h-3.5 w-3.5" />
                Change
              </span>
            </button>

            <div className="mt-3">
              <SalonSearchBar value={salonSearch} onChange={setSalonSearch} />
            </div>
          </div>

          <div className="space-y-5 bg-[#F8FAFA] px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-4 sm:px-5">

          <PromotionalBanner />

          {userEntry && (
            <div
              id="active-queue-banner"
              onClick={() => setScreen('tracking')}
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#B9DAD6] bg-[#EAF6F4] p-4 text-[#164E49] transition hover:bg-[#E1F1EF]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-bold text-[#0F766E] ring-1 ring-[#C9E3E0]">
                  {userEntry.status === 'Called' ? '!' : userEntry.status === 'Serving' ? '✂' : '#'}
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#4F7F7A]">
                    Active Queue Status
                  </div>
                  <div className="text-sm font-bold text-[#164E49]">
                    {callPhase(userEntry, nowTick) === 'called'
                      ? `Your turn! Arrive within ${formatCountdown(remainingMs(userEntry, nowTick))}`
                      : callPhase(userEntry, nowTick) === 'call_again'
                        ? 'Arrival window ended · waiting for salon'
                        : userEntry.status === 'Serving'
                          ? 'Currently in grooming service'
                          : `${peopleAhead} ahead · ${waitDisplay}`}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#0F766E]" />
            </div>
          )}

          <div>
            <div className="mb-3 flex items-end justify-between gap-4 px-1">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A8785]">Nearby salons</span>
                <h2 className="mt-0.5 text-xl font-bold tracking-[-0.025em] text-[#17201F]">Choose your chair</h2>
              </div>
              <span className="mb-1 flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-[#0F766E]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" />
                Live now
              </span>
            </div>

            <div className="space-y-3">
              {nearbySalons.length === 0 && isRestoringLocation && (
                <div className="rounded-2xl border border-[#DCE5E3] bg-white px-5 py-8 text-center">
                  <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[#0F766E]" />
                  <p className="mt-3 text-xs leading-5 text-[#788582]">Refreshing salons near {locationLabel || 'you'}…</p>
                </div>
              )}

              {nearbySalons.length === 0 && !isRestoringLocation && (
                <div className="rounded-2xl border border-[#DCE5E3] bg-white px-5 py-8 text-center">
                  <MapPin className="mx-auto h-6 w-6 text-[#7EA7A2]" />
                  <h3 className="mt-3 text-sm font-bold text-[#25302F]">No salons available in your area yet.</h3>
                  <p className="mt-1 text-xs leading-5 text-[#788582]">Try another city or area as we onboard more salon partners.</p>
                  <button type="button" onClick={() => setIsChangingLocation(true)} className="mt-4 text-xs font-bold text-[#0F766E]">Change location</button>
                </div>
              )}
              {nearbySalons.length > 0 && visibleSalons.length === 0 && (
                <div className="rounded-2xl border border-[#DCE5E3] bg-white px-5 py-8 text-center">
                  <h3 className="text-sm font-bold text-[#25302F]">No matching salons found.</h3>
                  <p className="mt-1 text-xs leading-5 text-[#788582]">Try a salon name, area, or service.</p>
                  <button type="button" onClick={() => setSalonSearch('')} className="mt-4 text-xs font-bold text-[#0F766E]">Clear search</button>
                </div>
              )}
              {visibleSalons.map((salon) => {
                const isSelected = selectedSalon.id === salon.id;
                const salonWait = salon.liveWaitMinutes === 0 ? 'No wait' : `${salon.liveWaitMinutes} min`;
                return (
                  <button
                    key={salon.id}
                    id={`salon-item-${salon.id}`}
                    onClick={() => {
                      setSelectedSalon(salon);
                      onQrContextChange(null);
                      setScreen('salon');
                    }}
                    className={`group w-full overflow-hidden rounded-2xl border bg-white text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-[#62AAA3] ring-1 ring-[#62AAA3]'
                        : 'border-[#E1E7E6] hover:border-[#9CCBC6]'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 p-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8F5F3] text-[#0F766E]">
                        <Scissors className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <b className="truncate text-[15px] font-bold text-[#202A29]">
                            {salon.name}
                          </b>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#A1ADAB] transition group-hover:translate-x-0.5 group-hover:text-[#0F766E]" />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-[#77746B]">
                          <span className="flex items-center gap-1 text-[#475351]">
                            <Star className="h-3 w-3 fill-[#5A8F89] text-[#5A8F89]" />
                            {salon.rating}
                          </span>
                          <span className="text-[#C7C3B8]">•</span>
                          <span>{salon.distanceKm} km</span>
                          <span className="text-[#C7C3B8]">•</span>
                          <span>{salon.travelTimeMinutes} min away</span>
                        </div>
                        <p className="mt-2 truncate text-[11px] text-[#969289]">
                          {salon.address}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#E8EDEC] bg-[#FBFCFC] px-4 py-2.5">
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#77746B]">
                        <Clock className="h-3.5 w-3.5 text-[#0F766E]" />
                        Current wait
                      </span>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="rounded-full bg-[#E6F4F2] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#0F766E]">
                            Selected
                          </span>
                        )}
                        <span className="text-xs font-bold text-[#0F766E]">{salonWait}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      )}

      {currentScreen === 'salon' && (
        <div className="relative min-h-full">
        {queueError && <div role="alert" className="absolute left-4 right-4 top-4 z-20 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{queueError}</div>}
        <SalonDetailPage
          salon={selectedSalon}
          nearbySalons={nearbySalons}
          queue={queue}
          barbers={barbers}
          selectedService={selectedService}
          setSelectedService={setSelectedService}
          selectedServiceIds={selectedServiceIds}
          setSelectedServiceIds={setSelectedServiceIds}
          onBack={() => setScreen('home')}
          onJoin={userEntry ? () => setScreen('tracking') : onJoinClick}
          onReserve={() => setScreen('slots')}
          userEntry={userEntry}
        />
        </div>
      )}

      {currentScreen === 'home' && !isQrScannerOpen && (
        <StickyScanQrButton scrollRef={homeScrollRef} onScan={openScanner} />
      )}

      <QrScannerModal open={isQrScannerOpen} onClose={() => setIsQrScannerOpen(false)} onResolved={openQrBusiness} />

      <LocationSelectorSheet
        open={isChangingLocation}
        currentLabel={locationLabel}
        onClose={() => setIsChangingLocation(false)}
        onSelected={applyLocation}
      />

      {/* Legacy salon layout retained temporarily for parity checks; it is not rendered. */}
      {false && currentScreen === 'salon' && (
        <div id="customer-salon-screen" className="min-h-full space-y-5 bg-[#F8FAFA] p-5 animate-in fade-in duration-200">
          <div>
            <button
              id="back-to-salons-btn"
              onClick={() => setScreen('home')}
              className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#60706E] transition hover:text-[#0F766E]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Nearby salons</span>
            </button>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[#475351]">
                    <Star className="h-3 w-3 fill-[#5A8F89] text-[#5A8F89]" />
                    {selectedSalon.rating}
                  </span>
                  <span className="text-[10px] text-[#879391]">({selectedSalon.reviewCount} reviews)</span>
                </div>
                <h1 className="truncate text-[25px] font-bold leading-tight tracking-[-0.035em] text-[#17201F]">
                  {selectedSalon.name}
                </h1>
                <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-[#6F7C7A]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F766E]" />
                  <span>{selectedSalon.address}</span>
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#E7F5F2] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#0F766E]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" />
                Open
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#E1E8E7] bg-white px-3 py-2.5">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#85918F]">Distance</span>
                <span className="mt-0.5 block text-xs font-semibold text-[#2E3A38]">{selectedSalon.distanceKm} km away</span>
              </div>
              <div className="rounded-xl border border-[#E1E8E7] bg-white px-3 py-2.5">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#85918F]">Team available</span>
                <span className="mt-0.5 block text-xs font-semibold text-[#2E3A38]">{activeBarbersCount} barbers</span>
              </div>
            </div>
          </div>

          {/* Live wait summary */}
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#BFE0DC] bg-[#EDF8F6] p-4">
            <div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#4C7772]">
                <Clock className="h-3.5 w-3.5" />
                Live estimated wait
              </div>
              <div className="mt-1 text-xl font-bold tracking-[-0.025em] text-[#135F58]">{waitDisplay}</div>
              <div className="mt-0.5 text-[10px] text-[#5E7774]">
                {peopleAhead === 0
                  ? 'No one ahead · You can walk right in'
                  : `${peopleAhead} ${peopleAhead === 1 ? 'person' : 'people'} currently ahead`}
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0F766E] ring-1 ring-[#C9E5E1]">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>

          {/* Service Selection */}
          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A8785]">Services</span>
                <h2 className="mt-0.5 text-lg font-bold tracking-[-0.02em] text-[#17201F]">What do you need?</h2>
              </div>
              <span className="mb-0.5 text-[10px] font-semibold text-[#0F766E]">1 selected</span>
            </div>

            <div className="space-y-2.5">
              {selectedSalon.services.map((srv) => {
                const isActive = selectedService === srv.name;
                return (
                  <button
                    key={srv.id}
                    id={`service-opt-${srv.id}`}
                    onClick={() => setSelectedService(srv.name)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                      isActive
                        ? 'border-[#55A59D] bg-[#F0F9F7] ring-1 ring-[#55A59D]'
                        : 'border-[#E1E7E6] bg-white hover:border-[#9CCBC6]'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3 pr-2">
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${isActive ? 'border-[#0F766E] bg-[#0F766E] text-white' : 'border-[#C5CECC] bg-white text-transparent'}`}>
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      <div className="min-w-0">
                        <span className={`block text-[13px] font-semibold ${isActive ? 'text-[#135F58]' : 'text-[#273230]'}`}>
                          {srv.name}
                        </span>
                        {srv.description && <span className="mt-0.5 block truncate text-[10px] text-[#7A8785]">{srv.description}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-xs font-bold text-[#273230]">₹{srv.priceInr}</span>
                      <span className="mt-0.5 block text-[10px] text-[#7A8785]">{srv.durationMin} min</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 border-t border-[#E2E8E7] pt-4">
            <button
              id="join-live-queue-btn"
              onClick={onJoinClick}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#0B665F] active:scale-[0.99]"
            >
              <Users className="w-4 h-4" />
              <span>{userEntry ? 'View Live Queue Status' : `Join Queue for ${selectedService}`}</span>
            </button>

            <button
              id="reserve-slot-btn"
              onClick={() => setScreen('slots')}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#DCE5E3] bg-white px-4 py-2.5 text-xs font-semibold text-[#43504E] transition hover:border-[#A9CECA] hover:text-[#0F766E]"
            >
              <Calendar className="h-3.5 w-3.5 text-[#0F766E]" />
              <span>Reserve a future queue window</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. FUTURE TIME SLOTS SCREEN */}
      {currentScreen === 'slots' && (
        <div id="customer-slots-screen" className="animate-in fade-in duration-150">
          {/* Premium header with a tasteful gold accent — not a loud gold page. */}
          <div className="bg-gradient-to-br from-[#173B38] to-[#0F2E2B] px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
            <button
              id="back-to-salon-btn"
              onClick={() => setScreen('salon')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 transition hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Salon details</span>
            </button>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#E7D6A3]/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#F5E8C4]">
              <Sparkles className="h-3 w-3" /> Advance reservation
            </span>
            <h1 className="mt-2.5 text-2xl font-bold tracking-tight">Reserve an arrival window</h1>
            <p className="mt-1 text-xs leading-relaxed text-white/70">
              {selectedService} at {selectedSalon.name}. This holds an <b className="text-white">estimated</b> arrival
              window in the live queue — never an exact appointment time.
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Date strip */}
            <div className="flex gap-2">
              {(['today', 'tomorrow'] as const).map((day) => (
                <button
                  key={day}
                  type="button"
                  id={`reservation-day-${day}`}
                  onClick={() => setReservationDay(day)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition ${
                    reservationDay === day ? 'border-[#0F766E] bg-[#0F766E] text-white' : 'border-[#E1E7E6] bg-white text-[#43504E]'
                  }`}
                >
                  {day === 'today' ? 'Today' : 'Tomorrow'}
                </button>
              ))}
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#DCE5E3] px-3 py-2.5 text-center text-[11px] font-semibold text-[#9AA6A3]">
                <CalendarDays className="h-3.5 w-3.5" /> More dates soon
              </span>
            </div>

            <div className="p-3.5 bg-white border border-[#E1E7E6] rounded-2xl flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
              <p className="text-xs text-[#17201F] leading-snug">
                Selected service: <b className="font-bold text-[#0F766E]">{selectedService}</b> at {selectedSalon.name}.
              </p>
            </div>

            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6F7C7A] mb-2.5">
                {reservationDay === 'today' ? 'Available windows today' : 'Available windows tomorrow'}
              </span>

              <div className="space-y-2">
                {AVAILABLE_TIME_SLOTS.map((slot, index) => (
                  <button
                    key={slot}
                    id={`slot-${slot.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => onSelectSlotClick(slot)}
                    className="w-full p-3.5 rounded-2xl border border-[#E1E7E6] bg-white hover:border-[#0F766E] hover:bg-[#0F766E]/5 text-left flex items-center justify-between transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#F8FAFA] border border-[#E1E7E6] group-hover:bg-[#0F766E] group-hover:text-white text-[#0F766E] flex items-center justify-center font-bold text-xs transition">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <b className="font-sans text-sm font-bold text-[#17201F]">{slot}</b>
                          {index === 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#FBF3DE] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8A5A16]">
                              <Sparkles className="h-2.5 w-2.5" /> Best time
                            </span>
                          )}
                        </div>
                        <span className="block text-[11px] text-[#6F7C7A]">
                          {index === 0 ? 'Approx. arrival window · lower expected wait' : 'Approx. arrival window'}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#0F766E] group-hover:text-[#0B665F] bg-[#0F766E]/10 px-3 py-1 rounded-lg">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Locked premium preview — coming soon, never a fake guarantee. */}
            <div className="rounded-2xl border border-[#E7D6A3] bg-gradient-to-br from-[#FBF3DE] to-[#F5E8C4] p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A5A16]">
                <Lock className="h-3.5 w-3.5" /> Premium unlocks
              </p>
              <div className="mt-3 space-y-2">
                {['Priority arrival window', 'Auto-hold your favourite stylist'].map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5 rounded-xl bg-white/70 px-3 py-2.5 text-xs font-semibold text-[#6B531B]">
                    <Lock className="h-3.5 w-3.5 shrink-0" /> {feature}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. LIVE TRACKING SCREEN */}
      {currentScreen === 'tracking' && (
        <div id="customer-tracking-screen" className="p-5 space-y-4 animate-in fade-in duration-150">
          <button
            id="back-to-home-btn"
            onClick={() => setScreen('home')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6F7C7A] hover:text-[#17201F] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Find another salon</span>
          </button>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#6F7C7A]">
              Live Ticket
            </div>
            <h1 className="font-sans text-2xl font-bold text-[#17201F] tracking-tight">
              Your live queue
            </h1>
            <p className="text-xs text-[#6F7C7A] mt-0.5">
              {selectedSalon.name} · {userEntry?.service || selectedService}
            </p>
          </div>

          {/* Main Tracking Card — one surface per phase, so Waiting/Called/In
              service never show two cards saying the same thing at once. */}
          <div
            id="tracking-position-badge"
            className={`rounded-2xl p-6 text-white ${
              trackingCalled
                ? 'bg-gradient-to-br from-[#B4761C] to-[#8A5A16]'
                : 'bg-gradient-to-br from-[#0F766E] to-[#0B4A44]'
            }`}
          >
            {userEntry?.status === 'Reserved' && (
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Reserved window</p>
                <p className="mt-1 text-xl font-bold">Reserved for {userEntry.reservedFor}</p>
                <p className="mt-2 text-xs text-white/85">We'll update you with live notifications as the window nears.</p>
              </div>
            )}

            {userEntry?.status !== 'Reserved' && !trackingCalled && !trackingArrivalExpired && !trackingInService && (
              <>
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Your position</p>
                <p className="mt-1 text-center text-[44px] font-extrabold leading-none">{peopleAhead + 1}</p>
                <p className="mt-1 text-center text-[13px] text-white/85">
                  {peopleAhead > 0 ? `${peopleAhead} people ahead of you` : "You're next!"}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/10 p-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/70">Ahead</p>
                    <p className="mt-0.5 text-base font-bold">{peopleAhead}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/70">Est. wait</p>
                    <p className="mt-0.5 text-base font-bold leading-tight">{waitDisplay}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/70">Ready chairs</p>
                    <p className="mt-0.5 text-base font-bold">{readyChairs}/{activeBarbersCount}</p>
                  </div>
                </div>
              </>
            )}

            {trackingCalled && (
              <div className="text-center">
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/15">
                  <BellRing className="h-5.5 w-5.5" />
                </div>
                <p className="mt-3 text-lg font-extrabold">{trackingAcknowledged ? 'On your way' : "It's your turn!"}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">
                  {trackingAcknowledged ? 'Please reach the salon within' : 'Please arrive within'}
                </p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums">{trackingCountdown}</p>
                {(userEntry?.callAttempt || 0) > 1 && (
                  <p className="mt-1 text-[11px] font-semibold text-white/80">Call attempt {userEntry?.callAttempt}</p>
                )}
                {!trackingAcknowledged && (
                  <button
                    type="button"
                    id="acknowledge-turn-btn"
                    onClick={onAcknowledgeTurn}
                    className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-bold text-[#8A5A16] active:scale-[0.99]"
                  >
                    I'm on my way
                  </button>
                )}
              </div>
            )}

            {trackingArrivalExpired && (
              <div className="text-center">
                <AlertCircle className="mx-auto h-6 w-6 text-white/80" />
                <p className="mt-3 text-base font-bold">Your arrival window has ended</p>
                <p className="mt-1 text-xs leading-5 text-white/85">The salon will call you again shortly, or you can call them directly.</p>
              </div>
            )}

            {trackingInService && (
              <div className="text-center">
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/15">
                  <Scissors className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">In service</p>
                <p className="mt-1 text-xl font-bold">{userEntry?.barberName ? `With ${userEntry.barberName}` : 'You are being served'}</p>
                <p className="mt-2 text-xs text-white/85">{selectedSalon.name} · {userEntry?.service}</p>
              </div>
            )}
          </div>

          {/* Live-updates band: honest about what this actually is — an
              in-app SSE stream, not a background push subscription. */}
          {userEntry && !trackingInService && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-[#CFE6E2] bg-[#EAF6F4] px-4 py-3">
              <Radio className="h-4 w-4 shrink-0 animate-pulse text-[#0F766E]" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#0F766E]">Live updates automatically</p>
                <p className="text-[11px] text-[#4F7F7A]">No need to refresh — this screen updates the instant staff acts.</p>
              </div>
            </div>
          )}

          {!trackingInService && notifyState === 'default' && (
            <button
              type="button"
              onClick={() => void requestTurnNotifications().then(setNotifyState)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#CDE3E0] bg-white py-3 text-xs font-bold text-[#0F766E]"
            >
              <Bell className="h-4 w-4" /> Notify me when it's my turn
            </button>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              id="get-directions-link"
              href={`https://maps.google.com/?q=${encodeURIComponent(selectedSalon.name + ' ' + selectedSalon.address)}`}
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-2xl border border-[#E1E7E6] bg-white hover:bg-[#F8FAFA] text-[#17201F] font-semibold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Navigation className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Get Directions</span>
            </a>
            <button
              id="call-salon-action-btn"
              onClick={() => setIsCallModalOpen(true)}
              className="p-3 rounded-2xl border border-[#E1E7E6] bg-white hover:bg-[#F8FAFA] text-[#17201F] font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 text-[#6F7C7A]" />
              <span>Call Salon</span>
            </button>
          </div>

          {/* Cancel Queue button — hidden once in service, since it no longer
              makes sense (canCancel excludes 'Serving'). */}
          {userEntry && canCancel(userEntry.status) && (
            <button
              id="cancel-queue-entry-btn"
              onClick={() => setCancelSheetOpen(true)}
              className="w-full py-2 text-rose-700 hover:text-rose-900 font-semibold text-xs underline underline-offset-4 transition cursor-pointer"
            >
              Cancel my queue entry
            </button>
          )}
        </div>
      )}

      {/* 5. TERMINAL SCREEN — completed, no-show, or cancelled. Reads whichever
          outcome actually closed the booking instead of assuming success. */}
      {currentScreen === 'complete' && (
        <div id="customer-complete-screen" className="flex min-h-full flex-col justify-center bg-[#F8FAFA] p-5 animate-in fade-in duration-200">
          <div
            className={`rounded-2xl border p-6 text-center ${
              completedCancelled || completedNoShow ? 'border-[#E5DAD5] bg-white' : 'border-[#C8E3DF] bg-white'
            }`}
          >
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-1 ${
                completedCancelled || completedNoShow
                  ? 'bg-[#F3F0EE] text-[#8A6A62] ring-[#E5DAD5]'
                  : 'bg-[#E7F5F2] text-[#0F766E] ring-[#C8E3DF]'
              }`}
            >
              {completedCancelled || completedNoShow ? <AlertCircle className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
            </div>
            <span className="mt-4 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#0F766E]">
              {completedCancelledByStaff
                ? 'Booking cancelled by salon'
                : completedCancelledByCustomer
                  ? 'Booking cancelled'
                  : completedNoShow
                    ? 'Turn missed'
                    : 'Service complete'}
            </span>
            <h1 id="tracking-main-status" className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#17201F]">
              {completedCancelledByStaff
                ? 'The salon cancelled your booking'
                : completedCancelledByCustomer
                  ? 'Booking cancelled'
                  : completedNoShow
                    ? 'You missed your turn'
                    : 'Looking sharp.'}
            </h1>
            <p className="mx-auto mt-2 max-w-[300px] text-xs leading-relaxed text-[#6F7C7A]">
              {completedCancelledByStaff
                ? 'The salon could not keep this booking. You can join the queue again or call them.'
                : completedCancelledByCustomer
                  ? 'Your booking was cancelled and removed from the queue.'
                  : completedNoShow
                    ? 'Your queue entry was closed because you could not reach the salon within the arrival window.'
                    : `Your ${completedEntry?.service || selectedService} at ${selectedSalon.name} is complete. Thanks for visiting us today.`}
            </p>

            {!completedCancelled && !completedNoShow && (
              <div className="mt-5 grid grid-cols-2 gap-2 text-left">
                <div className="rounded-xl border border-[#E1E7E6] bg-[#F8FAFA] p-3">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-[#7A8785]">Service</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-[#273230]">{completedEntry?.service || selectedService}</span>
                </div>
                <div className="rounded-xl border border-[#E1E7E6] bg-[#F8FAFA] p-3">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-[#7A8785]">Stylist</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-[#273230]">{completedEntry?.barberName || 'Salon team'}</span>
                </div>
              </div>
            )}

            {(completedCancelled || completedNoShow) && selectedSalon.phoneNumber && (
              <a
                href={`tel:${selectedSalon.phoneNumber}`}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#DDE7E5] text-sm font-bold text-[#0F766E]"
              >
                <PhoneCall className="h-4 w-4" /> Call salon
              </a>
            )}

            <button
              type="button"
              onClick={() => setScreen('home')}
              className="mt-3 w-full rounded-xl bg-[#0F766E] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0B665F] active:scale-[0.99]"
            >
              {completedCancelled || completedNoShow ? 'Join a queue again' : 'Find another service'}
            </button>
          </div>
        </div>
      )}

      {/* Turn popup: the guaranteed full-screen surface for the Called edge,
          matching the public QR web page. Only ever shown while genuinely
          Called — the App-level effect clears it the instant that changes. */}
      {showTurnPopup && userEntry && trackingCalled && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:items-center">
          <div role="alertdialog" aria-modal="true" aria-label="It's your turn" className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto grid h-16 w-16 animate-pulse place-items-center rounded-full bg-[#FFF3E2] text-[#B4761C]">
              <BellRing className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-[-0.01em]">It's your turn!</h2>
            <p className="mt-2 text-sm leading-6 text-[#5A6866]">Please proceed to the salon counter.</p>
            <p className="mt-2 text-sm font-bold text-[#B4761C]">Please arrive within {trackingCountdown}</p>
            <div className="mt-4 rounded-2xl bg-[#F6F9F8] p-3">
              <p className="text-sm font-bold">{selectedSalon.name}</p>
              <p className="mt-0.5 text-xs text-[#667371]">{userEntry.service}</p>
            </div>
            <button
              type="button"
              onClick={onAcknowledgeTurn}
              className="mt-5 h-12 w-full rounded-xl bg-[#0F766E] text-sm font-bold text-white active:scale-[0.99]"
            >
              I'm on my way
            </button>
          </div>
        </div>
      )}

      {/* Call Salon In-App Modal */}
      <CallSalonModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        salon={selectedSalon}
      />

      <CancelBookingSheet
        open={cancelSheetOpen}
        audience="customer"
        title="Cancel your booking?"
        onClose={() => setCancelSheetOpen(false)}
        onConfirm={(code, text) => {
          setCancelSheetOpen(false);
          onCancelQueue({ code, text });
        }}
      />
    </div>
  );
};
