import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
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

/**
 * Public mobile web page reached by scanning a salon QR with a plain phone
 * camera. No app install required: view the salon, authenticate with the
 * existing OTP system, and join that exact salon's queue.
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
  const sessionId = useRef(webSessionId());

  // Resolve the scanned token to exactly one business.
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
    let cancelled = false;
    realtimeQueueService
      .getState(business.id)
      .then((state) => {
        if (!cancelled) setQueue(state.queue);
      })
      .catch(() => undefined);
    const unsubscribe = realtimeQueueService.subscribe(
      business.id,
      (state) => {
        setQueue(state.queue);
        setEntry((current) => (current ? state.queue.find((item) => item.id === current.id) || current : current));
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [business]);

  const waiting = queue.filter((item) => item.status === 'Waiting').length;
  const peopleAhead = useMemo(() => {
    if (!entry) return waiting;
    return queue.filter(
      (item) => item.id !== entry.id && ['Waiting', 'Called', 'Serving'].includes(item.status) && item.createdAt < entry.createdAt,
    ).length;
  }, [entry, queue, waiting]);

  // Same storage key as the Android app, so one phone number is one identity.
  const persistAuth = (session: CustomerAuthSession) => {
    saveCustomerAuth(session);
    setAuth(session);
  };

  const joinQueue = useCallback(
    async (session: CustomerAuthSession) => {
      if (!business) return;
      setBusy(true);
      setError('');
      try {
        const result = await businessQrService.join(token, serviceId, sessionId.current, 'qr_web');
        // Backend enforces duplicate protection; reuse the existing entry.
        setEntry(result.entry as QueueItem);
        if (result.state?.queue) setQueue(result.state.queue);
        if (consent) void businessQrService.setMarketingConsent(true);
        void businessQrService.recordVisit(token, { appCtaShown: true });
        setStep('queued');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to join this queue right now.');
      } finally {
        setBusy(false);
      }
      void session;
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

  const startJoin = () => {
    setError('');
    if (!serviceId) return setError('Please choose a service.');
    if (auth) {
      void joinQueue(auth);
      return;
    }
    setStep('phone');
  };

  if (loadError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-[#F8FAFA] px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF1EE] text-[#B4483A]">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-lg font-bold text-[#17201F]">This QR is not linked to an active business.</h1>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[#667371]">
          The code may have been replaced or the business is not active on No-Wait Salon right now.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 h-11 rounded-xl bg-[#0F766E] px-5 text-sm font-bold text-white"
        >
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
      <div className="grid min-h-full place-items-center bg-[#F8FAFA]">
        <LoaderCircle className="h-6 w-6 animate-spin text-[#0F766E]" />
      </div>
    );
  }

  const services = business.services || [];
  const selectedService = services.find((service) => service.id === serviceId);

  return (
    <div className="min-h-full bg-[#F8FAFA] text-[#17201F]">
      <div className="mx-auto w-full max-w-md pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* Hero */}
        <div className="relative h-44 w-full overflow-hidden bg-[#0F766E]">
          {business.coverImageUrl && (
            <img src={business.coverImageUrl} alt="" className="h-full w-full object-cover" />
          )}
          {step !== 'salon' && step !== 'queued' && (
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep('salon');
              }}
              aria-label="Back"
              className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="-mt-8 rounded-t-3xl bg-[#F8FAFA] px-5 pt-5">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-[#DDE7E5]">
              {business.logoImageUrl ? (
                <img src={business.logoImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Scissors className="h-5 w-5 text-[#0F766E]" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold tracking-[-0.02em]">{business.name}</h1>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-[#667371]">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{business.address}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span
                  className={`rounded-full px-2 py-1 ${
                    business.queueAccepting ? 'bg-[#E5F3F1] text-[#0F766E]' : 'bg-[#FDECEA] text-[#B4483A]'
                  }`}
                >
                  {business.queueAccepting ? 'Open now' : 'Closed'}
                </span>
                {business.rating > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[#42524F] ring-1 ring-[#E1E7E6]">
                    <Star className="h-3 w-3 fill-[#F5A524] text-[#F5A524]" /> {business.rating}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live queue */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#DCE5E3] bg-white p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A8785]">
                <Clock className="h-3.5 w-3.5" /> Live wait
              </p>
              <p className="mt-1 text-lg font-bold">{business.liveWaitMinutes} min</p>
            </div>
            <div className="rounded-2xl border border-[#DCE5E3] bg-white p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A8785]">
                <Users className="h-3.5 w-3.5" /> In queue
              </p>
              <p className="mt-1 text-lg font-bold">{waiting}</p>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#F0D6D1] bg-[#FFF7F5] p-3 text-xs leading-5 text-[#8A3E35]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* ---------- Steps ---------- */}
          {step === 'salon' && (
            <>
              {business.offers?.length > 0 && (
                <div className="mt-4 rounded-2xl border border-[#F2E2C9] bg-[#FFF9EF] p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9A7327]">
                    <Sparkles className="h-3.5 w-3.5" /> Offers
                  </p>
                  {business.offers.slice(0, 2).map((offer, index) => (
                    <p key={index} className="mt-2 text-sm font-semibold text-[#5C4713]">
                      {typeof offer === 'string' ? offer : offer?.title}
                    </p>
                  ))}
                </div>
              )}

              <h2 className="mt-6 text-sm font-bold">Services</h2>
              <div className="mt-2 space-y-2">
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setServiceId(service.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition ${
                      serviceId === service.id ? 'border-[#0F766E] bg-[#F1FAF9]' : 'border-[#DCE5E3] bg-white'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{service.name}</span>
                      <span className="block text-xs text-[#667371]">{service.durationMin} min</span>
                    </span>
                    <span className="ml-3 flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold">₹{service.priceInr}</span>
                      {serviceId === service.id && <Check className="h-4 w-4 text-[#0F766E]" />}
                    </span>
                  </button>
                ))}
                {services.length === 0 && (
                  <p className="rounded-2xl border border-[#DCE5E3] bg-white p-4 text-center text-xs text-[#788582]">
                    No services listed yet.
                  </p>
                )}
              </div>

              {business.description && (
                <>
                  <h2 className="mt-6 text-sm font-bold">About</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5A6866]">{business.description}</p>
                </>
              )}

              <button
                type="button"
                onClick={startJoin}
                disabled={!business.queueAccepting || busy || services.length === 0}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {business.queueAccepting ? 'Join Queue' : 'Not accepting right now'}
              </button>
              <p className="mt-2 text-center text-[11px] text-[#788582]">No app download needed.</p>
            </>
          )}

          {step === 'phone' && (
            <div className="mt-5">
              <h2 className="text-base font-bold">Enter your mobile number</h2>
              <p className="mt-1 text-xs text-[#667371]">We send a one-time code to confirm your spot.</p>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                className="mt-4 h-12 w-full rounded-xl border border-[#D7E2E0] bg-white px-4 text-sm outline-none focus:border-[#62AAA3]"
              />
              <button
                type="button"
                onClick={() => void requestOtp()}
                disabled={busy || phone.trim().length < 8}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Send code
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="mt-5">
              <h2 className="text-base font-bold">Enter the code</h2>
              <p className="mt-1 text-xs text-[#667371]">Sent to {phone}</p>
              {demoCode && (
                <p className="mt-3 rounded-xl bg-[#F1FAF9] p-3 text-center text-xs font-semibold text-[#0F766E]">
                  Demo code: {demoCode}
                </p>
              )}
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="4-digit code"
                className="mt-4 h-12 w-full rounded-xl border border-[#D7E2E0] bg-white px-4 text-center text-lg font-bold tracking-[0.4em] outline-none focus:border-[#62AAA3]"
              />
              <button
                type="button"
                onClick={() => void verifyOtp()}
                disabled={busy || code.trim().length < 4}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Verify and continue
              </button>
            </div>
          )}

          {step === 'profile' && (
            <div className="mt-5">
              <h2 className="text-base font-bold">Almost there</h2>
              <p className="mt-1 text-xs text-[#667371]">We only need your name to call you in the queue.</p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Your name"
                className="mt-4 h-12 w-full rounded-xl border border-[#D7E2E0] bg-white px-4 text-sm outline-none focus:border-[#62AAA3]"
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                inputMode="email"
                autoComplete="email"
                placeholder="Email (optional)"
                className="mt-3 h-12 w-full rounded-xl border border-[#D7E2E0] bg-white px-4 text-sm outline-none focus:border-[#62AAA3]"
              />
              <label className="mt-4 flex items-start gap-3 rounded-xl border border-[#DCE5E3] bg-white p-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F766E]"
                />
                <span className="text-[11px] leading-5 text-[#5A6866]">
                  Send me offers and updates from No-Wait Salon. Optional — you can join the queue either way.
                </span>
              </label>
              <button
                type="button"
                onClick={() => void saveProfileAndJoin()}
                disabled={busy}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Join queue
              </button>
            </div>
          )}

          {step === 'queued' && entry && (
            <div className="mt-5">
              <div className="rounded-2xl border border-[#B9DAD6] bg-[#EAF6F4] p-5 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#0F766E]">
                  <Check className="h-6 w-6" />
                </div>
                <h2 className="mt-3 text-base font-bold text-[#164E49]">You are in the queue</h2>
                <p className="mt-1 text-xs text-[#3F6D68]">
                  {business.name} · {entry.service}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-left">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A8785]">People ahead</p>
                    <p className="mt-1 text-lg font-bold">{peopleAhead}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A8785]">Status</p>
                    <p className="mt-1 text-lg font-bold">{entry.status}</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-[#3F6D68]">This page updates automatically. No need to refresh.</p>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#DCE5E3] bg-white p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E5F3F1] text-[#0F766E]">
                  <Smartphone className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Get the app for faster check-in next time</p>
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

          {selectedService && step === 'salon' && (
            <p className="mt-3 text-center text-[11px] text-[#788582]">
              Selected: {selectedService.name} · ₹{selectedService.priceInr}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
