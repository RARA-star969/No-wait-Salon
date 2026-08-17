import React, { useState, useRef, useEffect } from 'react';
import { X, Smartphone, CheckCircle2, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';
import { OtpAction } from '../types';

interface OtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingAction: OtpAction | null;
  onVerifySuccess: (phone: string) => void;
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
  const [isResending, setIsResending] = useState(false);

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
      setTimeout(() => phoneInputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendOtp = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setPhoneError('');
    const randomOtp = String(Math.floor(1000 + Math.random() * 9000));
    setGeneratedOtp(randomOtp);
    setStep('code');
    setOtpDigits(['', '', '', '']);
    setTimeout(() => digitInputRefs.current[0]?.focus(), 150);
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

  const handleResend = () => {
    setIsResending(true);
    const newOtp = String(Math.floor(1000 + Math.random() * 9000));
    setGeneratedOtp(newOtp);
    setOtpDigits(['', '', '', '']);
    setCodeError('');
    setTimeout(() => {
      setIsResending(false);
      digitInputRefs.current[0]?.focus();
    }, 400);
  };

  const handleVerify = () => {
    const entered = otpDigits.join('');
    if (entered.length < 4) {
      setCodeError('Please enter all 4 digits.');
      return;
    }
    if (entered !== generatedOtp) {
      setCodeError('Incorrect OTP. Please check the demo code.');
      return;
    }
    setCodeError('');
    onVerifySuccess(phone);
  };

  return (
    <div
      id="otp-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="otp-modal-dialog"
        className="relative w-full max-w-sm rounded-3xl bg-[#FAF9F6] p-6 sm:p-7 shadow-2xl border border-[#E5E5DF] text-[#1A1A1A] transition-all transform scale-100"
        role="dialog"
        aria-modal="true"
      >
        <button
          id="otp-close-btn"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#7A7A70] hover:bg-[#E5E5DF] hover:text-[#1A1A1A] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#5A5A40]/10 border border-[#5A5A40]/20 flex items-center justify-center text-[#5A5A40] mb-3 shadow-xs">
            <Smartphone className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#1A1A1A] tracking-tight">
            {step === 'phone' ? 'Verify Mobile' : 'Enter 4-Digit Code'}
          </h2>
          <p className="text-xs text-[#7A7A70] mt-1 max-w-[260px] leading-relaxed">
            {step === 'phone'
              ? pendingAction?.type === 'slot'
                ? `Hold your slot for ${pendingAction.slot} with instant SMS verification.`
                : 'Join live queue and receive turn alerts on your phone.'
              : `We sent a 4-digit OTP to +91 ${phone.slice(0, 5)} ${phone.slice(5)}`}
          </p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="otp-phone-input" className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                Mobile Number
              </label>
              <div className="flex rounded-2xl border border-[#E5E5DF] bg-white focus-within:border-[#5A5A40] transition overflow-hidden">
                <span className="flex items-center px-3.5 text-xs font-bold text-[#5A5A40] border-r border-[#E5E5DF] bg-[#FAF9F6]">
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
                  className="w-full px-3.5 py-3 text-sm text-[#1A1A1A] bg-transparent outline-none placeholder:text-[#7A7A70] font-medium"
                />
              </div>
              {phoneError && (
                <p id="otp-phone-error" className="text-xs font-semibold text-rose-600 mt-1.5">
                  {phoneError}
                </p>
              )}
            </div>

            <div className="p-3.5 bg-white border border-[#E5E5DF] rounded-2xl flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#5A5A40] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#1A1A1A] leading-relaxed">
                No spam. You'll only receive live alerts when 1 person is ahead of you.
              </p>
            </div>

            <button
              id="otp-send-code-btn"
              onClick={handleSendOtp}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[#5A5A40] hover:bg-[#4A4A34] text-white font-bold text-sm shadow-lg shadow-[#5A5A40]/20 transition active:scale-[0.99] cursor-pointer"
            >
              <span>Get Verification OTP</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Demo Helper Banner */}
            <div className="p-3.5 bg-[#5A5A40]/10 border border-[#5A5A40]/20 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#5A5A40]">Demo Code:</span>
                <span className="text-sm font-mono font-bold text-[#1A1A1A] tracking-widest bg-white px-2 py-0.5 rounded-lg border border-[#E5E5DF]">
                  {generatedOtp}
                </span>
              </div>
              <button
                type="button"
                id="otp-autofill-btn"
                onClick={handleAutoFill}
                className="text-[11px] font-bold text-[#5A5A40] bg-white hover:bg-[#FAF9F6] px-3 py-1 rounded-xl border border-[#E5E5DF] transition cursor-pointer shadow-2xs"
              >
                Auto-fill
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-2 text-center">
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
                    className={`w-12 h-14 text-center font-serif text-2xl font-bold rounded-2xl border transition-all outline-none ${
                      codeError
                        ? 'border-rose-400 bg-rose-50/50 text-rose-900'
                        : digit
                          ? 'border-[#5A5A40] bg-white text-[#1A1A1A] shadow-xs'
                          : 'border-[#E5E5DF] bg-white text-[#1A1A1A] focus:border-[#5A5A40]'
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
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[#5A5A40] hover:bg-[#4A4A34] text-white font-bold text-sm shadow-lg shadow-[#5A5A40]/20 transition active:scale-[0.99] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm &amp; Join Queue</span>
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                id="otp-change-number-btn"
                onClick={() => setStep('phone')}
                className="text-[#7A7A70] hover:text-[#1A1A1A] font-medium transition cursor-pointer"
              >
                Change number
              </button>
              <button
                type="button"
                id="otp-resend-btn"
                onClick={handleResend}
                disabled={isResending}
                className="flex items-center gap-1 text-[#5A5A40] hover:text-[#4A4A34] font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                <span>Resend OTP</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
