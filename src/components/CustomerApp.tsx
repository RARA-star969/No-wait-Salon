import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  MapPin,
  Users,
  ChevronRight,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  PhoneCall,
  Navigation,
  ShieldCheck,
  Bell,
  BellRing,
  Volume2,
  Check,
  Sparkles,
  LocateFixed,
  LoaderCircle,
  QrCode,
  Search,
  AlertTriangle,
  ArrowUp,
  X,
} from 'lucide-react';
import { Salon, QueueItem, Barber, CustomerScreen, NearbySalon, CustomerAuthSession, CustomerProfile, UserAddress } from '../types';
import { formatDurationRangeLabel } from '../shared/durationFormat';
import { smoothScrollTo } from '../shared/smoothScroll';
import { isGymCategory } from '../shared/businessCategory';
import { AddressManagementModal } from './AddressManagementModal';
import { LocationSelectScreen } from './LocationSelectScreen';
import { AddAddressScreen } from './AddAddressScreen';
import { RequestAddressScreen } from './RequestAddressScreen';
import { CATEGORY_THEME_MAP, PremiumBusinessCard, getCategoryIcon, categoryCssVars, resolveCategoryTheme, CustomerCategoryGrid, customerHomeAccent } from './CustomerHomeComponents';
import { AVAILABLE_TIME_SLOTS } from '../data/mockData';
import { CallSalonModal } from './CallSalonModal';
import { LandingScreen } from './LandingScreen';
import { LocationDiscovery } from './LocationDiscovery';
import { NotificationPermissionStep } from './NotificationPermissionStep';
import { AccountOnboarding } from './AccountOnboarding';
import { PromotionalBanner, SalonSearchBar, CategoryLandingState, DEFAULT_MAIN_CATEGORIES, CategoryItemConfig } from './CustomerHomeComponents';
import { CustomerProfileScreen } from './CustomerProfile';
import { GymActivityScreen } from './GymActivityScreen';
import { GymMemberHub } from './GymMemberHub';
import { SalonDetailPage } from './SalonDetailPage';
import { GymDetailPage } from './GymDetailPage';
import { ReserveFutureWindowScreen } from './ReserveFutureWindowScreen';
import { ThankYouScreen } from './ThankYouScreen';
import { realtimeQueueService } from '../services/realtimeQueueService';
import { QrScannerModal } from './QrScannerModal';
import { DetailErrorBoundary } from './DetailErrorBoundary';
import { businessQrService, businessQrToken, type QrBusiness } from '../services/businessQrService';
import { fetchSalonProfile, salonDiscoveryService } from '../services/salonDiscoveryService';
import {
  locationPreference,
  readGeolocationPermission,
  resolveStartupPlan,
  type StoredLocationPreference,
} from '../services/locationPreferenceService';
import { lastViewedBusinessPreference, type LastViewedByCategory } from '../services/recentBusinessPreferenceService';
import { businessMembershipService } from '../services/businessMembershipService';
import type { SignalColor } from '../shared/signalColor';
import { resolveSalonQueueSignal } from '../shared/salonQueueLevel';
import { deriveLocalityLabel } from '../shared/localityLabel';
import { mergeLiveOperationalFields } from '../shared/nearbySalonsSync';
import { salonListingPositionLabel } from '../shared/liveQueueDisplayMetrics';
import { resolveGymCrowdLevel } from '../shared/gymCrowdResolver';
import { gymListingSignal } from '../shared/gymListingSignal';
import { LocationSelectorSheet } from './LocationSelectorSheet';
import { callPhase, canCancel, formatCountdown, remainingMs } from '../shared/queueTiming';
import { getNotificationPermissionStatus } from '../services/notificationService';
import { resolveAppReadiness } from '../shared/profileReadiness';
import { resolveOnboardingStage } from '../shared/onboardingStage';
import { CancelBookingSheet } from './CancelBookingSheet';
import { LiveTicket, type JourneyStage, type TicketPerson } from './LiveTicket';
import { StickyScanQrButton } from './StickyScanQrButton';
import { MyBookingsScreen } from './MyBookingsScreen';
import { NotificationsScreen } from './NotificationsScreen';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';
import { useNotificationInbox } from './useNotificationInbox';
import { resolveBackAction, type CustomerOverlayState } from '../shared/customerBackResolver';
import type { CustomerNotification, NotificationFilter, NotificationRoute } from '../shared/customerNotifications';
import type { BookingRoute, CustomerBookingView } from '../shared/customerBookingViews';

const CUSTOMER_ONBOARDING_STORAGE_KEY = 'no_wait_salon_customer_onboarding_v1';
const NOTIFICATION_PROMPT_STORAGE_KEY = 'no_wait_salon_customer_notification_prompt_v1';
const APPROVED_EMPTY_HOME_CATEGORIES: CategoryItemConfig[] = [
  { id: 'clinic', name: 'Clinic', iconName: 'SquarePlus', label: 'Clinic', description: 'No supported clinic listings are available in this area yet.', themeKey: 'clinic' },
  { id: 'spa', name: 'Spa', iconName: 'Sparkles', label: 'Spa', description: 'No supported spa listings are available in this area yet.', themeKey: 'spa' },
];

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
  appliedOfferId: string | null;
  onApplyOffer: (offerId: string) => void;
  onRemoveOffer: () => void;
  queue: QueueItem[];
  barbers: Barber[];
  userEntry: QueueItem | null;
  completedEntry: QueueItem | null;
  onJoinClick: () => void;
  onSelectSlotClick: (slot: string) => void;
  onCancelQueue: (reason?: { code: string; text: string }) => void;
  onAcknowledge: () => void;
  permissionStatus: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
  onTestPush: (type: 'approaching' | 'called' | 'reserved_nearing') => void;
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
  isJoinSheetOpen?: boolean;
  /** Opens App.tsx's existing NotificationCenterModal — reused as-is for the
   *  bottom nav's "Alerts" destination. */
  onOpenNotifications?: () => void;
}

// Every non-home screen (Profile, Edit Profile, location/address screens, and
// any future screen added the same way) must own real vertical scroll, not
// just inherit `overflow-hidden` from CustomerApp's shell. Screens below only
// ever set `min-h-full` on their own root — by design they expect an
// ancestor like this to be the actual scroll container. Defined at module
// scope (not inside CustomerApp) so it never remounts — and loses scroll
// position — on an unrelated re-render.
//
// Deliberately a BLOCK container, not `flex flex-col`. As a flex column its
// single child was a flex item with the default `flex-shrink: 1`, so a screen
// taller than the viewport was *shrunk back down* to exactly the container
// height instead of overflowing it. The screen then never scrolled, its own
// bottom safe-area padding had nothing to push against, and its last rows
// (Log out, the final settings row) sat permanently under the bottom nav.
// A block child grows to its natural height, which is what makes this element
// the real — and only — scroll owner for the screen.
const ScreenScroll: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
    {children}
  </div>
);

