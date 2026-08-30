import React, { useState, useEffect, useRef } from 'react';
import { QueueItem, Barber, Salon, SalonOffer, ViewMode, CustomerScreen, OtpAction, PushNotification, CustomerAuthSession, CustomerProfile } from './types';
import { SALONS, INITIAL_BARBERS, INITIAL_QUEUE } from './data/mockData';
import { fetchSalonProfile } from './services/salonDiscoveryService';
import { Header } from './components/Header';
import { CustomerApp } from './components/CustomerApp';
import { PublicSalonPage } from './components/PublicSalonPage';
import { salonDiscoveryService, type SalonDirectoryEntry } from './services/salonDiscoveryService';

const STAFF_SALON_KEY = 'no_wait_salon_staff_salon_id';
import { StaffAppShell } from './components/StaffAppShell';
import { OtpModal } from './components/OtpModal';
import { PushNotificationToast } from './components/PushNotificationToast';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import {
  getNotificationPermissionStatus,
  requestPushPermission,
  dispatchWebPushNotification,
} from './services/notificationService';
import { realtimeQueueService, type SalonSnapshot } from './services/realtimeQueueService';
import { customerAccountService, loadCustomerAuth, saveCustomerAuth } from './services/customerAccountService';
import { businessQrService } from './services/businessQrService';
import { resolveAppReadiness } from './shared/profileReadiness';
import { offerDiscountLabel } from './shared/couponPricing';
import { QueueJoinSheet } from './components/QueueJoinSheet';
import { AccountOnboarding } from './components/AccountOnboarding';

const NOTIFICATIONS_STORAGE_KEY = 'no_wait_salon_notifications_v1';
const SESSION_STORAGE_KEY = 'no_wait_salon_customer_session';

const createCustomerSessionId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'customer-' + Date.now() + '-' + Math.random().toString(36).slice(2);
};

const loadCustomerSessionId = (): string => {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY) || createCustomerSessionId();
  } catch {
    return createCustomerSessionId();
  }
};
const PACKAGED_MODE = import.meta.env.VITE_APP_MODE === 'customer' || import.meta.env.VITE_APP_MODE === 'staff'
  ? import.meta.env.VITE_APP_MODE
  : null;

