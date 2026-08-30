/**
 * Server side of the customer Notification domain.
 *
 * Everything a customer sees in the in-app inbox is persisted here, scoped to
 * the authenticated customer, before any push transport is attempted. Push is
 * a *delivery* concern layered on top (see `PushTransport` below); the inbox
 * is the durable record and is never conditional on push succeeding.
 *
 * Authorization decisions live here and only here for the write paths:
 *   - a business may only target customers legitimately linked to it,
 *   - an admin may target a customer / business / category / city / platform,
 *   - a customer may only ever read and mark their own rows.
 * The rules those decisions apply are the pure ones in
 * src/shared/customerNotifications.ts, so they are directly unit-testable.
 */

import type express from 'express';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  canBusinessNotifyCustomer,
  isAdminSendableType,
  isBusinessSendableType,
  isKnownNotificationType,
  isSuppressedByPreferences,
  notificationCategory,
  notificationPriority,
  parseAdminAudience,
  reviewRequestDedupeKey,
  reviewRequestEligibility,
  reviewRequestMessage,
  sanitizePreferences,
  type CustomerNotification,
  type CustomerNotificationType,
  type NotificationDeepLink,
  type NotificationPreferences,
  type NotificationSourceKind,
} from '../src/shared/customerNotifications.ts';