export const CustomerApp: React.FC<CustomerAppProps> = ({
  currentScreen,
  setScreen,
  selectedSalon,
  setSelectedSalon,
  selectedService,
  setSelectedService,
  selectedServiceIds,
  setSelectedServiceIds,
  appliedOfferId,
  onApplyOffer,
  onRemoveOffer,
  queue,
  barbers,
  userEntry,
  completedEntry,
  onJoinClick,
  onSelectSlotClick,
  onCancelQueue,
  onAcknowledge,
  permissionStatus,
  onRequestPermission,
  onTestPush,
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
  isJoinSheetOpen,
  onOpenNotifications,
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
  const [selectedAddressLabel, setSelectedAddressLabel] = useState('Home Me');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [isRestoringLocation, setIsRestoringLocation] = useState(false);
  const [salonSearch, setSalonSearch] = useState('');
  const [mainCategories, setMainCategories] = useState<CategoryItemConfig[]>(DEFAULT_MAIN_CATEGORIES);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('salon');
  // UI-only "last viewed" memory per category — no card starts selected;
  // one becomes marked only once the customer actually opens it. Never a
  // source of truth for booking/queue/payment state.
  const [lastViewedByCategory, setLastViewedByCategory] = useState<LastViewedByCategory>({});
  useEffect(() => {
    let cancelled = false;
    lastViewedBusinessPreference.read().then((stored) => {
      if (!cancelled) setLastViewedByCategory(stored);
    });
    return () => { cancelled = true; };
  }, []);
  const markLastViewed = useCallback((categoryId: string, businessId: string) => {
    setLastViewedByCategory((prev) => {
      const next = { ...prev, [categoryId.toLowerCase()]: businessId };
      void lastViewedBusinessPreference.save(next);
      return next;
    });
  }, []);
  // One authenticated summary call covers every Gym card on the listing —
  // never one membership lookup per card. Only a genuinely 'active' status
  // counts as a MEMBER; expired/cancelled memberships never do, even though
  // the same endpoint also returns those for the Profile "Gym Activity" view.
  //
  // Refetches on every auth change AND on the same short cadence/visibility
  // pattern the nearby-salons live poll above uses, but scoped to just this
  // one summary call — so a membership purchased/claimed on the Gym Detail
  // page (or by staff) flips Last-viewed -> Member on Home within a few
  // seconds, never requiring a full reload, without turning into a
  // per-card poll.
  // Businesses this customer holds a genuinely active membership at, in ANY
  // category — the same "businessId + active membership" concept the crown
  // renders everywhere it appears. See businessMembershipService for the
  // future-safe abstraction boundary (today gym-sourced, never gated on
  // `isGym` here).
  const [activeMemberBusinessIds, setActiveMemberBusinessIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!customerAuth?.token) {
      setActiveMemberBusinessIds(new Set());
      return;
    }
    let cancelled = false;
    let inFlight = false;

    const refreshMembership = async () => {
      if (inFlight || cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      inFlight = true;
      try {
        const activeIds = await businessMembershipService.getMyActiveMembershipBusinessIds();
        if (cancelled) return;
        setActiveMemberBusinessIds(activeIds);
      } catch {
        // Keep showing the last known membership set; the next tick retries.
      } finally {
        inFlight = false;
      }
    };

    void refreshMembership();
    if (currentScreen !== 'home') return () => { cancelled = true; };

    const intervalId = setInterval(refreshMembership, 3000);
    const onVisibilityChange = () => { if (!document.hidden) void refreshMembership(); };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [customerAuth?.token, currentScreen]);
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const handleVoiceSearch = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceFeedback('Voice search is not supported on this browser. Please type your search.');
      setTimeout(() => setVoiceFeedback(null), 4000);
      return;
    }

    if (isListening) {
      try { recognitionRef.current?.stop(); } catch (_) {}
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceFeedback('Listening... Speak now');
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setSalonSearch(transcript);
        setVoiceFeedback(`Heard: "${transcript}"`);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setVoiceFeedback('Microphone access denied. Please allow mic permissions.');
        } else {
          setVoiceFeedback('Voice search stopped.');
        }
        setTimeout(() => setVoiceFeedback(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
        setTimeout(() => setVoiceFeedback(null), 4000);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setIsListening(false);
      setVoiceFeedback('Unable to start speech recognition. Please type your search.');
      setTimeout(() => setVoiceFeedback(null), 4000);
    }
  }, [isListening]);

  useEffect(() => {
    fetch(`${(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'')}/api/main-categories`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.categories) && data.categories.length) {
          setMainCategories(data.categories);
        }
      })
      .catch(() => {});
  }, []);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isMoreCategoriesOpen, setIsMoreCategoriesOpen] = useState(false);
  // Per-gym Member Hub overlay (Profile → Gym Activity → this gym) and its
  // nested Workout Plan editor — both lifted here, alongside the other
  // overlay booleans, so Android hardware back can close the deepest one
  // first without a second, disconnected back-handling mechanism.
  const [memberHubTarget, setMemberHubTarget] = useState<{ gymId: string; gymName: string } | null>(null);
  const [memberHubWorkoutPlanOpen, setMemberHubWorkoutPlanOpen] = useState(false);
  // Which tab the Live Ticket was entered from. The centralized back resolver
  // reads this so Bookings -> Ticket -> back returns to My Bookings, while the
  // Home active-queue banner -> Ticket -> back returns to Home. Without it the
  // ticket's back destination is ambiguous.
  const [ticketOrigin, setTicketOrigin] = useState<'home' | 'bookings'>('home');
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all');
  // One inbox for the whole customer surface — the Alerts screen, the bottom
  // nav's unread badge and the settings screen all read this same state.
  const inbox = useNotificationInbox(
    customerAuth?.token,
    currentScreen === 'home' || currentScreen === 'notifications' || currentScreen === 'bookings',
  );

  const [selectedReservationDay, setSelectedReservationDay] = useState<'today' | 'tomorrow' | 'day3' | 'day4'>('today');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const homeScrollRef = useRef<HTMLDivElement>(null);
  const listingsSectionRef = useRef<HTMLDivElement>(null);
  const homeHeaderObserverRef = useRef<ResizeObserver | null>(null);
  // Real rendered height of the Location/Search header — measured rather
  // than hardcoded because safe-area insets and device font/DPI settings
  // change it. Drives both the top spacer's height and the scroll-position
  // thresholds below, so neither ever drifts out of sync with what's
  // actually on screen.
  const [homeHeaderHeight, setHomeHeaderHeight] = useState(0);
  // A callback ref (rather than a plain ref + a `useEffect(..., [])`) because
  // the header's DOM node doesn't exist yet on first mount — the app starts
  // on the landing/location/notifications stages, which return before the
  // header ever renders. An effect keyed on mount would attach to a null
  // node and never retry once Home actually appears; this re-attaches the
  // observer every time the node itself mounts or unmounts.
  const setHomeHeaderNode = useCallback((node: HTMLDivElement | null) => {
    homeHeaderObserverRef.current?.disconnect();
    homeHeaderObserverRef.current = null;
    if (!node) return;
    // `offsetHeight` (border-box, padding included) — not
    // ResizeObserver's `contentRect` (content-box only), which undershoots by
    // the header's own top/bottom padding and left the spacer a bit short of
    // the header's real painted height.
    const measure = () => setHomeHeaderHeight(node.offsetHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    homeHeaderObserverRef.current = observer;
  }, []);
  const [homeHeaderCollapsed, setHomeHeaderCollapsed] = useState(false);
  // True only while the scripted "Location & search" return-to-top glide is
  // running — drives the very subtle depth/parallax dip on Home's content.
  const [isReturningToTop, setIsReturningToTop] = useState(false);
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

  // Keeps listing operational fields (queue/wait/occupancy) live while Home
  // is on screen — reuses the already-stored area/coordinates (never GPS,
  // never a permission prompt) against the same server-authoritative
  // /api/salons/nearby endpoint the initial load already used. Only the
  // live fields are merged in by id, so the array's order/membership and
  // the customer's selected/last-viewed state are untouched. There is no
  // multi-business realtime/SSE stream to reuse here (the existing SSE
  // path is scoped to one salon's own queue), so short polling is the
  // documented fallback.
  useEffect(() => {
    if (currentScreen !== 'home') return;
    if (!storedLocation?.setupCompleted) return;

    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (inFlight || cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      inFlight = true;
      try {
        const fresh = storedLocation.mode === 'manual' && storedLocation.area
          ? (await salonDiscoveryService.byArea(storedLocation.area)).salons
          : storedLocation.latitude !== undefined && storedLocation.longitude !== undefined
            ? (await salonDiscoveryService.byCoordinates(storedLocation.latitude, storedLocation.longitude)).salons
            : null;
        if (!cancelled && fresh) {
          setNearbySalons((current) => mergeLiveOperationalFields(current, fresh));
        }
      } catch {
        // Keep showing the last known live values; the next tick retries.
      } finally {
        inFlight = false;
      }
    };

    const intervalId = setInterval(poll, 2500);
    const onVisibilityChange = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentScreen, storedLocation]);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (userEntry?.status !== 'Called') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [userEntry?.status]);

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
        : formatDurationRangeLabel(Math.max(5, estimatedMinutes - 5), estimatedMinutes + 5);

  const joinedAtTimeLabel = userEntry?.createdAt
    ? new Date(userEntry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : undefined;

  const calledAtTimeLabel = userEntry?.calledAt
    ? new Date(userEntry.calledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : undefined;

  const callTimerRemainingLabel = userEntry?.status === 'Called'
    ? formatCountdown(remainingMs(userEntry, now))
    : undefined;

  const callExpired = userEntry?.status === 'Called' && remainingMs(userEntry, now) <= 0;

  const journeyStage: JourneyStage = !userEntry
    ? 'joined'
    : userEntry.status === 'Serving' || userEntry.status === 'Called'
      ? 'your-turn'
      : (peopleAhead <= 1 || estimatedMinutes <= 10)
        ? 'upcoming'
        : 'in-queue';

  const ticketPosition = !userEntry || userEntry.status === 'Called' || userEntry.status === 'Serving' ? 0 : peopleAhead + 1;

  const ticketPeopleAround: TicketPerson[] = (() => {
    if (!userEntry) return [];
    const ordered = queue
      .filter((item) => ['Waiting', 'Called', 'Serving'].includes(item.status))
      .sort((a, b) => a.createdAt - b.createdAt);
    const myIndex = ordered.findIndex((item) => item.id === userEntry.id);
    if (myIndex < 0) return [];
    return ordered.slice(Math.max(0, myIndex - 2), myIndex + 3).map((item, idx, arr) => {
      const positionNum = queue
        .filter((q) => ['Waiting', 'Called', 'Serving'].includes(q.status))
        .sort((a, b) => a.createdAt - b.createdAt)
        .findIndex((q) => q.id === item.id) + 1;
      const isMe = item.id === userEntry.id;
      const absoluteIdx = queue.filter((q) => ['Waiting', 'Called', 'Serving'].includes(q.status)).sort((a, b) => a.createdAt - b.createdAt).findIndex((q) => q.id === item.id);
      const relLabel = isMe
        ? 'Current token'
        : absoluteIdx < myIndex
          ? 'Ahead of you'
          : 'Behind you';

      return {
        id: item.id,
        label: isMe ? 'YOU' : (item.name || 'Customer').trim().slice(0, 1).toUpperCase(),
        positionNumber: positionNum,
        relLabel,
        photoUrl: item.customerPhotoUrl,
        isMe,
      };
    });
  })();

  // Services chosen so far, falling back to the legacy single-select name —
  // mirrors the same fallback used when actually confirming the reservation.
  const reserveWindowServices = (() => {
    const chosen = selectedSalon.services.filter((item) => selectedServiceIds.includes(item.id));
    if (chosen.length) return chosen;
    const fallback = selectedSalon.services.find((item) => item.name === selectedService);
    return fallback ? [fallback] : [selectedSalon.services[0]].filter(Boolean);
  })();

  const normalizedSearch = salonSearch.trim().toLocaleLowerCase();
  const visibleSalons = nearbySalons?.filter((salon) => {
    if (salon.platformStatus === 'deactivated' || salon.platformStatus === 'inactive') return false;
    if (!normalizedSearch) return true;
    return [
      salon.name,
      salon.address,
      ...salon.services.flatMap((service) => [service.name, service.description || '']),
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
  }) || [];

  const categoryFilteredSalons = visibleSalons.filter((salon) => {
    const catId = (salon.mainCategoryId || 'salon').toLowerCase();
    return catId === activeCategoryId.toLowerCase();
  });
  const homeBrowsableCategories = [
    ...mainCategories,
    ...APPROVED_EMPTY_HOME_CATEGORIES.filter((placeholder) => !mainCategories.some((category) => category.id.toLowerCase() === placeholder.id)),
  ];
  const activeCategoryObj = homeBrowsableCategories.find((c) => c.id === activeCategoryId) || DEFAULT_MAIN_CATEGORIES[0];

  // Live per-category counts derived from the same nearby-salons data already
  // loaded for the list — no invented backend field, just a client-side tally.
  const categoriesWithLiveCounts = homeBrowsableCategories.map((cat) => ({
    ...cat,
    businessCount: visibleSalons.filter((salon) => (salon.mainCategoryId || 'salon').toLowerCase() === cat.id.toLowerCase()).length,
  }));
  const homeCategoryPreference = ['salon', 'gym', 'shop', 'clinic', 'spa'];
  const homeCategoryOrder = [
    ...homeCategoryPreference.map((id) => categoriesWithLiveCounts.find((category) => category.id.toLowerCase() === id)).filter(Boolean),
    ...categoriesWithLiveCounts.filter((category) => !homeCategoryPreference.includes(category.id.toLowerCase())),
  ] as CategoryItemConfig[];
  const homeGridCategories = homeCategoryOrder.slice(0, 5);
  const moreCategories = mainCategories
    .map((category) => categoriesWithLiveCounts.find((counted) => counted.id === category.id) || category)
    .filter((category) => !homeGridCategories.some((visible) => visible.id === category.id));
  const featuredBusiness = categoryFilteredSalons[0] || null;
  const featuredOperationalLabel = (() => {
    if (!featuredBusiness) return null;
    const categoryId = (featuredBusiness.mainCategoryId || 'salon').toLowerCase();
    if (categoryId === 'gym') {
      return featuredBusiness.maxCapacity && featuredBusiness.maxCapacity > 0
        ? `${featuredBusiness.currentOccupancy ?? 0} / ${featuredBusiness.maxCapacity} inside`
        : null;
    }
    if (categoryId === 'salon') {
      return featuredBusiness.waitingCustomers === 0
        ? 'Ready now'
        : `${featuredBusiness.waitingCustomers} ahead · ~${featuredBusiness.liveWaitMinutes} min`;
    }
    return `${featuredBusiness.isOpen ? 'Open now' : 'Closed'}${featuredBusiness.openingHours ? ` · ${featuredBusiness.openingHours}` : ''}`;
  })();
  const homeSectionHeading: Record<string, string> = {
    salon: 'Salons with low wait',
    gym: 'Live gym floors near you',
    shop: 'Open shops near you',
    clinic: 'Clinics near you',
    spa: 'Spas near you',
    moto: 'Auto care near you',
    pets: 'Pet care near you',
    mall: 'Malls near you',
    food: 'Places to eat near you',
  };

  // The browse theme follows the customer's chosen category everywhere they
  // explore (Home, Profile, scanner) and never resets to Salon just because
  // they left Home. A business detail page is themed by the business's own
  // category instead — its identity is authoritative there, per-listing.
  const browseTheme = resolveCategoryTheme(activeCategoryObj.themeKey || activeCategoryId);
  const businessScreens: CustomerScreen[] = ['salon', 'slots', 'tracking', 'complete'];
  const detailTheme = businessScreens.includes(currentScreen)
    ? resolveCategoryTheme(selectedSalon.mainCategoryId)
    : browseTheme;

  // Single write site for the whole app's category identity: plain CSS/Tailwind
  // arbitrary-value classes anywhere (including portaled modals like the QR
  // scanner) can read `var(--category-*)` without any prop drilling.
  useEffect(() => {
    const root = document.documentElement;
    const vars = categoryCssVars(detailTheme);
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [detailTheme]);

  // Header is visible whenever Home is freshly entered (or search/voice is
  // active) and otherwise purely follows scroll position — there is no idle
  // timer collapsing it while someone is simply reading. An unrequested
  // disappearance is exactly the "attention-seeking pop" this was tuned away
  // from; the only way it hides now is the customer's own scroll gesture.
  useEffect(() => {
    if (
      currentScreen !== 'home' || salonSearch || isListening ||
      !locationHydrated || !storedLocation?.setupCompleted
    ) return;
    setHomeHeaderCollapsed(false);
  }, [currentScreen, isListening, locationHydrated, salonSearch, storedLocation?.setupCompleted]);

  // Reveal/hide thresholds are derived from the header's own measured
  // height rather than a hardcoded guess, so they never drift out of sync
  // with the safe-area-dependent spacer below. Reveal fires a bit *before*
  // the spacer's region would actually enter the viewport (headerHeight +
  // buffer, not headerHeight itself) so the header is already painted over
  // that region by the time it would otherwise show through as blank —
  // this is what actually fixes the "empty gap while scrolling up" bug.
  // Hide only fires well past that, giving a wide hysteresis band so
  // casual back-and-forth scrolling near the top never flickers.
  const headerRevealThreshold = homeHeaderHeight + 24;
  const headerHideThreshold = homeHeaderHeight + 110;

  // Debounced against the scroll position rather than reacting to every
  // frame: a wide hysteresis band between collapse and reveal thresholds
  // means casual back-and-forth scrolling near the top never flips the
  // header state on every tick, which was the source of the reported jitter.
  // This only ever toggles a transform/opacity flag on an overlay that
  // never reserves document height (see the header markup below) — flipping
  // this state never reflows the deck/listings under it, and — unlike a
  // fixed scrollTop<=4 check — the threshold tracks the real header height,
  // so the header is never still-hidden while its own reserved region has
  // already scrolled into view.
  const handleHomeScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (currentScreen !== 'home') return;
    const scrollTop = event.currentTarget.scrollTop;
    if (scrollTop > headerHideThreshold) setHomeHeaderCollapsed(true);
    else if (scrollTop <= headerRevealThreshold) setHomeHeaderCollapsed(false);
  }, [currentScreen, headerHideThreshold, headerRevealThreshold]);

  // Purely a scroll-to-top glide — it never forces the header open itself.
  // The Location/Search header reveals on its own, driven by
  // handleHomeScroll's scrollTop<=4 check as this glide passes near the top,
  // exactly as if the customer had scrolled there by hand.
  const revealHomeHeader = useCallback(() => {
    const container = homeScrollRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) setIsReturningToTop(true);
    const handle = smoothScrollTo(container, 0);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      handle.cancel();
      setIsReturningToTop(false);
      container.removeEventListener('wheel', onUserInterrupt);
      container.removeEventListener('touchstart', onUserInterrupt);
      container.removeEventListener('pointerdown', onUserInterrupt);
    };
    // A real touch/wheel/pointer gesture always wins over the scripted glide —
    // it hands control back to the user immediately, mid-flight.
    function onUserInterrupt() { finish(); }
    container.addEventListener('wheel', onUserInterrupt, { passive: true, once: true });
    container.addEventListener('touchstart', onUserInterrupt, { passive: true, once: true });
    container.addEventListener('pointerdown', onUserInterrupt, { passive: true, once: true });
    window.setTimeout(finish, 800);
  }, []);

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
  // Every dismissable overlay, declared once. The resolver below decides the
  // order; nothing here decides it locally any more.
  const overlays: CustomerOverlayState = {
    qrScanner: isQrScannerOpen,
    moreCategories: isMoreCategoriesOpen,
    locationSheet: isChangingLocation,
    cancelSheet: cancelSheetOpen,
    callModal: isCallModalOpen,
    loginGate: showLoginGate,
    memberHubWorkoutPlan: memberHubWorkoutPlanOpen,
    memberHub: Boolean(memberHubTarget),
  };

  const closeOverlay = useCallback((overlay: keyof CustomerOverlayState) => {
    if (overlay === 'qrScanner') setIsQrScannerOpen(false);
    else if (overlay === 'moreCategories') setIsMoreCategoriesOpen(false);
    else if (overlay === 'locationSheet') setIsChangingLocation(false);
    else if (overlay === 'cancelSheet') setCancelSheetOpen(false);
    else if (overlay === 'callModal') setIsCallModalOpen(false);
    else if (overlay === 'loginGate') setShowLoginGate(false);
    else if (overlay === 'memberHubWorkoutPlan') setMemberHubWorkoutPlanOpen(false);
    else if (overlay === 'memberHub') setMemberHubTarget(null);
  }, []);

  /**
   * Android hardware back. The ordering rule (deepest sheet -> child screen ->
   * parent -> Home -> exit) now lives entirely in the shared resolver, so the
   * hardware button, every visible Back control and the regression tests all
   * read the same single decision. Only the true landing root reports
   * "unhandled", which is the sole case allowed to exit the app.
   */
  const handleHardwareBack = useCallback((): boolean => {
    const action = resolveBackAction({
      stage,
      landingOverride: showLandingOverride,
      screen: currentScreen,
      overlays,
      ticketOrigin,
    });
    switch (action.type) {
      case 'close-overlay': closeOverlay(action.overlay); return true;
      case 'go-screen': setScreen(action.screen); return true;
      case 'go-landing': backToLanding(); return true;
      case 'consume': return true;
      case 'exit-app':
      default: return false;
    }
  }, [
    stage, showLandingOverride, currentScreen, ticketOrigin,
    overlays.qrScanner, overlays.moreCategories, overlays.locationSheet, overlays.cancelSheet, overlays.callModal,
    overlays.loginGate, overlays.memberHubWorkoutPlan, overlays.memberHub,
    closeOverlay, backToLanding, setScreen,
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
          <div className="fixed inset-0 z-[100] bg-[var(--noq-base)]">
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
      <div className="grid min-h-full place-items-center bg-[var(--noq-base)]">
        <LoaderCircle className="h-6 w-6 animate-spin text-[var(--noq-accent)]" />
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
      <>
      <ScreenScroll>
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
        onOpenGymActivity={() => setScreen('gym-activity')}
        // Exactly the same destination the bottom-nav Bookings tab opens.
        onOpenBookings={() => setScreen('bookings')}
        onOpenNotificationSettings={() => setScreen('notification-settings')}
      />
      </ScreenScroll>
      {currentScreen === 'profile' && (
        <StickyScanQrButton
          activeTab="more"
          onScan={openScanner}
          onHome={() => setScreen('home')}
          onBookings={() => setScreen('bookings')}
          onNotifications={() => setScreen('notifications')}
          onMore={() => setScreen('profile')}
          unreadCount={inbox.unreadCount}
        />
      )}
      <QrScannerModal open={isQrScannerOpen} onClose={() => setIsQrScannerOpen(false)} onResolved={openQrBusiness} />
      </>
    );
  }

  if (currentScreen === 'gym-activity') {
    return (
      <>
      <ScreenScroll>
      <GymActivityScreen
        onBack={() => setScreen('profile')}
        onOpenMemberHub={(gymId, gymName) => setMemberHubTarget({ gymId, gymName })}
        // Gym Activity's "Upgrade" opens the gym's own page, where the real
        // access/upgrade sheet lives — Profile never duplicates that flow.
        onOpenGym={(gymId) => {
          const gym = nearbySalons.find((salon) => salon.id === gymId);
          if (!gym) return;
          setSelectedSalon(gym);
          onQrContextChange(null);
          setScreen('salon');
        }}
      />
      </ScreenScroll>
      {memberHubTarget && (
        <GymMemberHub
          gymId={memberHubTarget.gymId}
          gymName={memberHubTarget.gymName}
          onClose={() => setMemberHubTarget(null)}
          workoutPlanOpen={memberHubWorkoutPlanOpen}
          onOpenWorkoutPlan={() => setMemberHubWorkoutPlanOpen(true)}
          onCloseWorkoutPlan={() => setMemberHubWorkoutPlanOpen(false)}
        />
      )}
      </>
    );
  }

  // A booking/notification that names a business opens that business's real
  // detail page. Resolved against the already-loaded nearby list first, then
  // fetched by id, so a deep link never dead-ends on Home.
  const openBusinessById = async (businessId: string) => {
    const known = nearbySalons.find((salon) => salon.id === businessId);
    if (known) {
      setSelectedSalon(known);
      onQrContextChange(null);
      setScreen('salon');
      return;
    }
    const profile = await fetchSalonProfile(businessId);
    if (!profile) { setScreen('bookings'); return; }
    setSelectedSalon(profile);
    setNearbySalons((current) => (current.some((salon) => salon.id === profile.id) ? current : [profile as NearbySalon, ...current]));
    onQrContextChange(null);
    setScreen('salon');
  };

  /** One booking-tap handler shared by both My Bookings entry points. */
  const openBookingRoute = (route: BookingRoute, _booking: CustomerBookingView) => {
    if (route.screen === 'tracking') { setTicketOrigin('bookings'); setScreen('tracking'); return; }
    void openBusinessById(route.businessId);
  };

  /**
   * Notification deep links. Marks the row read, then routes to the
   * notification's own destination — never a blanket redirect to Home.
   */
  const openNotification = (notification: CustomerNotification, route: NotificationRoute) => {
    void inbox.markRead(notification);
    switch (route.screen) {
      case 'tracking': setTicketOrigin('bookings'); setScreen('tracking'); break;
      case 'bookings': setScreen('bookings'); break;
      case 'gym-activity': setScreen('gym-activity'); break;
      case 'member-hub': {
        const gym = nearbySalons.find((salon) => salon.id === route.businessId);
        setMemberHubTarget({ gymId: route.businessId, gymName: gym?.name || 'Your gym' });
        setScreen('gym-activity');
        break;
      }
      case 'salon':
      case 'review':
        // The review flow lives on the business's own detail page (its
        // Reviews section owns submission), so a review request deep-links
        // straight there rather than to a duplicated rating screen.
        void openBusinessById(route.businessId);
        break;
      case 'home': setScreen('home'); break;
      case 'notifications':
      default: setScreen('notifications'); break;
    }
  };

  if (currentScreen === 'bookings') {
    return (
      <>
        <MyBookingsScreen
          auth={customerAuth}
          onBack={() => setScreen('home')}
          onLogin={onProfileLogin}
          onExplore={() => setScreen('home')}
          onOpenBooking={openBookingRoute}
          liveBookingHint={userEntry ? {
            id: `live-${userEntry.id}`,
            queueEntryId: userEntry.id,
            businessId: selectedSalon.id,
            businessName: selectedSalon.name,
            categoryId: (selectedSalon.mainCategoryId || 'salon').toLowerCase(),
            service: userEntry.service,
            services: userEntry.services || [],
            status: userEntry.status,
            reservedFor: userEntry.reservedFor || null,
            token: userEntry.token || null,
            createdAt: userEntry.createdAt,
            updatedAt: userEntry.createdAt,
            kind: 'queue',
          } : null}
        />
        <StickyScanQrButton
          activeTab="bookings"
          onScan={openScanner}
          onHome={() => setScreen('home')}
          onBookings={() => setScreen('bookings')}
          onNotifications={() => setScreen('notifications')}
          onMore={() => setScreen('profile')}
          unreadCount={inbox.unreadCount}
        />
        <QrScannerModal open={isQrScannerOpen} onClose={() => setIsQrScannerOpen(false)} onResolved={openQrBusiness} />
      </>
    );
  }

  if (currentScreen === 'notifications') {
    return (
      <>
        <NotificationsScreen
          auth={customerAuth}
          notifications={inbox.notifications}
          unreadCount={inbox.unreadCount}
          loading={inbox.loading}
          error={inbox.error}
          pushTransport={inbox.pushTransport}
          filter={notificationFilter}
          onFilterChange={setNotificationFilter}
          onBack={() => setScreen('home')}
          onLogin={onProfileLogin}
          onOpenSettings={() => setScreen('notification-settings')}
          onMarkAllRead={() => void inbox.markAllRead()}
          onOpen={openNotification}
        />
        <StickyScanQrButton
          activeTab="notifications"
          onScan={openScanner}
          onHome={() => setScreen('home')}
          onBookings={() => setScreen('bookings')}
          onNotifications={() => setScreen('notifications')}
          onMore={() => setScreen('profile')}
          unreadCount={inbox.unreadCount}
        />
        <QrScannerModal open={isQrScannerOpen} onClose={() => setIsQrScannerOpen(false)} onResolved={openQrBusiness} />
      </>
    );
  }

  if (currentScreen === 'notification-settings') {
    return (
      <NotificationSettingsScreen
        preferences={inbox.preferences}
        pushTransport={inbox.pushTransport}
        saving={inbox.savingPreferences}
        error={inbox.error}
        onBack={() => setScreen('notifications')}
        onSave={(preferences) => void inbox.savePreferences(preferences)}
      />
    );
  }

  if (currentScreen === 'location-select') {
    return (
      <ScreenScroll>
      <LocationSelectScreen
        onBack={() => setScreen('home')}
        currentLabel={selectedAddressLabel}
        currentAddress={locationLabel}
        onSelectAddress={(addr) => {
          if (addr.label) setSelectedAddressLabel(addr.label);
          if (addr.fullAddress || addr.area) setLocationLabel(addr.fullAddress || `${addr.area}, ${addr.city}`);
        }}
        userToken={customerAuth?.token}
        onUseGps={() => setIsChangingLocation(true)}
        onNavigateAddAddress={() => { setEditingAddress(null); setScreen('add-address'); }}
        onNavigateRequestAddress={() => setScreen('request-address')}
        onEditAddress={(addr) => { setEditingAddress(addr); setScreen('add-address'); }}
      />
      </ScreenScroll>
    );
  }

  if (currentScreen === 'add-address') {
    return (
      <ScreenScroll>
      <AddAddressScreen
        onBack={() => setScreen('location-select')}
        userToken={customerAuth?.token}
        editingAddress={editingAddress}
        onAddressSaved={(addr) => {
          if (addr.label) setSelectedAddressLabel(addr.label);
          if (addr.fullAddress || addr.area) setLocationLabel(addr.fullAddress || `${addr.area}, ${addr.city}`);
        }}
      />
      </ScreenScroll>
    );
  }

  if (currentScreen === 'request-address') {
    return (
      <ScreenScroll>
      <RequestAddressScreen
        onBack={() => setScreen('location-select')}
        userToken={customerAuth?.token}
        onRequestSubmitted={(areaName) => {
          setVoiceFeedback(`Requested area coverage for "${areaName}"`);
          setTimeout(() => setVoiceFeedback(null), 4000);
        }}
      />
      </ScreenScroll>
    );
  }

  return (
    <div
      ref={homeScrollRef}
      onScroll={handleHomeScroll}
      className="noq-customer-page flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain text-[var(--noq-ink)] [-webkit-overflow-scrolling:touch] [touch-action:pan-y]"
    >
      {/* 1. HOME SCREEN - NEARBY SALONS */}
      {currentScreen === 'home' && (
        <div id="customer-home-screen" className="customer-liquid-home relative min-h-full overflow-x-clip bg-[var(--noq-base)] animate-in fade-in">
          {/* Futuristic ambient glow backdrop */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -top-28 left-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-[var(--noq-accent)] opacity-[28%] blur-[82px]"
            />
            <div
              className="absolute top-72 -right-24 h-72 w-72 rounded-full bg-[var(--noq-accent)] opacity-[8%] blur-[90px]"
            />
          </div>

          {/* Header — overlay architecture. The sticky shell has `h-0`, so it
              reserves ZERO document height at any scroll position; the actual
              header is `position: absolute` inside it and purely paints over
              whatever is currently scrolled beneath. This is what fixes both
              bugs at once: no reflow when it hides/reveals (nothing beneath it
              ever moves), and no "reserved but invisible" blank gap while
              scrolling up through the middle of Home (there's no reservation
              to be blank — see the explicit spacer below instead). */}
          <div className="sticky top-0 z-[140] h-0 overflow-visible">
            <div
              id="customer-home-header"
              ref={setHomeHeaderNode}
              className={`customer-home-header absolute inset-x-0 top-0 overflow-hidden px-4 pb-3 pt-[max(.8rem,env(safe-area-inset-top))] backdrop-blur-xl transition-[opacity,transform] duration-300 ease-[cubic-bezier(.32,.72,.33,1)] will-change-transform sm:px-5 ${
                homeHeaderCollapsed
                  ? 'pointer-events-none -translate-y-full opacity-0'
                  : 'translate-y-0 opacity-100'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div aria-label="NOQ" className="flex items-center gap-1 text-[23px] font-black tracking-[0.18em] text-[var(--noq-ink)]">
                  NOQ<span className="h-1.5 w-1.5 rounded-full bg-[var(--noq-accent)] shadow-[0_0_12px_var(--noq-accent)]" />
                </div>
                <button type="button" onClick={() => setScreen('location-select')} aria-label={`Choose location${locationLabel ? `, current location ${locationLabel}` : ''}`} className="customer-location-button ml-auto grid h-10 w-10 place-items-center rounded-[14px] border text-[var(--noq-accent-light)] transition active:translate-y-0.5 active:scale-95">
                  <MapPin className="h-[18px] w-[18px]" />
                </button>
              </div>

              {/* Large Search Box with rotating placeholder & inner mic button */}
              <div className="mt-3">
                <SalonSearchBar
                  value={salonSearch}
                  onChange={setSalonSearch}
                  categories={categoriesWithLiveCounts}
                  activeCategoryName={activeCategoryObj.name}
                  isListening={isListening}
                  onVoiceSearch={handleVoiceSearch}
                  voiceFeedback={voiceFeedback}
                />
              </div>
            </div>
          </div>

          {/* Ordinary static spacer — the ONLY thing that reserves the
              header's vertical space, so the deck begins naturally below
              Location/Search at rest. It is a plain block (not sticky, not
              transform-hidden) and scrolls away with the rest of the
              document exactly like any other content. */}
          <div style={{ height: homeHeaderHeight }} aria-hidden="true" />

          {/* Minimal return-to-top shortcut only — no text, no capsule, and it
              never opens the header itself. It is always mounted (so the
              appearance is a soft fade+slide, never a pop), hidden near the
              top, and appears once the customer has scrolled meaningfully
              down. The Location/Search header reveals on its own once the
              scroll-to-top glide this triggers actually reaches the top. */}
          <div className="pointer-events-none sticky top-3 z-[130] flex justify-end pr-1">
            <button
              type="button"
              onClick={revealHomeHeader}
              tabIndex={homeHeaderCollapsed ? 0 : -1}
              aria-hidden={!homeHeaderCollapsed}
              className={`flex h-8 w-8 items-center justify-center rounded-full border bg-white/80 backdrop-blur-xl transition-[opacity,transform] duration-300 ease-[cubic-bezier(.32,.72,.33,1)] active:scale-90 ${
                homeHeaderCollapsed
                  ? 'pointer-events-auto translate-y-0 opacity-100'
                  : 'pointer-events-none -translate-y-2 opacity-0'
              }`}
              style={{ borderColor: 'var(--category-tint-20, rgba(148,163,184,0.25))' }}
              aria-label="Return to top"
            >
              <ArrowUp className="h-3.5 w-3.5 text-[var(--category-accent)]" />
            </button>
          </div>

          {/* A near-imperceptible depth cue during the scripted return-to-top
              glide (Task 1: "premium and controlled, not flashy") — barely a
              1% scale dip, no brightness/opacity change to draw the eye. */}
          <div
            className={`relative space-y-3.5 px-4 pb-[calc(env(safe-area-inset-bottom)_+_5.5rem)] pt-2.5 sm:px-5 transition-transform ease-[cubic-bezier(.22,1,.36,1)] ${
              isReturningToTop ? 'duration-500 scale-[0.994]' : 'duration-300 scale-100'
            }`}
          >

          <CustomerCategoryGrid
            categories={categoriesWithLiveCounts}
            selectedCategoryId={activeCategoryId}
            onSelect={setActiveCategoryId}
            onMore={() => setIsMoreCategoriesOpen(true)}
          />

          {/* Premium hero / featured card — adapts to the selected category */}
          <div id="category-exploration-anchor" key={`banner-${activeCategoryId}`} className="scroll-mt-3 category-content-transition">
            <PromotionalBanner
              category={activeCategoryObj}
              featuredBusiness={featuredBusiness}
              operationalLabel={featuredOperationalLabel}
              onCtaClick={() => {
                if (!featuredBusiness) {
                  listingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  return;
                }
                setSelectedSalon(featuredBusiness);
                markLastViewed(activeCategoryId, featuredBusiness.id);
                onQrContextChange(null);
                setScreen('salon');
              }}
            />
          </div>

          {/* Full Address Management Modal */}
          <AddressManagementModal
            isOpen={isAddressModalOpen}
            onClose={() => setIsAddressModalOpen(false)}
            currentLabel={selectedAddressLabel}
            currentAddress={locationLabel}
            onSelectAddress={(addr) => {
              if (addr.label) setSelectedAddressLabel(addr.label);
              if (addr.fullAddress || addr.area) setLocationLabel(addr.fullAddress || `${addr.area}, ${addr.city}`);
            }}
            userToken={customerAuth?.token}
            onUseGps={() => setIsChangingLocation(true)}
          />

          {userEntry && (
            <div
              id="active-queue-banner"
              onClick={() => { setTicketOrigin('home'); setScreen('tracking'); }}
              className="flex cursor-pointer items-center justify-between rounded-2xl border p-4 text-[var(--noq-ink)] backdrop-blur-md transition"
              style={{
                borderColor: 'var(--category-tint-20)',
                backgroundColor: 'var(--category-tint-10)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 font-bold ring-1" style={{ color: 'var(--category-accent)', ['--tw-ring-color' as any]: 'var(--category-tint-20)' }}>
                  {userEntry.status === 'Called' ? '!' : userEntry.status === 'Serving' ? '✂' : '#'}
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--category-soft)' }}>
                    Active Queue Status
                  </div>
                  <div className="text-sm font-bold text-[var(--noq-ink)]">
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
              <ChevronRight className="h-5 w-5" style={{ color: 'var(--category-accent)' }} />
            </div>
          )}

          <div ref={listingsSectionRef} key={`businesses-${activeCategoryId}`} className="category-content-transition">
            <div className="mb-2.5 flex items-center justify-between gap-4 px-0.5">
              <h2 className="truncate text-[15px] font-black tracking-[-0.02em] text-[var(--noq-ink)]">
                {homeSectionHeading[activeCategoryId.toLowerCase()] || `${activeCategoryObj.name} businesses near you`}
              </h2>
              <button type="button" onClick={() => listingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="shrink-0 text-[10px] font-bold text-[var(--noq-accent)]">See all</button>
            </div>

            <div className="space-y-2.5">
              {nearbySalons.length === 0 && isRestoringLocation && (
                <div className="rounded-2xl border border-[var(--noq-glass-border)] bg-white/75 px-5 py-8 text-center">
                  <LoaderCircle className="mx-auto h-6 w-6 animate-spin" style={{ color: 'var(--category-accent)' }} />
                  <p className="mt-3 text-xs leading-5 text-[var(--noq-muted)]">Refreshing businesses near {locationLabel || 'you'}…</p>
                </div>
              )}

              {nearbySalons.length === 0 && !isRestoringLocation && (
                <div className="rounded-2xl border border-[var(--noq-glass-border)] bg-white/75 px-5 py-8 text-center">
                  <MapPin className="mx-auto h-6 w-6 text-[var(--noq-muted)]" />
                  <h3 className="mt-3 text-sm font-bold text-[var(--noq-ink)]">No businesses available in your area yet.</h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--noq-muted)]">Try another city or area as we onboard more partners.</p>
                  <button type="button" onClick={() => setIsChangingLocation(true)} className="mt-4 text-xs font-bold" style={{ color: 'var(--category-accent)' }}>Change location</button>
                </div>
              )}

              {nearbySalons.length > 0 && salonSearch.trim() !== '' && categoryFilteredSalons.length === 0 && (
                <div className="rounded-2xl border border-[var(--noq-glass-border)] bg-white/75 px-5 py-8 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06]" style={{ color: 'var(--category-accent)' }}>
                    <Search className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--noq-ink)]">No matching {activeCategoryObj.name} listings found</h3>
                  <p className="text-xs leading-5 text-[var(--noq-muted)] max-w-xs mx-auto">
                    No results found for &ldquo;{salonSearch}&rdquo; under {activeCategoryObj.name}. Try another term or switch categories.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSalonSearch('')}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--noq-tint-10)] px-4 py-2 text-xs font-bold hover:bg-[var(--noq-tint-20)] transition"
                    style={{ color: 'var(--category-accent)' }}
                  >
                    Clear search
                  </button>
                </div>
              )}

              {nearbySalons.length > 0 && salonSearch.trim() === '' && categoryFilteredSalons.length === 0 && (
                <CategoryLandingState
                  category={activeCategoryObj}
                  onExploreSalons={() => setActiveCategoryId('salon')}
                />
              )}

              {categoryFilteredSalons.map((salon) => {
                const catId = (salon.mainCategoryId || 'salon').toLowerCase();
                const isGym = catId === 'gym';
                // Category-agnostic: any business with a real active
                // membership record lights up the crown, not just Gym.
                const isMember = activeMemberBusinessIds.has(salon.id);
                // MEMBER outranks Last viewed — an active member never also
                // shows the last-viewed badge for that same business.
                const isSelected = !isMember && lastViewedByCategory[activeCategoryId.toLowerCase()] === salon.id;
                const baseTheme = CATEGORY_THEME_MAP[activeCategoryObj.themeKey || activeCategoryId] || CATEGORY_THEME_MAP.salon;
                const homeAccent = customerHomeAccent(activeCategoryObj);
                const theme = { ...baseTheme, primary: homeAccent, accent: homeAccent };

                let liveLine1: string;
                let liveLine2: string;
                let signalColor: ReturnType<typeof resolveSalonQueueSignal>['color'];
                let signalLabel: string;
                let positionLabel: string | null = null;
                let liveFloorMeter: { occupancy: number; maxCapacity: number; color: SignalColor } | undefined;

                if (isGym) {
                  const currentOccupancy = salon.currentOccupancy ?? 0;
                  const maxCapacity = salon.maxCapacity ?? 0;
                  const crowd = resolveGymCrowdLevel(currentOccupancy, maxCapacity);
                  const signal = gymListingSignal(crowd.level);
                  liveLine1 = '';
                  liveLine2 = '';
                  liveFloorMeter = { occupancy: currentOccupancy, maxCapacity, color: signal.color };
                  signalColor = signal.color === 'green' ? 'green' : signal.color === 'yellow' ? 'yellow' : 'red';
                  signalLabel = signal.label.toUpperCase();
                } else if (catId === 'salon') {
                  const waitingCustomers = salon.waitingCustomers;
                  const isNoWait = waitingCustomers === 0;
                  // Compact form — no "Live queue:"/"Est. wait:" prefixes,
                  // which read as verbose duplication once the signal chip
                  // already names the status.
                  liveLine1 = isNoWait ? 'No wait' : `${waitingCustomers} ahead`;
                  liveLine2 = isNoWait ? 'Ready now' : `~${salon.liveWaitMinutes} min wait`;
                  const signal = resolveSalonQueueSignal(waitingCustomers);
                  signalColor = signal.color === 'green' ? 'green' : signal.color === 'yellow' ? 'yellow' : 'red';
                  signalLabel = signal.label.toUpperCase();
                  positionLabel = salonListingPositionLabel(waitingCustomers, salon.readyChairs ?? 0);
                } else {
                  liveLine1 = salon.isOpen ? 'Open now' : 'Closed';
                  liveLine2 = salon.openingHours || 'Hours unavailable';
                  signalColor = catId === 'shop' ? 'yellow' : salon.isOpen ? 'green' : 'red';
                  signalLabel = catId === 'shop' ? 'FAST PICKUP' : salon.isOpen ? 'Open' : 'Closed';
                }

                return (
                  <div key={salon.id} id={`salon-item-${salon.id}`}>
                    <PremiumBusinessCard
                      salon={salon}
                      theme={theme}
                      icon={getCategoryIcon(activeCategoryObj.iconName)}
                      isSelected={isSelected}
                      isMember={isMember}
                      localityLabel={deriveLocalityLabel(salon)}
                      liveFloorMeter={liveFloorMeter}
                      liveLine1={liveLine1}
                      liveLine2={liveLine2}
                      signalColor={signalColor}
                      signalLabel={signalLabel}
                      positionLabel={positionLabel}
                      onClick={() => {
                        setSelectedSalon(salon);
                        markLastViewed(activeCategoryId, salon.id);
                        onQrContextChange(null);
                        setScreen('salon');
                      }}
                    />
                  </div>
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
        {selectedSalon.platformStatus === 'deactivated' ? (
          <div id="business-deactivated-customer-view" className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-[var(--noq-ink)]">Business Currently Unavailable</h2>
            <p className="mt-2 max-w-sm text-sm text-[var(--noq-muted)]">
              {selectedSalon.name} is temporarily unavailable or deactivated on No-Wait Salon.
            </p>
            <button
              onClick={() => setScreen('home')}
              className="mt-6 rounded-xl bg-[var(--noq-accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--noq-accent-hover)]"
            >
              Back to Home
            </button>
          </div>
        ) : (
          <DetailErrorBoundary
            businessName={selectedSalon.name}
            onBackToHome={() => setScreen('home')}
          >
            {isGymCategory(selectedSalon.mainCategoryId) ? (
              <GymDetailPage
                salon={selectedSalon}
                nearbySalons={nearbySalons}
                onBack={() => setScreen('home')}
                customerAuth={customerAuth}
                customerProfile={customerProfile}
                profileLoading={profileLoading}
                onIdentityVerified={onIdentityVerified}
                onProfileSaved={onProfileSaved}
              />
            ) : (
              <SalonDetailPage
                salon={selectedSalon}
                nearbySalons={nearbySalons}
                queue={queue}
                barbers={barbers}
                selectedService={selectedService}
                setSelectedService={setSelectedService}
                selectedServiceIds={selectedServiceIds}
                setSelectedServiceIds={setSelectedServiceIds}
                appliedOfferId={appliedOfferId}
                onApplyOffer={onApplyOffer}
                onRemoveOffer={onRemoveOffer}
                onBack={() => setScreen('home')}
                onJoin={userEntry ? () => { setTicketOrigin('home'); setScreen('tracking'); } : onJoinClick}
                onReserve={() => setScreen('slots')}
                userEntry={userEntry}
                isJoinSheetOpen={isJoinSheetOpen}
                customerAuth={customerAuth}
                customerProfile={customerProfile}
                profileLoading={profileLoading}
                onIdentityVerified={onIdentityVerified}
                onProfileSaved={onProfileSaved}
              />
            )}
          </DetailErrorBoundary>
        )}
        </div>
      )}

      {currentScreen === 'home' && !isQrScannerOpen && (
        <StickyScanQrButton
          activeTab="home"
          onScan={openScanner}
          onHome={revealHomeHeader}
          // Bookings opens the dedicated My Bookings screen — NOT the Live
          // Ticket. The ticket is reachable from the active booking inside it.
          onBookings={() => setScreen('bookings')}
          onNotifications={() => setScreen('notifications')}
          onMore={() => setScreen('profile')}
          unreadCount={inbox.unreadCount}
        />
      )}

      {currentScreen === 'home' && isMoreCategoriesOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) setIsMoreCategoriesOpen(false); }}>
          <section className="customer-more-sheet relative w-full max-w-md rounded-t-[30px] border border-[var(--noq-glass-border)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-[var(--noq-ink)] shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--noq-accent-light)]">All categories</p><h2 className="mt-1 text-xl font-black">Explore more nearby</h2></div>
              <button type="button" onClick={() => setIsMoreCategoriesOpen(false)} aria-label="Close categories" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-[var(--noq-muted)] active:scale-95"><X className="h-4 w-4" /></button>
            </div>
            {moreCategories.length ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                {moreCategories.map((category) => {
                  const Icon = getCategoryIcon(category.iconName);
                  const accent = customerHomeAccent(category);
                  return (
                    <button key={category.id} type="button" onClick={() => { setActiveCategoryId(category.id); setIsMoreCategoriesOpen(false); revealHomeHeader(); }} className="customer-more-category flex min-h-16 items-center gap-3 rounded-2xl border border-[var(--noq-glass-border)] bg-white/70 px-4 text-left transition active:translate-y-0.5 active:scale-[0.98]">
                      <Icon className="h-5 w-5 shrink-0" style={{ color: accent }} />
                      <span className="min-w-0"><b className="block truncate text-sm">{category.name}</b><span className="block text-[10px] font-semibold text-[var(--noq-muted)]">{category.businessCount ?? 0} nearby</span></span>
                    </button>
                  );
                })}
              </div>
            ) : <p className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 text-sm text-[var(--noq-muted)]">All currently supported categories are already visible on Home.</p>}
          </section>
        </div>
      )}

      <QrScannerModal open={isQrScannerOpen} onClose={() => setIsQrScannerOpen(false)} onResolved={openQrBusiness} />

      <LocationSelectorSheet
        open={isChangingLocation}
        currentLabel={locationLabel}
        onClose={() => setIsChangingLocation(false)}
        onSelected={applyLocation}
      />

      {/* 3. FUTURE TIME SLOTS SCREEN - EXACT RECOVERED APK45 EXPERIENCE */}
      {currentScreen === 'slots' && (
        <ReserveFutureWindowScreen
          salon={selectedSalon}
          services={reserveWindowServices}
          onBack={() => setScreen('salon')}
          onSelectSlot={onSelectSlotClick}
        />
      )}

      {/* 4. LIVE TRACKING SCREEN */}
      {currentScreen === 'tracking' && (
        <div id="customer-tracking-screen" className="p-5 space-y-4 animate-in fade-in duration-150">
          <button
            id="back-to-home-btn"
            onClick={() => setScreen(ticketOrigin === 'bookings' ? 'bookings' : 'home')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--noq-muted)] hover:text-[var(--noq-ink)] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{ticketOrigin === 'bookings' ? 'Back to My Bookings' : 'Find another salon'}</span>
          </button>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--noq-muted)]">
              Live Ticket
            </div>
            <h1 className="font-sans text-2xl font-bold text-[var(--noq-ink)] tracking-tight">
              Your live queue
            </h1>
            <p className="text-xs text-[var(--noq-muted)] mt-0.5">
              {selectedSalon.name} · {userEntry?.service || selectedService}
            </p>
          </div>

          {/* Main ticket area. Reserved (future-slot) bookings keep the
              original status card — the token ticket is for an active live
              queue position, which a Reserved entry does not hold yet. */}
          {userEntry?.status === 'Reserved' ? (
            <div className="p-6 rounded-2xl bg-white border border-[var(--noq-border)] space-y-4">
              <div className="flex items-center gap-4">
                <div id="tracking-position-badge" className="w-16 h-16 rounded-2xl flex items-center justify-center font-sans font-bold text-2xl shrink-0 bg-[var(--noq-accent)]/10 text-[var(--noq-accent)]">
                  ✓
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--noq-muted)]">RESERVED WINDOW</span>
                  <b id="tracking-main-status" className="block font-sans text-xl font-bold text-[var(--noq-ink)] mt-0.5">
                    Reserved for {userEntry.reservedFor}
                  </b>
                </div>
              </div>
              <div id="tracking-notice-box" className="p-3.5 rounded-2xl text-xs font-medium leading-relaxed flex items-start gap-2.5 bg-[var(--noq-base)] text-[var(--noq-accent)] border border-[var(--noq-border)]">
                <CheckCircle2 className="w-4 h-4 text-[var(--noq-accent)] shrink-0 mt-0.5" />
                <span>Your slot at <b>{userEntry.reservedFor}</b> is held. We will update you with live notifications.</span>
              </div>
              {userEntry && canCancel(userEntry.status) && (
                <button
                  id="cancel-queue-entry-btn"
                  onClick={() => setCancelSheetOpen(true)}
                  className="w-full py-2 text-rose-700 hover:text-rose-900 font-semibold text-xs underline underline-offset-4 transition cursor-pointer"
                >
                  Cancel your ticket
                </button>
              )}
            </div>
          ) : (
            <LiveTicket
              salonName={selectedSalon.name}
              token={userEntry?.token || '—'}
              position={ticketPosition}
              waitLabel={userEntry?.status === 'Called' ? 'Ready now' : userEntry?.status === 'Serving' ? 'In progress' : waitDisplay}
              stage={journeyStage}
              acknowledgeEnabled={userEntry?.status === 'Called'}
              onAcknowledge={onAcknowledge}
              onCancel={() => setCancelSheetOpen(true)}
              peopleAround={ticketPeopleAround}
              joinedAtTimeLabel={joinedAtTimeLabel}
              calledAtTimeLabel={calledAtTimeLabel}
              callTimerRemainingLabel={callTimerRemainingLabel}
              isCalledState={userEntry?.status === 'Called'}
              isUpcomingState={userEntry?.status === 'Waiting' && (peopleAhead <= 1 || estimatedMinutes <= 10)}
              isServingState={userEntry?.status === 'Serving'}
              isAcknowledged={Boolean(userEntry?.acknowledgedAt)}
              callExpired={callExpired}
              upcomingPeopleAhead={peopleAhead}
              upcomingApproxTimeLabel={waitDisplay}
              totalPriceInr={userEntry?.totalPriceInr || 250}
              discountInr={userEntry?.discountInr || 0}
              servicesList={userEntry?.services || [userEntry?.service || selectedService || 'Haircut']}
              paymentStatus={userEntry?.paymentStatus || 'unpaid'}
              paymentMethod={userEntry?.paymentMethod}
              onPayOnline={() => {
                if (userEntry) {
                  realtimeQueueService.command(selectedSalon.id, {
                    type: 'queue_action',
                    itemId: userEntry.id,
                    action: 'Pay-online',
                  });
                }
              }}
              onPayCash={() => {
                if (userEntry) {
                  realtimeQueueService.command(selectedSalon.id, {
                    type: 'queue_action',
                    itemId: userEntry.id,
                    action: 'Pay-cash',
                  });
                }
              }}
            />
          )}

          {/* Alerts card. Deliberately carries NO developer affordances: no
              "simulate push" trigger, no test-alert button, and no
              "Simulated Push Active" claim. It states only what is true —
              every update is written to the customer's real, persisted
              Notification inbox — and offers the OS permission prompt when
              the device has not decided yet. */}
          <div
            id="tracking-push-notification-card"
            className="p-4 rounded-2xl bg-white border border-[var(--noq-border)] space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-[var(--noq-accent)]" />
                <span className="text-xs font-bold text-[var(--noq-ink)]">Queue alerts</span>
              </div>
              {permissionStatus === 'granted' && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#E7F5F2] text-[var(--noq-accent)]">
                  Device alerts on
                </span>
              )}
            </div>

            <p className="text-[11px] text-[var(--noq-muted)] leading-relaxed">
              {userEntry?.status === 'Reserved'
                ? `We'll alert you ahead of your reserved arrival window (${userEntry.reservedFor}), and every update is saved to your Notifications inbox.`
                : "We'll alert you when one person is ahead of you and when it's your turn. Every update is saved to your Notifications inbox."}
            </p>

            <div className="flex items-center gap-2 pt-1">
              {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
                <button
                  id="tracking-enable-push-btn"
                  onClick={onRequestPermission}
                  className="flex-1 py-2 px-3 rounded-xl bg-[var(--noq-accent)] hover:bg-[var(--noq-accent-hover)] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Bell className="w-3 h-3" />
                  <span>Enable device notifications</span>
                </button>
              )}
              <button
                id="tracking-open-notifications-btn"
                onClick={() => setScreen('notifications')}
                className="py-2 px-3 rounded-xl bg-[var(--noq-base)] hover:bg-[var(--noq-border)] border border-[var(--noq-border)] text-[var(--noq-accent)] text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ml-auto"
              >
                <span>Open Notifications</span>
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              id="get-directions-link"
              href={`https://maps.google.com/?q=${encodeURIComponent(selectedSalon.name + ' ' + selectedSalon.address)}`}
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-2xl border border-[var(--noq-border)] bg-white hover:bg-[var(--noq-base)] text-[var(--noq-ink)] font-semibold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Navigation className="w-3.5 h-3.5 text-[var(--noq-accent)]" />
              <span>Get Directions</span>
            </a>
            <button
              id="call-salon-action-btn"
              onClick={() => setIsCallModalOpen(true)}
              className="p-3 rounded-2xl border border-[var(--noq-border)] bg-white hover:bg-[var(--noq-base)] text-[var(--noq-ink)] font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 text-[var(--noq-muted)]" />
              <span>Call Salon</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. NEW SERVICE COMPLETE & THANK YOU EXPERIENCE */}
      {currentScreen === 'complete' && (
        <div id="customer-complete-screen" className="flex min-h-full flex-col justify-center bg-[var(--noq-base)] animate-in fade-in duration-200">
          <ThankYouScreen
            item={completedEntry || userEntry || {
              id: 'demo-completed',
              name: customerProfile?.name || 'Ritik',
              service: selectedService || 'Haircut',
              status: 'Completed',
              createdAt: Date.now() - 3600000,
              totalPriceInr: 250,
              paymentStatus: 'paid',
              paymentMethod: 'cash',
              token: 'SC-014',
            }}
            salonName={selectedSalon.name}
            onBackToHome={() => setScreen('home')}
            onSubmitRating={(rating, tags, comment) => {
              const target = completedEntry || userEntry;
              if (target) {
                realtimeQueueService.command(selectedSalon.id, {
                  type: 'queue_action',
                  itemId: target.id,
                  action: 'Submit-rating',
                  rating,
                  feedbackTags: tags,
                  feedbackComment: comment,
                });
              }
            }}
          />
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
