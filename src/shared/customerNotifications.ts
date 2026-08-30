/**
 * The single source of truth for the customer Notification domain — shared by
 * the server (persistence, authorization, audience resolution) and the client
 * (inbox rendering, deep links, preference gating).
 *
 * Everything in here is pure: no DB, no fetch, no DOM. The server owns the
 * authoritative data and the authorization *decisions* stay server-side, but
 * the *rules* those decisions apply live here so both sides can never drift
 * and so every rule is directly unit-testable.
 */

/** Broad grouping used for preference gating and inbox source identity. */
export type NotificationCategory =
  | 'transactional'
  | 'membership'
  | 'business'
  | 'admin'
  | 'review_request';

/**
 * Delivery class. `transactional` is deliberately NOT mutable by preferences:
 * a customer who muted everything must still be told their turn has arrived.
 */
export type NotificationPriority = 'transactional' | 'promotional';

export type NotificationSourceKind = 'system' | 'business' | 'admin';

/** Every notification kind the platform can persist today. */
export type CustomerNotificationType =
  // --- transactional: booking / queue lifecycle ---
  | 'booking_confirmed'
  | 'booking_changed'
  | 'booking_cancelled'
  | 'queue_joined'
  | 'turn_approaching'
  | 'your_turn'
  | 'slot_reminder'
  | 'service_completed'
  | 'payment_confirmed'
  // --- transactional: gym access ---
  | 'gym_checkin'
  | 'gym_checkout'
  | 'class_booking_confirmed'
  | 'pt_booking_confirmed'
  // --- membership lifecycle ---
  | 'membership_claim_received'
  | 'membership_claim_pending'
  | 'membership_claim_approved'
  | 'membership_claim_rejected'
  | 'membership_activated'
  | 'membership_expiring_7d'
  | 'membership_expiring_3d'
  | 'membership_expires_today'
  | 'membership_expired'
  | 'membership_renewal_reminder'
  | 'session_package_low'
  | 'sessions_exhausted'
  // --- business -> customer ---
  | 'business_renewal_reminder'
  | 'business_schedule_notice'
  | 'business_temporary_closure'
  | 'business_trainer_change'
  | 'business_announcement'
  | 'business_offer'
  // --- admin -> customer ---
  | 'admin_targeted'
  | 'admin_platform_announcement'
  | 'admin_maintenance_notice'
  | 'admin_feature_notice'
  | 'admin_policy_notice'
  // --- review ---
  | 'review_request';

type TypeSpec = {
  category: NotificationCategory;
  priority: NotificationPriority;
  /** Default deep-link intent when the stored payload carries nothing better. */
  target: NotificationTargetKind;
};

export type NotificationTargetKind =
  | 'ticket'
  | 'bookings'
  | 'business'
  | 'gym-activity'
  | 'member-hub'
  | 'review'
  | 'notifications'
  | 'home';

/**
 * The catalog. Adding a type here (and nowhere else) is what makes it
 * routable, mutable-or-not, and correctly grouped in the inbox.
 */
export const NOTIFICATION_TYPES: Record<CustomerNotificationType, TypeSpec> = {
  booking_confirmed: { category: 'transactional', priority: 'transactional', target: 'ticket' },
  booking_changed: { category: 'transactional', priority: 'transactional', target: 'ticket' },
  booking_cancelled: { category: 'transactional', priority: 'transactional', target: 'bookings' },
  queue_joined: { category: 'transactional', priority: 'transactional', target: 'ticket' },
  turn_approaching: { category: 'transactional', priority: 'transactional', target: 'ticket' },
  your_turn: { category: 'transactional', priority: 'transactional', target: 'ticket' },
  slot_reminder: { category: 'transactional', priority: 'transactional', target: 'ticket' },
  service_completed: { category: 'transactional', priority: 'transactional', target: 'bookings' },
  payment_confirmed: { category: 'transactional', priority: 'transactional', target: 'bookings' },

  gym_checkin: { category: 'transactional', priority: 'transactional', target: 'member-hub' },
  gym_checkout: { category: 'transactional', priority: 'transactional', target: 'member-hub' },
  class_booking_confirmed: { category: 'transactional', priority: 'transactional', target: 'bookings' },
  pt_booking_confirmed: { category: 'transactional', priority: 'transactional', target: 'bookings' },

  membership_claim_received: { category: 'membership', priority: 'transactional', target: 'gym-activity' },
  membership_claim_pending: { category: 'membership', priority: 'transactional', target: 'gym-activity' },
  membership_claim_approved: { category: 'membership', priority: 'transactional', target: 'member-hub' },
  membership_claim_rejected: { category: 'membership', priority: 'transactional', target: 'gym-activity' },
  membership_activated: { category: 'membership', priority: 'transactional', target: 'member-hub' },
  membership_expiring_7d: { category: 'membership', priority: 'transactional', target: 'member-hub' },
  membership_expiring_3d: { category: 'membership', priority: 'transactional', target: 'member-hub' },
  membership_expires_today: { category: 'membership', priority: 'transactional', target: 'member-hub' },
  membership_expired: { category: 'membership', priority: 'transactional', target: 'gym-activity' },
  membership_renewal_reminder: { category: 'membership', priority: 'promotional', target: 'business' },
  session_package_low: { category: 'membership', priority: 'transactional', target: 'member-hub' },
  sessions_exhausted: { category: 'membership', priority: 'transactional', target: 'member-hub' },

  business_renewal_reminder: { category: 'business', priority: 'promotional', target: 'business' },
  business_schedule_notice: { category: 'business', priority: 'transactional', target: 'business' },
  business_temporary_closure: { category: 'business', priority: 'transactional', target: 'business' },
  business_trainer_change: { category: 'business', priority: 'transactional', target: 'business' },
  business_announcement: { category: 'business', priority: 'promotional', target: 'business' },
  business_offer: { category: 'business', priority: 'promotional', target: 'business' },

  admin_targeted: { category: 'admin', priority: 'transactional', target: 'notifications' },
  admin_platform_announcement: { category: 'admin', priority: 'promotional', target: 'notifications' },
  admin_maintenance_notice: { category: 'admin', priority: 'transactional', target: 'notifications' },
  admin_feature_notice: { category: 'admin', priority: 'promotional', target: 'notifications' },
  admin_policy_notice: { category: 'admin', priority: 'transactional', target: 'notifications' },

  review_request: { category: 'review_request', priority: 'transactional', target: 'review' },
};

