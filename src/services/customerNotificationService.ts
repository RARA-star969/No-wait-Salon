/**
 * Customer-side client for the persisted Notification inbox and the device
 * push registration path.
 *
 * Same API-base architecture every other service in this app uses (resolved
 * once at build time from VITE_API_BASE_URL) — never derived from a window
 * presence check, which resolves to the Android WebView's own origin.
 */

import type {
  CustomerNotification,
  NotificationPreferences,
} from '../shared/customerNotifications';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../shared/customerNotifications';
import { authHeaders } from './customerAccountService';

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface PushTransportStatus {
  name: string;
  /** False means no external provider is configured for this deployment. The
   *  in-app inbox is still fully real and persisted; only OS-level background
   *  delivery is unavailable. Never presented to the customer as success. */
  configured: boolean;
}

export interface NotificationInboxResponse {
  notifications: CustomerNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  pushTransport: PushTransportStatus;
}

export const EMPTY_INBOX: NotificationInboxResponse = {
  notifications: [],
  unreadCount: 0,
  preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  pushTransport: { name: 'none', configured: false },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init.headers },
  });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || 'Unable to load your notifications.');
  return body as T;
}

/** Never lets a malformed response reach the inbox UI as if it were valid. */
export function normalizeInbox(body: unknown): NotificationInboxResponse {
  const raw = (body && typeof body === 'object' ? body : {}) as Partial<NotificationInboxResponse>;
  const notifications = Array.isArray(raw.notifications) ? raw.notifications : [];
  return {
    notifications,
    unreadCount: Number.isFinite(raw.unreadCount as number)
      ? Number(raw.unreadCount)
      : notifications.filter((item) => !item.readAt).length,
    preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(raw.preferences || {}) },
    pushTransport: {
      name: raw.pushTransport?.name || 'none',
      configured: Boolean(raw.pushTransport?.configured),
    },
  };
}

export const customerNotificationService = {
  inbox: async (): Promise<NotificationInboxResponse> =>
    normalizeInbox(await request<unknown>('/api/me/notifications')),
  markRead: (id: string) =>
    request<{ ok: boolean; unreadCount: number }>(`/api/me/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  markAllRead: () =>
    request<{ ok: boolean; unreadCount: number }>('/api/me/notifications/read-all', { method: 'POST' }),
  savePreferences: (preferences: NotificationPreferences) =>
    request<{ preferences: NotificationPreferences }>('/api/me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    }),
  /** Registers this device for background push. Safe to call repeatedly; the
   *  server upserts by token. Returns the honest transport status. */
  registerDevice: (token: string, platform: string) =>
    request<{ ok: boolean; pushTransport: PushTransportStatus }>('/api/me/push-devices', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),
};
