import React, { useState, useRef, useEffect } from 'react';
import { X, Smartphone, CheckCircle2, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';
import { CustomerAuthSession, OtpAction } from '../types';
import { ui } from './ui';
import { realtimeQueueService } from '../services/realtimeQueueService';

interface OtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingAction: OtpAction | null;
  onVerifySuccess: (auth: CustomerAuthSession) => void;
}

export const OtpModal: React.FC<OtpModalProps> = ({
  isOpen,
  onClose,
  pendingAction,
  onVerifySuccess,
}) => {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [codeError, setCodeError] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep('phone');
      setPhone('');
      setPhoneError('');
      setCodeError('');
      setOtpDigits(['', '', '', '']);
      setGeneratedOtp('');
      setChallengeId('');
      setIsSending(false);
      setIsVerifying(false);
      setResendTimer(0);
      setTimeout(() => phoneInputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = window.setInterval(() => setResendTimer((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendTimer]);

  if (!isOpen) return null;

  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setPhoneError('');
    setIsSending(true);
    try {
      const result = await realtimeQueueService.requestOtp(cleanPhone);
      setChallengeId(result.challengeId);
      setGeneratedOtp(result.demoCode);
      setResendTimer(30);
      setStep('code');
      setOtpDigits(['', '', '', '']);
      setTimeout(() => digitInputRefs.current[0]?.focus(), 150);
    } catch (error) {
      setPhoneError(error instanceof Error ? error.message : 'Unable to send OTP. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    const numeric = val.replace(/\D/g, '');
    const updated = [...otpDigits];
    updated[index] = numeric ? numeric.slice(-1) : '';
    setOtpDigits(updated);
    setCodeError('');

    if (numeric && index < 3) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      if (step === 'phone') handleSendOtp();
      else handleVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    const newDigits = ['', '', '', ''];
    for (let i = 0; i < 4; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    const nextIdx = Math.min(pasted.length, 3);
    digitInputRefs.current[nextIdx]?.focus();
  };

  const handleAutoFill = () => {
    if (!generatedOtp) return;
    setOtpDigits(generatedOtp.split(''));
    setCodeError('');
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setIsResending(true);
    try {
      const result = await realtimeQueueService.requestOtp(phone);
      setChallengeId(result.challengeId);
      setGeneratedOtp(result.demoCode);
      setOtpDigits(['', '', '', '']);
      setCodeError('');
      setResendTimer(30);
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : 'Unable to resend OTP.');
    } finally {
      setIsResending(false);
      digitInputRefs.current[0]?.focus();
    }
  };

  const handleVerify = async () => {
    const entered = otpDigits.join('');
    if (entered.length < 4) {
      setCodeError('Please enter all 4 digits.');
      return;
    }
    setCodeError('');
    setIsVerifying(true);
    try {
      const result = await realtimeQueueService.verifyOtp(challengeId, entered);
      onVerifySuccess({ token: result.token, customerId: result.customerId, phoneNumber: result.phone });
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : 'Unable to verify OTP.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      id="otp-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--noq-ink)]/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="otp-modal-dialog"
        className="relative w-full max-w-sm rounded-2xl bg-[var(--noq-base)] p-6 sm:p-7 shadow-xl border border-[var(--noq-border)] text-[var(--noq-ink)] transition-all transform scale-100"
        role="dialog"
        aria-modal="true"
      >
        <button
          id="otp-close-btn"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--noq-muted)] hover:bg-[var(--noq-border)] hover:text-[var(--noq-ink)] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[var(--noq-accent)]/10 border border-[var(--noq-accent)]/20 flex items-center justify-center text-[var(--noq-accent)] mb-3">
            <Smartphone className="w-6 h-6" />
          </div>
          <h2 className="font-sans text-2xl font-bold text-[var(--noq-ink)] tracking-tight">
            {step === 'phone' ? 'Verify Mobile' : 'Enter 4-Digit Code'}
          </h2>
          <p className="text-xs text-[var(--noq-muted)] mt-1 max-w-[260px] leading-relaxed">
            {step === 'phone'
              ? pendingAction?.type === 'profile'
                ? 'Verify once to securely access your personal profile.'
                : pendingAction?.type === 'slot'
                ? `Hold your slot for ${pendingAction.slot} with instant SMS verification.`
                : 'Join live queue and receive turn alerts on your phone.'
              : `We sent a 4-digit OTP to +91 ${phone.slice(0, 5)} ${phone.slice(5)}`}
          </p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="otp-phone-input" className="block text-xs font-semibold text-[var(--noq-ink)] mb-1.5">
                Mobile Number
              </label>
              <div className="flex overflow-hidden rounded-xl border border-[var(--noq-border)] bg-white transition focus-within:border-[#62AAA3] focus-within:ring-2 focus-within:ring-[var(--noq-accent)]/10">
                <span className="flex items-center px-3.5 text-xs font-bold text-[var(--noq-accent)] border-r border-[var(--noq-border)] bg-[var(--noq-base)]">
                  +91
                </span>
                <input
                  ref={phoneInputRef}
                  id="otp-phone-input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '');
                    setPhone(cleaned);
                    setPhoneError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendOtp();
                  }}
                  className="w-full px-3.5 py-3 text-sm text-[var(--noq-ink)] bg-transparent outline-none placeholder:text-[var(--noq-muted)] font-medium"
                />
              </div>
              {phoneError && (
                <p id="otp-phone-error" className="text-xs font-semibold text-rose-600 mt-1.5">
                  {phoneError}
                </p>
              )}
            </div>

            <div className="p-3.5 bg-white border border-[var(--noq-border)] rounded-2xl flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[var(--noq-accent)] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[var(--noq-ink)] leading-relaxed">
                No spam. You'll only receive live alerts when 1 person is ahead of you.
              </p>
            </div>

            <button
              id="otp-send-code-btn"
              onClick={handleSendOtp}
              disabled={isSending}
              className={`${ui.primaryButton} flex w-full items-center justify-center gap-2`}
            >
              <span>{isSending ? 'Sending OTP…' : 'Get Verification OTP'}</span>
              {isSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Demo Helper Banner */}
            <div className="p-3.5 bg-[var(--noq-accent)]/10 border border-[var(--noq-accent)]/20 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--noq-accent)]">Demo Code:</span>
                <span className="text-sm font-mono font-bold text-[var(--noq-ink)] tracking-widest bg-white px-2 py-0.5 rounded-lg border border-[var(--noq-border)]">
                  {generatedOtp}
                </span>
              </div>
              <button
                type="button"
                id="otp-autofill-btn"
                onClick={handleAutoFill}
                className="text-[11px] font-bold text-[var(--noq-accent)] bg-white hover:bg-[var(--noq-base)] px-3 py-1 rounded-xl border border-[var(--noq-border)] transition cursor-pointer"
              >
                Auto-fill
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--noq-ink)] mb-2 text-center">
                Enter 4-Digit Code
              </label>
              <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      digitInputRefs.current[idx] = el;
                    }}
                    id={`otp-box-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className={`h-14 w-12 rounded-xl border text-center font-sans text-2xl font-bold outline-none transition-all ${
                      codeError
                        ? 'border-rose-400 bg-rose-50/50 text-rose-900'
                        : digit
                          ? 'border-[var(--noq-accent)] bg-white text-[var(--noq-ink)]'
                          : 'border-[var(--noq-border)] bg-white text-[var(--noq-ink)] focus:border-[var(--noq-accent)]'
                    }`}
                  />
                ))}
              </div>
              {codeError && (
                <p id="otp-code-error" className="text-xs font-semibold text-rose-600 mt-2 text-center">
                  {codeError}
                </p>
              )}
            </div>

            <button
              id="otp-confirm-btn"
              onClick={handleVerify}
              disabled={isVerifying}
              className={`${ui.primaryButton} flex w-full items-center justify-center gap-2`}
            >
              {isVerifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>{isVerifying ? 'Verifying…' : pendingAction?.type === 'profile' ? 'Verify & Open Profile' : 'Confirm & Join Queue'}</span>
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                id="otp-change-number-btn"
                onClick={() => setStep('phone')}
                className="text-[var(--noq-muted)] hover:text-[var(--noq-ink)] font-medium transition cursor-pointer"
              >
                Change number
              </button>
              <button
                type="button"
                id="otp-resend-btn"
                onClick={handleResend}
                disabled={isResending || resendTimer > 0}
                className="flex items-center gap-1 text-[var(--noq-accent)] hover:text-[var(--noq-accent-hover)] font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                <span>{resendTimer > 0 ? `Resend in 0:${String(resendTimer).padStart(2, '0')}` : 'Resend OTP'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