export const ALL_NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPES) as CustomerNotificationType[];

export function isKnownNotificationType(value: unknown): value is CustomerNotificationType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPES, value);
}

export function notificationCategory(type: CustomerNotificationType): NotificationCategory {
  return NOTIFICATION_TYPES[type].category;
}

export function notificationPriority(type: CustomerNotificationType): NotificationPriority {
  return NOTIFICATION_TYPES[type].priority;
}

/** The wire/inbox shape. `deepLink` is stored alongside so a notification can
 *  still route correctly years later even if the catalog default changes. */
export interface CustomerNotification {
  id: string;
  type: CustomerNotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  sourceKind: NotificationSourceKind;
  sourceBusinessId: string | null;
  sourceName: string;
  deepLink: NotificationDeepLink;
  readAt: number | null;
  createdAt: number;
}

export interface NotificationDeepLink {
  kind?: NotificationTargetKind;
  businessId?: string;
  bookingId?: string;
  queueEntryId?: string;
}

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

export interface NotificationPreferences {
  /** Marketing/offer style messages. Freely mutable. */
  promotionalEnabled: boolean;
  /** Non-promotional business updates (schedule/closure/trainer changes). */
  businessUpdatesEnabled: boolean;
  /** "HH:MM" 24h, empty when unset. Designed and stored; delivery-side
   *  suppression is intentionally NOT applied to transactional types. */
  quietHoursStart: string;
  quietHoursEnd: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  promotionalEnabled: true,
  businessUpdatesEnabled: true,
  quietHoursStart: '',
  quietHoursEnd: '',
};

/**
 * Whether a given type is suppressed by the customer's preferences.
 * Transactional priority can NEVER be suppressed — that is the "important
 * transactional notifications protected from accidental full mute" rule, and
 * it is enforced here rather than trusted to each call site.
 */
export function isSuppressedByPreferences(
  type: CustomerNotificationType,
  preferences: NotificationPreferences,
): boolean {
  const spec = NOTIFICATION_TYPES[type];
  if (!spec) return false;
  if (spec.priority === 'transactional') return false;
  if (!preferences.promotionalEnabled) return true;
  if (spec.category === 'business' && !preferences.businessUpdatesEnabled) return true;
  return false;
}

/** Normalizes whatever the client sent into a safe preference record. */
export function sanitizePreferences(input: unknown): NotificationPreferences {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<NotificationPreferences>;
  const time = (value: unknown) =>
    typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '';
  return {
    promotionalEnabled: raw.promotionalEnabled !== false,
    businessUpdatesEnabled: raw.businessUpdatesEnabled !== false,
    quietHoursStart: time(raw.quietHoursStart),
    quietHoursEnd: time(raw.quietHoursEnd),
  };
}

/**
 * Quiet hours are *designed* here (and stored), so the settings architecture
 * is ready, but only promotional traffic could ever be held by them. Exposed
 * for tests and for a future delivery scheduler; nothing calls it to drop a
 * transactional alert.
 */
