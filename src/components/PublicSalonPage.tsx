import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArmchairIcon,
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
} from 'lucide-react';
import type { Barber, CustomerAuthSession, CustomerProfile, QueueItem } from '../types';
import { businessQrService, type QrBusiness } from '../services/businessQrService';
import { realtimeQueueService } from '../services/realtimeQueueService';
import { customerAccountService, loadCustomerAuth, saveCustomerAuth } from '../services/customerAccountService';
import { callPhase, canCancel, formatCountdown, remainingMs } from '../shared/queueTiming';
import { CancelBookingSheet } from './CancelBookingSheet';
import { toSalonProfile } from '../shared/salonProfile';
import { formatDuration } from '../shared/duration';
import { LiveQueueCard, type QueueTrend } from './LiveQueueCard';
import { filterServices, selectionTotals, SERVICE_FILTERS, type ServiceFilter } from '../shared/serviceSelection';
import { resolveAppReadiness } from '../shared/profileReadiness';
import { QueueJoinSheet } from './QueueJoinSheet';
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
  <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0F6E63] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
    <span className="flex items-center gap-1.5 text-[13px] font-extrabold tracking-[0.06em] text-white">
      <Scissors className="h-4 w-4" />
      NO-WAIT SALON
    </span>
    <button
      type="button"
      onClick={onOpenApp}
      className="rounded-full border border-white/40 px-3 py-1.5 text-[11px] font-bold text-white"
    >
      Open in app
    </button>
  </header>
);

/**
 * Public mobile page reached by scanning a salon QR with a plain phone camera.
 * No app install: view the salon, authenticate with the existing OTP system,
 * join that exact salon's queue, then track it live over the same SSE stream.
 */
