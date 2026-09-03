import React from 'react';
import { X } from 'lucide-react';

export const ui = {
  page: 'bg-[#F8FAFA] text-[#17201F]',
  card: 'rounded-2xl border border-[#E1E7E6] bg-white',
  cardInteractive: 'rounded-2xl border border-[#E1E7E6] bg-white transition hover:border-[#9CCBC6]',
  primaryButton: 'rounded-xl bg-[#3454FD] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#2746EA] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
  secondaryButton: 'rounded-xl border border-[#DCE5E3] bg-white px-4 py-3 text-sm font-semibold text-[#43504E] transition hover:border-[#3454FD]/40 hover:text-[#3454FD] active:scale-[0.99]',
  field: 'w-full rounded-xl border border-[#DCE5E3] bg-white px-3.5 py-3 text-sm text-[#17201F] outline-none transition placeholder:text-[#879391] focus:border-[#3454FD] focus:ring-2 focus:ring-[#3454FD]/10',
  label: 'mb-1.5 block text-xs font-semibold text-[#35413F]',
  eyebrow: 'text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A8785]',
};

/** Customer-only semantic controls. Staff keeps the legacy `ui` map above;
 * customer flows consume this NOQ hierarchy explicitly. */
export const customerUi = {
  page: 'noq-customer-page text-[var(--noq-ink)]',
  card: 'noq-glass-surface rounded-2xl border',
  primaryButton: 'rounded-xl bg-[var(--noq-accent)] px-4 py-3 text-sm font-bold text-white shadow-[0_14px_28px_-14px_var(--noq-glow)] transition hover:bg-[var(--noq-accent-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
  secondaryButton: 'rounded-xl border border-[var(--noq-glass-border)] bg-white/75 px-4 py-3 text-sm font-semibold text-[var(--noq-ink)] transition hover:border-[var(--noq-accent)]/35 hover:text-[var(--noq-accent)] active:scale-[0.99]',
  field: 'w-full rounded-xl border border-[var(--noq-border)] bg-white/80 px-3.5 py-3 text-sm text-[var(--noq-ink)] outline-none transition placeholder:text-[var(--noq-text-subtle)] focus:border-[var(--noq-accent)] focus:ring-2 focus:ring-[var(--noq-tint-10)]',
  label: 'mb-1.5 block text-xs font-semibold text-[var(--noq-ink)]',
  eyebrow: 'text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--noq-muted)]',
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const variants = {
    primary: ui.primaryButton,
    secondary: ui.secondaryButton,
    ghost: 'rounded-xl px-3 py-2 text-sm font-semibold text-[#60706E] transition hover:bg-[#EEF1FE] hover:text-[#3454FD] active:scale-[0.99]',
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
