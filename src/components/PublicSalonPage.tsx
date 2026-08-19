import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  LoaderCircle,
  MapPin,
  Scissors,
  Smartphone,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import type { CustomerAuthSession, QueueItem } from '../types';
import { businessQrService, type QrBusiness } from '../services/businessQrService';
import { realtimeQueueService } from '../services/realtimeQueueService';
import { customerAccountService, loadCustomerAuth, saveCustomerAuth } from '../services/customerAccountService';
import { callPhase, canCancel, formatCountdown, remainingMs } from '../shared/queueTiming';
import { CancelBookingSheet } from './CancelBookingSheet';
import { toSalonProfile, waitLabel } from '../shared/salonProfile';
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

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-[#E2EAE9] bg-white p-3.5">
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A8785]">{label}</p>
    <p className="mt-1 text-[17px] font-bold leading-tight text-[#17201F]">{value}</p>
  </div>
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
  const [serviceId, setServiceId] = useState('');
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
  const [barbersActive, setBarbersActive] = useState(1);
  const [showTurnPopup, setShowTurnPopup] = useState(false);
  const [notifyState, setNotifyState] = useState(notificationPermission());
  const [now, setNow] = useState(() => Date.now());
  const [cancelOpen, setCancelOpen] = useState(false);
  const sessionId = useRef(webSessionId());
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    businessQrService
      .resolve(token)
      .then(({ business: resolved }) => {
        if (cancelled) return;
        setBusiness(resolved);
        setServiceId(resolved.services?.[0]?.id || '');
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
    const apply = (state: { queue: QueueItem[]; barbers?: Array<{ status: string }>; completedList?: QueueItem[] }) => {
      setQueue(state.queue);
      if (state.barbers) setBarbersActive(state.barbers.filter((b) => b.status !== 'unavailable').length || 1);
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
    };
    realtimeQueueService.getState(business.id).then(apply).catch(() => undefined);
    const unsubscribe = realtimeQueueService.subscribe(business.id, apply, () => undefined);
    return unsubscribe;
  }, [business]);

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

  const estimatedWait = useMemo(() => {
    if (peopleAhead === 0) return 'Ready now';
    const minutes = Math.max(5, Math.ceil((peopleAhead * 15) / Math.max(1, barbersActive)));
    return `${Math.max(5, minutes - 5)}–${minutes + 5} min`;
  }, [peopleAhead, barbersActive]);

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

  const joinQueue = useCallback(
    async (_session: CustomerAuthSession) => {
      if (!business) return;
      setBusy(true);
      setError('');
      try {
        const result = await businessQrService.join(token, serviceId, sessionId.current, 'qr_web');
        const joined = result.entry as QueueItem;
        setEntry(joined);
        lastStatus.current = joined?.status || null;
        if (result.state?.queue) setQueue(result.state.queue);
        if (consent) void businessQrService.setMarketingConsent(true);
        void businessQrService.recordVisit(token, { appCtaShown: true });
        setStep('queued');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to join this queue right now.');
      } finally {
        setBusy(false);
      }
    },
    [business, consent, serviceId, token],
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
      if (profile?.name) {
        await joinQueue(session);
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
      await customerAccountService.updateProfile({
        name: name.trim(),
        email: email.trim(),
        dateOfBirth: '',
        gender: '',
        anniversary: '',
        city: '',
      });
      if (auth) await joinQueue(auth);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your details.');
      setBusy(false);
    }
  };

  // Runs inside the tap, which is the only moment browsers allow audio priming.
  const startJoin = () => {
    setError('');
    primeTurnAlert();
    if (!serviceId) return setError('Please choose a service.');
    if (auth) {
      void joinQueue(auth);
      return;
    }
    setStep('phone');
  };

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

  if (!business) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#F6F9F8]">
        <LoaderCircle className="h-6 w-6 animate-spin text-[#0F766E]" />
      </div>
    );
  }

  const profile = toSalonProfile(business as never);
  const services = profile.services;
  const selectedService = services.find((service) => service.id === serviceId);
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

  return (
    <div className="min-h-dvh bg-[#F6F9F8] text-[#17201F]">
      <div className="mx-auto w-full max-w-[30rem]">
        {/* Compact hero: a slim gradient band, not a large empty colour block. */}
        <header className="relative overflow-hidden bg-gradient-to-br from-[#0F766E] to-[#0B5F58] px-5 pb-14 pt-[max(0.875rem,env(safe-area-inset-top))]">
          {business.coverImageUrl && (
            <img src={business.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          )}
          <div className="relative flex items-center justify-between">
            {step !== 'salon' && !isQueued ? (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep('salon');
                }}
                aria-label="Back"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">No-Wait Salon</span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                business.queueAccepting ? 'bg-white/20 text-white' : 'bg-[#B4483A] text-white'
              }`}
            >
              {business.queueAccepting ? 'Open now' : 'Closed'}
            </span>
          </div>
        </header>

        {/* Identity card overlapping the hero keeps the fold tight. */}
        <div className="-mt-10 px-4">
          <div className="rounded-3xl border border-[#E2EAE9] bg-white p-4 shadow-[0_8px_24px_-12px_rgba(15,32,31,0.18)]">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#E5F3F1] ring-1 ring-[#D3E7E4]">
                {profile.logoImageUrl ? (
                  <img src={profile.logoImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Scissors className="h-5 w-5 text-[#0F766E]" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[19px] font-bold leading-tight tracking-[-0.02em]">{profile.name}</h1>
                {profile.category && <p className="mt-0.5 truncate text-[11px] font-semibold text-[#0F766E]">{profile.category}</p>}
                <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-[#667371]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-2">{profile.address}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {profile.rating > 0 && (
                  <span className="flex items-center gap-1 rounded-lg bg-[#FFF8EC] px-2 py-1 text-xs font-bold text-[#8A6516]">
                    <Star className="h-3.5 w-3.5 fill-[#F5A524] text-[#F5A524]" />
                    {profile.rating}
                    {profile.reviewCount > 0 && <span className="font-semibold text-[#A98A44]">({profile.reviewCount})</span>}
                  </span>
                )}
                <span
                  className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    profile.isOpen ? 'bg-[#E7F5F2] text-[#0F766E]' : 'bg-[#F3F0EE] text-[#8A6A62]'
                  }`}
                >
                  {profile.isOpen ? 'Open now' : 'Closed'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <main className="px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-4">
          {/* Live status row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Live wait" value={isQueued ? estimatedWait : waitLabel(profile.liveWaitMinutes)} />
            <Field label={isQueued ? 'People ahead' : 'In queue'} value={String(isQueued ? peopleAhead : waiting)} />
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
                <div className="mt-5 rounded-2xl border border-[#F2E2C9] bg-[#FFFBF3] p-4">
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

              <h2 className="mt-6 text-[13px] font-bold uppercase tracking-[0.12em] text-[#5A6866]">Choose a service</h2>
              <div className="mt-3 space-y-2.5">
                {services.map((service) => {
                  const active = serviceId === service.id;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setServiceId(service.id)}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                        active
                          ? 'border-[#0F766E] bg-[#F1FAF9] shadow-[0_4px_14px_-8px_rgba(15,118,110,0.5)]'
                          : 'border-[#E2EAE9] bg-white'
                      }`}
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                          active ? 'border-[#0F766E] bg-[#0F766E]' : 'border-[#CBD8D6]'
                        }`}
                      >
                        {active && <Check className="h-3 w-3 text-white" />}
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
                {services.length === 0 && (
                  <p className="rounded-2xl border border-[#E2EAE9] bg-white p-5 text-center text-xs text-[#788582]">No services listed yet.</p>
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

          {/* ---------------- Live queue status ---------------- */}
          {isQueued && entry && (
            <div className="mt-5">
              <div
                className={`rounded-3xl border p-5 text-center ${
                  completed
                    ? 'border-[#CBD8D6] bg-white'
                    : entry.status === 'Called'
                      ? 'border-[#F3C79A] bg-[#FFF6EA]'
                      : 'border-[#B9DAD6] bg-[#EDF7F5]'
                }`}
              >
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#0F766E] ring-1 ring-[#D3E7E4]">
                  {completed ? <CheckCircle2 className="h-6 w-6" /> : entry.status === 'Called' ? <BellRing className="h-6 w-6 text-[#B4761C]" /> : <Check className="h-6 w-6" />}
                </div>
                <h2 className="mt-3 text-[17px] font-bold">
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
                            : "It's your turn"
                          : inService
                            ? 'In service'
                            : "You're in the queue"}
                </h2>
                <p className="mt-1 text-xs text-[#4F7F7A]">
                  {business.name} · {entry.service}
                </p>

                {phase === 'called' && (
                  <div className="mt-4 rounded-2xl bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A8785]">
                      {acknowledged ? 'Please reach the salon within' : 'Please arrive within'}
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-[#B4761C]">{countdown}</p>
                    {(entry.callAttempt || 0) > 1 && (
                      <p className="mt-1 text-[11px] font-semibold text-[#8A6516]">Call attempt {entry.callAttempt}</p>
                    )}
                  </div>
                )}

                {arrivalExpired && (
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#5A6866]">
                    Your booking is still waiting for salon action.
                  </div>
                )}

                {noShow && (
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#5A6866]">
                    Your queue entry was closed because you could not reach the salon within the arrival window.
                  </div>
                )}

                {!completed && !noShow && phase !== 'called' && (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-left">
                    <div className="rounded-xl bg-white p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#7A8785]">Position</p>
                      <p className="mt-0.5 text-base font-bold">{peopleAhead + 1}</p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#7A8785]">Ahead</p>
                      <p className="mt-0.5 text-base font-bold">{peopleAhead}</p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#7A8785]">Status</p>
                      <p className="mt-0.5 text-base font-bold">{inService ? 'In service' : 'Waiting'}</p>
                    </div>
                  </div>
                )}

                {cancelled && (
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#5A6866]">
                    {cancelledByStaff
                      ? 'The salon could not keep this booking. You can join the queue again or call them.'
                      : 'Your booking was cancelled and removed from the queue.'}
                  </div>
                )}

                {(arrivalExpired || noShow || cancelled) && (
                  <div className="mt-4 flex flex-col gap-2">
                    {business.phoneNumber && (
                      <a href={`tel:${business.phoneNumber}`} className="flex h-11 items-center justify-center rounded-xl border border-[#CDE3E0] bg-white text-sm font-bold text-[#0F766E]">
                        Call salon
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => (arrivalExpired && !cancelled && !noShow ? void cancelBooking('changed_mind') : rejoin())}
                      disabled={busy}
                      className="flex h-11 items-center justify-center rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60"
                    >
                      {noShow || cancelled ? 'Join queue again' : 'Leave this queue & join again'}
                    </button>
                  </div>
                )}

                {!completed && !noShow && !cancelled && (
                  <>
                    <p className="mt-3 text-[11px] text-[#4F7F7A]">Live · updates automatically, no need to refresh.</p>
                    {canCancel(entry.status) && (
                      <button
                        type="button"
                        onClick={() => setCancelOpen(true)}
                        className="mt-3 text-xs font-bold text-[#8A3E35] underline underline-offset-2"
                      >
                        Cancel booking
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Optional, never blocking. */}
              {!completed && notifyState === 'default' && (
                <button
                  type="button"
                  onClick={() => void requestTurnNotifications().then(setNotifyState)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#CDE3E0] bg-white py-3 text-xs font-bold text-[#0F766E]"
                >
                  <BellRing className="h-4 w-4" /> Notify me when it's my turn
                </button>
              )}

              <div className="mt-3 flex items-start gap-3 rounded-2xl border border-[#E2EAE9] bg-white p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E5F3F1] text-[#0F766E]">
                  <Smartphone className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Get the app for faster check-in</p>
                  <p className="mt-0.5 text-[11px] leading-5 text-[#667371]">Track your turn and skip re-entering details.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void businessQrService.recordVisit(token, { appCtaShown: true, appCtaClicked: true })}
                  className="shrink-0 self-center rounded-lg bg-[#0F766E] px-3 py-2 text-xs font-bold text-white"
                >
                  Get app
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Sticky CTA: only while choosing, so the status page stays uncluttered. */}
      {step === 'salon' && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E2EAE9] bg-white/95 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[30rem] items-center gap-3">
            {selectedService && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#5A6866]">{selectedService.name}</p>
                <p className="text-[15px] font-bold leading-tight">₹{selectedService.priceInr}</p>
              </div>
            )}
            <button
              type="button"
              onClick={startJoin}
              disabled={!business.queueAccepting || busy || services.length === 0}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-6 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60 ${
                selectedService ? '' : 'flex-1'
              }`}
            >
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {business.queueAccepting ? 'Join Queue' : 'Not accepting'}
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
