import React, { useState, useEffect, useRef } from 'react';
import { QueueItem, Barber, Salon, ViewMode, CustomerScreen, OtpAction, PushNotification } from './types';
import { SALONS, INITIAL_BARBERS, INITIAL_QUEUE } from './data/mockData';
import { Header } from './components/Header';
import { CustomerApp } from './components/CustomerApp';
import { StaffDashboard } from './components/StaffDashboard';
import { OtpModal } from './components/OtpModal';
import { PushNotificationToast } from './components/PushNotificationToast';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import {
  getNotificationPermissionStatus,
  requestPushPermission,
  dispatchWebPushNotification,
} from './services/notificationService';

const STORAGE_KEY = 'no_wait_salon_mvp_v2';
const NOTIFICATIONS_STORAGE_KEY = 'no_wait_salon_notifications_v1';

export default function App() {
  // State Initialization from LocalStorage or Defaults
  const [salons] = useState<Salon[]>(SALONS);
  const [selectedSalon, setSelectedSalon] = useState<Salon>(SALONS[0]);
  const [selectedService, setSelectedService] = useState<string>('Haircut');
  const [currentScreen, setCurrentScreen] = useState<CustomerScreen>('home');
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  const [queue, setQueue] = useState<QueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.queue)) return parsed.queue;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_QUEUE;
  });

  const [barbers, setBarbers] = useState<Barber[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.barbers)) return parsed.barbers;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_BARBERS;
  });

  const [completedList, setCompletedList] = useState<QueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.completedList)) return parsed.completedList;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [queueAlert, setQueueAlert] = useState<string>('');

  // OTP Modal State
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [pendingOtpAction, setPendingOtpAction] = useState<OtpAction | null>(null);

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

  // Set of already fired notification trigger keys to prevent repeated spam
  const sentNotificationsRef = useRef<Set<string>>(new Set());

  // Sync state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          queue,
          barbers,
          completedList,
          selectedService,
        })
      );
    } catch (e) {
      console.error(e);
    }
  }, [queue, barbers, completedList, selectedService]);

  // Sync notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    } catch (e) {
      console.error(e);
    }
  }, [notifications]);

  // Find user's active entry in queue if any
  const userEntry = queue.find((item) => item.isUser) || null;

  // Auto-redirect to tracking screen if user is in queue and on salon/slots
  useEffect(() => {
    if (userEntry && (currentScreen === 'slots' || currentScreen === 'salon')) {
      setCurrentScreen('tracking');
    }
  }, [userEntry]);

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

  // Periodic check for expired called customers (10 min timeout)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setQueue((prevQueue) => {
        let hasChanges = false;
        const updated = prevQueue.filter((item) => {
          if (item.status === 'Called' && item.calledAt && now - item.calledAt > 10 * 60 * 1000) {
            hasChanges = true;
            // Free the barber
            if (item.barberIndex !== undefined) {
              setBarbers((prevB) => {
                const bCopy = [...prevB];
                if (bCopy[item.barberIndex!]) {
                  bCopy[item.barberIndex!].status = 'available';
                  bCopy[item.barberIndex!].currentCustomerName = undefined;
                }
                return bCopy;
              });
            }
            return false; // remove as no-show
          }
          return true;
        });
        return hasChanges ? updated : prevQueue;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // --- Handlers ---
  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    sentNotificationsRef.current.clear();
    setQueue(INITIAL_QUEUE);
    setBarbers(INITIAL_BARBERS);
    setCompletedList([]);
    setSelectedService('Haircut');
    setCurrentScreen('home');
    setQueueAlert('');
    triggerPushNotification(
      '🔄 Salon State Reset',
      'Initial demo queue restored with live push notification triggers.',
      'general'
    );
  };

  const handleBarberToggle = (barberIndex: number) => {
    setBarbers((prev) => {
      const updated = [...prev];
      const barber = updated[barberIndex];
      if (!barber || barber.status === 'busy') return prev;

      updated[barberIndex] = {
        ...barber,
        status: barber.status === 'available' ? 'unavailable' : 'available',
      };
      return updated;
    });
  };

  const handleAddWalkin = (
    name: string,
    phone: string,
    service: string,
    startImmediately = false,
    selectedBarberIndex?: number
  ) => {
    let assignedIndex = selectedBarberIndex;
    if (assignedIndex === undefined || barbers[assignedIndex]?.status !== 'available') {
      assignedIndex = barbers.findIndex((b) => b.status === 'available');
    }

    if (startImmediately && assignedIndex >= 0) {
      const assignedBarber = barbers[assignedIndex];
      // Set barber to busy
      setBarbers((prev) => {
        const updated = [...prev];
        updated[assignedIndex!] = {
          ...assignedBarber,
          status: 'busy',
          currentCustomerName: name,
        };
        return updated;
      });

      const newServingEntry: QueueItem = {
        id: `walkin-${Date.now()}`,
        name,
        phone,
        service,
        status: 'Serving',
        barberIndex: assignedIndex,
        barberName: assignedBarber.name,
        isUser: false,
        createdAt: Date.now(),
        estimatedDurationMin: 30,
      };

      setQueue((prev) => [...prev, newServingEntry]);
      setQueueAlert('');
      triggerPushNotification(
        `✂️ ${assignedBarber.name} Started Service`,
        `Directly seated ${name} for ${service}.`,
        'serving'
      );
      return;
    }

    const preferredBarber =
      selectedBarberIndex !== undefined ? barbers[selectedBarberIndex]?.name : undefined;

    const newEntry: QueueItem = {
      id: `walkin-${Date.now()}`,
      name,
      phone,
      service,
      status: 'Waiting',
      barberName: preferredBarber,
      isUser: false,
      createdAt: Date.now(),
      estimatedDurationMin: 30,
    };
    setQueue((prev) => [...prev, newEntry]);
    setQueueAlert('');
  };

  const handleQueueAction = (
    item: QueueItem,
    action: 'Call' | 'Start' | 'Complete' | 'No-show' | 'Remove',
    specificBarberIndex?: number
  ) => {
    if (action === 'Call') {
      let availableIndex = specificBarberIndex;
      if (availableIndex === undefined || barbers[availableIndex]?.status !== 'available') {
        availableIndex = barbers.findIndex((b) => b.status === 'available');
      }

      if (availableIndex < 0) {
        setQueueAlert('No barber is currently available. Please toggle a barber to available or finish an in-progress service.');
        return;
      }
      setQueueAlert('');

      const assignedBarber = barbers[availableIndex];

      // Update Barber to busy
      setBarbers((prev) => {
        const updated = [...prev];
        updated[availableIndex!] = {
          ...assignedBarber,
          status: 'busy',
          currentCustomerName: item.name,
        };
        return updated;
      });

      // Update Queue item to Called
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: 'Called',
                barberIndex: availableIndex,
                barberName: assignedBarber.name,
                calledAt: Date.now(),
              }
            : q
        )
      );

      // If called customer is the user, trigger instant push notification
      if (item.isUser) {
        triggerPushNotification(
          `🔔 ${selectedSalon.name}: Barber ${assignedBarber.name} is Ready!`,
          `Your styling station is open. Please step inside to be seated.`,
          'called'
        );
      }
    } else if (action === 'Start') {
      // If item was in Waiting state and has no barber assigned yet, assign an available barber
      let barberIndex = item.barberIndex;
      let barberName = item.barberName;

      if (barberIndex === undefined) {
        const availIdx = barbers.findIndex((b) => b.status === 'available');
        if (availIdx < 0) {
          setQueueAlert('No barber is currently available. Free a chair first to start service.');
          return;
        }
        barberIndex = availIdx;
        barberName = barbers[availIdx].name;

        // Set barber to busy
        setBarbers((prev) => {
          const updated = [...prev];
          updated[availIdx] = {
            ...updated[availIdx],
            status: 'busy',
            currentCustomerName: item.name,
          };
          return updated;
        });
      }

      setQueueAlert('');
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: 'Serving',
                barberIndex,
                barberName,
              }
            : q
        )
      );

      if (item.isUser) {
        triggerPushNotification(
          `✂️ ${selectedSalon.name}: Service In Progress`,
          `You are now being served by Barber ${barberName || 'Arjun'}. Enjoy your cut!`,
          'serving'
        );
      }
    } else if (action === 'Complete') {
      setQueueAlert('');
      // Free the barber
      if (item.barberIndex !== undefined) {
        setBarbers((prev) => {
          const updated = [...prev];
          if (updated[item.barberIndex!]) {
            updated[item.barberIndex!] = {
              ...updated[item.barberIndex!],
              status: 'available',
              currentCustomerName: undefined,
            };
          }
          return updated;
        });
      }

      // Remove from queue and add to completedList
      setQueue((prev) => prev.filter((q) => q.id !== item.id));
      setCompletedList((prev) => [
        { ...item, status: 'Completed' },
        ...prev.slice(0, 19),
      ]);

      if (item.isUser) {
        triggerPushNotification(
          `🎉 ${selectedSalon.name}: Service Complete!`,
          `Your ${item.service} is finished. Thank you for visiting! Have a wonderful day.`,
          'general'
        );
      }
    } else if (action === 'No-show' || action === 'Remove') {
      setQueueAlert('');
      // Free the barber if one was occupied
      if (item.barberIndex !== undefined) {
        setBarbers((prev) => {
          const updated = [...prev];
          if (updated[item.barberIndex!]) {
            updated[item.barberIndex!] = {
              ...updated[item.barberIndex!],
              status: 'available',
              currentCustomerName: undefined,
            };
          }
          return updated;
        });
      }
      setQueue((prev) => prev.filter((q) => q.id !== item.id));
    }
  };

  const handleJoinClick = () => {
    if (userEntry) {
      setCurrentScreen('tracking');
      return;
    }
    setPendingOtpAction({ type: 'join', serviceName: selectedService });
    setIsOtpOpen(true);
  };

  const handleSelectSlotClick = (slot: string) => {
    if (userEntry) {
      setCurrentScreen('tracking');
      return;
    }
    setPendingOtpAction({ type: 'slot', slot, serviceName: selectedService });
    setIsOtpOpen(true);
  };

  const handleOtpVerifySuccess = (verifiedPhone: string) => {
    setIsOtpOpen(false);
    if (!pendingOtpAction) return;

    if (pendingOtpAction.type === 'join') {
      const newUserEntry: QueueItem = {
        id: `user-${Date.now()}`,
        name: 'You',
        phone: verifiedPhone,
        service: pendingOtpAction.serviceName,
        status: 'Waiting',
        isUser: true,
        createdAt: Date.now(),
        estimatedDurationMin: 30,
      };
      setQueue((prev) => [...prev, newUserEntry]);

      // Push notification for ticket confirmation
      triggerPushNotification(
        `🎟️ ${selectedSalon.name}: Live Ticket Confirmed`,
        `You've joined the queue for ${pendingOtpAction.serviceName}. We'll notify you 10–15 mins before your turn!`,
        'confirmed'
      );
    } else if (pendingOtpAction.type === 'slot') {
      const newSlotEntry: QueueItem = {
        id: `user-slot-${Date.now()}`,
        name: 'You',
        phone: verifiedPhone,
        service: pendingOtpAction.serviceName,
        status: 'Reserved',
        reservedFor: pendingOtpAction.slot,
        isUser: true,
        createdAt: Date.now(),
        estimatedDurationMin: 30,
      };
      setQueue((prev) => [...prev, newSlotEntry]);

      // Push notification for slot reservation
      triggerPushNotification(
        `⏰ ${selectedSalon.name}: Slot Reserved (${pendingOtpAction.slot})`,
        `Your reservation for ${pendingOtpAction.serviceName} is locked. We'll send a push reminder 15 minutes prior!`,
        'reserved_nearing'
      );
    }

    setPendingOtpAction(null);
    setCurrentScreen('tracking');
  };

  const handleCancelUserQueue = () => {
    if (userEntry?.barberIndex !== undefined && userEntry.status !== 'Waiting') {
      setBarbers((prev) => {
        const updated = [...prev];
        if (updated[userEntry.barberIndex!]) {
          updated[userEntry.barberIndex!] = {
            ...updated[userEntry.barberIndex!],
            status: 'available',
            currentCustomerName: undefined,
          };
        }
        return updated;
      });
    }
    setQueue((prev) => prev.filter((item) => !item.isUser));
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

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] flex flex-col justify-between selection:bg-[#5A5A40]/20 selection:text-[#1A1A1A] font-sans">
      <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col">
        {/* Top Header */}
        <Header
          viewMode={viewMode}
          setViewMode={setViewMode}
          onReset={handleReset}
          notificationCount={notifications.filter((n) => !n.read).length}
          onOpenNotifications={() => setIsNotificationCenterOpen(true)}
          permissionStatus={permissionStatus}
        />

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
              className="flex flex-col bg-white rounded-3xl border border-[#E5E5DF] shadow-md overflow-hidden min-h-[640px] max-h-[820px] transition-all"
            >
              {/* Window Header */}
              <div className="px-5 py-4 border-b border-[#E5E5DF] flex items-center justify-between bg-[#FAF9F6]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#5A5A40]"></span>
                  <h2 className="font-serif text-sm font-bold text-[#1A1A1A] tracking-tight">
                    Customer Experience
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {permissionStatus === 'granted' && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[#5A5A40]/10 text-[#5A5A40] flex items-center gap-1">
                      Push Active
                    </span>
                  )}
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#E8F0E6] text-[#3D6B37] tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3D6B37] animate-ping"></span>
                    Live Queue
                  </span>
                </div>
              </div>

              {/* Customer Body */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <CustomerApp
                  currentScreen={currentScreen}
                  setScreen={setCurrentScreen}
                  selectedSalon={selectedSalon}
                  setSelectedSalon={setSelectedSalon}
                  selectedService={selectedService}
                  setSelectedService={setSelectedService}
                  queue={queue}
                  barbers={barbers}
                  userEntry={userEntry}
                  onJoinClick={handleJoinClick}
                  onSelectSlotClick={handleSelectSlotClick}
                  onCancelQueue={handleCancelUserQueue}
                  permissionStatus={permissionStatus}
                  onRequestPermission={handleRequestPermission}
                  onTestPush={handleTestNotification}
                />
              </div>
            </section>
          )}

          {/* Panel 2: Staff / Salon Dashboard Window */}
          {(viewMode === 'split' || viewMode === 'staff') && (
            <section
              id="staff-dashboard-window"
              className="flex flex-col bg-white rounded-3xl border border-[#E5E5DF] shadow-md overflow-hidden min-h-[640px] max-h-[820px] transition-all"
            >
              {/* Window Header */}
              <div className="px-5 py-4 border-b border-[#E5E5DF] flex items-center justify-between bg-[#FAF9F6]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#5A5A40]"></span>
                  <h2 className="font-serif text-sm font-bold text-[#1A1A1A] tracking-tight">
                    Salon Staff Dashboard
                  </h2>
                </div>
                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] tracking-wider">
                  Sync Active
                </span>
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
          setCurrentScreen('tracking');
          if (viewMode === 'staff') setViewMode('split');
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
    </div>
  );
}
