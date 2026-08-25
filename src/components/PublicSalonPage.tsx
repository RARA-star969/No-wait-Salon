import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  LoaderCircle,
  MapPin,
  Radio,
  Scissors,
  Smartphone,
  Sparkles,
  Star,
  User,
  Building2,
} from 'lucide-react';
import type { Barber, CustomerAuthSession, CustomerProfile, QueueItem } from '../types';
import { businessQrService, type QrBusiness } from '../services/businessQrService';
import { realtimeQueueService } from '../services/realtimeQueueService';
import { customerAccountService, loadCustomerAuth, saveCustomerAuth } from '../services/customerAccountService';
import { callPhase, canCancel, formatCountdown, remainingMs } from '../shared/queueTiming';
import { CancelBookingSheet } from './CancelBookingSheet';
import { toSalonProfile, waitLabel } from '../shared/salonProfile';
import { LiveQueueCard, type QueueTrend } from './LiveQueueCard';
import { filterServices, selectionTotals, SERVICE_FILTERS, type ServiceFilter } from '../shared/serviceSelection';
import { resolveAppReadiness } from '../shared/profileReadiness';
import { QueueJoinSheet } from './QueueJoinSheet';
import { SalonDetailPage } from './SalonDetailPage';
import {
  fireTurnAlert,
  notificationPermission,
  primeTurnAlert,
  requestTurnNotifications,
} from '../services/turnAlertService';

const WEB_SESSION_KEY = 'no_wait_salon_web_qr_session';

type Step = 'salon' | 'phone' | 'otp' | 'profile' | 'queued';

