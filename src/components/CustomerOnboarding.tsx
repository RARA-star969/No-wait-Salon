import React, { useState } from 'react';
import { BellRing, ChevronRight, Clock3, Scissors, ShieldCheck } from 'lucide-react';
import { Button } from './ui';

type CustomerOnboardingProps = {
  onComplete: () => void;
};

const STEPS = [
  {
    eyebrow: 'Welcome to No-Wait Salon',
    title: 'Know the wait before you go.',
    description: 'See nearby salons, live queue length, and a clear wait estimate before leaving home.',
    icon: Clock3,
    detail: 'Live wait times, updated as the queue moves',
  },
  {
    eyebrow: 'Book with confidence',
    title: 'Choose a service. Keep your place.',
    description: 'Pick what you need, join the live queue or reserve a time, and confirm securely with OTP.',
    icon: Scissors,
    detail: 'Simple booking with no counter-side confusion',
  },
  {
    eyebrow: 'Stay in control',
    title: 'Your turn, tracked live.',
    description: 'Follow your queue position and get timely updates when the salon is almost ready for you.',
    icon: BellRing,
    detail: 'One continuous journey from booking to completion',
  },
] as const;

export function CustomerOnboarding({ onComplete }: CustomerOnboardingProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-[#F8FAFA] text-[#17201F]">
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#DDF2EF] to-transparent" aria-hidden="true" />
      <div className="absolute -right-20 top-12 h-52 w-52 rounded-full border border-[#BFDCD8] opacity-60" aria-hidden="true" />
      <div className="absolute -left-16 top-36 h-36 w-36 rounded-full bg-[#EDF7F5]" aria-hidden="true" />

      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2.5" aria-label="No-Wait Salon">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F766E] text-white">
            <Scissors className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold tracking-[-0.02em]">No-Wait Salon</span>
        </div>
        {!isLast && (
          <button
            type="button"
            onClick={onComplete}
            className="rounded-lg px-2.5 py-2 text-xs font-semibold text-[#60706E] transition hover:bg-white/70 hover:text-[#0F766E]"
          >
            Skip
          </button>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-8 pt-5">
        <div key={step} className="animate-in fade-in slide-in-from-right-3 duration-300">
          <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-[28px] border border-[#C6E1DD] bg-white text-[#0F766E] shadow-[0_14px_40px_rgba(15,118,110,0.10)]">
            <Icon className="h-10 w-10" strokeWidth={1.7} />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0F766E]">{current.eyebrow}</p>
          <h1 className="mt-3 max-w-[360px] text-[31px] font-bold leading-[1.08] tracking-[-0.045em] text-[#17201F]">
            {current.title}
          </h1>
          <p className="mt-4 max-w-[370px] text-[13px] leading-6 text-[#667371]">{current.description}</p>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#DDE9E7] bg-white/80 p-3.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E5F3F1] text-[#0F766E]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <p className="text-[11px] font-semibold leading-5 text-[#43504E]">{current.detail}</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 border-t border-[#E2E9E8] bg-white/90 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-center gap-2" aria-label={`Onboarding step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === step ? 'w-7 bg-[#0F766E]' : 'w-1.5 bg-[#C9D5D3]'
              }`}
              aria-hidden="true"
            />
          ))}
        </div>

        <Button
          type="button"
          onClick={() => (isLast ? onComplete() : setStep((value) => value + 1))}
          className="flex w-full items-center justify-center gap-2 py-3.5"
        >
          {isLast ? 'Find a salon' : 'Continue'}
          <ChevronRight className="h-4 w-4" />
        </Button>
        <p className="mt-3 text-center text-[10px] leading-4 text-[#879391]">
          {isLast ? 'You can change notification preferences anytime.' : 'No account needed to explore nearby salons.'}
        </p>
      </div>
    </div>
  );
}
