import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, ChevronRight, Compass, LoaderCircle, RefreshCw } from 'lucide-react';
import type { CustomerAuthSession } from '../types';
import { customerAccountService } from '../services/customerAccountService';
import {
  bookingDateLabel,
  bookingDetailLine,
  bookingServiceLabel,
  bookingStatusBadge,
  groupBookings,
  resolveBookingRoute,
  type BookingRoute,
  type CustomerBookingView,
} from '../shared/customerBookingViews';
import { SafeAreaHeader, SafeAreaScreen } from './SafeAreaScreen';

/**
 * The ONE "My Bookings" screen. Both the bottom-nav Bookings tab and
 * Profile -> "My bookings & history" render this same component with the same
 * props — there is no second bookings implementation anywhere, so the two
 * entry points can never drift apart.
 *
 * Category-agnostic by construction: it renders whatever real records
 * /api/me/bookings returns (salon queue + reservations, gym class/PT
 * bookings), classified by the shared resolver. Nothing is synthesised for a
 * customer with no history — they get the empty state.
 */

export interface MyBookingsScreenProps {
  auth: CustomerAuthSession | null;
  onBack: () => void;
  onLogin: () => void;
  onExplore: () => void;
  /** Opens the resolved destination — Live Ticket or the business detail. */
  onOpenBooking: (route: BookingRoute, booking: CustomerBookingView) => void;
  /** Live entry from the realtime queue, so an active ticket shows instantly
   *  even before the history fetch resolves. */
  liveBookingHint?: CustomerBookingView | null;
}

const TONE_CLASS: Record<string, string> = {
  live: 'bg-[var(--noq-tint-20)] text-[var(--noq-accent)]',
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  bad: 'bg-rose-50 text-rose-700',
  neutral: 'bg-[var(--noq-surface-soft)] text-[var(--noq-muted)]',
};

