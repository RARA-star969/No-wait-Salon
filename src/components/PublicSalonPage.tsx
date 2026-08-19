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
import type { Barber, CustomerAuthSession, QueueItem } from '../types';
import { businessQrService, type QrBusiness } from '../services/businessQrService';
import { realtimeQueueService } from '../services/realtimeQueueService';
import { customerAccountService, loadCustomerAuth, saveCustomerAuth } from '../services/customerAccountService';
import { callPhase, canCancel, formatCountdown, remainingMs } from '../shared/queueTiming';
import { CancelBookingSheet } from './CancelBookingSheet';
import { LiveTicket } from './LiveTicket';
import { workingChairs } from '../shared/liveTicket';
import {
  SalonAbout,
  SalonGallery,
  SalonIdentity,
  SalonLiveQueue,
  SalonLocationHours,
  SalonServiceMenu,
  SalonOffers,
  SalonStylists,
} from './SalonSections';
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
  // Full roster, not just a count: the shared live ticket derives waits and
  // chair availability from the same barber data the app uses.
  const [barbers, setBarbers] = useState<Barber[]>([]);
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
    const apply = (state: { queue: QueueItem[]; barbers?: Barber[]; completedList?: QueueItem[] }) => {
      setQueue(state.queue);
      if (state.barbers) setBarbers(state.barbers);
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
    const minutes = Math.max(5, Math.ceil((peopleAhead * 15) / workingChairs(barbers)));
    return `${Math.max(5, minutes - 5)}–${minutes + 5} min`;
  }, [peopleAhead, barbers]);

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

        {/* Identity card overlapping the hero keeps the fold tight. Shared
            with the Customer app salon screen. */}
        <div className="-mt-10 px-4">
          <SalonIdentity profile={profile} />
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

          {/* ---------------- Salon / service selection ----------------
              Rendered from the SAME shared sections the Customer app salon
              screen uses, fed by the same salon record the Admin panel edits,
              so the two pages match in content, hierarchy and spacing. */}
          {step === 'salon' && (
            <div className="mt-5 space-y-6">
              <SalonLiveQueue
                profile={profile}
                peopleAhead={waiting}
                openChairs={barbers.filter((barber) => barber.status === 'available').length}
                workingChairs={workingChairs(barbers)}
              />
              <SalonOffers profile={profile} />
              <SalonServiceMenu
                profile={profile}
                selectedServiceId={serviceId}
                onSelect={(id) => setServiceId(id)}
              />
              <SalonStylists barbers={barbers} />
              <SalonGallery profile={profile} />
              <SalonAbout profile={profile} />
              <SalonLocationHours profile={profile} />
            </div>
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
              {/* Shared with the Customer app: identical status hierarchy,
                  position, countdown and actions from one view model. */}
              <LiveTicket
                surface="web"
                entry={entry}
                queue={queue}
                barbers={barbers}
                salonName={business.name}
                now={now}
                busy={busy}
                onAcknowledge={acknowledgeTurn}
                onCancel={() => setCancelOpen(true)}
                onRejoin={rejoin}
              />

              {/* Web-only extras below. */}
              {!completed && notifyState === 'default' && (
                <button
                  type="button"
                  onClick={() => void requestTurnNotifications().then(setNotifyState)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#CDE3E0] bg-white py-3 text-xs font-bold text-[#0F766E]"
                >
                  <BellRing className="h-4 w-4" /> Notify me when it's my turn
                </button>
              )}

              {/* App-download CTA is deliberately WEB ONLY. The installed
                  Customer app must never render it, which is why it lives here
                  and not inside the shared LiveTicket. */}
              <div id="web-get-app-cta" className="mt-3 flex items-start gap-3 rounded-2xl border border-[#E2EAE9] bg-white p-4">
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