export function inQuietHours(preferences: NotificationPreferences, minutesOfDay: number): boolean {
  const { quietHoursStart, quietHoursEnd } = preferences;
  if (!quietHoursStart || !quietHoursEnd) return false;
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const start = toMinutes(quietHoursStart);
  const end = toMinutes(quietHoursEnd);
  if (start === end) return false;
  return start < end
    ? minutesOfDay >= start && minutesOfDay < end
    : minutesOfDay >= start || minutesOfDay < end; // window wraps midnight
}

/* ------------------------------------------------------------------ */
/* Authorization / audience                                            */
/* ------------------------------------------------------------------ */

/** What the server actually knows about a customer<->business relationship. */
export interface CustomerBusinessLink {
  hasBooking: boolean;
  hasMembership: boolean;
  hasVisit: boolean;
}

export const NO_LINK: CustomerBusinessLink = { hasBooking: false, hasMembership: false, hasVisit: false };

/**
 * A business may only target customers legitimately linked to it. This is the
 * rule the server enforces before writing any business-sourced notification —
 * there is no client path that can bypass it, and no "broadcast to everyone"
 * capability for a business at all.
 */
export function canBusinessNotifyCustomer(link: CustomerBusinessLink): boolean {
  return Boolean(link && (link.hasBooking || link.hasMembership || link.hasVisit));
}

/** Types a business account is permitted to originate. */
export const BUSINESS_SENDABLE_TYPES: CustomerNotificationType[] = [
  'business_renewal_reminder',
  'business_schedule_notice',
  'business_temporary_closure',
  'business_trainer_change',
  'business_announcement',
  'business_offer',
  'membership_renewal_reminder',
  'review_request',
];

/** Types an admin account is permitted to originate. */
export const ADMIN_SENDABLE_TYPES: CustomerNotificationType[] = [
  'admin_targeted',
  'admin_platform_announcement',
  'admin_maintenance_notice',
  'admin_feature_notice',
  'admin_policy_notice',
];

export function isBusinessSendableType(type: unknown): type is CustomerNotificationType {
  return isKnownNotificationType(type) && BUSINESS_SENDABLE_TYPES.includes(type);
}

export function isAdminSendableType(type: unknown): type is CustomerNotificationType {
  return isKnownNotificationType(type) && ADMIN_SENDABLE_TYPES.includes(type);
}

export type AdminAudience =
  | { kind: 'customer'; customerId: string }
  | { kind: 'business'; businessId: string }
  | { kind: 'category'; categoryId: string }
  | { kind: 'city'; city: string }
  | { kind: 'platform' };

