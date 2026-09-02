import React, { useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, Clock, Lock, Scissors, Sparkles, UserCheck, X } from 'lucide-react';
import type { Salon, ServiceItem } from '../types';
import { AVAILABLE_TIME_SLOTS } from '../data/mockData';
import { useRevealOnView } from '../shared/useRevealOnView';
import { ServicesBillSheet } from './ServicesBillSheet';
import { LockedCalendarIcon } from './LockedCalendarIcon';

type Props = {
  salon: Salon;
  services: ServiceItem[];
  onBack: () => void;
  onSelectSlot: (slot: string) => void;
};

/** The slot that reads best against a typical evening rush — a tasteful, non-fabricated nudge. */
const BEST_TIME_SLOT = AVAILABLE_TIME_SLOTS[0];

export const ReserveFutureWindowScreen: React.FC<Props> = ({ salon, services, onBack, onSelectSlot }) => {
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [windowsOpen, setWindowsOpen] = useState(false);
  const [packageOpen, setPackageOpen] = useState(false);
  const [calendarComingSoonOpen, setCalendarComingSoonOpen] = useState(false);
  const totalPriceInr = services.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0);
  const { ref: unlocksRef, revealed: unlocksRevealed } = useRevealOnView<HTMLDivElement>();

  return (
    <div id="reserve-future-window-screen" className="min-h-full bg-[var(--noq-base)] pb-10 animate-in fade-in duration-150">
      {/* Branded hero, same colour language as the salon profile page, so the
          reservation flow reads as one continuous premium surface. */}
      <div className="relative overflow-hidden bg-[var(--noq-accent-deep)] px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,#7890FF_0,transparent_38%),linear-gradient(145deg,#17213D,#3454FD_58%,#1D36C9)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#17213D]/30 via-transparent to-[#17213D]/90" />

        <div className="relative">
          <button
            id="back-to-salon-btn"
            onClick={onBack}
            aria-label="Back to salon details"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>

          {/* Compact salon identity row. */}
          <div className="mt-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-white/10 text-white">
              {salon.logoImageUrl ? <img src={salon.logoImageUrl} alt="" className="h-full w-full object-cover" /> : <Scissors className="h-4 w-4" />}
            </span>
            <span className="min-w-0 truncate text-sm font-bold [overflow-wrap:anywhere]">{salon.name}</span>
          </div>

          <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.18em] text-white/70">Advance reservation</p>
          <h1 className="mt-1 whitespace-nowrap text-[26px] font-bold leading-tight tracking-[-0.03em]">
            Arrive when it matters
          </h1>
          <p className="mt-1 text-xs font-medium text-white/70">Reserve your future slot now.</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
      {/* Calendar: Today/Tomorrow toggle + a gold calendar control with a lock badge overlapping its outside edge. */}
      <div className="flex items-center gap-2.5">
        <div className="flex flex-1 rounded-xl border border-[var(--noq-border)] bg-white p-1">
          {(['today', 'tomorrow'] as const).map((option) => (
            <button
              key={option}
              id={`pill-${option}-btn`}
              type="button"
              onClick={() => setDay(option)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold capitalize transition ${
                day === option ? 'bg-[var(--noq-accent)] text-white' : 'text-[var(--noq-muted)]'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          id="gold-calendar-premium-btn"
          type="button"
          onClick={() => setCalendarComingSoonOpen(true)}
          aria-label="Choose a specific calendar date (premium, coming soon)"
          className="transition active:scale-[0.98]"
        >
          <LockedCalendarIcon size="md" />
        </button>
      </div>

      {/* Selected services summary — no "approx duration" clutter here. */}
      <button
        id="view-package-btn"
        type="button"
        onClick={() => setPackageOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl border border-[var(--noq-border)] bg-white px-4 py-3.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold text-[var(--noq-ink)]">
            {services.length} {services.length === 1 ? 'service' : 'services'} selected
          </span>
          <span className="mt-0.5 block text-sm font-bold text-[var(--noq-accent)]">₹{totalPriceInr}</span>
        </span>
        <span className="shrink-0 text-[11px] font-bold text-[var(--noq-accent)] underline underline-offset-4">View package</span>
      </button>

      {/* Available windows: a compact expandable selector instead of a wall of cards. */}
      <div className="overflow-hidden rounded-2xl border border-[var(--noq-border)] bg-white">
        <button
          id="available-windows-accordion-btn"
          type="button"
          onClick={() => setWindowsOpen((value) => !value)}
          aria-expanded={windowsOpen}
          className="flex w-full items-center justify-between px-4 py-3.5"
        >
          <span className="flex items-center gap-2 text-xs font-bold text-[var(--noq-ink)]">
            <Clock className="h-4 w-4 text-[var(--noq-accent)]" />
            Available windows {day === 'today' ? 'today' : 'tomorrow'}
          </span>
          <ChevronDown className={`h-4 w-4 text-[var(--noq-muted)] transition-transform ${windowsOpen ? 'rotate-180' : ''}`} />
        </button>
        {windowsOpen && (
          <div className="space-y-1.5 border-t border-[var(--noq-border)] p-2">
            {AVAILABLE_TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                id={`slot-${slot.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => onSelectSlot(slot)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--noq-tint-10)]"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--noq-surface-soft)] text-[var(--noq-accent)]">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-bold text-[var(--noq-ink)]">{slot}</span>
                  {slot === BEST_TIME_SLOT && (
                    <span className="rounded-full bg-[var(--noq-tint-10)] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-[var(--noq-accent)]">Best time</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Premium unlocks: one reveal on first view, no continuous motion. */}
      <div
        ref={unlocksRef}
        className={`relative overflow-hidden rounded-2xl p-4 text-white ring-1 ring-[var(--noq-accent-light)]/25 shadow-[0_14px_30px_-18px_var(--noq-glow)] ${unlocksRevealed ? 'premium-reveal-in' : 'premium-reveal-pending'}`}
        style={{ background: 'var(--noq-cta-gradient)' }}
      >
        <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-white" />
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white">Premium unlocks</span>
        </div>
        <div className="relative mt-3 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white"><Clock className="h-3.5 w-3.5" /></span>
            <div>
              <p className="text-xs font-bold">Priority arrival window</p>
              <p className="mt-0.5 text-[11px] leading-4 text-white/60">A wider grace period so a late arrival never loses the slot.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white"><UserCheck className="h-3.5 w-3.5" /></span>
            <div>
              <p className="text-xs font-bold">Auto-hold your favourite stylist</p>
              <p className="mt-0.5 text-[11px] leading-4 text-white/60">Reserve with the same stylist across future visits.</p>
            </div>
          </div>
        </div>
      </div>
      </div>

      <ServicesBillSheet
        open={packageOpen}
        title="Your package"
        eyebrow={`${services.length} ${services.length === 1 ? 'service' : 'services'} selected`}
        services={services}
        onClose={() => setPackageOpen(false)}
      />

      {/* Honest "coming soon" — tapping the locked calendar never silently
          no-ops and never pretends to book a specific future date. */}
      {calendarComingSoonOpen && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/55 sm:items-center" onClick={(event) => { if (event.target === event.currentTarget) setCalendarComingSoonOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="Premium calendar booking" className="w-full rounded-t-3xl bg-[var(--noq-base)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:max-w-sm sm:rounded-3xl sm:pb-6">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--noq-border)] sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <LockedCalendarIcon size="sm" className="!h-9 !w-9" />
                <h2 className="text-lg font-bold text-[var(--noq-ink)]">Premium calendar booking</h2>
              </div>
              <button id="close-calendar-modal-btn" onClick={() => setCalendarComingSoonOpen(false)} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[var(--noq-border)]"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--noq-muted)]">
              Choosing a specific future date is a premium feature that isn't live yet — coming soon. For now, Today and Tomorrow hold your place in the live queue.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-[var(--noq-tint-10)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--noq-accent)]">
              <Lock className="h-3 w-3" /> Coming soon
            </span>
          </section>
        </div>
      )}
    </div>
  );
};