const BookingCard: React.FC<{
  booking: CustomerBookingView;
  onOpen: () => void;
}> = ({ booking, onOpen }) => {
  const badge = bookingStatusBadge(booking);
  const detail = bookingDetailLine(booking);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="noq-glass-surface flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-[var(--noq-ink)]">{booking.businessName}</span>
          <span className="shrink-0 rounded-full bg-[var(--noq-tint-10)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--noq-muted)]">
            {booking.categoryId}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs font-semibold text-[var(--noq-muted)]">{bookingServiceLabel(booking)}</p>
        {detail && <p className="mt-0.5 truncate text-[11px] text-[var(--noq-text-subtle)]">{detail}</p>}
        <p className="mt-1 text-[10px] font-medium text-[var(--noq-text-subtle)]">{bookingDateLabel(booking)}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${TONE_CLASS[badge.tone]}`}>
        {badge.label}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--noq-text-subtle)]" />
    </button>
  );
};

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="space-y-2.5">
    <div className="flex items-end justify-between gap-3 px-1">
      <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--noq-muted)]">{title}</h2>
      {hint && <span className="text-[10px] font-semibold text-[var(--noq-text-subtle)]">{hint}</span>}
    </div>
    {children}
  </section>
);

export const MyBookingsScreen: React.FC<MyBookingsScreenProps> = ({
  auth,
  onBack,
  onLogin,
  onExplore,
  onOpenBooking,
  liveBookingHint,
}) => {
  const [bookings, setBookings] = useState<CustomerBookingView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!auth?.token) { setBookings([]); return; }
    setLoading(true);
    setError('');
    try {
      const result = await customerAccountService.getBookings();
      if (signal?.cancelled) return;
      setBookings(Array.isArray(result.bookings) ? (result.bookings as unknown as CustomerBookingView[]) : []);
    } catch (reason) {
      if (signal?.cancelled) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load your bookings.');
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    return () => { signal.cancelled = true; };
  }, [load]);

  // The live queue entry the app already holds is merged in by queue-entry id
  // so a ticket created seconds ago is never missing while the fetch settles.
  const merged = React.useMemo(() => {
    if (!liveBookingHint) return bookings;
    const exists = bookings.some(
      (item) => item.queueEntryId && item.queueEntryId === liveBookingHint.queueEntryId,
    );
    return exists ? bookings : [liveBookingHint, ...bookings];
  }, [bookings, liveBookingHint]);

  const grouped = groupBookings(merged);

  const header = (
    <SafeAreaHeader
      title="My Bookings"
      subtitle="Every booking linked to your account"
      onBack={onBack}
      backLabel="Back"
      actions={
        auth ? (
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh bookings"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--noq-glass-border)] bg-white/75 transition active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 text-[var(--noq-accent)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        ) : undefined
      }
    />
  );

  if (!auth) {
    return (
      <SafeAreaScreen id="customer-bookings-screen" header={header} className="noq-customer-page" bottomInset="nav">
        <div className="mx-auto flex max-w-sm flex-col items-center px-6 pt-16 text-center">
          <div className="noq-glass-surface flex h-16 w-16 items-center justify-center rounded-2xl border text-[var(--noq-accent)]">
            <CalendarCheck className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-[var(--noq-ink)]">Sign in to see your bookings</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--noq-muted)]">
            Verify your mobile number to keep your queue tickets, reservations and history synced.
          </p>
          <button
            type="button"
            onClick={onLogin}
            className="mt-7 h-12 w-full rounded-xl bg-[var(--noq-accent)] text-sm font-bold text-white shadow-[0_14px_28px_-14px_var(--noq-glow)]"
          >
            Verify mobile number
          </button>
        </div>
      </SafeAreaScreen>
    );
  }

  return (
    <SafeAreaScreen id="customer-bookings-screen" header={header} className="noq-customer-page" bottomInset="nav">
      <div className="space-y-6 px-4 pt-4 sm:px-5">
        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {loading && !merged.length && (
          <div className="grid place-items-center py-16">
            <LoaderCircle className="h-6 w-6 animate-spin text-[color:var(--category-accent,var(--noq-accent))]" />
          </div>
        )}

        {!loading && grouped.isEmpty && !error && (
          <div id="bookings-empty-state" className="mx-auto flex max-w-sm flex-col items-center px-4 pt-14 text-center">
            <div className="noq-glass-surface flex h-16 w-16 items-center justify-center rounded-2xl border text-[var(--noq-accent)]">
              <CalendarCheck className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-[var(--noq-ink)]">No bookings yet</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--noq-muted)]">
              Join a live queue or reserve a slot and it will appear here — with your token, status and full history.
            </p>
            <button
              type="button"
              onClick={onExplore}
              className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--noq-accent)] text-sm font-bold text-white shadow-[0_14px_28px_-14px_var(--noq-glow)]"
            >
              <Compass className="h-4 w-4" />
              Explore businesses
            </button>
          </div>
        )}

        {grouped.active.length > 0 && (
          <Section title="Active now" hint="Live queue & tickets">
            <div className="space-y-2.5">
              {grouped.active.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onOpen={() => onOpenBooking(resolveBookingRoute(booking), booking)}
                />
              ))}
            </div>
          </Section>
        )}

        {grouped.upcoming.length > 0 && (
          <Section title="Upcoming" hint="Reserved & scheduled">
            <div className="space-y-2.5">
              {grouped.upcoming.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onOpen={() => onOpenBooking(resolveBookingRoute(booking), booking)}
                />
              ))}
            </div>
          </Section>
        )}

        {grouped.past.length > 0 && (
          <Section title="Past" hint={`${grouped.past.length} record${grouped.past.length === 1 ? '' : 's'}`}>
            <div className="space-y-2.5">
              {grouped.past.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onOpen={() => onOpenBooking(resolveBookingRoute(booking), booking)}
                />
              ))}
            </div>
          </Section>
        )}
      </div>
    </SafeAreaScreen>
  );
};
