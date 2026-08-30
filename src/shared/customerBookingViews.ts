/**
 * The single resolver behind the customer "My Bookings" screen. Category
 * agnostic by construction: it classifies whatever real booking records the
 * server returns, and knows nothing about Salon vs Gym vs anything else
 * beyond the `categoryId` string it passes through for display.
 *
 * Pure — no fetch, no DOM — so the grouping/labelling rules are unit-testable
 * without rendering the screen.
 */

/** The wire shape of `/api/me/bookings`. Every field is real server data. */
export interface CustomerBookingView {
  id: string;
  /** Queue entry id — the key the Live Ticket / staff surfaces use. */
  queueEntryId?: string;
  businessId: string;
  businessName: string;
  categoryId: string;
  service: string;
  services: string[];
  status: string;
  outcome?: string | null;
  reservedFor?: string | null;
  token?: string | null;
  totalPriceInr?: number | null;
  createdAt: number;
  updatedAt: number;
  serviceCompletedAt?: number | null;
  cancelledAt?: number | null;
  noShowAt?: number | null;
  /** Present for non-queue bookings (gym class / PT) that carry their own kind. */
  kind?: 'queue' | 'class' | 'pt';
  /** Human slot label for a class/PT booking, e.g. "Today · 06:30 PM". */
  slotLabel?: string | null;
}

export type BookingSection = 'active' | 'upcoming' | 'past';

const LIVE_STATUSES = new Set(['Waiting', 'Called', 'Serving']);
const PAST_STATUSES = new Set(['Completed', 'Cancelled', 'NoShow', 'No-show', 'Remove', 'Removed']);

/**
 * One booking -> one section. A terminal outcome always wins over `status`,
 * because a record can legitimately still read "Waiting" in a stale snapshot
 * after it was cancelled.
 */
export function resolveBookingSection(booking: CustomerBookingView): BookingSection {
  if (booking.outcome) return 'past';
  if (PAST_STATUSES.has(booking.status)) return 'past';
  if (booking.serviceCompletedAt || booking.cancelledAt || booking.noShowAt) return 'past';
  if (booking.status === 'Reserved' || booking.kind === 'class' || booking.kind === 'pt') return 'upcoming';
  if (LIVE_STATUSES.has(booking.status)) return 'active';
  return 'upcoming';
}

/** Most recent activity on a record — the one ordering key used everywhere. */
export function bookingStamp(booking: CustomerBookingView): number {
  return (
    booking.serviceCompletedAt ||
    booking.cancelledAt ||
    booking.noShowAt ||
    booking.updatedAt ||
    booking.createdAt
  );
}

export interface GroupedBookings {
  active: CustomerBookingView[];
  upcoming: CustomerBookingView[];
  past: CustomerBookingView[];
  /** True when there is genuinely nothing to show in any section. */
  isEmpty: boolean;
}

/**
 * Active/Upcoming read oldest-first (the next thing to happen sits on top);
 * Past reads newest-first, which is what a history list should do.
 */
export function groupBookings(list: readonly CustomerBookingView[]): GroupedBookings {
  const active: CustomerBookingView[] = [];
  const upcoming: CustomerBookingView[] = [];
  const past: CustomerBookingView[] = [];
  for (const booking of list) {
    const section = resolveBookingSection(booking);
    if (section === 'active') active.push(booking);
    else if (section === 'upcoming') upcoming.push(booking);
    else past.push(booking);
  }
  active.sort((a, b) => a.createdAt - b.createdAt);
  upcoming.sort((a, b) => a.createdAt - b.createdAt);
  past.sort((a, b) => bookingStamp(b) - bookingStamp(a));
  return { active, upcoming, past, isEmpty: !active.length && !upcoming.length && !past.length };
}

export type BookingTone = 'live' | 'good' | 'warn' | 'bad' | 'neutral';

export interface BookingStatusBadge {
  label: string;
  tone: BookingTone;
}

/** The one place a raw status/outcome pair becomes customer-facing wording. */
export function bookingStatusBadge(booking: CustomerBookingView): BookingStatusBadge {
  if (booking.outcome === 'no_show' || booking.status === 'NoShow' || booking.status === 'No-show') {
    return { label: 'Missed', tone: 'bad' };
  }
  if (booking.outcome === 'cancelled_staff') return { label: 'Cancelled by business', tone: 'warn' };
  if (booking.outcome === 'cancelled_customer') return { label: 'Cancelled by you', tone: 'warn' };
  if (booking.outcome === 'removed' || booking.status === 'Remove' || booking.status === 'Removed') {
    return { label: 'Removed', tone: 'warn' };
  }
  if (booking.status === 'Cancelled') return { label: 'Cancelled', tone: 'warn' };
  if (booking.outcome === 'completed' || booking.status === 'Completed') return { label: 'Completed', tone: 'good' };
  if (booking.status === 'Called') return { label: 'Your turn', tone: 'live' };
  if (booking.status === 'Serving') return { label: 'In service', tone: 'live' };
  if (booking.status === 'Waiting') return { label: 'In queue', tone: 'live' };
  if (booking.status === 'Reserved') return { label: 'Reserved', tone: 'neutral' };
  if (booking.kind === 'class') return { label: 'Class booked', tone: 'neutral' };
  if (booking.kind === 'pt') return { label: 'Session booked', tone: 'neutral' };
  return { label: booking.status || 'Booked', tone: 'neutral' };
}

/** "Haircut + Beard Trim" from whichever field actually carries the services. */
export function bookingServiceLabel(booking: CustomerBookingView): string {
  if (booking.services?.length) return booking.services.join(' + ');
  return booking.service || 'Service';
}

/** The secondary line: token / reserved window / slot, whichever is real. */
export function bookingDetailLine(booking: CustomerBookingView): string {
  const parts: string[] = [];
  if (booking.token) parts.push(`Token ${booking.token}`);
  if (booking.reservedFor) parts.push(`Reserved ${booking.reservedFor}`);
  if (booking.slotLabel) parts.push(booking.slotLabel);
  return parts.join(' · ');
}

export function bookingDateLabel(booking: CustomerBookingView): string {
  return new Date(bookingStamp(booking)).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Where tapping a booking goes. Only a genuinely live queue entry opens the
 * Live Ticket; everything else opens the business it belongs to, so a tap
 * never dead-ends and never lies about having a live ticket.
 */
export type BookingRoute =
  | { screen: 'tracking' }
  | { screen: 'salon'; businessId: string };

export function resolveBookingRoute(booking: CustomerBookingView): BookingRoute {
  return resolveBookingSection(booking) === 'active'
    ? { screen: 'tracking' }
    : { screen: 'salon', businessId: booking.businessId };
}
