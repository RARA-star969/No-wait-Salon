import React, { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import type { AppReadiness } from '../shared/profileReadiness';
import type { CustomerAuthSession, CustomerProfile } from '../types';
import { realtimeQueueService } from '../services/realtimeQueueService';
import { customerAccountService, saveCustomerAuth } from '../services/customerAccountService';
import { ui } from './ui';

type Props = {
  /** The non-ready readiness result that sent the customer here. */
  gate: Extract<AppReadiness, { kind: 'onboarding_required' }>;
  onVerified: (auth: CustomerAuthSession) => void;
  onProfileSaved: (profile: CustomerProfile) => void;
};

type Step = 'phone' | 'code' | 'name';

/**
 * The identity half of the first-run onboarding gate: verify mobile by OTP,
 * then collect the one field the app genuinely needs — a name. Runs full
 * screen, before Home, never mid-journey. A customer who only needs a name
 * (already verified elsewhere) starts straight on that step.
 */
export const AccountOnboarding: React.FC<Props> = ({ gate, onVerified, onProfileSaved }) => {
  const [step, setStep] = useState<Step>(gate.reason === 'missing_profile' ? 'name' : 'phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
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
      // Same identity may already carry a saved name server-side (a reinstall,
      // a cleared browser) — never ask again if it does.
      const profile = await customerAccountService.getProfile().catch(() => null);
      if (profile?.name && profile.name.trim().length >= 2) {
        onProfileSaved(profile);
        return;
      }
      setStep('name');
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : 'That code did not match. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (name.trim().length < 2) return setNameError('Please enter your name.');
    setNameError('');
    setBusy(true);
    try {
      const profile = await customerAccountService.updateProfile({
        name: name.trim(),
        email: '',
        dateOfBirth: '',
        gender: '',
        anniversary: '',
        city: '',
      });
      onProfileSaved(profile);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : 'Could not save your details. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="account-onboarding-screen" className={`flex min-h-full flex-col px-5 pb-7 pt-10 ${ui.page}`}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        {step === 'phone' && (
          <>
            <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#CDE3E0] bg-[#E8F5F3] text-[#0F766E]">
              <Smartphone className="h-7 w-7" />
            </div>
            <p className={ui.eyebrow}>Verify your mobile</p>
            <h1 className="mt-2 text-[29px] font-bold leading-[1.12] tracking-[-0.04em]">One quick check.</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#667371]">
              We use your mobile number to hold your place in a queue and let you back in without asking again.
            </p>

            <label htmlFor="onboarding-phone-input" className={`mt-7 ${ui.label}`}>
              Mobile number
            </label>
            <div className="flex overflow-hidden rounded-xl border border-[#DCE5E3] bg-white transition focus-within:border-[#62AAA3] focus-within:ring-2 focus-within:ring-[#0F766E]/10">
              <span className="flex items-center px-3.5 text-xs font-bold text-[#0F766E] border-r border-[#E1E7E6] bg-[#F8FAFA]">+91</span>
              <input
                id="onboarding-phone-input"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="98765 43210"
                value={phone}
                onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '')); setPhoneError(''); }}
                onKeyDown={(event) => { if (event.key === 'Enter') void sendCode(); }}
                className="h-12 w-full min-w-0 flex-1 bg-transparent px-3.5 text-sm text-[#17201F] outline-none placeholder:text-[#879391]"
              />
            </div>
            {phoneError && <p role="alert" className="mt-1.5 text-xs font-semibold text-rose-600">{phoneError}</p>}

            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0F766E]" />
              <p className="text-[11px] leading-5 text-[#17201F]">No spam. Used only to verify it's really you.</p>
            </div>

            <button
              type="button"
              id="onboarding-send-code-btn"
              onClick={() => void sendCode()}
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Send verification code
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#CDE3E0] bg-[#E8F5F3] text-[#0F766E]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <p className={ui.eyebrow}>Enter the code</p>
            <h1 className="mt-2 text-[29px] font-bold leading-[1.12] tracking-[-0.04em]">Sent to {phone}</h1>
            {demoCode && (
              <p className="mt-3 rounded-xl bg-[#F1FAF9] p-3 text-center text-xs font-bold text-[#0F766E]">Demo code: {demoCode}</p>
            )}

            <input
              id="onboarding-code-input"
              value={code}
              onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 4)); setCodeError(''); }}
              onKeyDown={(event) => { if (event.key === 'Enter') void verifyCode(); }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="4-digit code"
              className="mt-5 h-12 w-full rounded-xl border border-[#D7E2E0] bg-white px-4 text-center text-lg font-bold tracking-[0.4em] outline-none focus:border-[#62AAA3]"
            />
            {codeError && <p role="alert" className="mt-1.5 text-center text-xs font-semibold text-rose-600">{codeError}</p>}

            <button
              type="button"
              id="onboarding-verify-code-btn"
              onClick={() => void verifyCode()}
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Verify
            </button>

            <button
              type="button"
              id="onboarding-change-number-btn"
              onClick={() => { setStep('phone'); setCode(''); setCodeError(''); }}
              className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#60706E]"
            >
              <RefreshCw className="h-3 w-3" /> Use a different number
            </button>
          </>
        )}

        {step === 'name' && (
          <>
            <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#CDE3E0] bg-[#E8F5F3] text-[#0F766E]">
              <UserRound className="h-7 w-7" />
            </div>
            <p className={ui.eyebrow}>Almost there</p>
            <h1 className="mt-2 text-[29px] font-bold leading-[1.12] tracking-[-0.04em]">What should we call you?</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#667371]">
              Just your name — the salon needs it to call you when it's your turn. Everything else is optional and can be added later in Profile.
            </p>

            <label htmlFor="onboarding-name-input" className={`mt-7 ${ui.label}`}>
              Full name
            </label>
            <input
              id="onboarding-name-input"
              value={name}
              onChange={(event) => { setName(event.target.value); setNameError(''); }}
              onKeyDown={(event) => { if (event.key === 'Enter') void saveName(); }}
              autoComplete="name"
              placeholder="Your full name"
              className={ui.field}
            />
            {nameError && <p role="alert" className="mt-1.5 text-xs font-semibold text-rose-600">{nameError}</p>}

            <button
              type="button"
              id="onboarding-save-name-btn"
              onClick={() => void saveName()}
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
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
