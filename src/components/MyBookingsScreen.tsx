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
  live: 'bg-[color:var(--category-tint-20,rgba(34,211,238,.2))] text-[color:var(--category-accent,#22D3EE)]',
  good: 'bg-emerald-500/15 text-emerald-300',
  warn: 'bg-amber-500/15 text-amber-300',
  bad: 'bg-rose-500/15 text-rose-300',
  neutral: 'bg-white/10 text-slate-300',
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
      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-white">{booking.businessName}</span>
          <span className="shrink-0 rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {booking.categoryId}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs font-semibold text-slate-300">{bookingServiceLabel(booking)}</p>
        {detail && <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p>}
        <p className="mt-1 text-[10px] font-medium text-slate-500">{bookingDateLabel(booking)}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${TONE_CLASS[badge.tone]}`}>
        {badge.label}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
    </button>
  );
};

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="space-y-2.5">
    <div className="flex items-end justify-between gap-3 px-1">
      <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{title}</h2>
      {hint && <span className="text-[10px] font-semibold text-slate-500">{hint}</span>}
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
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] transition active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
          </button>
        ) : undefined
      }
    />
  );

  if (!auth) {
    return (
      <SafeAreaScreen id="customer-bookings-screen" header={header} className="bg-[#050B0C]" bottomInset="nav">
        <div className="mx-auto flex max-w-sm flex-col items-center px-6 pt-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] text-[color:var(--category-accent,#22D3EE)]">
            <CalendarCheck className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-white">Sign in to see your bookings</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Verify your mobile number to keep your queue tickets, reservations and history synced.
          </p>
          <button
            type="button"
            onClick={onLogin}
            className="mt-7 h-12 w-full rounded-xl bg-[color:var(--category-accent,#22D3EE)] text-sm font-bold text-slate-950"
          >
            Verify mobile number
          </button>
        </div>
      </SafeAreaScreen>
    );
  }

  return (
    <SafeAreaScreen id="customer-bookings-screen" header={header} className="bg-[#050B0C]" bottomInset="nav">
      <div className="space-y-6 px-4 pt-4 sm:px-5">
        {error && (
          <div role="alert" className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {loading && !merged.length && (
          <div className="grid place-items-center py-16">
            <LoaderCircle className="h-6 w-6 animate-spin text-[color:var(--category-accent,#22D3EE)]" />
          </div>
        )}

        {!loading && grouped.isEmpty && !error && (
          <div id="bookings-empty-state" className="mx-auto flex max-w-sm flex-col items-center px-4 pt-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] text-[color:var(--category-accent,#22D3EE)]">
              <CalendarCheck className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-white">No bookings yet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Join a live queue or reserve a slot and it will appear here — with your token, status and full history.
            </p>
            <button
              type="button"
              onClick={onExplore}
              className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--category-accent,#22D3EE)] text-sm font-bold text-slate-950"
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