const webSessionId = (): string => {
  try {
    const existing = localStorage.getItem(WEB_SESSION_KEY);
    if (existing) return existing;
    const created = globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(WEB_SESSION_KEY, created);
    return created;
  } catch {
    return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

/** Flat teal top bar shared by every step of the public web page. */
const TopBar: React.FC<{ onOpenApp: () => void }> = ({ onOpenApp }) => (
  <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0F6E63] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm">
    <span className="flex items-center gap-1.5 text-[13px] font-extrabold tracking-[0.06em] text-white">
      <Scissors className="h-4 w-4" />
      NO-WAIT SALON
    </span>
    <button
      type="button"
      onClick={onOpenApp}
      className="rounded-full border border-white/40 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/10"
    >
      Open in app
    </button>
  </header>
);

/**
 * Public mobile page reached by scanning a salon QR with a plain phone camera.
 * Uses the exact same SalonDetailPage view-model / components as CustomerApp
 * for single source of truth and complete token journey.
 */
export const PublicSalonPage: React.FC<{ token: string }> = ({ token }) => {
  const [business, setBusiness] = useState<QrBusiness | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>('salon');
  const [auth, setAuth] = useState<CustomerAuthSession | null>(() => loadCustomerAuth());
  const [selectedService, setSelectedService] = useState('Haircut');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [appliedOfferId, setAppliedOfferId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [entry, setEntry] = useState<QueueItem | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [completedList, setCompletedList] = useState<QueueItem[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersActive, setBarbersActive] = useState(1);
  const [barbersAvailable, setBarbersAvailable] = useState(1);
  const [restoring, setRestoring] = useState(true);
  const [showTurnPopup, setShowTurnPopup] = useState(false);
  const [notifyState, setNotifyState] = useState(notificationPermission());
  const [now, setNow] = useState(() => Date.now());
  const [cancelOpen, setCancelOpen] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const sessionId = useRef(webSessionId());
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    businessQrService
      .resolve(token)
      .then(({ business: resolved }) => {
        if (cancelled) return;
        setBusiness(resolved);
        void businessQrService.recordVisit(token, { appCtaShown: false });
      })
      .catch((reason: unknown) => {
        if (!cancelled) setLoadError(reason instanceof Error ? reason.message : 'This QR is not linked to an active business.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Live queue for this salon only over existing SSE stream
  useEffect(() => {
    if (!business) return;
    const apply = (state: { queue: QueueItem[]; barbers?: Barber[]; completedList?: QueueItem[] }) => {
      setQueue(state.queue);
      setCompletedList(state.completedList || []);
      if (state.barbers) {
        setBarbers(state.barbers);
        setBarbersActive(state.barbers.filter((b) => b.status !== 'unavailable').length || 1);
        setBarbersAvailable(state.barbers.filter((b) => b.status === 'available').length);
      }
      setEntry((current) => {
        if (!current) return current;
        return (
          state.queue.find((item) => item.id === current.id) ||
          state.completedList?.find((item) => item.id === current.id) ||
          current
        );
      });
      setRestoring(false);
    };
    realtimeQueueService.getState(business.id).then(apply).catch(() => setRestoring(false));
    const unsubscribe = realtimeQueueService.subscribe(business.id, apply, () => undefined);
    return unsubscribe;
  }, [business]);

  // Restore active booking across refresh / reopen
  useEffect(() => {
    if (!business || entry || step !== 'salon') return;
    const allItems = [...queue, ...completedList];
    const mine = allItems.find(
      (item) => item.sessionId === sessionId.current || (auth && item.customerId === auth.customerId),
    );
    if (!mine) return;
    setEntry(mine);
    lastStatus.current = mine.status;
    setStep('queued');
  }, [business, entry, queue, completedList, auth, step]);

  // Ticking clock for arrival countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Alert when staff calls customer
  useEffect(() => {
    if (!entry || !business) return;
    const previous = lastStatus.current;
    lastStatus.current = entry.status;
    if (previous && previous !== 'Called' && entry.status === 'Called') {
      setShowTurnPopup(true);
      fireTurnAlert(business.name, entry.service);
    }
  }, [entry, business]);

  const waiting = queue.filter((item) => item.status === 'Waiting').length;
  const peopleAhead = useMemo(() => {
    if (!entry) return waiting;
    return queue.filter(
      (item) => item.id !== entry.id && ['Waiting', 'Called', 'Serving'].includes(item.status) && item.createdAt < entry.createdAt,
    ).length;
  }, [entry, queue, waiting]);

  const estimatedWaitRange = useMemo(() => {
    if (peopleAhead === 0) return { label: 'Ready now', minutes: 0 };
    const minutes = Math.max(5, Math.ceil((peopleAhead * 15) / Math.max(1, barbersActive)));
    return { label: `${Math.max(5, minutes - 5)}–${minutes + 5} min`, minutes };
  }, [peopleAhead, barbersActive]);

  const estimatedWait = estimatedWaitRange.label;

  const previousAhead = useRef(peopleAhead);
  const [aheadTrend, setAheadTrend] = useState<QueueTrend>('steady');
  useEffect(() => {
    setAheadTrend(peopleAhead < previousAhead.current ? 'down' : peopleAhead > previousAhead.current ? 'up' : 'steady');
    previousAhead.current = peopleAhead;
  }, [peopleAhead]);

  const acknowledgeTurn = () => {
    setShowTurnPopup(false);
    if (business && entry) void businessQrService.acknowledgeCall(business.id, entry.id);
  };

  const cancelBooking = async (reasonCode = 'other', reasonText = '') => {
    if (!business) return;
    setBusy(true);
    setError('');
    try {
      await businessQrService.leaveQueue(business.id, sessionId.current, reasonCode, reasonText);
      setCancelOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not cancel this booking.');
    } finally {
      setBusy(false);
    }
  };

  const rejoin = () => {
    setEntry(null);
    lastStatus.current = null;
    setError('');
    setStep('salon');
  };

  const persistAuth = (session: CustomerAuthSession) => {
    saveCustomerAuth(session);
    setAuth(session);
  };

  const [profileLoading, setProfileLoading] = useState(false);
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    setProfileLoading(true);
    customerAccountService
      .getProfile()
      .then((profile) => {
        if (!cancelled) setCustomerProfile(profile);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.token]);

  const confirmJoin = useCallback(
    async (preferredBarberId: string) => {
      if (!business) return;
      setBusy(true);
      setError('');
      try {
        const result = await businessQrService.join(
          token,
          selectedServiceIds.length > 0 ? selectedServiceIds : [selectedService || 'Haircut'],
          sessionId.current,
          'qr_web',
          preferredBarberId || undefined,
        );
        const joined = result.entry as QueueItem;
        setEntry(joined);
        lastStatus.current = joined?.status || null;
        if (result.state?.queue) setQueue(result.state.queue);
        if (consent) void businessQrService.setMarketingConsent(true);
        void businessQrService.recordVisit(token, { appCtaShown: true });
        setJoinSheetOpen(false);
        setStep('queued');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to join this queue right now.');
      } finally {
        setBusy(false);
      }
    },
    [business, consent, selectedServiceIds, selectedService, token],
  );

  const requestOtp = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await realtimeQueueService.requestOtp(phone.trim());
      setChallengeId(result.challengeId);
      setDemoCode(result.demoCode || '');
      setStep('otp');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    setError('');
    try {
      const verified = await realtimeQueueService.verifyOtp(challengeId, code.trim());
      const session: CustomerAuthSession = {
        token: verified.token,
        customerId: verified.customerId,
        phoneNumber: verified.phone,
      };
      persistAuth(session);
      const profile = await customerAccountService.getProfile().catch(() => null);
      setCustomerProfile(profile);
      if (profile?.name && profile.name.trim().length >= 2) {
        setJoinSheetOpen(true);
        return;
      }
      setStep('profile');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That code did not match. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveProfileAndJoin = async () => {
    if (name.trim().length < 2) return setError('Please enter your name.');
    setBusy(true);
    setError('');
    try {
      const updated = await customerAccountService.updateProfile({
        name: name.trim(),
        email: email.trim(),
        dateOfBirth: '',
        gender: '',
        anniversary: '',
        city: '',
      });
      setCustomerProfile(updated);
      setJoinSheetOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your details.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinClick = useCallback(() => {
    if (!business) return;
    primeTurnAlert();
    const readiness = resolveAppReadiness(auth, customerProfile, profileLoading);
    if (readiness.kind === 'ready') {
      setJoinSheetOpen(true);
    } else if (readiness.kind === 'onboarding_required') {
      if (readiness.reason === 'not_signed_in' || readiness.reason === 'no_verified_phone') {
        setStep('phone');
      } else {
        setStep('profile');
      }
    } else {
      setJoinSheetOpen(true);
    }
  }, [auth, business, customerProfile, profileLoading]);

  const openApp = () => void businessQrService.recordVisit(token, { appCtaShown: true, appCtaClicked: true });

  const salonProfile = useMemo(() => {
    if (!business) return null;
    return toSalonProfile(business, {
      liveWaitMinutes: barbersActive ? Math.ceil((waiting * 15) / barbersActive) : 0,
      waitingCustomers: waiting,
    });
  }, [business, barbersActive, waiting]);

  // Handle Load Errors / Deactivated State
  if (loadError) {
    return (
      <div className="min-h-dvh bg-[#F6F9F8] text-[#17201F]">
        <TopBar onOpenApp={openApp} />
        <main className="mx-auto max-w-md p-6 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Business Unavailable</h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0D5E5E]"
          >
            Retry
          </button>
        </main>
      </div>
    );
  }

  if (!business || !salonProfile) {
    return (
      <div className="min-h-dvh bg-[#F6F9F8] text-[#17201F]">
        <TopBar onOpenApp={openApp} />
        <main className="mx-auto max-w-md py-20 text-center">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#0F766E]" />
          <p className="mt-3 text-sm font-medium text-slate-500">Loading business queue…</p>
        </main>
      </div>
    );
  }

  const isQueued = step === 'queued' && entry;
  const phase = entry ? callPhase(entry, now) : 'waiting';
  const completed = phase === 'completed';
  const inService = phase === 'in_service';
  const noShow = phase === 'no_show';
  const cancelledByStaff = entry?.outcome === 'cancelled_staff';
  const cancelledByCustomer = entry?.outcome === 'cancelled_customer';
  const cancelled = cancelledByStaff || cancelledByCustomer || entry?.status === 'Cancelled';
  const arrivalExpired = phase === 'call_again';
  const countdown = formatCountdown(remainingMs(entry || {}, now));
  const acknowledged = Boolean(entry?.acknowledgedAt);
  const position = peopleAhead + 1;

  return (
    <div className="min-h-dvh bg-[#F6F9F8] text-[#17201F]">
      <TopBar onOpenApp={openApp} />

      {/* ---------------- STEP 1: SALON DETAIL VIEW (100% Shared Component) ---------------- */}
      {step === 'salon' && (
        <SalonDetailPage
          salon={salonProfile}
          nearbySalons={[]}
          queue={queue}
          barbers={barbers}
          selectedService={selectedService}
          setSelectedService={setSelectedService}
          selectedServiceIds={selectedServiceIds}
          setSelectedServiceIds={setSelectedServiceIds}
          appliedOfferId={appliedOfferId}
          onApplyOffer={(id) => setAppliedOfferId(id)}
          onRemoveOffer={() => setAppliedOfferId(null)}
          onBack={openApp}
          onJoin={handleJoinClick}
          onReserve={() => handleJoinClick()}
          userEntry={entry}
          isJoinSheetOpen={joinSheetOpen}
        />
      )}

      {/* ---------------- ONBOARDING STEPS (Phone, OTP, Profile) ---------------- */}
      {step === 'phone' && (
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="rounded-3xl border border-[#E2EAE9] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B9795]">Verification</p>
            <h1 className="mt-1 text-[20px] font-extrabold">Enter your phone number</h1>
            <p className="mt-1 text-xs text-[#667371]">We'll send a code to verify your booking.</p>
            <div className="mt-6 space-y-4">
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#536966]">
                Phone Number
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="h-12 rounded-2xl border border-[#DDE7E5] px-4 text-base font-semibold outline-none focus:border-[#0F766E]"
                />
              </label>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <button
                disabled={busy || phone.trim().length < 8}
                onClick={() => void requestOtp()}
                className="h-12 w-full rounded-2xl bg-[#0F766E] font-bold text-white shadow-sm hover:bg-[#0D5E5E] disabled:opacity-50"
              >
                {busy ? 'Sending code…' : 'Send verification code'}
              </button>
            </div>
          </div>
        </main>
      )}

      {step === 'otp' && (
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="rounded-3xl border border-[#E2EAE9] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B9795]">Verification</p>
            <h1 className="mt-1 text-[20px] font-extrabold">Enter verification code</h1>
            <p className="mt-1 text-xs text-[#667371]">Code sent to {phone}. {demoCode ? `(Demo code: ${demoCode})` : ''}</p>
            <div className="mt-6 space-y-4">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                className="h-12 w-full rounded-2xl border border-[#DDE7E5] px-4 text-center font-mono text-xl font-bold tracking-widest outline-none focus:border-[#0F766E]"
              />
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <button
                disabled={busy || code.trim().length < 4}
                onClick={() => void verifyOtp()}
                className="h-12 w-full rounded-2xl bg-[#0F766E] font-bold text-white shadow-sm hover:bg-[#0D5E5E] disabled:opacity-50"
              >
                {busy ? 'Verifying…' : 'Verify & Continue'}
              </button>
            </div>
          </div>
        </main>
      )}

      {step === 'profile' && (
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="rounded-3xl border border-[#E2EAE9] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B9795]">Customer Details</p>
            <h1 className="mt-1 text-[20px] font-extrabold">What is your name?</h1>
            <p className="mt-1 text-xs text-[#667371]">Staff will use this name when calling your turn.</p>
            <div className="mt-6 space-y-4">
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#536966]">
                Your Full Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="h-12 rounded-2xl border border-[#DDE7E5] px-4 text-base font-semibold outline-none focus:border-[#0F766E]"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#536966]">
                Email (Optional)
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rahul@gmail.com"
                  className="h-12 rounded-2xl border border-[#DDE7E5] px-4 text-base outline-none focus:border-[#0F766E]"
                />
              </label>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <button
                disabled={busy || name.trim().length < 2}
                onClick={() => void saveProfileAndJoin()}
                className="h-12 w-full rounded-2xl bg-[#0F766E] font-bold text-white shadow-sm hover:bg-[#0D5E5E] disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Continue to Queue'}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ---------------- LIVE TICKET / QUEUED VIEW ---------------- */}
      {isQueued && entry && (
        <main className="mx-auto max-w-md px-4 pb-12 pt-4">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#0F766E] text-white shadow-sm">
              {completed ? <CheckCircle2 className="h-7 w-7" /> : <Check className="h-7 w-7" />}
            </div>
            <h1 className="mt-3 text-[19px] font-extrabold tracking-[-0.01em]">
              {cancelledByStaff
                ? 'The salon cancelled your booking'
                : cancelledByCustomer
                  ? 'Booking cancelled'
                  : completed
                    ? 'Service complete'
                    : noShow
                      ? 'You missed your turn'
                      : arrivalExpired
                        ? 'Your arrival window has ended'
                        : phase === 'called'
                          ? acknowledged
                            ? 'On your way'
                            : "It's your turn!"
                          : inService
                            ? 'In service'
                            : "You're in the queue!"}
            </h1>
            <p className="mt-1 text-[13px] text-[#667371]">
              {phase === 'called' || inService || completed || noShow || arrivalExpired || cancelled
                ? `${business.name} · ${entry.service}`
                : "We'll notify you when it's your turn"}
            </p>
          </div>

          <div className="mt-4">
            <LiveQueueCard
              waitLabel={isQueued ? estimatedWait : salonProfile.liveWaitMinutes > 0 ? waitLabel(salonProfile.liveWaitMinutes) : 'Ready now'}
              peopleAhead={peopleAhead}
              peopleAheadTrend={aheadTrend}
              readyChairs={barbersAvailable}
              totalChairs={barbersActive}
              live={business.queueAccepting}
              activityLabel={`${business.name} · ${entry.service}`}
            />
          </div>

          {/* TURN CALL / ACKNOWLEDGEMENT BANNER */}
          {phase === 'called' && !acknowledged && (
            <div className="mt-4 rounded-3xl border border-teal-300 bg-teal-50/90 p-5 shadow-lg animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-600 text-white">
                  <BellRing className="h-5 w-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-extrabold text-teal-950">It's your turn now!</h3>
                  <p className="text-xs text-teal-800">Please arrive within {countdown}.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={acknowledgeTurn}
                className="mt-4 h-12 w-full rounded-2xl bg-teal-700 font-extrabold text-white shadow-md hover:bg-teal-800"
              >
                I'm on my way
              </button>
            </div>
          )}

          {phase === 'called' && acknowledged && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Staff notified that you are on your way!
              </span>
              <span className="font-mono text-emerald-900">{countdown}</span>
            </div>
          )}

          {/* TICKET DETAILS CARD */}
          <div className="mt-4 rounded-3xl border border-[#E2EAE9] bg-white p-5 shadow-sm space-y-3">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Token Number</span>
              <span className="font-mono font-bold text-slate-900">#{entry.id.slice(-4).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Service</span>
              <span className="font-semibold text-slate-900">{entry.service}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Stylist Preference</span>
              <span className="font-semibold text-slate-900">
                {entry.preferredBarberId
                  ? barbers.find((b) => b.id === entry.preferredBarberId)?.name || 'Any Stylist'
                  : 'Any Stylist'}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 border-t pt-3">
              <span>Queue Status</span>
              <span className="font-bold text-teal-700 capitalize">{entry.status}</span>
            </div>
          </div>

          {canCancel(entry.status) && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                Cancel Booking
              </button>
            </div>
          )}

          {(completed || cancelled || noShow) && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={rejoin}
                className="rounded-2xl bg-[#0F766E] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0D5E5E]"
              >
                Book another service
              </button>
            </div>
          )}
        </main>
      )}

      {/* QUEUE JOIN SHEET */}
      {joinSheetOpen && business && (
        <QueueJoinSheet
          isOpen={joinSheetOpen}
          salonName={business.name}
          selectedServices={
            selectedServiceIds.length > 0
              ? selectedServiceIds.map((id) => {
                  const item = (salonProfile.services || []).find((s) => s.id === id);
                  return { id, name: item?.name || id, price: item?.price || 0, duration: item?.duration || 15 };
                })
              : [{ id: 'haircut', name: selectedService || 'Haircut', price: 299, duration: 30 }]
          }
          barbers={barbers}
          busy={busy}
          error={error}
          onClose={() => setJoinSheetOpen(false)}
          onConfirm={(preferredId) => void confirmJoin(preferredId)}
        />
      )}

      {/* CANCEL SHEET */}
      {cancelOpen && (
        <CancelBookingSheet
          open={cancelOpen}
          audience="customer"
          onClose={() => setCancelOpen(false)}
          onConfirm={(code, text) => void cancelBooking(code, text)}
          busy={busy}
        />
      )}
    </div>
  );
};