/** Parses an untrusted admin audience descriptor; returns null when invalid. */
export function parseAdminAudience(input: unknown): AdminAudience | null {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  switch (text(raw.kind)) {
    case 'customer': {
      const customerId = text(raw.customerId);
      return customerId ? { kind: 'customer', customerId } : null;
    }
    case 'business': {
      const businessId = text(raw.businessId);
      return businessId ? { kind: 'business', businessId } : null;
    }
    case 'category': {
      const categoryId = text(raw.categoryId);
      return categoryId ? { kind: 'category', categoryId: categoryId.toLowerCase() } : null;
    }
    case 'city': {
      const city = text(raw.city);
      return city ? { kind: 'city', city } : null;
    }
    case 'platform':
      return { kind: 'platform' };
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Review requests                                                     */
/* ------------------------------------------------------------------ */

export interface ReviewRequestBookingFacts {
  customerId: string | null;
  businessId: string;
  status: string;
  outcome: string | null;
  serviceCompletedAt: number | null;
}

export interface ReviewRequestEligibilityInput {
  booking: ReviewRequestBookingFacts | null;
  /** The requesting business, from the authenticated staff session. */
  requestingBusinessId: string;
  alreadyReviewed: boolean;
  alreadyRequested: boolean;
}

export type ReviewRequestEligibility =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * The one place that decides whether "Request Review" may fire. Deliberately
 * strict: only a real, completed, customer-linked visit at the requesting
 * business, never twice, and never once a review already exists.
 */
export function reviewRequestEligibility(input: ReviewRequestEligibilityInput): ReviewRequestEligibility {
  const { booking } = input;
  if (!booking) return { ok: false, code: 'NOT_FOUND', message: 'That booking no longer exists.' };
  if (booking.businessId !== input.requestingBusinessId) {
    return { ok: false, code: 'FORBIDDEN', message: 'That booking belongs to a different business.' };
  }
  if (!booking.customerId) {
    return { ok: false, code: 'NO_CUSTOMER', message: 'This visit is not linked to a NOQ customer account.' };
  }
  const completed = booking.outcome === 'completed' || (booking.status === 'Completed' && !booking.outcome);
  if (!completed || !booking.serviceCompletedAt) {
    return { ok: false, code: 'NOT_COMPLETED', message: 'Only a completed service can request a review.' };
  }
  if (input.alreadyReviewed) {
    return { ok: false, code: 'ALREADY_REVIEWED', message: 'This customer has already reviewed this visit.' };
  }
  if (input.alreadyRequested) {
    return { ok: false, code: 'ALREADY_REQUESTED', message: 'A review request was already sent for this visit.' };
  }
  return { ok: true };
}

/** Stable idempotency key — one review request per completed visit, forever. */
export function reviewRequestDedupeKey(queueEntryId: string): string {
  return `review_request:${queueEntryId}`;
}

/**
 * Neutral, rating-agnostic copy. An owner cannot condition the ask on a good
 * rating because the owner never supplies the wording at all.
 */
export function reviewRequestMessage(businessName: string, serviceLabel: string, completedAt: number, now = Date.now()) {
  const when = isSameDay(completedAt, now) ? 'today' : 'recently';
  const service = serviceLabel.trim() || 'visit';
  return {
    title: `${businessName} — How was your visit?`,
    body: `Your ${service} was completed ${when}. Rate your experience.`,
  };
}

/* ------------------------------------------------------------------ */
/* Inbox presentation                                                  */
/* ------------------------------------------------------------------ */

export function unreadCount(list: readonly CustomerNotification[]): number {
  return list.reduce((total, item) => (item.readAt ? total : total + 1), 0);
}

export function isSameDay(a: number, b: number): boolean {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export type NotificationFilter = 'all' | 'unread';

export interface NotificationGroup {
  key: 'today' | 'earlier';
  label: string;
  items: CustomerNotification[];
}

/**
 * Newest-first, filtered, then split into Today / Earlier. Sorting happens
 * here (not in each caller) so the inbox order can never disagree with the
 * badge count or with a re-render after a read toggle.
 */
export function groupNotifications(
  list: readonly CustomerNotification[],
  filter: NotificationFilter = 'all',
  now = Date.now(),
): NotificationGroup[] {
  const visible = [...list]
    .filter((item) => (filter === 'unread' ? !item.readAt : true))
    .sort((a, b) => b.createdAt - a.createdAt);
  const today = visible.filter((item) => isSameDay(item.createdAt, now));
  const earlier = visible.filter((item) => !isSameDay(item.createdAt, now));
  const groups: NotificationGroup[] = [];
  if (today.length) groups.push({ key: 'today', label: 'Today', items: today });
  if (earlier.length) groups.push({ key: 'earlier', label: 'Earlier', items: earlier });
  return groups;
}

/** Human "2m ago" / "3h ago" / date, used by the inbox row. */
export function relativeTimeLabel(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && isSameDay(timestamp, now)) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${Math.max(1, days)}d ago`;
  return new Date(timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/* ------------------------------------------------------------------ */
/* Deep links                                                          */
/* ------------------------------------------------------------------ */

export type NotificationRoute =
  | { screen: 'tracking' }
  | { screen: 'bookings' }
  | { screen: 'notifications' }
  | { screen: 'home' }
  | { screen: 'gym-activity' }
  | { screen: 'salon'; businessId: string }
  | { screen: 'member-hub'; businessId: string }
  | { screen: 'review'; businessId: string; bookingId?: string };

/**
 * Maps a notification to exactly one destination. Every route is a real
 * customer surface — the fallback is the inbox itself, never "everything
 * lands on Home".
 */
export function resolveNotificationRoute(notification: CustomerNotification): NotificationRoute {
  const link = notification.deepLink || {};
  const kind = link.kind || NOTIFICATION_TYPES[notification.type]?.target || 'notifications';
  const businessId = link.businessId || notification.sourceBusinessId || '';
  switch (kind) {
    case 'ticket':
      return { screen: 'tracking' };
    case 'bookings':
      return { screen: 'bookings' };
    case 'gym-activity':
      return { screen: 'gym-activity' };
    case 'business':
      return businessId ? { screen: 'salon', businessId } : { screen: 'bookings' };
    case 'member-hub':
      return businessId ? { screen: 'member-hub', businessId } : { screen: 'gym-activity' };
    case 'review':
      return businessId
        ? { screen: 'review', businessId, bookingId: link.bookingId }
        : { screen: 'bookings' };
    case 'home':
      return { screen: 'home' };
    case 'notifications':
    default:
      return { screen: 'notifications' };
  }
}

/** Short CTA label per destination — what the inbox row's button says. */
export function notificationCtaLabel(route: NotificationRoute): string {
  switch (route.screen) {
    case 'tracking': return 'View live ticket';
    case 'bookings': return 'View booking';
    case 'gym-activity': return 'Gym activity';
    case 'salon': return 'Open business';
    case 'member-hub': return 'Member hub';
    case 'review': return 'Rate your experience';
    case 'home': return 'Explore';
    case 'notifications':
    default: return 'View details';
  }
}
