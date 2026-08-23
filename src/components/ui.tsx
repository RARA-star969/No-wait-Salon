import React from 'react';
import { X } from 'lucide-react';

export const ui = {
  page: 'bg-[#F8FAFA] text-[#17201F]',
  card: 'rounded-2xl border border-[#E1E7E6] bg-white',
  cardInteractive: 'rounded-2xl border border-[#E1E7E6] bg-white transition hover:border-[#9CCBC6]',
  primaryButton: 'rounded-xl bg-[#0F766E] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0B665F] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
  secondaryButton: 'rounded-xl border border-[#DCE5E3] bg-white px-4 py-3 text-sm font-semibold text-[#43504E] transition hover:border-[#9CCBC6] hover:text-[#0F766E] active:scale-[0.99]',
  field: 'w-full rounded-xl border border-[#DCE5E3] bg-white px-3.5 py-3 text-sm text-[#17201F] outline-none transition placeholder:text-[#879391] focus:border-[#62AAA3] focus:ring-2 focus:ring-[#0F766E]/10',
  label: 'mb-1.5 block text-xs font-semibold text-[#35413F]',
  eyebrow: 'text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A8785]',
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const variants = {
    primary: ui.primaryButton,
    secondary: ui.secondaryButton,
    ghost: 'rounded-xl px-3 py-2 text-sm font-semibold text-[#60706E] transition hover:bg-[#EEF4F3] hover:text-[#0F766E] active:scale-[0.99]',
    danger: 'rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 active:scale-[0.99]',
  };
  return <button className={`${variants[variant]} ${className}`} {...props} />;
}

export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`${ui.card} ${className}`} {...props} />;
}

interface ModalShellProps {
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  className?: string;
}

export function ModalShell({ onClose, children, labelledBy, className = '' }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17201F]/35 p-4 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative w-full rounded-2xl border border-[#E1E7E6] bg-[#F8FAFA] shadow-xl ${className}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-[#6F7C7A] transition hover:bg-[#E8EFEE] hover:text-[#17201F]"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
