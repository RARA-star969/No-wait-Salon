import React, { useState, useEffect, useRef } from 'react';
import { QueueItem, Barber, Salon, ViewMode, CustomerScreen, OtpAction, PushNotification, CustomerAuthSession, CustomerProfile } from './types';
import { SALONS, INITIAL_BARBERS, INITIAL_QUEUE } from './data/mockData';
import { fetchSalonProfile } from './services/salonDiscoveryService';
import { Header } from './components/Header';
import { CustomerApp } from './components/CustomerApp';
import { PublicSalonPage } from './components/PublicSalonPage';
import { salonDiscoveryService, type SalonDirectoryEntry } from './services/salonDiscoveryService';

const STAFF_SALON_KEY = 'no_wait_salon_staff_salon_id';
import { StaffDashboard } from './components/StaffDashboard';
import { OtpModal } from './components/OtpModal';
import { PushNotificationToast } from './components/PushNotificationToast';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import {
  getNotificationPermissionStatus,
  requestPushPermission,
  dispatchWebPushNotification,
  playNotificationChime,
} from './services/notificationService';
import { realtimeQueueService, type SalonSnapshot } from './services/realtimeQueueService';
import { customerAccountService, loadCustomerAuth, saveCustomerAuth } from './services/customerAccountService';
import { businessQrService } from './services/businessQrService';
import { fireTurnAlert } from './services/turnAlertService';
import { resolveAppReadiness } from './shared/profileReadiness';
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
  const [selectedSalon, setSelectedSalon] = useState<Salon>(SALONS[0]);
  const [selectedService, setSelectedService] = useState<string>('Haircut');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [currentScreen, setCurrentScreen] = useState<CustomerScreen>('home');
  const qrRouteMatch = window.location.pathname.match(/^\/q\/([^/]+)\/?$/);
  const isQrRoute = Boolean(qrRouteMatch);
  // A plain phone camera lands here in a browser: serve the public salon page.
  // The packaged Android app keeps its existing in-app scanner flow.
  const publicQrToken = !PACKAGED_MODE && qrRouteMatch ? decodeURIComponent(qrRouteMatch[1]) : null;
  const [viewMode, setViewMode] = useState<ViewMode>(isQrRoute ? 'customer' : PACKAGED_MODE || 'split');
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
      setSelectedSalon((current) => (current.id === chosen.id ? current : { ...current, id: chosen.id, name: chosen.name }));
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

  // Urgent "it's your turn" popup — the guaranteed in-app surface for the
  // Called transition, mirroring the public QR web page. Reset whenever the
  // active entry changes identity or leaves the Called phase, so it never
  // survives to the next booking or reappears on an SSE reconnect replay.
  const [showTurnPopup, setShowTurnPopup] = useState(false);

  const applySnapshot = (snapshot: SalonSnapshot) => {
    setQueue(snapshot.queue);
    setBarbers(snapshot.barbers);
    setCompletedList(snapshot.completedList);
    setQueueAlert('');
  };

  useEffect(() => {
    let disposed = false;
    realtimeQueueService.getState(selectedSalon.id)
      .then((snapshot) => !disposed && applySnapshot(snapshot))
      .catch((error) => !disposed && setQueueAlert(error instanceof Error ? error.message : 'Unable to load the live queue.'));
    const unsubscribe = realtimeQueueService.subscribe(
      selectedSalon.id,
      (snapshot) => !disposed && applySnapshot(snapshot),
      (connected) => {
        if (!disposed && !connected) setQueueAlert('Live connection interrupted. Reconnecting…');
      }
    );
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [selectedSalon.id]);

  // Keep the selected salon's profile identical to what the public web page
  // would show for it: re-read the server record whenever the salon changes.
  useEffect(() => {
    let disposed = false;
    fetchSalonProfile(selectedSalon.id)
      .then((fresh) => {
        if (disposed || !fresh) return;
        setSelectedSalon((current) => (current.id === fresh.id ? { ...current, ...fresh } : current));
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [selectedSalon.id]);

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
    salonName = selectedSalon.name
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

  /**
   * Background join-success feedback: adds a notification-center entry and,
   * where permission is already granted, an Android system notification —
   * never an in-app toast/banner (no `setActiveToast`), so nothing overlays
   * the screen the customer is already looking at.
   */
  const notifyJoinSuccessQuietly = (title: string, body: string, salonName = selectedSalon.name) => {
    const notif: PushNotification = {
      id: `push-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      body,
      timestamp: Date.now(),
      type: 'confirmed',
      salonName,
      read: false,
    };
    setNotifications((prev) => [notif, ...prev.slice(0, 30)]);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notif.title, { body: notif.body, tag: notif.id });
      } catch {
        // Native notification is a nice-to-have here; the notification-center entry above already recorded it.
      }
    }
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
            `✂️ ${selectedSalon.name}: You're Almost Up!`,
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
          `🔔 ${selectedSalon.name}: Barber Ready!`,
          `Barber ${userEntry.barberName || 'Arjun'} is ready for you at the styling chair. Please step inside now!`,
          'called'
        );
        // Same in-page alert channel (vibration + chime) as the public QR web
        // page, plus the urgent full-screen popup so a customer with the app
        // open never misses the edge into Called.
        fireTurnAlert(selectedSalon.name, userEntry.service);
        setShowTurnPopup(true);
      }
    }

    // 3. Check if user has Reserved Slot nearing
    if (userEntry.status === 'Reserved' && userEntry.reservedFor) {
      const triggerKey = `${userEntry.id}-slot-nearing`;
      if (!sentNotificationsRef.current.has(triggerKey)) {
        sentNotificationsRef.current.add(triggerKey);
        triggerPushNotification(
          `⏰ ${selectedSalon.name}: Reserved Slot Approaching`,
          `Your reserved slot for ${userEntry.reservedFor} is in 15 minutes! Please head to the salon check-in counter.`,
          'reserved_nearing'
        );
      }
    }
  }, [queue, userEntry, selectedSalon]);

  // The popup is dismissed by "I'm on my way" below, but also auto-clears the
  // instant the entry stops being Called (staff called again, cancelled it,
  // or it moved on) so it can never linger over a stale state.
  useEffect(() => {
    if (!userEntry || userEntry.status !== 'Called') setShowTurnPopup(false);
  }, [userEntry?.id, userEntry?.status]);

  // --- Handlers ---
  const runCommand = async (command: Parameters<typeof realtimeQueueService.command>[1]) => {
    try {
      const snapshot = await realtimeQueueService.command(selectedSalon.id, command);
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
        triggerPushNotification(`🔔 ${selectedSalon.name}: Barber ${updated?.barberName || 'Ready'} is Ready!`, 'Your styling station is open. Please step inside to be seated.', 'called');
      } else if (action === 'Start') {
        triggerPushNotification(`✂️ ${selectedSalon.name}: Service In Progress`, 'You are now being served. Enjoy your cut!', 'serving');
      } else if (action === 'Complete') {
        setCurrentScreen('complete');
        triggerPushNotification(`🎉 ${selectedSalon.name}: Service Complete!`, `Your ${item.service} is finished. Thank you for visiting!`, 'general');
      }
    });
  };

  /** Services chosen so far, falling back to the legacy single-select name. */
  const chosenServicesFor = () => {
    const chosen = selectedSalon.services.filter((item) => selectedServiceIds.includes(item.id));
    if (chosen.length) return chosen;
    const fallback = selectedSalon.services.find((item) => item.name === selectedService);
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

  const handleSelectSlotClick = (slot: string) => {
    if (userEntry) {
      setCurrentScreen('tracking');
      return;
    }
    setPendingOtpAction({ type: 'slot', slot, serviceName: selectedService });
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
        const snapshot = await realtimeQueueService.command(selectedSalon.id, {
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
          },
        });
        applySnapshot(snapshot);
      }
      setIsJoinSheetOpen(false);
      // A successful join is a routine, expected outcome — not an urgent
      // event — so it gets a light, one-shot chime + haptic + a quiet
      // background notification, and goes straight to the Live Ticket,
      // never a large confirmation popup or in-app toast. This block runs
      // only once, directly off this join-success promise resolving — never
      // off derived queue state — so it can never repeat from an SSE
      // reconnect, a rerender, or a later restore of an already-joined ticket.
      playNotificationChime();
      try { navigator.vibrate?.(60); } catch { /* unsupported or blocked */ }
      notifyJoinSuccessQuietly(
        `${selectedSalon.name}: You're in the queue`,
        `${chosenServices.map((item) => item.name).join(' + ')} · position confirmed.`,
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
      `⏰ ${selectedSalon.name}: Slot Reserved (${action.slot})`,
      `Your reservation for ${action.serviceName} is locked.`,
      'reserved_nearing'
    );
    setPendingOtpAction(null);
    setCurrentScreen('tracking');
  };

  /** "I'm on my way": records the acknowledgement server-side. The arrival
   *  deadline staff set is never moved by this — only the ack timestamp. */
  const acknowledgeTurn = () => {
    setShowTurnPopup(false);
    if (userEntry) void runCommand({ type: 'queue_action', itemId: userEntry.id, action: 'Acknowledge' });
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
      `ℹ️ ${selectedSalon.name}: Queue Cancelled`,
      `Your position in the live queue has been released.`,
      'general'
    );
  };

  const handleTestNotification = (type: 'approaching' | 'called' | 'reserved_nearing') => {
    if (type === 'approaching') {
      triggerPushNotification(
        `✂️ ${selectedSalon.name}: You're Almost Up!`,
        `Only 1 person ahead (~10–15 mins remaining). Please start heading over to the salon entrance.`,
        'approaching'
      );
    } else if (type === 'called') {
      triggerPushNotification(
        `🔔 ${selectedSalon.name}: Barber Arjun is Ready!`,
        `Your counter is ready now! Please step inside the salon within 10 minutes.`,
        'called'
      );
    } else if (type === 'reserved_nearing') {
      triggerPushNotification(
        `⏰ ${selectedSalon.name}: Reserved Slot Approaching`,
        `Your reserved arrival slot (${userEntry?.reservedFor || '4:30 PM'}) is in 15 minutes! Please head to the counter.`,
        'reserved_nearing'
      );
    }
  };

  // Scanned with a plain phone camera: render the standalone public salon page
  // instead of the full app shell, so no install or onboarding is required.
  if (publicQrToken) {
    return (
      <div className="min-h-screen bg-[#F8FAFA] font-sans text-[#17201F]">
        <PublicSalonPage token={publicQrToken} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#F4F7F6] font-sans text-[#17201F] selection:bg-[#0F766E]/20 selection:text-[#17201F]">
      <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col">
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
          className={`grid gap-5 sm:gap-6 flex-1 items-start ${
            viewMode === 'split'
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1 max-w-xl mx-auto w-full'
          }`}
        >
          {/* Panel 1: Customer Mobile App Window */}
          {(viewMode === 'split' || viewMode === 'customer') && (
            <section
              id="customer-app-window"
              className="flex min-h-[640px] max-h-[820px] flex-col overflow-hidden rounded-2xl border border-[#DDE5E3] bg-white transition-all"
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
              <div className="flex-1 overflow-hidden flex flex-col">
                <CustomerApp
                  currentScreen={currentScreen}
                  setScreen={setCurrentScreen}
                  selectedSalon={selectedSalon}
                  setSelectedSalon={setSelectedSalon}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                  selectedServiceIds={selectedServiceIds}
                  setSelectedServiceIds={setSelectedServiceIds}
                  queue={queue}
                  barbers={barbers}
                  userEntry={userEntry}
                  completedEntry={completedList.find((item) => item.sessionId === customerSessionId.current) || null}
                  onJoinClick={handleJoinClick}
                  onSelectSlotClick={handleSelectSlotClick}
                  onCancelQueue={handleCancelUserQueue}
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
                  showTurnPopup={showTurnPopup}
                  onAcknowledgeTurn={acknowledgeTurn}
                />
              </div>
            </section>
          )}

          {/* Panel 2: Staff / Salon Dashboard Window */}
          {(viewMode === 'split' || viewMode === 'staff') && (
            <section
              id="staff-dashboard-window"
              className="flex min-h-[640px] max-h-[820px] flex-col overflow-hidden rounded-2xl border border-[#DDE5E3] bg-white transition-all"
            >
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-[#E1E7E6] bg-white px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-[#14B8A6]"></span>
                  <h2 className="font-sans text-sm font-bold text-[#17201F] tracking-tight">
                    Salon Staff Dashboard
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {isStaffSurface && salonDirectory.length > 0 && (
                    <select
                      aria-label="Select salon"
                      value={selectedSalon.id}
                      onChange={(event) => {
                        const entry = salonDirectory.find((item) => item.id === event.target.value);
                        if (!entry) return;
                        try { localStorage.setItem(STAFF_SALON_KEY, entry.id); } catch { /* keep in memory */ }
                        setSelectedSalon((current) => ({ ...current, id: entry.id, name: entry.name }));
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

              {/* Staff Body */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <StaffDashboard
                  salon={selectedSalon}
                  queue={queue}
                  barbers={barbers}
                  completedList={completedList}
                  onBarberToggle={handleBarberToggle}
                  onAddWalkin={handleAddWalkin}
                  onQueueAction={handleQueueAction}
                  queueAlert={queueAlert}
                />
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

      {/* Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
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
        salon={selectedSalon}
        services={chosenServicesFor()}
        barbers={barbers}
        queue={queue}
        busy={joinSheetBusy}
        error={joinSheetError}
        customerName={customerProfile?.name}
        customerAvatarUrl={customerProfile?.profilePhotoUrl || undefined}
        onClose={() => { setIsJoinSheetOpen(false); setJoinSheetError(''); }}
        onConfirm={(preferredBarberId) => void confirmJoinFromSheet(preferredBarberId)}
      />
    </div>
  );
}
