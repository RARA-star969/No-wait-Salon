import React, { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, UserRound, X } from 'lucide-react';
import { missingProfileFields, type AppReadiness } from '../shared/profileReadiness';
import type { CustomerAuthSession, CustomerProfile } from '../types';
import { realtimeQueueService } from '../services/realtimeQueueService';
import { customerAccountService, saveCustomerAuth } from '../services/customerAccountService';
import { customerUi as ui } from './ui';

type Props = {
  /** The non-ready readiness result that sent the customer here. */
  gate: Extract<AppReadiness, { kind: 'onboarding_required' }>;
  onVerified: (auth: CustomerAuthSession) => void;
  onProfileSaved: (profile: CustomerProfile) => void;
  /** Shown as a close (X) affordance when this runs as a dismissible gate rather than a mandatory first-run screen. */
  onCancel?: () => void;
  /** Copy shown above the phone step, so the booking gate and the landing "Login / Sign up" entry point read differently. */
  intro?: { eyebrow: string; title: string; description: string };
};

type Step = 'phone' | 'code' | 'details';

const GENDER_OPTIONS = ['Woman', 'Man', 'Non-binary', 'Prefer not to say'];

/**
 * The shared identity flow: verify mobile by OTP, then collect the details
 * the app genuinely needs — name and gender (email stays optional). Reused
 * both as the full-screen "Login / Sign up" entry from the landing screen
 * and as the booking-verification gate shown right before a queue-join, so
 * there is exactly one place this logic lives. A customer who only needs
 * details (already verified elsewhere) starts straight on that step.
 */