export const PublicSalonPage: React.FC<{ token: string }> = ({ token }) => {
  const [business, setBusiness] = useState<QrBusiness | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>('salon');
  const [auth, setAuth] = useState<CustomerAuthSession | null>(() => loadCustomerAuth());
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('All');
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

  // Live queue for this salon only, over the existing SSE stream.
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
        // Complete moves the entry out of `queue` and into `completedList`, so
        // follow it there instead of freezing on the last in-queue status.
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

  // Restores an active booking across a refresh/reopen: this browser's local
  // session id (persisted in localStorage) or, once logged in, this exact
  // verified customer, is matched against the live queue for this salon — the
  // server-authoritative source of truth — so the customer lands back on
  // their live ticket instead of the salon picker, and never files a second
  // booking through the picker below.
  useEffect(() => {
    if (!business || entry || step !== 'salon') return;
    const mine = queue.find((item) => item.sessionId === sessionId.current || (auth && item.customerId === auth.customerId));
    if (!mine) return;
    setEntry(mine);
    lastStatus.current = mine.status;
    setStep('queued');
  }, [business, entry, queue, auth, step]);

  // One ticking clock drives the arrival countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Staff pressing Call Next flips this customer to "Called"; alert on the edge.
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

  // Trend arrows on the live queue hero card: a lightweight client-side read
  // of "did this number move since the last snapshot", nothing more.
  const previousAhead = useRef(peopleAhead);
  const [aheadTrend, setAheadTrend] = useState<QueueTrend>('steady');
  useEffect(() => {
    setAheadTrend(peopleAhead < previousAhead.current ? 'down' : peopleAhead > previousAhead.current ? 'up' : 'steady');
    previousAhead.current = peopleAhead;
  }, [peopleAhead]);

  const acknowledgeTurn = () => {
    setShowTurnPopup(false);
    // Server records the acknowledgement; the deadline staff set is unchanged.
    if (business && entry) void businessQrService.acknowledgeCall(business.id, entry.id);
  };

  /** Cancels and stays on the card: SSE reports the cancelled outcome back. */
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

  /** Clears the closed booking so the customer can pick a service again. */
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

  // A customer we have already verified is never asked again: once signed in,
  // fetch their profile so resolveAppReadiness can decide without a round trip
  // inside the tap that opens the sheet.
  const [profileLoading, setProfileLoading] = useState(false);
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    setProfileLoading(true);
    customerAccountService
      .getProfile()
      .then((profile) => { if (!cancelled) setCustomerProfile(profile); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [auth?.token]);

  /** Confirms the join from the queue-join sheet, honouring the chosen stylist. */
  const confirmJoin = useCallback(
    async (preferredBarberId: string) => {
      if (!business) return;
      setBusy(true);
      setError('');
      try {
        const result = await businessQrService.join(token, selectedServiceIds, sessionId.current, 'qr_web', preferredBarberId || undefined);
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
    [business, consent, selectedServiceIds, token],
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

  const toggleService = (id: string) => {
    setSelectedServiceIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  // Runs inside the tap, which is the only moment browsers allow audio priming.
  const startJoin = () => {
    setError('');
    primeTurnAlert();
    if (!selectedServiceIds.length) return setError('Please choose at least one service.');
    const gate = resolveAppReadiness(auth, customerProfile, { profileLoading });
    if (gate.kind === 'loading') return;
    if (gate.kind === 'ready') {
      setJoinSheetOpen(true);
      return;
    }
    if (gate.reason === 'missing_profile') {
      setStep('profile');
      return;
    }
    setStep('phone');
  };

  const openApp = () => void businessQrService.recordVisit(token, { appCtaShown: true, appCtaClicked: true });

  if (loadError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F6F9F8] px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF1EE] text-[#B4483A]">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-lg font-bold text-[#17201F]">This QR is not linked to an active business.</h1>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[#667371]">
          The code may have been replaced, or the business is not active on No-Wait Salon right now.
        </p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 h-11 rounded-xl bg-[#0F766E] px-5 text-sm font-bold text-white">
          Try again
        </button>
        <a href="/" className="mt-3 text-sm font-semibold text-[#0F766E]">
          Go to No-Wait Salon
        </a>
      </div>
    );
  }

  if (!business || restoring) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#F6F9F8]">
        <LoaderCircle className="h-6 w-6 animate-spin text-[#0F766E]" />
      </div>
    );
  }

  const profile = toSalonProfile(business as never);
  const services = profile.services;
  const filteredServices = filterServices(services, serviceFilter);
  const totals = selectionTotals(services, selectedServiceIds);
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
  // Small fixed row of avatar dots ahead of the customer's own marker, capped so a
  // long queue never overflows the progress strip.
  const progressDots = Math.min(peopleAhead, 4);

  return (
    <div className="min-h-dvh bg-[#F6F9F8] text-[#17201F]">
      <div className="mx-auto w-full max-w-[26rem]">
        <TopBar onOpenApp={openApp} />

        <main className="px-4 pb-[calc(env(safe-area-inset-bottom)+9rem)] pt-4">
          {/* ---------------- Salon identity ---------------- */}
          {step === 'salon' && (
            <div className="rounded-2xl border border-[#E2EAE9] bg-white p-3.5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#E5F3F1] ring-1 ring-[#D3E7E4]">
                  {profile.logoImageUrl ? (
                    <img src={profile.logoImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Scissors className="h-5 w-5 text-[#0F766E]" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[17px] font-extrabold leading-tight tracking-[-0.01em]">{profile.name}</h1>
                  {profile.category && <p className="mt-0.5 truncate text-[12px] text-[#8B9795]">{profile.category}</p>}
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-[#667371]">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{profile.address}</span>
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    profile.isOpen ? 'bg-[#E7F5F2] text-[#0F766E]' : 'bg-[#F3F0EE] text-[#8A6A62]'
                  }`}
                >
                  {profile.isOpen ? 'Open now' : 'Closed'}
                </span>
              </div>
              {profile.rating > 0 && (
                <span className="mt-3 flex w-fit items-center gap-1 rounded-lg bg-[#FFF8EC] px-2 py-1 text-xs font-bold text-[#8A6516]">
                  <Star className="h-3.5 w-3.5 fill-[#F5A524] text-[#F5A524]" />
                  {profile.rating}
                  {profile.reviewCount > 0 && <span className="font-semibold text-[#A98A44]">({profile.reviewCount})</span>}
                </span>
              )}
            </div>
          )}

          {/* ---------------- Success header (live ticket) ---------------- */}
          {isQueued && entry && (
            <div className="pt-2 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#0F766E] text-white">
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
          )}

          {/* Live queue hero: the strongest visual signal on the page. */}
          <div className="mt-4">
            <LiveQueueCard
              waitLabel={isQueued ? estimatedWait : profile.liveWaitMinutes > 0 ? formatDuration(profile.liveWaitMinutes) : 'Ready now'}
              peopleAhead={isQueued ? peopleAhead : waiting}
              peopleAheadTrend={aheadTrend}
              readyChairs={barbersAvailable}
              totalChairs={barbersActive}
              live={business.queueAccepting}
              activityLabel={isQueued ? `${business.name} · ${entry?.service || ''}` : `${waiting} ${waiting === 1 ? 'person' : 'people'} waiting`}
            />
          </div>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-[#F0D6D1] bg-[#FFF7F5] p-3 text-xs leading-5 text-[#8A3E35]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* ---------------- Salon / service selection ---------------- */}
          {step === 'salon' && (
            <>
              {profile.offers.length > 0 && (
                <div className="mt-4 rounded-2xl border border-[#F2E2C9] bg-[#FFFBF3] p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9A7327]">
                    <Sparkles className="h-3.5 w-3.5" /> Offers
                  </p>
                  {profile.offers.map((offer) => (
                    <div key={offer.id} className="mt-2">
                      {offer.discount && <p className="text-xs font-bold text-[#0F766E]">{offer.discount}</p>}
                      <p className="text-sm font-semibold leading-5 text-[#5C4713]">{offer.title}</p>
                      {offer.minimumBill && <p className="mt-0.5 text-[10px] text-[#9A7327]">Minimum bill {offer.minimumBill}</p>}
                      {offer.validity && <p className="text-[10px] text-[#9A7327]">{offer.validity}</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B9795]">Choose your services</p>
                  <h2 className="mt-0.5 text-[16px] font-extrabold">Service menu</h2>
                </div>
                {totals.count > 0 && <span className="text-xs font-semibold text-[#0F766E]">{totals.count} selected</span>}
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {SERVICE_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setServiceFilter(filter)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                      serviceFilter === filter ? 'border-[#0F766E] bg-[#0F766E] text-white' : 'border-[#DDE7E5] bg-white text-[#536966]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-2.5">
                {filteredServices.map((service) => {
                  const active = selectedServiceIds.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleService(service.id)}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                        active
                          ? 'border-[#0F766E] bg-[#F1FAF9] shadow-[0_4px_14px_-8px_rgba(15,118,110,0.5)]'
                          : 'border-[#E2EAE9] bg-white'
                      }`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border-2 ${
                          active ? 'border-[#0F766E] bg-[#0F766E]' : 'border-[#CBD8D6]'
                        }`}
                      >
                        {active && <Check className="h-3.5 w-3.5 text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{service.name}</span>
                        {service.description && (
                          <span className="mt-0.5 block text-[11px] leading-4 text-[#788582]">{service.description}</span>
                        )}
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-[#667371]">
                          <Clock className="h-3 w-3" /> {service.durationMin} min
                        </span>
                      </span>
                      <span className="shrink-0 text-[15px] font-bold">₹{service.priceInr}</span>
                    </button>
                  );
                })}
                {filteredServices.length === 0 && (
                  <p className="rounded-2xl border border-[#E2EAE9] bg-white p-5 text-center text-xs text-[#788582]">
                    {services.length === 0 ? 'No services listed yet.' : 'No services in this filter yet.'}
                  </p>
                )}
              </div>

              <h2 className="mt-7 text-[13px] font-bold uppercase tracking-[0.12em] text-[#5A6866]">About</h2>
              <div className="mt-2 rounded-2xl border border-[#E2EAE9] bg-white p-4">
                <p className="text-sm leading-6 text-[#4C5A58]">{profile.description}</p>
                {profile.amenities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.amenities.map((amenity) => (
                      <span key={amenity} className="rounded-full bg-[#F0F5F4] px-3 py-1.5 text-[10px] font-semibold text-[#536966]">
                        {amenity}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <h2 className="mt-7 text-[13px] font-bold uppercase tracking-[0.12em] text-[#5A6866]">Location &amp; hours</h2>
              <div className="mt-2 rounded-2xl border border-[#E2EAE9] bg-white p-4">
                <p className="text-sm leading-6 text-[#4C5A58]">{profile.address}</p>
                {profile.openingHours && <p className="mt-1 text-xs font-semibold text-[#25302F]">{profile.openingHours}</p>}
                <a
                  href={profile.directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#BED7D3] text-xs font-bold text-[#0F766E]"
                >
                  <MapPin className="h-4 w-4" /> View directions
                </a>
              </div>

              {profile.gallery.length > 0 && (
                <>
                  <h2 className="mt-7 text-[13px] font-bold uppercase tracking-[0.12em] text-[#5A6866]">Inside the salon</h2>
                  <div className="mt-2 flex snap-x gap-3 overflow-x-auto pb-1">
                    {profile.gallery.map((item) => (
                      <div key={item.id} className="aspect-[4/5] min-w-[150px] shrink-0 snap-start overflow-hidden rounded-2xl bg-[#DDE9E7]">
                        <img src={item.imageUrl} alt={item.label || profile.name} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ---------------- Auth + profile ---------------- */}
          {step === 'phone' && (
            <div className="mt-5 rounded-2xl border border-[#E2EAE9] bg-white p-4">
              <h2 className="text-base font-bold">Enter your mobile number</h2>
              <p className="mt-1 text-xs leading-5 text-[#667371]">We send a one-time code to confirm your spot.</p>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                className="mt-4 h-12 w-full rounded-xl border border-[#D7E2E0] bg-[#F8FAFA] px-4 text-base outline-none focus:border-[#62AAA3]"
              />
              <button
                type="button"
                onClick={() => void requestOtp()}
                disabled={busy || phone.trim().length < 8}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Send code
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="mt-5 rounded-2xl border border-[#E2EAE9] bg-white p-4">
              <h2 className="text-base font-bold">Enter the code</h2>
              <p className="mt-1 text-xs text-[#667371]">Sent to {phone}</p>
              {demoCode && <p className="mt-3 rounded-xl bg-[#F1FAF9] p-3 text-center text-xs font-bold text-[#0F766E]">Demo code: {demoCode}</p>}
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="4-digit code"
                className="mt-4 h-12 w-full rounded-xl border border-[#D7E2E0] bg-[#F8FAFA] px-4 text-center text-lg font-bold tracking-[0.4em] outline-none focus:border-[#62AAA3]"
              />
              <button
                type="button"
                onClick={() => void verifyOtp()}
                disabled={busy || code.trim().length < 4}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Verify and continue
              </button>
            </div>
          )}

          {step === 'profile' && (
            <div className="mt-5 rounded-2xl border border-[#E2EAE9] bg-white p-4">
              <h2 className="text-base font-bold">Almost there</h2>
              <p className="mt-1 text-xs leading-5 text-[#667371]">We only need your name to call you in the queue.</p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Your name"
                className="mt-4 h-12 w-full rounded-xl border border-[#D7E2E0] bg-[#F8FAFA] px-4 text-base outline-none focus:border-[#62AAA3]"
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                inputMode="email"
                autoComplete="email"
                placeholder="Email (optional)"
                className="mt-3 h-12 w-full rounded-xl border border-[#D7E2E0] bg-[#F8FAFA] px-4 text-base outline-none focus:border-[#62AAA3]"
              />
              <label className="mt-4 flex items-start gap-3 rounded-xl bg-[#F8FAFA] p-3">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F766E]" />
                <span className="text-[11px] leading-5 text-[#5A6866]">
                  Send me offers and updates. Optional — you can join the queue either way.
                </span>
              </label>
              <button
                type="button"
                onClick={() => void saveProfileAndJoin()}
                disabled={busy}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Join queue
              </button>
            </div>
          )}

          {/* ---------------- Live ticket ---------------- */}
          {isQueued && entry && (
            <div className="mt-4">
              <div
                className={`rounded-3xl p-5 text-white ${
                  completed || noShow || cancelled
                    ? 'bg-gradient-to-br from-[#5A6866] to-[#3F4B49]'
                    : phase === 'called'
                      ? 'bg-gradient-to-br from-[#B4761C] to-[#8A5A16]'
                      : 'bg-gradient-to-br from-[#0F766E] to-[#0B4A44]'
                }`}
              >
                {!completed && !noShow && !cancelled && !arrivalExpired && phase !== 'called' && (
                  <>
                    <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Your position</p>
                    <p className="mt-1 text-center text-[48px] font-extrabold leading-none">{position}</p>
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
                        <p className="mt-0.5 text-base font-bold leading-tight">{estimatedWait}</p>
                      </div>
                      <div className="rounded-xl bg-white/10 p-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/70">Service</p>
                        <p className="mt-0.5 truncate text-base font-bold">{entry.service}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-1.5">
                      {Array.from({ length: progressDots }).map((_, index) => (
                        <React.Fragment key={index}>
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white/80 ring-2 ring-white/25">
                            <User className="h-3.5 w-3.5" />
                          </span>
                          <span className="h-px w-3 bg-white/25" />
                        </React.Fragment>
                      ))}
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[15px] font-extrabold text-[#0B4A44]">
                        {position}
                      </span>
                      <span className="h-px w-3 border-t border-dashed border-white/35" />
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/40 text-white/80">
                        <ArmchairIcon className="h-4 w-4" />
                      </span>
                    </div>
                  </>
                )}

                {phase === 'called' && (
                  <div className="text-center">
                    <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/15">
                      <BellRing className="h-5.5 w-5.5" />
                    </div>
                    <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">
                      {acknowledged ? 'Please reach the salon within' : 'Please arrive within'}
                    </p>
                    <p className="mt-1 text-3xl font-extrabold tabular-nums">{countdown}</p>
                    {(entry.callAttempt || 0) > 1 && (
                      <p className="mt-1 text-[11px] font-semibold text-white/80">Call attempt {entry.callAttempt}</p>
                    )}
                  </div>
                )}

                {arrivalExpired && (
                  <p className="text-center text-sm leading-6 text-white/90">Your booking is still waiting for salon action.</p>
                )}

                {noShow && (
                  <p className="text-center text-sm leading-6 text-white/90">
                    Your queue entry was closed because you could not reach the salon within the arrival window.
                  </p>
                )}

                {cancelled && (
                  <p className="text-center text-sm leading-6 text-white/90">
                    {cancelledByStaff
                      ? 'The salon could not keep this booking. You can join the queue again or call them.'
                      : 'Your booking was cancelled and removed from the queue.'}
                  </p>
                )}

                {completed && <p className="text-center text-sm leading-6 text-white/90">Thanks for visiting {business.name}.</p>}

                {(arrivalExpired || noShow || cancelled) && (
                  <div className="mt-4 flex flex-col gap-2">
                    {business.phoneNumber && (
                      <a href={`tel:${business.phoneNumber}`} className="flex h-11 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white">
                        Call salon
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => (arrivalExpired && !cancelled && !noShow ? void cancelBooking('changed_mind') : rejoin())}
                      disabled={busy}
                      className="flex h-11 items-center justify-center rounded-xl bg-white text-sm font-bold text-[#0B4A44] disabled:opacity-60"
                    >
                      {noShow || cancelled ? 'Join queue again' : 'Leave this queue & join again'}
                    </button>
                  </div>
                )}
              </div>

              {!completed && !noShow && !cancelled && (
                <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-[#CFE6E2] bg-[#EAF6F4] px-4 py-3">
                  <Radio className="h-4 w-4 shrink-0 animate-pulse text-[#0F766E]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-[#0F766E]">Live updates automatically</p>
                    <p className="text-[11px] text-[#4F7F7A]">No need to refresh this page.</p>
                  </div>
                </div>
              )}

              {!completed && !noShow && !cancelled && canCancel(entry.status) && (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setCancelOpen(true)}
                    className="text-xs font-bold text-[#B4483A] underline underline-offset-2"
                  >
                    Cancel booking
                  </button>
                </div>
              )}

              {!completed && notifyState === 'default' && (
                <button
                  type="button"
                  onClick={() => void requestTurnNotifications().then(setNotifyState)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#CDE3E0] bg-white py-3 text-xs font-bold text-[#0F766E]"
                >
                  <BellRing className="h-4 w-4" /> Notify me when it's my turn
                </button>
              )}

              {/* Get-the-app promo: web-only, never shown in the native app. */}
              <div className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#5B2A9E] to-[#3C1B70] p-5">
                <Sparkles className="pointer-events-none absolute right-6 top-6 h-4 w-4 text-white/40" />
                <Sparkles className="pointer-events-none absolute right-16 top-24 h-3 w-3 text-white/30" />
                <span className="inline-block rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/85">
                  Faster in the app
                </span>
                <h3 className="mt-2.5 max-w-[13rem] text-[19px] font-extrabold leading-tight text-white">
                  Track your turn <span className="text-[#C9A6FF]">faster</span> in the app
                </h3>
                <ul className="mt-3 space-y-1.5 text-[12px] font-semibold text-white/90">
                  <li className="flex items-center gap-2">
                    <BellRing className="h-3.5 w-3.5 shrink-0 text-white/70" /> Instant turn alerts
                  </li>
                  <li className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 shrink-0 text-white/70" /> No re-entering details
                  </li>
                  <li className="flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5 shrink-0 text-white/70" /> Quicker repeat booking
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={openApp}
                  className="mt-4 flex h-11 items-center gap-2 rounded-xl bg-[#7C3AED] px-4 text-sm font-bold text-white"
                >
                  Get the app <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Sticky CTA: only while choosing, so the status page stays uncluttered. */}
      {step === 'salon' && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E2EAE9] bg-white/95 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
          {totals.count > 0 && (
            <div className="mx-auto mb-2 flex w-full max-w-[26rem] items-center justify-between text-[11px] font-semibold text-[#5A6866]">
              <span>{totals.count} {totals.count === 1 ? 'service' : 'services'} selected · {totals.totalDurationMin} min</span>
              <span className="text-sm font-bold text-[#17201F]">₹{totals.totalPriceInr}</span>
            </div>
          )}
          <div className="mx-auto flex w-full max-w-[26rem] items-center gap-3">
            <button
              type="button"
              onClick={startJoin}
              disabled={!business.queueAccepting || busy || totals.count === 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-6 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {!business.queueAccepting ? 'Not accepting' : totals.count === 0 ? 'Select a service' : 'Join Queue'}
            </button>
          </div>
        </div>
      )}

      <CancelBookingSheet
        open={cancelOpen}
        audience="customer"
        busy={busy}
        error={error}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reasonCode, reasonText) => void cancelBooking(reasonCode, reasonText)}
      />

      {/* Queue-join sheet: opens once a customer is verified and ready. */}
      <QueueJoinSheet
        open={joinSheetOpen}
        salon={business}
        services={profile.services.filter((service) => selectedServiceIds.includes(service.id))}
        barbers={barbers}
        queue={queue}
        busy={busy}
        error={error}
        customerName={customerProfile?.name}
        customerPhotoUrl={customerProfile?.profilePhotoUrl}
        onClose={() => { setJoinSheetOpen(false); setError(''); }}
        onConfirm={(preferredBarberId) => void confirmJoin(preferredBarberId)}
      />

      {/* Turn popup: the guaranteed in-page surface, driven by SSE. */}
      {showTurnPopup && entry && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:items-center">
          <div role="alertdialog" aria-modal="true" aria-label="It's your turn" className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto grid h-16 w-16 animate-pulse place-items-center rounded-full bg-[#FFF3E2] text-[#B4761C]">
              <BellRing className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-[-0.01em]">It's your turn!</h2>
            <p className="mt-2 text-sm leading-6 text-[#5A6866]">Please proceed to the salon counter.</p>
            <p className="mt-2 text-sm font-bold text-[#B4761C]">Please arrive within {countdown}</p>
            <div className="mt-4 rounded-2xl bg-[#F6F9F8] p-3">
              <p className="text-sm font-bold">{business.name}</p>
              <p className="mt-0.5 text-xs text-[#667371]">{entry.service}</p>
            </div>
            <button
              type="button"
              onClick={acknowledgeTurn}
              className="mt-5 h-12 w-full rounded-xl bg-[#0F766E] text-sm font-bold text-white active:scale-[0.99]"
            >
              I'm on my way
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
