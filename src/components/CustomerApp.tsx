import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  Scissors,
  Dumbbell,
  MapPin,
  Clock,
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
  Star,
  LocateFixed,
  LoaderCircle,
  QrCode,
  Search,
} from 'lucide-react';
import { Salon, QueueItem, Barber, CustomerScreen, NearbySalon, CustomerAuthSession, CustomerProfile, UserAddress } from '../types';
import { formatDurationRangeLabel } from '../shared/durationFormat';
import { AddressManagementModal } from './AddressManagementModal';
import { LocationSelectScreen } from './LocationSelectScreen';
import { AddAddressScreen } from './AddAddressScreen';
import { RequestAddressScreen } from './RequestAddressScreen';
import { CATEGORY_THEME_MAP } from './CustomerHomeComponents';
import { AVAILABLE_TIME_SLOTS } from '../data/mockData';
import { CallSalonModal } from './CallSalonModal';
import { LandingScreen } from './LandingScreen';
import { LocationDiscovery } from './LocationDiscovery';
import { NotificationPermissionStep } from './NotificationPermissionStep';
import { AccountOnboarding } from './AccountOnboarding';
import { ProfileButton, PromotionalBanner, SalonSearchBar, WalletButton, TopCategoryTabs, CategoryLandingState, DEFAULT_MAIN_CATEGORIES, CategoryItemConfig } from './CustomerHomeComponents';
import { CustomerProfileScreen } from './CustomerProfile';
import { SalonDetailPage } from './SalonDetailPage';
import { ReserveFutureWindowScreen } from './ReserveFutureWindowScreen';
import { ThankYouScreen } from './ThankYouScreen';
import { realtimeQueueService } from '../services/realtimeQueueService';
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
import { resolveAppReadiness } from '../shared/profileReadiness';
import { resolveOnboardingStage } from '../shared/onboardingStage';
import { CancelBookingSheet } from './CancelBookingSheet';
import { LiveTicket, type JourneyStage, type TicketPerson } from './LiveTicket';
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
  const [selectedReservationDay, setSelectedReservationDay] = useState<'today' | 'tomorrow' | 'day3' | 'day4'>('today');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
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
  const activeCategoryObj = mainCategories.find((c) => c.id === activeCategoryId) || DEFAULT_MAIN_CATEGORIES[0];

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

  if (currentScreen === 'location-select') {
    return (
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
    );
  }

  if (currentScreen === 'add-address') {
    return (
      <AddAddressScreen
        onBack={() => setScreen('location-select')}
        userToken={customerAuth?.token}
        editingAddress={editingAddress}
        onAddressSaved={(addr) => {
          if (addr.label) setSelectedAddressLabel(addr.label);
          if (addr.fullAddress || addr.area) setLocationLabel(addr.fullAddress || `${addr.area}, ${addr.city}`);
        }}
      />
    );
  }

  if (currentScreen === 'request-address') {
    return (
      <RequestAddressScreen
        onBack={() => setScreen('location-select')}
        userToken={customerAuth?.token}
        onRequestSubmitted={(areaName) => {
          setVoiceFeedback(`Requested area coverage for "${areaName}"`);
          setTimeout(() => setVoiceFeedback(null), 4000);
        }}
      />
    );
  }

  return (
    <div ref={homeScrollRef} className="flex flex-col h-full bg-[#F8FAFA] text-[#17201F] overflow-y-auto">
      {/* 1. HOME SCREEN - NEARBY SALONS */}
      {currentScreen === 'home' && (
        <div id="customer-home-screen" className={`min-h-full transition-colors duration-500 animate-in fade-in ${
          (CATEGORY_THEME_MAP[activeCategoryObj.themeKey || activeCategoryId] || CATEGORY_THEME_MAP.salon).joinedBg
        }`}>
          {/* Header */}
          <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5">
            <div className="flex items-center justify-between gap-3">
              {/* LEFT: Address Title + Short Address */}
              <button
                type="button"
                onClick={() => setScreen('location-select')}
                className="group flex min-w-0 flex-col text-left active:scale-[0.98] transition-transform"
                aria-label="Open address management"
              >
                <div className="flex items-center gap-1.5 text-slate-900">
                  <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
                  <span className="truncate text-base font-black tracking-tight">{selectedAddressLabel} ›</span>
                </div>
                <p className="truncate text-[11px] font-semibold text-slate-500 max-w-[220px] sm:max-w-xs">
                  {locationLabel || 'Indiranagar, Bengaluru'}
                </p>
              </button>

              {/* RIGHT: Compact 3D Wallet + Profile controls ONLY */}
              <div className="flex shrink-0 items-center gap-2">
                <WalletButton />
                <ProfileButton onClick={() => setScreen('profile')} />
              </div>
            </div>

            {/* Large Search Box with rotating placeholder & inner mic button */}
            <div className="mt-3.5">
              <SalonSearchBar
                value={salonSearch}
                onChange={setSalonSearch}
                categories={mainCategories}
                activeCategoryName={activeCategoryObj.name}
                isListening={isListening}
                onVoiceSearch={handleVoiceSearch}
                voiceFeedback={voiceFeedback}
              />
            </div>
          </div>

          <div className="space-y-5 px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-3 sm:px-5">

          {/* Sculpted Connected Category Tabs */}
          <TopCategoryTabs
            categories={mainCategories}
            selectedCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
          />

          {/* Dynamic Theme Banner */}
          <PromotionalBanner category={activeCategoryObj} />

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
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A8785]">
                  {activeCategoryObj.name} Businesses
                </span>
                <h2 className="mt-0.5 text-xl font-bold tracking-[-0.025em] text-[#17201F]">
                  {activeCategoryId === 'salon' ? 'Choose your chair' : `Explore ${activeCategoryObj.name}`}
                </h2>
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
                  <p className="mt-3 text-xs leading-5 text-[#788582]">Refreshing businesses near {locationLabel || 'you'}…</p>
                </div>
              )}

              {nearbySalons.length === 0 && !isRestoringLocation && (
                <div className="rounded-2xl border border-[#DCE5E3] bg-white px-5 py-8 text-center">
                  <MapPin className="mx-auto h-6 w-6 text-[#7EA7A2]" />
                  <h3 className="mt-3 text-sm font-bold text-[#25302F]">No businesses available in your area yet.</h3>
                  <p className="mt-1 text-xs leading-5 text-[#788582]">Try another city or area as we onboard more partners.</p>
                  <button type="button" onClick={() => setIsChangingLocation(true)} className="mt-4 text-xs font-bold text-[#0F766E]">Change location</button>
                </div>
              )}

              {nearbySalons.length > 0 && salonSearch.trim() !== '' && categoryFilteredSalons.length === 0 && (
                <div className="rounded-2xl border border-[#DCE5E3] bg-white px-5 py-8 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0F6F5] text-[#0F766E]">
                    <Search className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#25302F]">No matching {activeCategoryObj.name} listings found</h3>
                  <p className="text-xs leading-5 text-[#788582] max-w-xs mx-auto">
                    No results found for &ldquo;{salonSearch}&rdquo; under {activeCategoryObj.name}. Try another term or switch categories.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSalonSearch('')}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#EAF5F3] px-4 py-2 text-xs font-bold text-[#0F766E] hover:bg-[#DDF0ED] transition"
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
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#E8F5F3] text-[#0F766E]">
                        {salon.logoImageUrl ? (
                          <img src={salon.logoImageUrl} alt={salon.name} className="h-full w-full object-cover" />
                        ) : salon.mainCategoryId === 'gym' ? (
                          <Dumbbell className="h-5 w-5" />
                        ) : (
                          <Scissors className="h-5 w-5" />
                        )}
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
          appliedOfferId={appliedOfferId}
          onApplyOffer={onApplyOffer}
          onRemoveOffer={onRemoveOffer}
          onBack={() => setScreen('home')}
          onJoin={userEntry ? () => setScreen('tracking') : onJoinClick}
          onReserve={() => setScreen('slots')}
          userEntry={userEntry}
          isJoinSheetOpen={isJoinSheetOpen}
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

          {/* Main ticket area. Reserved (future-slot) bookings keep the
              original status card — the token ticket is for an active live
              queue position, which a Reserved entry does not hold yet. */}
          {userEntry?.status === 'Reserved' ? (
            <div className="p-6 rounded-2xl bg-white border border-[#E1E7E6] space-y-4">
              <div className="flex items-center gap-4">
                <div id="tracking-position-badge" className="w-16 h-16 rounded-2xl flex items-center justify-center font-sans font-bold text-2xl shrink-0 bg-[#0F766E]/10 text-[#0F766E]">
                  ✓
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#6F7C7A]">RESERVED WINDOW</span>
                  <b id="tracking-main-status" className="block font-sans text-xl font-bold text-[#17201F] mt-0.5">
                    Reserved for {userEntry.reservedFor}
                  </b>
                </div>
              </div>
              <div id="tracking-notice-box" className="p-3.5 rounded-2xl text-xs font-medium leading-relaxed flex items-start gap-2.5 bg-[#F8FAFA] text-[#0F766E] border border-[#E1E7E6]">
                <CheckCircle2 className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
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

          {/* Push Notifications Status & Alert Settings Card */}
          <div
            id="tracking-push-notification-card"
            className="p-4 rounded-2xl bg-white border border-[#E1E7E6] space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-[#0F766E]" />
                <span className="text-xs font-bold text-[#17201F]">Live Push Notifications</span>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  permissionStatus === 'granted'
                    ? 'bg-[#E7F5F2] text-[#0F766E]'
                    : 'bg-[#0F766E]/10 text-[#0F766E]'
                }`}
              >
                {permissionStatus === 'granted' ? 'Alerts Enabled' : 'Simulated Push Active'}
              </span>
            </div>

            <p className="text-[11px] text-[#6F7C7A] leading-relaxed">
              {userEntry?.status === 'Reserved'
                ? `Push alert will notify your device 15 minutes before your reserved arrival window (${userEntry.reservedFor}).`
                : 'Push notification will sound and alert your screen when 10–15 minutes remain (1 person ahead) and when your counter is ready.'}
            </p>

            <div className="flex items-center gap-2 pt-1">
              {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
                <button
                  id="tracking-enable-push-btn"
                  onClick={onRequestPermission}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Bell className="w-3 h-3" />
                  <span>Enable Device Notifications</span>
                </button>
              )}

              <button
                id="tracking-test-push-btn"
                onClick={() =>
                  onTestPush(userEntry?.status === 'Reserved' ? 'reserved_nearing' : 'approaching')
                }
                className="py-2 px-3 rounded-xl bg-[#F8FAFA] hover:bg-[#E1E7E6] border border-[#E1E7E6] text-[#0F766E] text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ml-auto"
                title="Test Push Alert"
              >
                <Volume2 className="w-3 h-3" />
                <span>Test Alert</span>
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
        </div>
      )}

      {/* 5. NEW SERVICE COMPLETE & THANK YOU EXPERIENCE */}
      {currentScreen === 'complete' && (
        <div id="customer-complete-screen" className="flex min-h-full flex-col justify-center bg-[#F8FAFA] animate-in fade-in duration-200">
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
