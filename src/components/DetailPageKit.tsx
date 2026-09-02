import React from 'react';
import { CheckCircle2, Clock3, ExternalLink, Info, MapPin, Navigation, PhoneCall, Store, X } from 'lucide-react';
import type { NearbySalon } from '../types';

/**
 * Shared business-detail-page building blocks, originally built for
 * SalonDetailPage and lifted here unchanged (aside from generic prop names)
 * so GymDetailPage — and any future category detail page — can reuse the
 * exact same interaction pattern instead of re-implementing a parallel one.
 * One NOQ product, one set of components.
 */

export const QuickAction: React.FC<{ icon: React.ReactElement; label: string; secondary?: string; onClick?: () => void; active?: boolean; disabled?: boolean; surfaceGradient?: string; goldIcon?: boolean; tone?: 'default' | 'gymGlass' }> = ({ icon, label, secondary, onClick, disabled, goldIcon }) => {
  return (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`group relative flex min-h-[78px] w-full flex-col items-center justify-center rounded-[20px] py-3.5 px-1.5 text-center transition-all duration-200 ${
      goldIcon
        ? 'border border-[#FDE68A] bg-gradient-to-b from-[#FFFDF7] to-[#FFF9EE] text-[#D97706] shadow-[0_2px_12px_-2px_rgba(245,158,11,0.12),0_1px_3px_rgba(245,158,11,0.04)]'
        : 'border border-[#E2E8F0]/80 bg-white/95 backdrop-blur-sm text-slate-800 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] hover:bg-white'
    } ${disabled ? 'pointer-events-none opacity-40' : 'active:scale-[0.96]'}`}
  >
    <span
      className={`relative flex items-center justify-center transition-transform duration-200 group-active:scale-95 [&>svg]:h-[22px] [&>svg]:w-[22px] [&>svg]:stroke-[2] ${
        goldIcon
          ? 'text-amber-500 fill-amber-400'
          : 'text-[#2563eb]'
      }`}
    >
      <span className="relative contents">{icon}</span>
    </span>
    <span className={`mt-1.5 line-clamp-1 w-full truncate text-[11px] font-semibold tracking-tight text-center leading-tight ${goldIcon ? 'text-[#D97706]' : 'text-slate-800'}`}>{label}</span>
    {secondary && <span className="mt-0.5 line-clamp-1 text-[8px] text-[var(--noq-muted)]">{secondary}</span>}
  </button>
  );
};

export const SectionTitle: React.FC<{ eyebrow: string; title: string; secondary?: string }> = ({ eyebrow, title, secondary }) => (
  <div className="mb-3 flex items-end justify-between gap-3">
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--noq-muted)]">{eyebrow}</p>
      <h2 className="mt-0.5 text-lg font-bold tracking-[-0.025em]">{title}</h2>
    </div>
    {secondary && <span className="text-[10px] font-semibold text-[var(--category-primary-dark)]">{secondary}</span>}
  </div>
);

/** Generic bottom-sheet shell shared by the quick-action placeholder sheets below. */
export const QuickActionSheetShell: React.FC<{ icon: React.ReactElement; eyebrow: string; title: string; onClose: () => void; children: React.ReactNode }> = ({ icon, eyebrow, title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="w-full rounded-t-3xl bg-[var(--noq-base)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:max-w-sm sm:rounded-3xl sm:pb-6">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--noq-border)] sm:hidden" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--category-tint-10)] text-[var(--category-primary-dark)]">{icon}</span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--category-primary-dark)]">{eyebrow}</p>
            <h2 className="truncate text-lg font-bold text-[var(--noq-ink)]">{title}</h2>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[var(--noq-border)]"><X className="h-4 w-4" /></button>
      </div>
      {children}
    </section>
  </div>
);