export const AccountOnboarding: React.FC<Props> = ({ gate, onVerified, onProfileSaved, onCancel, intro }) => {
  const [step, setStep] = useState<Step>(gate.reason === 'missing_profile' ? 'details' : 'phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [busy, setBusy] = useState(false);
  const verifiedAuth = useRef<CustomerAuthSession | null>(null);

  const sendCode = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) return setPhoneError('Please enter a valid 10-digit mobile number.');
    setPhoneError('');
    setBusy(true);
    try {
      const result = await realtimeQueueService.requestOtp(cleaned);
      setChallengeId(result.challengeId);
      setDemoCode(result.demoCode || '');
      setStep('code');
    } catch (error) {
      setPhoneError(error instanceof Error ? error.message : 'Unable to send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (code.trim().length < 4) return setCodeError('Please enter the 4-digit code.');
    setCodeError('');
    setBusy(true);
    try {
      const verified = await realtimeQueueService.verifyOtp(challengeId, code.trim());
      const auth: CustomerAuthSession = { token: verified.token, customerId: verified.customerId, phoneNumber: verified.phone };
      saveCustomerAuth(auth);
      verifiedAuth.current = auth;
      onVerified(auth);
      // Same identity may already carry a saved name + gender server-side (a
      // reinstall, a cleared browser) — never ask again if it does.
      const profile = await customerAccountService.getProfile().catch(() => null);
      if (profile && missingProfileFields(profile).length === 0) {
        onProfileSaved(profile);
        return;
      }
      if (profile?.name) setName(profile.name);
      setStep('details');
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : 'That code did not match. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    if (name.trim().length < 2) return setDetailsError('Please enter your name.');
    if (!gender) return setDetailsError('Please select your gender.');
    setDetailsError('');
    setBusy(true);
    try {
      const profile = await customerAccountService.updateProfile({
        name: name.trim(),
        email: email.trim(),
        dateOfBirth: '',
        gender,
        anniversary: '',
        city: '',
      });
      onProfileSaved(profile);
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : 'Could not save your details. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="account-onboarding-screen" className={`relative flex min-h-full flex-col px-5 pb-7 pt-10 ${ui.page}`}>
      {onCancel && (
        <button
          type="button"
          id="onboarding-cancel-btn"
          onClick={onCancel}
          aria-label="Close"
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-9 w-9 place-items-center rounded-full bg-white text-[var(--noq-muted)] ring-1 ring-[var(--noq-border)]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        {step === 'phone' && (
          <>
            <div className="noq-glass-surface mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border text-[var(--noq-accent)]">
              <Smartphone className="h-7 w-7" />
            </div>
            <p className={ui.eyebrow}>{intro?.eyebrow || 'Verify your mobile'}</p>
            <h1 className="mt-2 text-[29px] font-bold leading-[1.12] tracking-[-0.04em]">{intro?.title || 'One quick check.'}</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--noq-muted)]">
              {intro?.description || 'We use your mobile number to hold your place in a queue and let you back in without asking again.'}
            </p>

            <label htmlFor="onboarding-phone-input" className={`mt-7 ${ui.label}`}>
              Mobile number
            </label>
            <div className="flex overflow-hidden rounded-xl border border-[var(--noq-border)] bg-white transition focus-within:border-[#62AAA3] focus-within:ring-2 focus-within:ring-[var(--noq-accent)]/10">
              <span className="flex items-center px-3.5 text-xs font-bold text-[var(--noq-accent)] border-r border-[var(--noq-border)] bg-[var(--noq-base)]">+91</span>
              <input
                id="onboarding-phone-input"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="98765 43210"
                value={phone}
                onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '')); setPhoneError(''); }}
                onKeyDown={(event) => { if (event.key === 'Enter') void sendCode(); }}
                className="h-12 w-full min-w-0 flex-1 bg-transparent px-3.5 text-sm text-[var(--noq-ink)] outline-none placeholder:text-[#879391]"
              />
            </div>
            {phoneError && <p role="alert" className="mt-1.5 text-xs font-semibold text-rose-600">{phoneError}</p>}

            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[var(--noq-border)] bg-white p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--noq-accent)]" />
              <p className="text-[11px] leading-5 text-[var(--noq-ink)]">No spam. Used only to verify it's really you.</p>
            </div>

            <button
              type="button"
              id="onboarding-send-code-btn"
              onClick={() => void sendCode()}
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--noq-accent)] text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Send verification code
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <div className="noq-glass-surface mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border text-[var(--noq-accent)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <p className={ui.eyebrow}>Enter the code</p>
            <h1 className="mt-2 text-[29px] font-bold leading-[1.12] tracking-[-0.04em]">Sent to {phone}</h1>
            {demoCode && (
              <p className="mt-3 rounded-xl bg-[var(--noq-tint-10)] p-3 text-center text-xs font-bold text-[var(--noq-accent)]">Demo code: {demoCode}</p>
            )}

            <input
              id="onboarding-code-input"
              value={code}
              onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 4)); setCodeError(''); }}
              onKeyDown={(event) => { if (event.key === 'Enter') void verifyCode(); }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="4-digit code"
              className="mt-5 h-12 w-full rounded-xl border border-[var(--noq-border)] bg-white px-4 text-center text-lg font-bold tracking-[0.4em] outline-none focus:border-[#62AAA3]"
            />
            {codeError && <p role="alert" className="mt-1.5 text-center text-xs font-semibold text-rose-600">{codeError}</p>}

            <button
              type="button"
              id="onboarding-verify-code-btn"
              onClick={() => void verifyCode()}
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--noq-accent)] text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Verify
            </button>

            <button
              type="button"
              id="onboarding-change-number-btn"
              onClick={() => { setStep('phone'); setCode(''); setCodeError(''); }}
              className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--noq-muted)]"
            >
              <RefreshCw className="h-3 w-3" /> Use a different number
            </button>
          </>
        )}

        {step === 'details' && (
          <>
            <div className="noq-glass-surface mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border text-[var(--noq-accent)]">
              <UserRound className="h-7 w-7" />
            </div>
            <p className={ui.eyebrow}>Almost there</p>
            <h1 className="mt-2 text-[29px] font-bold leading-[1.12] tracking-[-0.04em]">A couple of quick details.</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--noq-muted)]">
              The salon needs your name and gender to call you when it's your turn. Email is optional and can be added later in Profile.
            </p>

            <label htmlFor="onboarding-name-input" className={`mt-7 ${ui.label}`}>
              Full name
            </label>
            <input
              id="onboarding-name-input"
              value={name}
              onChange={(event) => { setName(event.target.value); setDetailsError(''); }}
              autoComplete="name"
              placeholder="Your full name"
              className={ui.field}
            />

            <label htmlFor="onboarding-gender-select" className={`mt-4 ${ui.label}`}>
              Gender
            </label>
            <select
              id="onboarding-gender-select"
              value={gender}
              onChange={(event) => { setGender(event.target.value); setDetailsError(''); }}
              className={ui.field}
            >
              <option value="" disabled>Select gender</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <label htmlFor="onboarding-email-input" className={`mt-4 ${ui.label}`}>
              Email <span className="font-normal normal-case text-[#8A9694]">(optional)</span>
            </label>
            <input
              id="onboarding-email-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void saveDetails(); }}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={ui.field}
            />
            {detailsError && <p role="alert" className="mt-1.5 text-xs font-semibold text-rose-600">{detailsError}</p>}

            <button
              type="button"
              id="onboarding-save-details-btn"
              onClick={() => void saveDetails()}
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--noq-accent)] text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Continue to No-Wait Salon
            </button>
          </>
        )}
      </div>
    </div>
  );
};