export const NOTIFICATION_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS customer_notification (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'transactional',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    source_kind TEXT NOT NULL DEFAULT 'system',
    source_business_id TEXT,
    source_name TEXT NOT NULL DEFAULT 'NOQ',
    deep_link_json TEXT NOT NULL DEFAULT '{}',
    dedupe_key TEXT NOT NULL DEFAULT '',
    actor_kind TEXT NOT NULL DEFAULT 'system',
    actor_id TEXT NOT NULL DEFAULT '',
    read_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS customer_notification_customer_idx ON customer_notification(customer_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS customer_notification_unread_idx ON customer_notification(customer_id, read_at);
  CREATE UNIQUE INDEX IF NOT EXISTS customer_notification_dedupe_idx
    ON customer_notification(customer_id, dedupe_key) WHERE dedupe_key <> '';

  CREATE TABLE IF NOT EXISTS customer_notification_preference (
    customer_id TEXT PRIMARY KEY,
    promotional_enabled INTEGER NOT NULL DEFAULT 1,
    business_updates_enabled INTEGER NOT NULL DEFAULT 1,
    quiet_hours_start TEXT NOT NULL DEFAULT '',
    quiet_hours_end TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customer_push_device (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'web',
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS customer_push_device_customer_idx ON customer_push_device(customer_id, updated_at DESC);
`;

/**
 * The push transport seam. No external provider credentials exist in this
 * deployment, so the default transport reports "not configured" and the
 * platform records that honestly instead of claiming a delivery happened.
 * A real FCM/APNs adapter drops in here without touching any call site.
 */
export interface PushTransport {
  readonly name: string;
  readonly configured: boolean;
  deliver(input: {
    tokens: string[];
    title: string;
    body: string;
    data: Record<string, string>;
  }): Promise<{ delivered: number; skippedReason?: string }>;
}

export const unconfiguredPushTransport: PushTransport = {
  name: 'none',
  configured: false,
  async deliver() {
    // Deliberately reports zero delivered rather than a fabricated success.
    return { delivered: 0, skippedReason: 'push_provider_not_configured' };
  },
};

export interface NotifyInput {
  customerId: string;
  type: CustomerNotificationType;
  title: string;
  body?: string;
  sourceKind?: NotificationSourceKind;
  sourceBusinessId?: string | null;
  sourceName?: string;
  deepLink?: NotificationDeepLink;
  /** When set, a second write with the same key for the same customer is a
   *  no-op. This is what makes every generator safely re-runnable. */
  dedupeKey?: string;
  actorKind?: 'system' | 'business' | 'admin' | 'customer';
  actorId?: string;
  createdAt?: number;
}

export interface NotificationStoreOptions {
  db: DatabaseSync;
  /** Mirrors new rows into Postgres when that persistence layer is active. */
  flush?: (tables: string[]) => void;
  pushTransport?: PushTransport;
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

export class NotificationStore {
  private readonly db: DatabaseSync;
  private readonly flush: (tables: string[]) => void;
  readonly push: PushTransport;

  constructor(options: NotificationStoreOptions) {
    this.db = options.db;
    this.flush = options.flush || (() => {});
    this.push = options.pushTransport || unconfiguredPushTransport;
    this.db.exec(NOTIFICATION_SCHEMA_SQL);
  }

  preferences(customerId: string): NotificationPreferences {
    const row = this.db
      .prepare('SELECT * FROM customer_notification_preference WHERE customer_id = ?')
      .get(customerId) as Record<string, unknown> | undefined;
    if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    return {
      promotionalEnabled: Number(row.promotional_enabled) !== 0,
      businessUpdatesEnabled: Number(row.business_updates_enabled) !== 0,
      quietHoursStart: String(row.quiet_hours_start || ''),
      quietHoursEnd: String(row.quiet_hours_end || ''),
    };
  }

  savePreferences(customerId: string, input: unknown): NotificationPreferences {
    const next = sanitizePreferences(input);
    this.db
      .prepare(
        `INSERT INTO customer_notification_preference
           (customer_id, promotional_enabled, business_updates_enabled, quiet_hours_start, quiet_hours_end, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(customer_id) DO UPDATE SET
           promotional_enabled = excluded.promotional_enabled,
           business_updates_enabled = excluded.business_updates_enabled,
           quiet_hours_start = excluded.quiet_hours_start,
           quiet_hours_end = excluded.quiet_hours_end,
           updated_at = excluded.updated_at`,
      )
      .run(
        customerId,
        next.promotionalEnabled ? 1 : 0,
        next.businessUpdatesEnabled ? 1 : 0,
        next.quietHoursStart,
        next.quietHoursEnd,
        Date.now(),
      );
    this.flush(['customer_notification_preference']);
    return next;
  }

  /**
   * Persists one notification for one customer. Returns the stored row, or
   * null when it was suppressed by preferences or already existed (dedupe).
   * Never throws for a duplicate — generators are expected to be re-run.
   */
  notify(input: NotifyInput): CustomerNotification | null {
    if (!input.customerId || !isKnownNotificationType(input.type)) return null;
    const title = text(input.title, 160);
    if (!title) return null;
    if (isSuppressedByPreferences(input.type, this.preferences(input.customerId))) return null;

    const dedupeKey = text(input.dedupeKey, 200);
    if (dedupeKey) {
      const existing = this.db
        .prepare('SELECT id FROM customer_notification WHERE customer_id = ? AND dedupe_key = ?')
        .get(input.customerId, dedupeKey);
      if (existing) return null;
    }

    const id = `notif_${randomUUID()}`;
    const createdAt = input.createdAt || Date.now();
    const row = {
      id,
      customer_id: input.customerId,
      type: input.type,
      category: notificationCategory(input.type),
      priority: notificationPriority(input.type),
      title,
      body: text(input.body, 600),
      source_kind: input.sourceKind || 'system',
      source_business_id: input.sourceBusinessId || null,
      source_name: text(input.sourceName, 120) || 'NOQ',
      deep_link_json: JSON.stringify(input.deepLink || {}),
      dedupe_key: dedupeKey,
      actor_kind: input.actorKind || 'system',
      actor_id: text(input.actorId, 120),
      read_at: null as number | null,
      created_at: createdAt,
    };
    try {
      this.db
        .prepare(
          `INSERT INTO customer_notification
             (id, customer_id, type, category, priority, title, body, source_kind, source_business_id,
              source_name, deep_link_json, dedupe_key, actor_kind, actor_id, read_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          row.id, row.customer_id, row.type, row.category, row.priority, row.title, row.body,
          row.source_kind, row.source_business_id, row.source_name, row.deep_link_json,
          row.dedupe_key, row.actor_kind, row.actor_id, row.read_at, row.created_at,
        );
    } catch {
      // Unique dedupe collision from a concurrent writer — treat as delivered.
      return null;
    }
    this.flush(['customer_notification']);
    void this.attemptPush(row.customer_id, row.title, row.body, {
      notificationId: row.id,
      type: row.type,
    });
    return toView(row);
  }

  /** Best-effort push fan-out. Inbox persistence above is already committed. */
  private async attemptPush(customerId: string, title: string, body: string, data: Record<string, string>) {
    if (!this.push.configured) return;
    try {
      const tokens = (this.db
        .prepare('SELECT token FROM customer_push_device WHERE customer_id = ?')
        .all(customerId) as Array<{ token: string }>).map((entry) => entry.token);
      if (!tokens.length) return;
      await this.push.deliver({ tokens, title, body, data });
    } catch {
      // A failed push never invalidates the persisted inbox record.
    }
  }

  list(customerId: string, limit = 100): CustomerNotification[] {
    const rows = this.db
      .prepare('SELECT * FROM customer_notification WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(customerId, limit) as Record<string, unknown>[];
    return rows.map(toView);
  }

  unreadCount(customerId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS total FROM customer_notification WHERE customer_id = ? AND read_at IS NULL')
      .get(customerId) as { total: number } | undefined;
    return Number(row?.total || 0);
  }

  /** Scoped by customer_id in the WHERE clause — one customer can never mark
   *  another customer's row, regardless of the id they send. */
  markRead(customerId: string, notificationId: string): boolean {
    const result = this.db
      .prepare('UPDATE customer_notification SET read_at = ? WHERE id = ? AND customer_id = ? AND read_at IS NULL')
      .run(Date.now(), notificationId, customerId);
    if (Number(result.changes) > 0) this.flush(['customer_notification']);
    return Number(result.changes) > 0;
  }

  markAllRead(customerId: string): number {
    const result = this.db
      .prepare('UPDATE customer_notification SET read_at = ? WHERE customer_id = ? AND read_at IS NULL')
      .run(Date.now(), customerId);
    if (Number(result.changes) > 0) this.flush(['customer_notification']);
    return Number(result.changes);
  }

  registerDevice(customerId: string, platform: string, token: string) {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO customer_push_device (id, customer_id, platform, token, created_at, updated_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET
           customer_id = excluded.customer_id, platform = excluded.platform,
           updated_at = excluded.updated_at, last_seen_at = excluded.last_seen_at`,
      )
      .run(`pushdev_${randomUUID()}`, customerId, text(platform, 20) || 'web', token, now, now, now);
    this.flush(['customer_push_device']);
  }

  /** The real customer<->business relationship, straight from stored records. */
  businessLink(customerId: string, businessId: string) {
    const hasBooking = Boolean(
      this.db
        .prepare('SELECT 1 FROM customer_booking WHERE customer_id = ? AND salon_id = ? LIMIT 1')
        .get(customerId, businessId),
    );
    let hasMembership = false;
    let hasVisit = false;
    const gymRow = this.db.prepare('SELECT state_json FROM gym_state WHERE gym_id = ?').get(businessId) as
      | { state_json: string }
      | undefined;
    if (gymRow) {
      try {
        const state = JSON.parse(gymRow.state_json) as {
          memberships?: Array<{ customerId?: string }>;
          visits?: Array<{ customerId?: string }>;
          membershipClaims?: Array<{ customerId?: string }>;
        };
        hasMembership =
          (state.memberships || []).some((entry) => entry.customerId === customerId) ||
          (state.membershipClaims || []).some((entry) => entry.customerId === customerId);
        hasVisit = (state.visits || []).some((entry) => entry.customerId === customerId);
      } catch {
        // A corrupt state blob must never widen who a business may message.
      }
    }
    return { hasBooking, hasMembership, hasVisit };
  }
}

function toView(row: Record<string, unknown>): CustomerNotification {
  let deepLink: NotificationDeepLink = {};
  try {
    const parsed = JSON.parse(String(row.deep_link_json || '{}'));
    if (parsed && typeof parsed === 'object') deepLink = parsed as NotificationDeepLink;
  } catch {
    deepLink = {};
  }
  return {
    id: String(row.id),
    type: String(row.type) as CustomerNotificationType,
    category: String(row.category) as CustomerNotification['category'],
    priority: String(row.priority) as CustomerNotification['priority'],
    title: String(row.title),
    body: String(row.body || ''),
    sourceKind: String(row.source_kind || 'system') as NotificationSourceKind,
    sourceBusinessId: row.source_business_id ? String(row.source_business_id) : null,
    sourceName: String(row.source_name || 'NOQ'),
    deepLink,
    readAt: row.read_at === null || row.read_at === undefined ? null : Number(row.read_at),
    createdAt: Number(row.created_at),
  };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export interface NotificationRouteDeps {
  store: NotificationStore;
  db: DatabaseSync;
  requireCustomer: express.RequestHandler;
  requireAdmin: express.RequestHandler;
  /** Resolves an authenticated business/staff session, or undefined. */
  staffSession: (request: express.Request) => { businessId: string; staffId: string; name: string; role: string } | undefined;
  businessName: (businessId: string) => string;
  flush?: (tables: string[]) => void;
}

type CustomerRequest = express.Request & { customerId?: string };
type AdminRequest = express.Request & { adminId?: string };

export function mountCustomerNotifications(app: express.Express, deps: NotificationRouteDeps) {
  const { store, db, requireCustomer, requireAdmin, staffSession, businessName } = deps;

  app.get('/api/me/notifications', requireCustomer, (request: CustomerRequest, response) => {
    const customerId = request.customerId!;
    response.set('Cache-Control', 'no-store');
    response.json({
      notifications: store.list(customerId),
      unreadCount: store.unreadCount(customerId),
      preferences: store.preferences(customerId),
      /** Honest transport reporting — the client never claims otherwise. */
      pushTransport: { name: store.push.name, configured: store.push.configured },
    });
  });

  app.post('/api/me/notifications/:id/read', requireCustomer, (request: CustomerRequest, response) => {
    const changed = store.markRead(request.customerId!, String(request.params.id));
    response.json({ ok: true, changed, unreadCount: store.unreadCount(request.customerId!) });
  });

  app.post('/api/me/notifications/read-all', requireCustomer, (request: CustomerRequest, response) => {
    const changed = store.markAllRead(request.customerId!);
    response.json({ ok: true, changed, unreadCount: 0 });
  });

  app.get('/api/me/notification-preferences', requireCustomer, (request: CustomerRequest, response) => {
    response.json({ preferences: store.preferences(request.customerId!) });
  });

  app.put('/api/me/notification-preferences', requireCustomer, (request: CustomerRequest, response) => {
    response.json({ preferences: store.savePreferences(request.customerId!, request.body) });
  });

  /** Device registration for background push. Persisted regardless of whether
   *  an external provider is configured, so enabling one later needs no
   *  re-registration campaign. */
  app.post('/api/me/push-devices', requireCustomer, (request: CustomerRequest, response) => {
    const token = text(request.body?.token, 400);
    if (!token) return response.status(400).json({ error: 'A device push token is required.' });
    store.registerDevice(request.customerId!, String(request.body?.platform || 'web'), token);
    response.status(201).json({
      ok: true,
      pushTransport: { name: store.push.name, configured: store.push.configured },
    });
  });

  /* ---------------- business -> customer ---------------- */

  app.post('/api/staff/business/notifications', (request, response) => {
    const session = staffSession(request);
    if (!session) return response.status(401).json({ error: 'Valid staff session required.' });
    const type = request.body?.type;
    if (!isBusinessSendableType(type)) {
      return response.status(400).json({ error: 'That notification type cannot be sent by a business.' });
    }
    if (type === 'review_request') {
      return response.status(400).json({ error: 'Use the review-request endpoint for review requests.' });
    }
    const customerId = text(request.body?.customerId, 120);
    if (!customerId) return response.status(400).json({ error: 'A target customer is required.' });
    const link = store.businessLink(customerId, session.businessId);
    if (!canBusinessNotifyCustomer(link)) {
      return response.status(403).json({
        error: 'You can only message customers linked to your business.',
        code: 'CUSTOMER_NOT_LINKED',
      });
    }
    const title = text(request.body?.title, 160);
    const body = text(request.body?.body, 600);
    if (!title) return response.status(400).json({ error: 'A notification title is required.' });
    const stored = store.notify({
      customerId,
      type,
      title,
      body,
      sourceKind: 'business',
      sourceBusinessId: session.businessId,
      sourceName: businessName(session.businessId),
      deepLink: { businessId: session.businessId },
      actorKind: 'business',
      actorId: session.staffId,
    });
    response.status(201).json({ ok: true, delivered: Boolean(stored), notification: stored });
  });

  /**
   * "Request Review" — only for a real completed visit at the requesting
   * business, once per completion, never when a review already exists, and
   * always with neutral platform-authored wording.
   */
  app.post('/api/staff/business/review-requests', (request, response) => {
    const session = staffSession(request);
    if (!session) return response.status(401).json({ error: 'Valid staff session required.' });
    const queueEntryId = text(request.body?.queueEntryId, 120) || text(request.body?.bookingId, 120);
    if (!queueEntryId) return response.status(400).json({ error: 'A completed booking is required.' });

    const booking = db
      .prepare(
        `SELECT queue_entry_id, customer_id, salon_id, service, status, outcome, service_completed_at
         FROM customer_booking WHERE queue_entry_id = ?`,
      )
      .get(queueEntryId) as Record<string, unknown> | undefined;

    const facts = booking
      ? {
          customerId: booking.customer_id ? String(booking.customer_id) : null,
          businessId: String(booking.salon_id),
          status: String(booking.status),
          outcome: booking.outcome ? String(booking.outcome) : null,
          serviceCompletedAt: booking.service_completed_at ? Number(booking.service_completed_at) : null,
        }
      : null;

    const alreadyReviewed = Boolean(
      facts?.customerId &&
        db
          .prepare('SELECT 1 FROM business_review WHERE business_id = ? AND customer_id = ? LIMIT 1')
          .get(facts.businessId, facts.customerId),
    );
    const dedupeKey = reviewRequestDedupeKey(queueEntryId);
    const alreadyRequested = Boolean(
      facts?.customerId &&
        db
          .prepare('SELECT 1 FROM customer_notification WHERE customer_id = ? AND dedupe_key = ? LIMIT 1')
          .get(facts.customerId, dedupeKey),
    );

    const eligibility = reviewRequestEligibility({
      booking: facts,
      requestingBusinessId: session.businessId,
      alreadyReviewed,
      alreadyRequested,
    });
    if (eligibility.ok !== true) {
      const { code, message } = eligibility;
      const status = code === 'NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : 409;
      return response.status(status).json({ error: message, code });
    }

    const name = businessName(session.businessId);
    const message = reviewRequestMessage(name, String(booking!.service || ''), facts!.serviceCompletedAt!);
    const stored = store.notify({
      customerId: facts!.customerId!,
      type: 'review_request',
      title: message.title,
      body: message.body,
      sourceKind: 'business',
      sourceBusinessId: session.businessId,
      sourceName: name,
      deepLink: { kind: 'review', businessId: session.businessId, bookingId: queueEntryId, queueEntryId },
      dedupeKey,
      actorKind: 'business',
      actorId: session.staffId,
    });
    if (!stored) {
      return response.status(409).json({ error: 'A review request was already sent for this visit.', code: 'ALREADY_REQUESTED' });
    }
    response.status(201).json({ ok: true, notification: stored });
  });

  /* ---------------- admin -> customer ---------------- */

  app.post('/api/admin/notifications', requireAdmin, (request: AdminRequest, response) => {
    const type = request.body?.type;
    if (!isAdminSendableType(type)) {
      return response.status(400).json({ error: 'That notification type cannot be sent by an admin.' });
    }
    const audience = parseAdminAudience(request.body?.audience);
    if (!audience) return response.status(400).json({ error: 'A valid audience is required.' });
    const title = text(request.body?.title, 160);
    const body = text(request.body?.body, 600);
    if (!title) return response.status(400).json({ error: 'A notification title is required.' });

    const customerIds = resolveAudience(db, audience);
    let delivered = 0;
    for (const customerId of customerIds) {
      const stored = store.notify({
        customerId,
        type,
        title,
        body,
        sourceKind: 'admin',
        sourceName: 'NOQ Admin',
        deepLink: audience.kind === 'business' ? { businessId: audience.businessId } : {},
        actorKind: 'admin',
        actorId: request.adminId || 'admin',
      });
      if (stored) delivered += 1;
    }
    response.status(201).json({ ok: true, audienceSize: customerIds.length, delivered });
  });
}

/**
 * Audience resolution. Every branch derives its customer list from real
 * stored relationships only — there is no "guess who might care" path, and a
 * category/city audience narrows through the businesses a customer actually
 * transacted with.
 */
export function resolveAudience(
  db: DatabaseSync,
  audience: ReturnType<typeof parseAdminAudience>,
): string[] {
  if (!audience) return [];
  const ids = (rows: Array<Record<string, unknown>>) =>
    [...new Set(rows.map((row) => String(row.customer_id)).filter(Boolean))];
  switch (audience.kind) {
    case 'customer': {
      const exists = db.prepare('SELECT id FROM customer_account WHERE id = ?').get(audience.customerId);
      return exists ? [audience.customerId] : [];
    }
    case 'business':
      return ids(
        db.prepare('SELECT DISTINCT customer_id FROM customer_booking WHERE salon_id = ?').all(audience.businessId) as Array<Record<string, unknown>>,
      );
    case 'category':
      return ids(
        db
          .prepare(
            `SELECT DISTINCT b.customer_id FROM customer_booking b
             JOIN salon s ON s.id = b.salon_id
             WHERE LOWER(COALESCE(s.main_category_id, 'salon')) = ?`,
          )
          .all(audience.categoryId) as Array<Record<string, unknown>>,
      );
    case 'city':
      return ids(
        db
          .prepare(
            `SELECT DISTINCT b.customer_id FROM customer_booking b
             JOIN salon s ON s.id = b.salon_id
             WHERE LOWER(s.city) = LOWER(?)`,
          )
          .all(audience.city) as Array<Record<string, unknown>>,
      );
    case 'platform':
    default:
      return (db.prepare('SELECT id FROM customer_account').all() as Array<{ id: string }>).map((row) => row.id);
  }
}