/** Business address + reach-out actions — real UI, dummy CTA wiring for now. */
export const AddressSheet: React.FC<{ name: string; address: string; locationLabel: string; phoneNumber?: string; directionsUrl: string; eyebrow?: string; onClose: () => void }> = ({ name, address, locationLabel, phoneNumber, directionsUrl, eyebrow = 'Store location', onClose }) => (
  <QuickActionSheetShell icon={<MapPin className="h-4 w-4" />} eyebrow={eyebrow} title={name} onClose={onClose}>
    <p className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--category-primary-dark)]"><MapPin className="h-3.5 w-3.5 shrink-0" />{locationLabel}</p>
    <p className="mt-2 rounded-2xl border border-[var(--noq-border)] bg-white p-4 text-xs leading-5 text-[var(--noq-muted)] shadow-[0_2px_10px_-6px_var(--noq-glow)] [overflow-wrap:anywhere]">{address}</p>
    <div className="mt-4 grid grid-cols-2 gap-2.5">
      {phoneNumber ? (
        <a href={`tel:${phoneNumber}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--noq-border)] bg-white text-xs font-bold text-[var(--noq-ink)]"><PhoneCall className="h-4 w-4 text-[var(--category-primary-dark)]" />Call</a>
      ) : (
        <span className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--noq-border)] bg-[var(--noq-surface-soft)] text-xs font-semibold text-[var(--noq-text-subtle)]"><PhoneCall className="h-4 w-4" />No number listed</span>
      )}
      <a href={directionsUrl} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--category-primary-dark)] text-xs font-bold text-white"><Navigation className="h-4 w-4" />Directions</a>
    </div>
  </QuickActionSheetShell>
);

/** Timing overview — placeholder structure, ready for a real weekly schedule later. */
export const OpenHoursSheet: React.FC<{ name: string; isOpen: boolean; openingHours: string; eyebrow?: string; onClose: () => void }> = ({ name, isOpen, openingHours, eyebrow = 'Salon timing', onClose }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <QuickActionSheetShell icon={<Clock3 className="h-4 w-4" />} eyebrow={eyebrow} title={name} onClose={onClose}>
      <div className={`mt-4 flex items-center gap-2 rounded-2xl border p-3.5 text-xs font-bold ${isOpen ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
        <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        {isOpen ? 'Open right now' : 'Closed right now'} · {openingHours}
      </div>
      <div className="mt-3 space-y-1 rounded-2xl border border-[var(--noq-border)] bg-white p-3.5">
        {days.map((day) => (
          <div key={day} className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--noq-ink)]">{day}</span>
            <span className="text-[var(--noq-muted)]">{openingHours}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-[var(--noq-text-subtle)]"><Info className="mt-0.5 h-3 w-3 shrink-0" />Per-day timing isn't wired up yet — every day shows the general hours for now.</p>
    </QuickActionSheetShell>
  );
};

/** Directions/help sheet — placeholder structure alongside the real maps link. */
export const DirectionsSheet: React.FC<{ name: string; address: string; directionsUrl: string; onClose: () => void }> = ({ name, address, directionsUrl, onClose }) => (
  <QuickActionSheetShell icon={<Navigation className="h-4 w-4" />} eyebrow="Get there" title={`Directions to ${name}`} onClose={onClose}>
    <p className="mt-4 text-xs leading-5 text-[var(--noq-muted)] [overflow-wrap:anywhere]">{address}</p>
    <a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--category-primary-dark)] text-xs font-bold text-white"><Navigation className="h-4 w-4" />Open in Maps<ExternalLink className="h-3 w-3" /></a>
    <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-[var(--noq-text-subtle)]"><Info className="mt-0.5 h-3 w-3 shrink-0" />In-app turn-by-turn guidance isn't available yet — this opens your device's maps app instead.</p>
  </QuickActionSheetShell>
);

/** Other branches of the same brand — real list when available, honest empty state otherwise. */
export const BranchesSheet: React.FC<{ branches: NearbySalon[]; onClose: () => void }> = ({ branches, onClose }) => (
  <QuickActionSheetShell icon={<Store className="h-4 w-4" />} eyebrow="Same brand" title="Other branches" onClose={onClose}>
    <div className="mt-4 space-y-2">
      {branches.map((branch) => (
        <div key={branch.id} className="rounded-2xl border border-[var(--noq-border)] bg-white p-3.5">
          <p className="text-sm font-bold text-[var(--noq-ink)]">{branch.name}</p>
          <p className="mt-1 text-[10px] text-[var(--noq-muted)]">{branch.distanceKm} km · {branch.liveWaitMinutes ? `${branch.liveWaitMinutes} min wait` : 'No wait'}</p>
        </div>
      ))}
      {branches.length === 0 && (
        <p className="rounded-2xl border border-[var(--noq-border)] bg-white p-4 text-center text-xs text-[var(--noq-muted)]">No other branches nearby yet.</p>
      )}
    </div>
  </QuickActionSheetShell>
);

/** "Been here" — a simple honest visited toggle; no fake visit history invented. */
export const BeenHereSheet: React.FC<{ visited: boolean; subjectLabel?: string; onToggle: () => void; onClose: () => void }> = ({ visited, subjectLabel = 'salon', onToggle, onClose }) => (
  <QuickActionSheetShell icon={<CheckCircle2 className="h-4 w-4" />} eyebrow="Your visits" title="Been here?" onClose={onClose}>
    <p className="mt-4 text-xs leading-5 text-[var(--noq-muted)]">Mark this {subjectLabel} as one you've visited before. Your visit history isn't tracked yet — this is just a personal reminder for now.</p>
    <button
      type="button"
      onClick={onToggle}
      className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${visited ? 'bg-[var(--noq-surface-soft)] text-[var(--noq-muted)]' : 'bg-[var(--category-primary-dark)] text-white'}`}
    >
      <CheckCircle2 className="h-4 w-4" />
      {visited ? 'Marked as visited' : 'Mark as visited'}
    </button>
  </QuickActionSheetShell>
);