export default function App() {
  // UI state is local; queue state is hydrated from the salon-scoped real-time service.
  const [salons] = useState<Salon[]>(SALONS);
  // Customer and Staff/Owner each get their OWN selected-business state.
  // These used to be a single shared `selectedSalon` — which meant the Test
  // Business Switcher (Staff/Owner side) silently overwrote whatever
  // business the Customer panel had open (e.g. opening Sharpcut Studio on
  // Customer, then switching Staff to Iron House Gym, would replace the
  // Customer panel's Sharpcut view with Iron House Gym). Customer's
  // business selection must never be driven by Staff/Owner switching, and
  // vice versa — see the isolation checks around `customerSalon` below.
  const [customerSalon, setCustomerSalon] = useState<Salon>(SALONS[0]);
  const [staffSalon, setStaffSalon] = useState<Salon>(SALONS[0]);
  const [selectedService, setSelectedService] = useState<string>('Haircut');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  // The one applied-offer source of truth: Salon Detail's price breakdown,
  // the Join Queue sheet's TO PAY, and its own View Services breakdown all
  // read this same id, so they can never show a different offer applied.
  const [appliedOfferId, setAppliedOfferId] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<CustomerScreen>('home');
  const qrRouteMatch = window.location.pathname.match(/^\/q\/([^/]+)\/?$/);
  const isQrRoute = Boolean(qrRouteMatch);
  // A plain phone camera lands here in a browser: serve the public salon page.
  // The packaged Android app keeps its existing in-app scanner flow.
  const publicQrToken = !PACKAGED_MODE && qrRouteMatch ? decodeURIComponent(qrRouteMatch[1]) : null;
  const urlParams = new URLSearchParams(window.location.search);
  const initialViewMode = (urlParams.get('mode') || urlParams.get('view')) as ViewMode | null;
  const [gymTestRole, setGymTestRole] = useState('owner');
  const [viewMode, setViewMode] = useState<ViewMode>(isQrRoute ? 'customer' : PACKAGED_MODE || initialViewMode || 'split');
  const [activeQrToken, setActiveQrToken] = useState<string | null>(null);
  // The Staff app runs as its own APK with no discovery flow, so it was pinned
  // to the first mock salon and never saw bookings made at any other salon.
  // It now loads the real salon directory and remembers the chosen salon.
  const [salonDirectory, setSalonDirectory] = useState<SalonDirectoryEntry[]>([]);
  const isStaffSurface = PACKAGED_MODE === 'staff';

  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE);
  const [barbers, setBarbers] = useState<Barber[]>(INITIAL_BARBERS);
  const [completedList, setCompletedList] = useState<QueueItem[]>([]);
  const customerSessionId = useRef<string>(loadCustomerSessionId());

  useEffect(() => {
    if (!isStaffSurface) return;
    let cancelled = false;
    void salonDiscoveryService.directory().then((entries) => {
      if (cancelled || entries.length === 0) return;
      setSalonDirectory(entries);
      let savedId: string | null = null;
      try { savedId = localStorage.getItem(STAFF_SALON_KEY); } catch { savedId = null; }
      const chosen = entries.find((entry) => entry.id === savedId) || entries[0];
      setStaffSalon((current) => (current.id === chosen.id ? current : { ...current, id: chosen.id, name: chosen.name, mainCategoryId: chosen.mainCategoryId }));
    });
    return () => { cancelled = true; };
  }, [isStaffSurface]);

  useEffect(() => {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, customerSessionId.current);
    } catch {
      // Keep using the in-memory ID when storage is unavailable.
    }
  }, []);

  const [queueAlert, setQueueAlert] = useState<string>('');
  const [customerAuth, setCustomerAuth] = useState<CustomerAuthSession | null>(() => loadCustomerAuth());
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  // OTP Modal State
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [pendingOtpAction, setPendingOtpAction] = useState<OtpAction | null>(null);

  // Queue-join sheet state: shown once a customer is verified and ready to
  // pick a stylist, never before.
  const [isJoinSheetOpen, setIsJoinSheetOpen] = useState(false);
  const [joinSheetBusy, setJoinSheetBusy] = useState(false);
  const [joinSheetError, setJoinSheetError] = useState('');

  // Booking verification gate: guests browse freely, but tapping Join Queue
  // without a verified, complete profile opens this instead of the join
  // sheet. On success it continues straight into the SAME pending booking —
  // the salon/services already chosen are never lost, and the customer is
  // never sent back to reselect them.
  const [bookingGateOpen, setBookingGateOpen] = useState(false);

  // Push Notifications State
  const [notifications, setNotifications] = useState<PushNotification[]>(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [activeToast, setActiveToast] = useState<PushNotification | null>(null);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermissionStatus()
  );

  const loadProfile = async () => {
    if (!loadCustomerAuth()) return;
    setProfileLoading(true); setProfileError('');
    try { setCustomerProfile(await customerAccountService.getProfile()); }
    catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to load your profile.');
      if (error instanceof Error && error.message.includes('verify')) { saveCustomerAuth(null); setCustomerAuth(null); }
    } finally { setProfileLoading(false); }
  };

  useEffect(() => { if (customerAuth) void loadProfile(); }, [customerAuth?.token]);

  // Set of already fired notification trigger keys to prevent repeated spam
  const sentNotificationsRef = useRef<Set<string>>(new Set());

  const applySnapshot = (snapshot: SalonSnapshot) => {
    setQueue(snapshot.queue);
    setBarbers(snapshot.barbers);
    setCompletedList(snapshot.completedList);
    setQueueAlert('');
    if (snapshot.platformStatus) {
      setCustomerSalon((prev) => (prev.id === snapshot.salonId ? (prev.platformStatus === snapshot.platformStatus ? prev : { ...prev, platformStatus: snapshot.platformStatus as any }) : prev));
    }
  };

  // Scoped to the Customer panel's own selected business — never affected
  // by the Staff/Owner panel switching businesses.
  useEffect(() => {
    let disposed = false;
    realtimeQueueService.getState(customerSalon.id)
      .then((snapshot) => !disposed && applySnapshot(snapshot))
      .catch((error) => !disposed && setQueueAlert(error instanceof Error ? error.message : 'Unable to load the live queue.'));
    const unsubscribe = realtimeQueueService.subscribe(
      customerSalon.id,
      (snapshot) => !disposed && applySnapshot(snapshot),
      (connected) => {
        if (!disposed && !connected) setQueueAlert('Live connection interrupted. Reconnecting…');
      }
    );
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [customerSalon.id]);

  // Keep the selected salon's profile identical to what the public web page
  // would show for it: re-read the server record whenever the salon changes.
  useEffect(() => {
    let disposed = false;
    fetchSalonProfile(customerSalon.id)
      .then((fresh) => {
        if (disposed || !fresh) return;
        setCustomerSalon((current) => (current.id === fresh.id ? { ...current, ...fresh } : current));
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [customerSalon.id]);

  // Sync notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    } catch (e) {
      console.error(e);
    }
  }, [notifications]);

  // Find user's active entry in queue if any
  const userEntry = queue.find((item) => item.sessionId === customerSessionId.current) || null;

  // Restores the live ticket after a refresh/reopen: the moment the queue
  // snapshot loads and reveals this session's active entry, jump straight to
  // it once. Tracked by entry id so a deliberate "back to Home" tap later
  // (same entry, unchanged id) is never fought.
  const restoredEntryId = useRef<string | null>(null);
  useEffect(() => {
    if (!userEntry) {
      restoredEntryId.current = null;
      return;
    }
    if (restoredEntryId.current === userEntry.id) return;
    restoredEntryId.current = userEntry.id;
    if (currentScreen === 'slots' || currentScreen === 'salon' || currentScreen === 'home') {
      setCurrentScreen('tracking');
    }
  }, [userEntry, currentScreen]);

  useEffect(() => {
    const completedEntry = completedList.find((item) => item.sessionId === customerSessionId.current);
    if (!userEntry && completedEntry && currentScreen === 'tracking') {
      setCurrentScreen('complete');
    }
  }, [completedList, userEntry, currentScreen]);

  // Dispatch push notification helper
  const triggerPushNotification = (
    title: string,
    body: string,
    type: PushNotification['type'],
    salonName = customerSalon.name
  ) => {
    const notif: PushNotification = {
      id: `push-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      body,
      timestamp: Date.now(),
      type,
      salonName,
      read: false,
    };
    setNotifications((prev) => [notif, ...prev.slice(0, 30)]);
    setActiveToast(notif);
    dispatchWebPushNotification(notif);
  };

  // Request native permission
  const handleRequestPermission = async () => {
    const status = await requestPushPermission();
    setPermissionStatus(status);
    if (status === 'granted') {
      triggerPushNotification(
        '🔔 Push Notifications Active',
        'You will now receive alerts 10–15 mins before your turn and when your slot arrives!',
        'general'
      );
    }
  };

  // Automated Push Notifications Trigger Engine
  useEffect(() => {
    if (!userEntry) return;

    // 1. Check if user position is nearing (≤ 15 mins or ≤ 1 person ahead)
    if (userEntry.status === 'Waiting') {
      const waitingList = queue.filter((x) => x.status === 'Waiting');
      const userWaitingIndex = waitingList.findIndex((x) => x.id === userEntry.id);
      const peopleAhead = userWaitingIndex >= 0 ? userWaitingIndex : 0;

      // Nearing alert triggered when 1 or 0 people are ahead in waiting queue
      if (peopleAhead <= 1) {
        const triggerKey = `${userEntry.id}-nearing-15min`;
        if (!sentNotificationsRef.current.has(triggerKey)) {
          sentNotificationsRef.current.add(triggerKey);
          triggerPushNotification(
            `✂️ ${customerSalon.name}: You're Almost Up!`,
            `Only ${peopleAhead === 0 ? '0' : '1'} person ahead (~10–15 mins remaining). Please start heading to the salon entrance.`,
            'approaching'
          );
        }
      }
    }

    // 2. Check if user is Called by barber
    if (userEntry.status === 'Called') {
      const triggerKey = `${userEntry.id}-called`;
      if (!sentNotificationsRef.current.has(triggerKey)) {
        sentNotificationsRef.current.add(triggerKey);
        triggerPushNotification(
          `🔔 ${customerSalon.name}: Barber Ready!`,
          `Barber ${userEntry.barberName || 'Arjun'} is ready for you at the styling chair. Please step inside now!`,
          'called'
        );
      }
    }

    // 3. Check if user has Reserved Slot nearing
    if (userEntry.status === 'Reserved' && userEntry.reservedFor) {
      const triggerKey = `${userEntry.id}-slot-nearing`;
      if (!sentNotificationsRef.current.has(triggerKey)) {
        sentNotificationsRef.current.add(triggerKey);
        triggerPushNotification(
          `⏰ ${customerSalon.name}: Reserved Slot Approaching`,
          `Your reserved slot for ${userEntry.reservedFor} is in 15 minutes! Please head to the salon check-in counter.`,
          'reserved_nearing'
        );
      }
    }
  }, [queue, userEntry, customerSalon]);

  // --- Handlers ---
  const runCommand = async (command: Parameters<typeof realtimeQueueService.command>[1]) => {
    try {
      const snapshot = await realtimeQueueService.command(customerSalon.id, command);
      applySnapshot(snapshot);
      return snapshot;
    } catch (error) {
      setQueueAlert(error instanceof Error ? error.message : 'Unable to update the live queue.');
      return null;
    }
  };

  const handleReset = async () => {
    const snapshot = await runCommand({ type: 'reset' });
    if (!snapshot) return;
    sentNotificationsRef.current.clear();
    setSelectedService('Haircut');
    setCurrentScreen('home');
    triggerPushNotification('🔄 Salon State Reset', 'Initial demo queue restored with live push notification triggers.', 'general');
  };

  const handleBarberToggle = async (barberIndex: number) => {
    const barber = barbers[barberIndex];
    if (!barber) return;
    await runCommand({ type: 'toggle_barber', barberId: barber.id });
  };

  // Manage Staff writes the whole roster through save_staff, same shape
  // Admin's salon editor already sends — the server reconciles it into live
  // state immediately, so this reaches Customer App without a queue reset.
  const handleSaveStaff = async (staff: Barber[]) => {
    await runCommand({
      type: 'save_staff',
      staff: staff.map((member) => ({
        id: member.id.startsWith('new-') ? undefined : member.id,
        name: member.name,
        role: member.role,
        photo_url: member.photoUrl,
        working_status: member.status,
        active: member.active !== false,
        service_ids: member.serviceIds || [],
        rating: member.rating,
        review_count: member.reviewCount,
        experience_years: member.experienceYears,
        bio: member.bio,
        specialties: member.specialties,
      })),
    });
  };

  // Staff Dashboard's Offers tab writes through save_offers, the same
  // salon_offer table Admin's salon editor already uses. The command
  // endpoint only returns queue/barber state (not the salon record), so a
  // fresh salon profile is re-read afterwards to pick up the new offers.
  const handleSaveOffers = async (offers: SalonOffer[]) => {
    await runCommand({
      type: 'save_offers',
      offers: offers.map((offer) => ({
        id: offer.id.startsWith('new-') ? undefined : offer.id,
        title: offer.title,
        // Staff's editor only sets the structured type/value fields — derive
        // the free-text badge ("20% OFF") from them so the offers carousel
        // (which still reads the plain string) isn't left blank.
        discount_text: offer.discount || offerDiscountLabel(offer),
        minimum_bill: offer.minimumBillInr ?? 0,
        start_date: offer.startDate ?? '',
        end_date: offer.endDate ?? '',
        terms: offer.terms ?? '',
        active: offer.active !== false,
        code: offer.code ?? '',
        discount_type: offer.discountType ?? 'percent',
        discount_value: offer.discountValue ?? 0,
        eligible_service_ids: offer.eligibleServiceIds ?? [],
      })),
    });
    const fresh = await fetchSalonProfile(customerSalon.id);
    if (fresh) setCustomerSalon((current) => (current.id === fresh.id ? { ...current, ...fresh } : current));
  };

  // Client-side selection only — App.tsx's `join` command sends this id as a
  // hint, but the server re-validates and recomputes the discount itself
  // from the live salon_offer row before it ever touches totalPriceInr.
  const handleApplyOffer = (offerId: string) => setAppliedOfferId(offerId);
  const handleRemoveOffer = () => setAppliedOfferId(null);

  const handleAddWalkin = (
    name: string,
    phone: string,
    service: string,
    startImmediately = false,
    selectedBarberIndex?: number
  ) => {
    const preferredBarber = selectedBarberIndex !== undefined ? barbers[selectedBarberIndex] : undefined;
    void runCommand({
      type: 'add_walkin',
      item: { id: '', name, phone, service, status: 'Waiting', isUser: false, createdAt: Date.now(), estimatedDurationMin: 30 },
      startImmediately,
      preferredBarberId: preferredBarber?.id,
    }).then((snapshot) => {
      if (snapshot && startImmediately) {
        triggerPushNotification(`✂️ Service Started`, `Directly seated ${name} for ${service}.`, 'serving');
      }
    });
  };

  const handleQueueAction = (
    item: QueueItem,
    action: 'Call' | 'Acknowledge' | 'Start' | 'Complete' | 'No-show' | 'Remove' | 'Cancel-chair',
    reason?: { code: string; text: string },
    specificBarberIndex?: number
  ) => {
    const barberId = specificBarberIndex !== undefined ? barbers[specificBarberIndex]?.id : undefined;
    void runCommand({
      type: 'queue_action',
      itemId: item.id,
      action,
      barberId,
      reasonCode: reason?.code,
      reasonText: reason?.text,
    }).then((snapshot) => {
      if (!snapshot || item.sessionId !== customerSessionId.current) return;
      if (action === 'Call') {
        const updated = snapshot.queue.find((entry) => entry.id === item.id);
        triggerPushNotification(`🔔 ${customerSalon.name}: Barber ${updated?.barberName || 'Ready'} is Ready!`, 'Your styling station is open. Please step inside to be seated.', 'called');
      } else if (action === 'Start') {
        triggerPushNotification(`✂️ ${customerSalon.name}: Service In Progress`, 'You are now being served. Enjoy your cut!', 'serving');
      } else if (action === 'Complete') {
        setCurrentScreen('complete');
        triggerPushNotification(`🎉 ${customerSalon.name}: Service Complete!`, `Your ${item.service} is finished. Thank you for visiting!`, 'general');
      }
    });
  };

  /** Services chosen so far, falling back to the legacy single-select name. */
  const chosenServicesFor = () => {
    const chosen = customerSalon.services.filter((item) => selectedServiceIds.includes(item.id));
    if (chosen.length) return chosen;
    const fallback = customerSalon.services.find((item) => item.name === selectedService);
    return fallback ? [fallback] : [];
  };

  /**
   * The single entry point for "Join Queue". Guests reach this freely — Home
   * never required signing in — so this is the one place booking is actually
   * gated: a verified, complete profile opens the queue-join sheet directly;
   * anything else opens the booking verification gate instead, which resumes
   * this exact same call once it succeeds.
   */
  const openQueueJoinSheet = () => {
    const readiness = resolveAppReadiness(customerAuth, customerProfile, { profileLoading });
    if (readiness.kind === 'loading') return;
    if (readiness.kind !== 'ready') {
      setBookingGateOpen(true);
      return;
    }
    setJoinSheetError('');
    setIsJoinSheetOpen(true);
  };

  const handleJoinClick = () => {
    if (userEntry) {
      setCurrentScreen('tracking');
      return;
    }
    openQueueJoinSheet();
  };

  const handleSelectSlotClick = async (slot: string) => {
    if (userEntry) {
      setCurrentScreen('tracking');
      return;
    }
    const chosenServices = chosenServicesFor();
    const serviceNames = chosenServices.map((item) => item.name);
    const serviceString = serviceNames.join(' + ') || selectedService || 'Haircut';
    const totalDuration = chosenServices.reduce((sum, item) => sum + (Number(item.durationMin) || 0), 0) || 30;
    const totalPrice = chosenServices.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0) || 250;

    if (customerAuth?.token) {
      const snapshot = await realtimeQueueService.command(customerSalon.id, {
        type: 'join',
        item: {
          id: '',
          name: customerProfile?.name?.trim() || 'You',
          phone: customerAuth.phoneNumber || '',
          service: serviceString,
          services: serviceNames.length ? serviceNames : [serviceString],
          totalPriceInr: totalPrice,
          status: 'Reserved',
          reservedFor: slot,
          isUser: true,
          sessionId: customerSessionId.current,
          createdAt: Date.now(),
          estimatedDurationMin: totalDuration,
        },
      });
      if (snapshot) {
        applySnapshot(snapshot);
        triggerPushNotification(
          `⏰ ${customerSalon.name}: Slot Reserved (${slot})`,
          `Your reservation for ${serviceString} is locked.`,
          'reserved_nearing'
        );
        setCurrentScreen('tracking');
      }
      return;
    }
    setPendingOtpAction({ type: 'slot', slot, serviceName: serviceString });
    setIsOtpOpen(true);
  };

  /** Confirms the join from the queue-join sheet, honouring the chosen stylist. */
  const confirmJoinFromSheet = async (preferredBarberId: string) => {
    const chosenServices = chosenServicesFor();
    if (!chosenServices.length) {
      setJoinSheetError('Please select an available service.');
      return;
    }
    setJoinSheetBusy(true);
    setJoinSheetError('');
    try {
      if (activeQrToken) {
        const serviceIds = chosenServices.map((item) => item.id);
        const result = await businessQrService.join(activeQrToken, serviceIds, customerSessionId.current, 'qr_walk_in', preferredBarberId || undefined);
        applySnapshot(result.state);
      } else {
        const serviceNames = chosenServices.map((item) => item.name);
        const snapshot = await realtimeQueueService.command(customerSalon.id, {
          type: 'join',
          item: {
            id: '',
            name: customerProfile?.name?.trim() || 'You',
            phone: customerAuth?.phoneNumber || '',
            service: serviceNames.join(' + '),
            services: serviceNames,
            totalPriceInr: chosenServices.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0),
            status: 'Waiting',
            isUser: true,
            sessionId: customerSessionId.current,
            createdAt: Date.now(),
            estimatedDurationMin: chosenServices.reduce((sum, item) => sum + (Number(item.durationMin) || 0), 0) || 30,
            preferredBarberId: preferredBarberId || undefined,
            // A hint only — the server re-validates against the live
            // salon_offer row and recomputes the discount itself.
            appliedOfferId: appliedOfferId || undefined,
          },
        });
        applySnapshot(snapshot);
      }
      setIsJoinSheetOpen(false);
      setAppliedOfferId(null);
      triggerPushNotification(
        `🎟️ ${customerSalon.name}: Live Ticket Confirmed`,
        `You've joined the queue for ${chosenServices.map((item) => item.name).join(' + ')}. We'll notify you before your turn!`,
        'confirmed'
      );
      setCurrentScreen('tracking');
    } catch (error) {
      setJoinSheetError(error instanceof Error ? error.message : 'Unable to join this queue right now.');
    } finally {
      setJoinSheetBusy(false);
    }
  };

  const handleOtpVerifySuccess = async (auth: CustomerAuthSession) => {
    if (!pendingOtpAction) return;
    const action = pendingOtpAction;
    saveCustomerAuth(auth);
    setCustomerAuth(auth);
    if (action.type === 'profile') {
      setIsOtpOpen(false);
      setPendingOtpAction(null);
      setCurrentScreen('profile');
      return;
    }
    // Only the slot-reservation flow reaches here now: Join Queue never opens
    // this modal, since onboarding already guarantees a verified, named
    // customer before Home is reachable at all.
    const snapshot = await runCommand({
      type: 'join',
      item: {
        id: '',
        name: 'You',
        phone: auth.phoneNumber,
        service: action.serviceName!,
        status: 'Reserved',
        reservedFor: action.slot,
        isUser: true,
        sessionId: customerSessionId.current,
        createdAt: Date.now(),
        estimatedDurationMin: 30,
      },
    });
    if (!snapshot) return;
    setIsOtpOpen(false);
    triggerPushNotification(
      `⏰ ${customerSalon.name}: Slot Reserved (${action.slot})`,
      `Your reservation for ${action.serviceName} is locked.`,
      'reserved_nearing'
    );
    setPendingOtpAction(null);
    setCurrentScreen('tracking');
  };

  const handleCancelUserQueue = async (reason?: { code: string; text: string }) => {
    const snapshot = await runCommand({
      type: 'cancel_customer',
      sessionId: customerSessionId.current,
      reasonCode: reason?.code,
      reasonText: reason?.text,
    });
    if (!snapshot) return;
    setCurrentScreen('salon');
    triggerPushNotification(
      `ℹ️ ${customerSalon.name}: Queue Cancelled`,
      `Your position in the live queue has been released.`,
      'general'
    );
  };

  const handleTestNotification = (type: 'approaching' | 'called' | 'reserved_nearing') => {
    if (type === 'approaching') {
      triggerPushNotification(
        `✂️ ${customerSalon.name}: You're Almost Up!`,
        `Only 1 person ahead (~10–15 mins remaining). Please start heading over to the salon entrance.`,
        'approaching'
      );
    } else if (type === 'called') {
      triggerPushNotification(
        `🔔 ${customerSalon.name}: Barber Arjun is Ready!`,
        `Your counter is ready now! Please step inside the salon within 10 minutes.`,
        'called'
      );
    } else if (type === 'reserved_nearing') {
      triggerPushNotification(
        `⏰ ${customerSalon.name}: Reserved Slot Approaching`,
        `Your reserved arrival slot (${userEntry?.reservedFor || '4:30 PM'}) is in 15 minutes! Please head to the counter.`,
        'reserved_nearing'
      );
    }
  };

  // The packaged NOQ Business APK always starts at the universal Business ID
  // login gate. The authenticated session then selects the correct business,
  // category dashboard, and role permissions from the server.
  if (PACKAGED_MODE === 'staff') {
    return (
      <StaffAppShell
        salon={staffSalon}
        queue={queue}
        barbers={barbers}
        completedList={completedList}
        onBarberToggle={handleBarberToggle}
        onAddWalkin={handleAddWalkin}
        onQueueAction={handleQueueAction}
        queueAlert={queueAlert}
        onSaveStaff={handleSaveStaff}
        onSaveOffers={handleSaveOffers}
        onBusinessResolved={(business) => {
          try { localStorage.setItem(STAFF_SALON_KEY, business.id); } catch { /* keep in memory */ }
          setStaffSalon((current) => ({
            ...current,
            id: business.id,
            name: business.name,
            mainCategoryId: business.mainCategoryId,
          }));
        }}
      />
    );
  }

  // Scanned with a plain phone camera: render the standalone public salon page
  // instead of the full app shell, so no install or onboarding is required.
  if (publicQrToken) {
    return (
      <div className="min-h-screen bg-[#F8FAFA] font-sans text-[#17201F]">
        <PublicSalonPage token={publicQrToken} />
      </div>
    );
  }

  const gymStaffSelected = staffSalon.mainCategoryId === 'gym' && viewMode !== 'customer';
  const gymTestSwitcher = import.meta.env.DEV || ['localhost', '127.0.0.1', 'no-wait-salon-web-test.onrender.com'].includes(window.location.hostname);
  // PACKAGED_MODE === 'staff' already returned above via the universal
  // StaffAppShell login gate; this only covers the web '/business' route.
  const isRealBusinessSurface = window.location.pathname === '/business';
  // Outside the hosted TEST wrapper, selecting a Gym business still gets its
  // own real full-screen NOQ Business surface, matching production/Android.
  // Only the TEST wrapper (gymTestSwitcher) keeps it inside the compact
  // Staff preview panel below instead of taking over the whole viewport.
  const gymFullscreenTakeover = gymStaffSelected && !gymTestSwitcher;
  const isBusinessSurface = isRealBusinessSurface || gymFullscreenTakeover;
  // Compact, developer-tooling-styled switcher — never shown on the real
  // production/Android business surface, which stays test-chrome-free.
  const showTestSwitcher = gymTestSwitcher && !isRealBusinessSurface && viewMode !== 'customer';
  const testSwitcherBanner = showTestSwitcher && (
    <div className="flex flex-wrap items-center gap-2 border-b border-teal-100 bg-teal-50/80 px-3 py-1.5 text-[11px] text-teal-800">
      <span className="font-semibold uppercase tracking-wide text-teal-700">Testing as</span>
      <select aria-label="Test Business Switcher" id="test-business-switcher" className="min-h-7 rounded-md border border-teal-200 bg-white px-2 py-0.5 text-[11px] font-medium text-teal-900" value={staffSalon.id + ':' + gymTestRole} onChange={e => { const [id, role] = e.target.value.split(':'); const found = SALONS.find(s => s.id === id); if (found) { setStaffSalon(found); setGymTestRole(role); } }}>
        {SALONS.filter(s => ['gym', 'salon'].includes(s.mainCategoryId || 'salon')).map(s => <React.Fragment key={s.id}><option value={s.id + ':owner'}>{s.name} — {s.mainCategoryId === 'gym' ? 'Gym' : 'Salon'} (Owner)</option>{s.mainCategoryId === 'gym' && <option value={s.id + ':trainer'}>{s.name} — Trainer</option>}</React.Fragment>)}
      </select>
      <span className="ml-auto text-teal-600/80">TEST environment only</span>
    </div>
  );
  if (isBusinessSurface) {
    return <div className="min-h-screen bg-[#f6f8fa]">
      <StaffAppShell key={gymStaffSelected ? staffSalon.id + ':' + gymTestRole : 'business'} testRole={gymTestRole} salon={staffSalon} queue={queue} barbers={barbers} completedList={completedList} onBarberToggle={handleBarberToggle} onAddWalkin={handleAddWalkin} onQueueAction={handleQueueAction} queueAlert={queueAlert} onSaveStaff={handleSaveStaff} onSaveOffers={handleSaveOffers} />
    </div>;
  }

  return (
    <div className={`flex flex-col justify-between bg-[#F4F7F6] font-sans text-[#17201F] selection:bg-[#0F766E]/20 selection:text-[#17201F] ${
      PACKAGED_MODE === 'customer' ? 'h-[100dvh] min-h-0 overflow-hidden' : 'min-h-screen'
    }`}>
      {testSwitcherBanner}
      <div className={`${PACKAGED_MODE === 'customer' ? 'h-full min-h-0 w-full p-0' : 'mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8'} flex flex-1 flex-col`}>
        {/* Top Header */}
        {PACKAGED_MODE !== 'customer' && !isQrRoute && (
          <Header
            viewMode={viewMode}
            setViewMode={setViewMode}
            onReset={handleReset}
            notificationCount={notifications.filter((n) => !n.read).length}
            onOpenNotifications={() => setIsNotificationCenterOpen(true)}
            permissionStatus={permissionStatus}
            lockedMode={PACKAGED_MODE || undefined}
            showNotifications={PACKAGED_MODE !== 'staff'}
          />
        )}

        {/* Main Workspaces Display */}
        <div
          className={`grid min-h-0 flex-1 gap-5 sm:gap-6 ${
            viewMode === 'split'
              ? 'grid-cols-1 items-stretch lg:grid-cols-2'
              : 'grid-cols-1 items-start max-w-xl mx-auto w-full'
          }`}
        >
          {/* Panel 1: Customer Mobile App Window */}
          {(viewMode === 'split' || viewMode === 'customer') && (
            <section
              id="customer-app-window"
              // Outside the packaged Customer app, this panel is a bounded
              // preview inside a larger desktop page, not the real device
              // viewport. `contain: layout` makes this section the CSS
              // containing block for its `position: fixed` descendants (the
              // gym floating capsule, the selected-pass bottom dock, etc.),
              // so they anchor to this panel's own box — clipped by its
              // existing rounded corners and overflow-hidden — instead of
              // the whole browser viewport. The real packaged Customer app
              // (PACKAGED_MODE === 'customer', Android included) never gets
              // this class, so those elements keep their normal
              // viewport-fixed behavior there, matching a real device.
              //
              // In TEST split view (never true for the packaged apps —
              // PACKAGED_MODE forces viewMode to 'customer'/'staff', never
              // 'split') both preview panels get a fixed `h-[820px]`
              // instead of `min-h-[640px] max-h-[820px]`. Letting height
              // stay content-driven meant the Customer panel (more content)
              // and Staff panel (Gym Overview has little content) settled
              // at different heights even with `items-stretch` on the grid,
              // since a grid row's auto track height is the *shorter*
              // item's max-content size once alignment resolves — nothing
              // forced both boxes to the same explicit height. A fixed
              // height makes both frames identical regardless of content.
              className={`flex ${
                PACKAGED_MODE === 'customer'
                  ? 'h-full min-h-0 border-0'
                  : `${viewMode === 'split' ? 'h-[820px]' : 'min-h-[640px] max-h-[820px]'} rounded-2xl border border-[#DDE5E3]`
              } flex-col overflow-hidden bg-white transition-all ${PACKAGED_MODE !== 'customer' ? '[contain:layout] relative' : ''}`}
            >
              {/* Development workspace chrome is hidden in the customer app. */}
              {PACKAGED_MODE !== 'customer' && !isQrRoute && <div className="flex items-center justify-between border-b border-[#E1E7E6] bg-white px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-[#14B8A6]"></span>
                  <h2 className="font-sans text-sm font-bold text-[#17201F] tracking-tight">
                    Customer Experience
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {permissionStatus === 'granted' && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[#0F766E]/10 text-[#0F766E] flex items-center gap-1">
                      Push Active
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 rounded-full bg-[#E7F5F2] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0F766E]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]"></span>
                    Live Queue
                  </span>
                </div>
              </div>}

              {/* Customer Body */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <CustomerApp
                  currentScreen={currentScreen}
                  setScreen={setCurrentScreen}
                  selectedSalon={customerSalon}
                  setSelectedSalon={setCustomerSalon}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                  selectedServiceIds={selectedServiceIds}
                  setSelectedServiceIds={setSelectedServiceIds}
                  appliedOfferId={appliedOfferId}
                  onApplyOffer={handleApplyOffer}
                  onRemoveOffer={handleRemoveOffer}
                  queue={queue}
                  barbers={barbers}
                  userEntry={userEntry}
                  completedEntry={completedList.find((item) => item.sessionId === customerSessionId.current) || null}
                  onJoinClick={handleJoinClick}
                  onSelectSlotClick={handleSelectSlotClick}
                  onCancelQueue={handleCancelUserQueue}
                  onAcknowledge={() => { if (userEntry) handleQueueAction(userEntry, 'Acknowledge'); }}
                  permissionStatus={permissionStatus}
                  onRequestPermission={handleRequestPermission}
                  onTestPush={handleTestNotification}
                  customerAuth={customerAuth}
                  customerProfile={customerProfile}
                  profileLoading={profileLoading}
                  profileError={profileError}
                  onProfileLogin={() => { setPendingOtpAction({ type: 'profile' }); setIsOtpOpen(true); }}
                  onIdentityVerified={(auth) => { saveCustomerAuth(auth); setCustomerAuth(auth); }}
                  onProfileSaved={(profile) => { setCustomerProfile(profile); setProfileError(''); }}
                  onProfileLogout={async () => {
                    try { await customerAccountService.logout(); } catch { /* local logout still completes */ }
                    saveCustomerAuth(null); setCustomerAuth(null); setCustomerProfile(null); setCurrentScreen('home');
                  }}
                  onQrContextChange={setActiveQrToken}
                  queueError={queueAlert}
                  isJoinSheetOpen={isJoinSheetOpen}
                  onOpenNotifications={() => setIsNotificationCenterOpen(true)}
                />
              </div>
            </section>
          )}

          {/* Panel 2: Staff / Salon Dashboard Window */}
          {(viewMode === 'split' || viewMode === 'staff') && (
            <section
              id="staff-dashboard-window"
              className={`flex ${viewMode === 'split' ? 'h-[820px]' : 'min-h-[640px] max-h-[820px]'} flex-col overflow-hidden rounded-2xl border border-[#DDE5E3] bg-white transition-all`}
            >
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-[#E1E7E6] bg-white px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-[#14B8A6]"></span>
                  <h2 className="font-sans text-sm font-bold text-[#17201F] tracking-tight">
                    {gymStaffSelected ? 'Gym Staff Dashboard' : 'Business Staff Dashboard'}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {isStaffSurface && salonDirectory.length > 0 && (
                    <select
                      aria-label="Select salon"
                      value={staffSalon.id}
                      onChange={(event) => {
                        const entry = salonDirectory.find((item) => item.id === event.target.value);
                        if (!entry) return;
                        try { localStorage.setItem(STAFF_SALON_KEY, entry.id); } catch { /* keep in memory */ }
                        setStaffSalon((current) => ({ ...current, id: entry.id, name: entry.name, mainCategoryId: entry.mainCategoryId }));
                      }}
                      className="rounded-lg border border-[#DDE7E5] bg-white px-2 py-1 text-[11px] font-semibold text-[#17201F]"
                    >
                      {salonDirectory.map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.name}</option>
                      ))}
                    </select>
                  )}
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#0F766E]/10 text-[#0F766E] tracking-wider">
                    Sync Active
                  </span>
                </div>
              </div>

              {/* Staff Body — the hosted TEST wrapper keeps the Gym business
                  dashboard inside this same preview panel (real authenticated
                  StaffAppShell -> GymDashboardView, rendered in its compact
                  embedded layout) instead of taking over the browser viewport.
                  Non-gym businesses use the same universal authenticated
                  StaffAppShell login flow as the real NOQ Business surface. */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {gymStaffSelected ? (
                  <StaffAppShell
                    key={staffSalon.id + ':' + gymTestRole}
                    embedded
                    testBusinessId={staffSalon.id}
                    testRole={gymTestRole}
                    salon={staffSalon}
                    queue={queue}
                    barbers={barbers}
                    completedList={completedList}
                    onBarberToggle={handleBarberToggle}
                    onAddWalkin={handleAddWalkin}
                    onQueueAction={handleQueueAction}
                    queueAlert={queueAlert}
                    onSaveStaff={handleSaveStaff}
                    onSaveOffers={handleSaveOffers}
                  />
                ) : (
                  <StaffAppShell
                    salon={staffSalon}
                    queue={queue}
                    barbers={barbers}
                    completedList={completedList}
                    onBarberToggle={handleBarberToggle}
                    onAddWalkin={handleAddWalkin}
                    onQueueAction={handleQueueAction}
                    queueAlert={queueAlert}
                    onSaveStaff={handleSaveStaff}
                    onSaveOffers={handleSaveOffers}
                    onBusinessResolved={(business) => {
                      try { localStorage.setItem(STAFF_SALON_KEY, business.id); } catch { /* keep in memory */ }
                      setStaffSalon((current) => ({
                        ...current,
                        id: business.id,
                        name: business.name,
                        mainCategoryId: business.mainCategoryId,
                      }));
                    }}
                  />
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Floating Push Notification Toast Banner */}
      <PushNotificationToast
        notification={activeToast}
        onDismiss={() => setActiveToast(null)}
        onView={() => {
          setCurrentScreen(userEntry ? 'tracking' : completedList.some((item) => item.sessionId === customerSessionId.current) ? 'complete' : 'home');
          if (!PACKAGED_MODE && viewMode === 'staff') setViewMode('split');
        }}
      />

      {/* Developer/QA notification console.
          This modal is the one surface that still carries push diagnostics
          (device permission state, simulated triggers, raw alert log). It is
          therefore explicitly NOT part of the packaged Customer app: the
          customer's Alerts destination is the real persisted Notification
          inbox screen inside CustomerApp. Gating it here — rather than
          deleting it — keeps the diagnostics available on the dev/split
          workspace without ever shipping test UI to a customer build. */}
      <NotificationCenterModal
        isOpen={PACKAGED_MODE !== 'customer' && isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        permissionStatus={permissionStatus}
        onRequestPermission={handleRequestPermission}
        onSendTestNotification={handleTestNotification}
        onClearAll={() => setNotifications([])}
      />

      {/* OTP Verification Modal */}
      <OtpModal
        isOpen={isOtpOpen}
        onClose={() => {
          setIsOtpOpen(false);
          setPendingOtpAction(null);
        }}
        pendingAction={pendingOtpAction}
        onVerifySuccess={handleOtpVerifySuccess}
      />

      {/* Booking verification gate: opens instead of the join sheet when the
          customer tapped Join Queue without a verified, complete profile.
          Success continues straight into the same pending booking below. */}
      {bookingGateOpen && (() => {
        const gate = resolveAppReadiness(customerAuth, customerProfile, { profileLoading });
        if (gate.kind !== 'onboarding_required') return null;
        return (
          <div className="fixed inset-0 z-[95] bg-[#F8FAFA]">
            <AccountOnboarding
              gate={gate}
              onVerified={(auth) => { saveCustomerAuth(auth); setCustomerAuth(auth); }}
              onProfileSaved={(profile) => {
                setCustomerProfile(profile);
                setProfileError('');
                setBookingGateOpen(false);
                setJoinSheetError('');
                setIsJoinSheetOpen(true);
              }}
              onCancel={() => setBookingGateOpen(false)}
              intro={{
                eyebrow: 'Verify to book',
                title: 'One quick check before we hold your spot.',
                description: "Verify your mobile number, then add your name and gender so the salon can call you when it's your turn.",
              }}
            />
          </div>
        );
      })()}

      {/* Queue-join sheet: opens once a customer is verified and ready. */}
      <QueueJoinSheet
        open={isJoinSheetOpen}
        salon={customerSalon}
        services={chosenServicesFor()}
        barbers={barbers}
        queue={queue}
        busy={joinSheetBusy}
        error={joinSheetError}
        customerName={customerProfile?.name}
        offers={customerSalon.offers || []}
        appliedOfferId={appliedOfferId}
        onApplyOffer={handleApplyOffer}
        onRemoveOffer={handleRemoveOffer}
        onClose={() => { setIsJoinSheetOpen(false); setJoinSheetError(''); }}
        onConfirm={(preferredBarberId) => void confirmJoinFromSheet(preferredBarberId)}
      />
    </div>
  );
}
