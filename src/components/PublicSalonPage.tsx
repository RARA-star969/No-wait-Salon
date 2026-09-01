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
import { isGymCategory } from '../shared/businessCategory';
import { LiveQueueCard, type QueueTrend } from './LiveQueueCard';
import { filterServices, selectionTotals, SERVICE_FILTERS, type ServiceFilter } from '../shared/serviceSelection';
import { missingProfileFields, resolveAppReadiness } from '../shared/profileReadiness';
import { QueueJoinSheet } from './QueueJoinSheet';
import { SalonDetailPage } from './SalonDetailPage';
import { GymDetailPage } from './GymDetailPage';
import { ThankYouScreen } from './ThankYouScreen';
import { LiveTicket, type JourneyStage, type TicketPerson } from './LiveTicket';
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
  const [gender, setGender] = useState('');
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
    if (!business || isGymCategory(business.mainCategoryId)) return;
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

  // The Salon Detail page is much taller than the QR onboarding/ticket steps.
  // A customer can tap the fixed Join Queue dock while scrolled deep in the
  // salon page; browsers preserve that scroll offset after the long view is
  // replaced, which can leave the new phone/OTP/profile/ticket UI above the
  // viewport and make the page look completely blank. Always reveal the top
  // of each route step when the public QR flow advances.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [step]);

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

  const submitRating = async (rating: number, tags: string[], comment: string) => {
    if (!business || !entry) return;
    setError('');
    try {
      const snapshot = await businessQrService.submitRating(business.id, entry.id, rating, tags, comment);
      if (snapshot?.completedList) {
        setCompletedList(snapshot.completedList);
        const updated = snapshot.completedList.find((item: QueueItem) => item.id === entry.id);
        if (updated) setEntry(updated);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your feedback.');
    }
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
        if (selectedServiceIds.length === 0) {
          throw new Error('Please choose at least one service before getting a token.');
        }
        const result = await businessQrService.join(
          token,
          selectedServiceIds,
          sessionId.current,
          'qr_web',
          preferredBarberId || undefined,
        );
        const joined = (
          result.entry ||
          result.state?.queue?.find(
            (item: QueueItem) => item.sessionId === sessionId.current || (auth && item.customerId === auth.customerId),
          )
        ) as QueueItem | undefined;
        if (!joined) {
          throw new Error('Your token was created but the live ticket could not be loaded. Please refresh this page.');
        }
        setEntry(joined);
        lastStatus.current = joined.status || null;
        if (result.state?.queue) setQueue(result.state.queue);
        if (result.state?.completedList) setCompletedList(result.state.completedList);
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
    [auth, business, consent, selectedServiceIds, token],
  );

  const requestOtp = async () => {
    const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanedPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setPhone(cleanedPhone);
    setBusy(true);
    setError('');
    try {
      const result = await realtimeQueueService.requestOtp(cleanedPhone);
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
      if (profile && missingProfileFields(profile).length === 0) {
        setStep('salon');
        setJoinSheetOpen(true);
        return;
      }
      if (profile?.name) setName(profile.name);
      if (profile?.email) setEmail(profile.email);
      if (profile?.gender) setGender(profile.gender);
      setStep('profile');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That code did not match. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveProfileAndJoin = async () => {
    if (name.trim().length < 2) return setError('Please enter your name.');
    if (!gender) return setError('Please select your gender.');
    setBusy(true);
    setError('');
    try {
      const updated = await customerAccountService.updateProfile({
        name: name.trim(),
        email: email.trim(),
        dateOfBirth: '',
        gender,
        anniversary: '',
        city: '',
      });
      setCustomerProfile(updated);
      setStep('salon');
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
    const readiness = resolveAppReadiness(auth, customerProfile, { profileLoading });
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
      <div className="min-h-dvh bg-[#F6F9F8] text-[var(--noq-ink)]">
        <TopBar onOpenApp={openApp} />
        <main className="mx-auto max-w-md p-6 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Business Unavailable</h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-[var(--noq-accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0D5E5E]"
          >
            Retry
          </button>
        </main>
      </div>
    );
  }

  if (!business || !salonProfile) {
    return (
      <div className="min-h-dvh bg-[#F6F9F8] text-[var(--noq-ink)]">
        <TopBar onOpenApp={openApp} />
        <main className="mx-auto max-w-md py-20 text-center">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[var(--noq-accent)]" />
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
  const estimatedMinutes = barbersActive > 0
    ? Math.max(5, Math.ceil((peopleAhead * 15) / Math.max(1, barbersActive)))
    : 0;
  const joinedAtTimeLabel = entry?.createdAt
    ? new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : undefined;
  const calledAtTimeLabel = entry?.calledAt
    ? new Date(entry.calledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : undefined;
  const journeyStage: JourneyStage = !entry
    ? 'joined'
    : entry.status === 'Serving' || entry.status === 'Called'
      ? 'your-turn'
      : (peopleAhead <= 1 || estimatedMinutes <= 10)
        ? 'upcoming'
        : 'in-queue';
  const ticketPosition = !entry || entry.status === 'Called' || entry.status === 'Serving' ? 0 : position;
  const ticketPeopleAround: TicketPerson[] = (() => {
    if (!entry) return [];
    const ordered = queue
      .filter((item) => ['Waiting', 'Called', 'Serving'].includes(item.status))
      .sort((a, b) => a.createdAt - b.createdAt);
    const myIndex = ordered.findIndex((item) => item.id === entry.id);
    if (myIndex < 0) return [];
    return ordered.slice(Math.max(0, myIndex - 2), myIndex + 3).map((item) => {
      const absoluteIndex = ordered.findIndex((candidate) => candidate.id === item.id);
      const isMe = item.id === entry.id;
      return {
        id: item.id,
        label: isMe ? 'YOU' : (item.name || 'Customer').trim().slice(0, 1).toUpperCase(),
        positionNumber: absoluteIndex + 1,
        relLabel: isMe ? 'Current token' : absoluteIndex < myIndex ? 'Ahead of you' : 'Behind you',
        photoUrl: item.customerPhotoUrl,
        isMe,
      };
    });
  })();

  return (
    <div className="min-h-dvh bg-[#F6F9F8] text-[var(--noq-ink)]">
      <TopBar onOpenApp={openApp} />

      {isQueued && entry && completed && (
        <main id="qr-complete-screen" className="mx-auto max-w-md pb-12">
          <ThankYouScreen
            item={entry}
            salonName={business.name}
            onBackToHome={rejoin}
            onSubmitRating={(rating, tags, comment) => void submitRating(rating, tags, comment)}
          />
          {error && (
            <p role="alert" className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>
          )}
        </main>
      )}

      {/* ---------------- STEP 1: SALON / GYM DETAIL VIEW ---------------- */}
      {step === 'salon' && isGymCategory(business.mainCategoryId) && (
        <GymDetailPage
          salon={business}
          onBack={openApp}
          onApplyOffer={(id) => setAppliedOfferId(id)}
          appliedOfferId={appliedOfferId}
        />
      )}
      {step === 'salon' && !isGymCategory(business.mainCategoryId) && (
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
          <div className="rounded-3xl border border-[var(--noq-border)] bg-white p-6 shadow-sm">
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
                  className="h-12 rounded-2xl border border-[var(--noq-border)] px-4 text-base font-semibold outline-none focus:border-[var(--noq-accent)]"
                />
              </label>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <button
                disabled={busy || phone.trim().length < 8}
                onClick={() => void requestOtp()}
                className="h-12 w-full rounded-2xl bg-[var(--noq-accent)] font-bold text-white shadow-sm hover:bg-[#0D5E5E] disabled:opacity-50"
              >
                {busy ? 'Sending code…' : 'Send verification code'}
              </button>
            </div>
          </div>
        </main>
      )}

      {step === 'otp' && (
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="rounded-3xl border border-[var(--noq-border)] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B9795]">Verification</p>
            <h1 className="mt-1 text-[20px] font-extrabold">Enter verification code</h1>
            <p className="mt-1 text-xs text-[#667371]">Code sent to {phone}. {demoCode ? `(Demo code: ${demoCode})` : ''}</p>
            <div className="mt-6 space-y-4">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                className="h-12 w-full rounded-2xl border border-[var(--noq-border)] px-4 text-center font-mono text-xl font-bold tracking-widest outline-none focus:border-[var(--noq-accent)]"
              />
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <button
                disabled={busy || code.trim().length < 4}
                onClick={() => void verifyOtp()}
                className="h-12 w-full rounded-2xl bg-[var(--noq-accent)] font-bold text-white shadow-sm hover:bg-[#0D5E5E] disabled:opacity-50"
              >
                {busy ? 'Verifying…' : 'Verify & Continue'}
              </button>
            </div>
          </div>
        </main>
      )}

      {step === 'profile' && (
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="rounded-3xl border border-[var(--noq-border)] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B9795]">Customer Details</p>
            <h1 className="mt-1 text-[20px] font-extrabold">A couple of quick details</h1>
            <p className="mt-1 text-xs text-[#667371]">Name and gender are required so staff can identify your booking. Email stays optional.</p>
            <div className="mt-6 space-y-4">
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#536966]">
                Your Full Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="h-12 rounded-2xl border border-[var(--noq-border)] px-4 text-base font-semibold outline-none focus:border-[var(--noq-accent)]"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#536966]">
                Gender
                <select
                  id="qr-profile-gender"
                  value={gender}
                  onChange={(e) => { setGender(e.target.value); setError(''); }}
                  className="h-12 rounded-2xl border border-[var(--noq-border)] bg-white px-4 text-base font-semibold outline-none focus:border-[var(--noq-accent)]"
                >
                  <option value="" disabled>Select gender</option>
                  <option value="Woman">Woman</option>
                  <option value="Man">Man</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#536966]">
                Email (Optional)
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rahul@gmail.com"
                  className="h-12 rounded-2xl border border-[var(--noq-border)] px-4 text-base outline-none focus:border-[var(--noq-accent)]"
                />
              </label>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <button
                disabled={busy || name.trim().length < 2 || !gender}
                onClick={() => void saveProfileAndJoin()}
                className="h-12 w-full rounded-2xl bg-[var(--noq-accent)] font-bold text-white shadow-sm hover:bg-[#0D5E5E] disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Continue to Queue'}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ---------------- LIVE TICKET / QUEUED VIEW ---------------- */}
      {isQueued && entry && !completed && (
        <main id="qr-live-ticket-screen" className="mx-auto max-w-md space-y-4 px-5 pb-12 pt-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--noq-muted)]">Live Ticket</div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--noq-ink)]">Your live queue</h1>
            <p className="mt-0.5 text-xs text-[var(--noq-muted)]">{business.name} · {entry.service}</p>
          </div>

          {cancelled || noShow ? (
            <div className="rounded-2xl border border-[var(--noq-border)] bg-white p-6 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--noq-accent)]/10 text-[var(--noq-accent)]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="mt-3 text-lg font-extrabold text-[var(--noq-ink)]">
                {cancelledByStaff ? 'The salon cancelled your booking' : cancelledByCustomer ? 'Booking cancelled' : 'You missed your turn'}
              </h2>
              <button type="button" onClick={rejoin} className="mt-5 rounded-xl bg-[var(--noq-accent)] px-5 py-2.5 text-xs font-bold text-white">
                Book another service
              </button>
            </div>
          ) : (
            <LiveTicket
              salonName={business.name}
              token={entry.token || entry.id.slice(-4).toUpperCase()}
              position={ticketPosition}
              waitLabel={entry.status === 'Called' ? 'Ready now' : entry.status === 'Serving' ? 'In progress' : estimatedWait}
              stage={journeyStage}
              acknowledgeEnabled={entry.status === 'Called'}
              acknowledgeBusy={busy}
              onAcknowledge={acknowledgeTurn}
              onCancel={() => setCancelOpen(true)}
              peopleAround={ticketPeopleAround}
              joinedAtTimeLabel={joinedAtTimeLabel}
              calledAtTimeLabel={calledAtTimeLabel}
              callTimerRemainingLabel={entry.status === 'Called' ? countdown : undefined}
              isCalledState={entry.status === 'Called'}
              isUpcomingState={entry.status === 'Waiting' && (peopleAhead <= 1 || estimatedMinutes <= 10)}
              isServingState={entry.status === 'Serving'}
              isAcknowledged={acknowledged}
              callExpired={arrivalExpired}
              upcomingPeopleAhead={peopleAhead}
              upcomingApproxTimeLabel={estimatedWait}
              totalPriceInr={entry.totalPriceInr || 250}
              discountInr={entry.discountInr || 0}
              servicesList={entry.services || [entry.service]}
              paymentStatus={entry.paymentStatus || 'unpaid'}
              paymentMethod={entry.paymentMethod}
              onPayOnline={() => {
                void realtimeQueueService.command(business.id, {
                  type: 'queue_action',
                  itemId: entry.id,
                  action: 'Pay-online',
                });
              }}
              onPayCash={() => {
                void realtimeQueueService.command(business.id, {
                  type: 'queue_action',
                  itemId: entry.id,
                  action: 'Pay-cash',
                });
              }}
            />
          )}

          {!cancelled && !noShow && (
            <div id="qr-live-alert-card" className="space-y-2.5 rounded-2xl border border-[var(--noq-border)] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-[var(--noq-accent)]" />
                  <span className="text-xs font-bold text-[var(--noq-ink)]">Live Queue Alerts</span>
                </div>
                <span className="rounded-full bg-[#E7F5F2] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--noq-accent)]">
                  {notifyState === 'granted' ? 'Alerts Enabled' : 'Live Updates Active'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--noq-muted)]">
                Keep this page available for real-time queue changes. We will alert you when your turn is called.
              </p>
              {notifyState === 'default' && (
                <button
                  type="button"
                  onClick={() => void requestTurnNotifications().then(setNotifyState)}
                  className="w-full rounded-xl bg-[var(--noq-accent)] px-3 py-2 text-[11px] font-bold text-white"
                >
                  Enable Browser Alerts
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(business.name + ' ' + business.address)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-[var(--noq-border)] bg-white p-3 text-center text-xs font-semibold text-[var(--noq-ink)]"
            >
              Get Directions
            </a>
            <a
              href={business.phoneNumber ? `tel:${business.phoneNumber}` : undefined}
              className="rounded-2xl border border-[var(--noq-border)] bg-white p-3 text-center text-xs font-semibold text-[var(--noq-ink)]"
            >
              Call Salon
            </a>
          </div>

          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        </main>
      )}

      {/* QUEUE JOIN SHEET */}
      {joinSheetOpen && business && (
        <QueueJoinSheet
          open={joinSheetOpen}
          salon={business}
          services={(business.services || []).filter((service) => selectedServiceIds.includes(service.id))}
          barbers={barbers}
          queue={queue}
          busy={busy}
          error={error}
          customerName={customerProfile?.name || undefined}
          offers={business.offers || []}
          appliedOfferId={appliedOfferId}
          onApplyOffer={(id) => setAppliedOfferId(id)}
          onRemoveOffer={() => setAppliedOfferId(null)}
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
