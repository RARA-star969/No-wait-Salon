import { useCallback, useEffect, useRef, useState } from 'react';
import {
  customerNotificationService,
  EMPTY_INBOX,
  type NotificationInboxResponse,
} from '../services/customerNotificationService';
import type { CustomerNotification, NotificationPreferences } from '../shared/customerNotifications';

/**
 * Owns the one copy of the customer's notification inbox for the whole
 * customer surface: the Alerts screen, the bottom-nav unread badge and the
 * settings screen all read this same state, so a badge can never disagree
 * with the list it links to and nothing is fetched twice.
 *
 * Poll cadence matches the app's existing live-data pattern (a short interval
 * plus a visibility-change refresh), and every timer/listener is torn down on
 * unmount — no stale interval survives a screen change or a logout.
 */
export function useNotificationInbox(token: string | undefined, active: boolean) {
  const [inbox, setInbox] = useState<NotificationInboxResponse>(EMPTY_INBOX);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingPreferences, setSavingPreferences] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!token) { setInbox(EMPTY_INBOX); setError(''); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    if (!options.quiet) setLoading(true);
    try {
      const next = await customerNotificationService.inbox();
      setInbox(next);
      setError('');
    } catch (reason) {
      // Keep showing the last good inbox; a transient failure must not blank it.
      if (!options.quiet) setError(reason instanceof Error ? reason.message : 'Unable to load your notifications.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!token) return;
    // Poll only while a notification-relevant surface is on screen, so the
    // app is not making a background request from deep inside a booking flow.
    if (!active) return;
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void refresh({ quiet: true });
    }, 15_000);
    const onVisibility = () => { if (!document.hidden) void refresh({ quiet: true }); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [token, active, refresh]);

  /** Optimistic read — the row greys out immediately, then reconciles. */
  const markRead = useCallback(async (notification: CustomerNotification) => {
    if (!token || notification.readAt) return;
    const readAt = Date.now();
    setInbox((current) => ({
      ...current,
      notifications: current.notifications.map((item) => (item.id === notification.id ? { ...item, readAt } : item)),
      unreadCount: Math.max(0, current.unreadCount - 1),
    }));
    try {
      const result = await customerNotificationService.markRead(notification.id);
      setInbox((current) => ({ ...current, unreadCount: result.unreadCount }));
    } catch {
      void refresh({ quiet: true });
    }
  }, [token, refresh]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    const readAt = Date.now();
    setInbox((current) => ({
      ...current,
      notifications: current.notifications.map((item) => (item.readAt ? item : { ...item, readAt })),
      unreadCount: 0,
    }));
    try {
      await customerNotificationService.markAllRead();
    } catch {
      void refresh({ quiet: true });
    }
  }, [token, refresh]);

  const savePreferences = useCallback(async (preferences: NotificationPreferences) => {
    if (!token) return;
    setInbox((current) => ({ ...current, preferences }));
    setSavingPreferences(true);
    try {
      const result = await customerNotificationService.savePreferences(preferences);
      setInbox((current) => ({ ...current, preferences: result.preferences }));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your notification settings.');
      void refresh({ quiet: true });
    } finally {
      setSavingPreferences(false);
    }
  }, [token, refresh]);

  return {
    notifications: inbox.notifications,
    unreadCount: inbox.unreadCount,
    preferences: inbox.preferences,
    pushTransport: inbox.pushTransport,
    loading,
    error,
    savingPreferences,
    refresh,
    markRead,
    markAllRead,
    savePreferences,
  };
}
