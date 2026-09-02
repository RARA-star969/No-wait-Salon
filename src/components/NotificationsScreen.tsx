import React from 'react';
import {
  BellRing,
  CalendarCheck,
  CheckCheck,
  ChevronRight,
  Dumbbell,
  LoaderCircle,
  MegaphoneIcon,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Ticket,
} from 'lucide-react';
import type { CustomerAuthSession } from '../types';
import {
  groupNotifications,
  notificationCtaLabel,
  relativeTimeLabel,
  resolveNotificationRoute,
  type CustomerNotification,
  type NotificationFilter,
  type NotificationRoute,
} from '../shared/customerNotifications';
import type { PushTransportStatus } from '../services/customerNotificationService';
import { SafeAreaHeader, SafeAreaScreen } from './SafeAreaScreen';

/**
 * The customer Notification inbox — the bottom "Alerts" destination.
 *
 * This screen carries NO developer/test affordances: no device-permission
 * toggle, no "simulate push", no test-alert buttons. Every row here is a real
 * server-persisted notification scoped to the authenticated customer, and the
 * only actions are read/filter/act-on-CTA.
 */

export interface NotificationsScreenProps {
  auth: CustomerAuthSession | null;
  notifications: CustomerNotification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  pushTransport: PushTransportStatus;
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
  onBack: () => void;
  onLogin: () => void;
  onOpenSettings: () => void;
  onMarkAllRead: () => void;
  /** Marks read, then navigates to the notification's own destination. */
  onOpen: (notification: CustomerNotification, route: NotificationRoute) => void;
}

const ROUTE_ICON: Record<NotificationRoute['screen'], React.FC<{ className?: string }>> = {
  tracking: Ticket,
  bookings: CalendarCheck,
  notifications: BellRing,
  home: Sparkles,
  'gym-activity': Dumbbell,
  salon: Store,
  'member-hub': Dumbbell,
  review: Star,
};

const NotificationRow: React.FC<{
  notification: CustomerNotification;
  onOpen: (route: NotificationRoute) => void;
}> = ({ notification, onOpen }) => {
  const route = resolveNotificationRoute(notification);
  const Icon = ROUTE_ICON[route.screen] || BellRing;
  const unread = !notification.readAt;
  const isAdmin = notification.sourceKind === 'admin';
  return (
    <button
      type="button"
      onClick={() => onOpen(route)}
      data-unread={unread ? 'true' : 'false'}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${
        unread
          ? 'border-[var(--noq-accent)]/25 bg-[var(--noq-tint-10)] shadow-[0_12px_28px_-24px_var(--noq-glow)]'
          : 'border-[var(--noq-glass-border)] bg-white/70'
      }`}
    >
      <span
        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          unread ? 'bg-[var(--noq-tint-20)] text-[var(--noq-accent)]' : 'bg-[var(--noq-surface-soft)] text-[var(--noq-muted)]'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {isAdmin && <ShieldCheck className="h-3 w-3 shrink-0 text-[color:var(--category-accent,var(--noq-accent))]" />}
            <span className="truncate text-[10px] font-bold uppercase tracking-wider text-[var(--noq-muted)]">
              {isAdmin ? 'NOQ Admin' : notification.sourceName}
            </span>
          </span>
          <span className="ml-auto shrink-0 text-[10px] font-medium text-[var(--noq-text-subtle)]">
            {relativeTimeLabel(notification.createdAt)}
          </span>
          {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--category-accent,var(--noq-accent))]" />}
        </span>
        <span className={`mt-1 block text-sm leading-snug ${unread ? 'font-bold' : 'font-semibold'} text-[var(--noq-ink)]`}>
          {notification.title}
        </span>
        {notification.body && (
          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--noq-muted)]">{notification.body}</span>
        )}
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--category-accent,var(--noq-accent))]">
          {notificationCtaLabel(route)}
          <ChevronRight className="h-3 w-3" />
        </span>
      </span>
    </button>
  );
};

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  auth,
  notifications,
  unreadCount,
  loading,
  error,
  pushTransport,
  filter,
  onFilterChange,
  onBack,
  onLogin,
  onOpenSettings,
  onMarkAllRead,
  onOpen,
}) => {
  const groups = groupNotifications(notifications, filter);

  const header = (
    <SafeAreaHeader
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
      onBack={onBack}
      actions={
        <>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              aria-label="Mark all as read"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--noq-glass-border)] bg-white/75 transition active:scale-95"
            >
              <CheckCheck className="h-4 w-4 text-[var(--noq-accent)]" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Notification settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--noq-glass-border)] bg-white/75 transition active:scale-95"
          >
            <Settings2 className="h-4 w-4 text-[var(--noq-accent)]" />
          </button>
        </>
      }
    />
  );

  if (!auth) {
    return (
      <SafeAreaScreen id="customer-notifications-screen" header={header} className="noq-customer-page" bottomInset="nav">
        <div className="mx-auto flex max-w-sm flex-col items-center px-6 pt-16 text-center">
          <div className="noq-glass-surface flex h-16 w-16 items-center justify-center rounded-2xl border text-[var(--noq-accent)]">
            <BellRing className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-[var(--noq-ink)]">Sign in for your alerts</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--noq-muted)]">
            Queue updates, membership reminders and business announcements are kept with your verified account.
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
    <SafeAreaScreen id="customer-notifications-screen" header={header} className="noq-customer-page" bottomInset="nav">
      <div className="space-y-4 px-4 pt-4 sm:px-5">
        <div className="flex items-center gap-2">
          {(['all', 'unread'] as NotificationFilter[]).map((value) => {
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onFilterChange(value)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                  active
                    ? 'border-transparent bg-[var(--noq-accent)] text-white shadow-[0_8px_20px_-12px_var(--noq-glow)]'
                    : 'border-[var(--noq-glass-border)] bg-white/70 text-[var(--noq-muted)]'
                }`}
              >
                {value === 'all' ? 'All' : 'Unread'}
                {value === 'unread' && unreadCount > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/20' : 'bg-[var(--noq-tint-10)]'}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {loading && !notifications.length && (
          <div className="grid place-items-center py-16">
            <LoaderCircle className="h-6 w-6 animate-spin text-[color:var(--category-accent,var(--noq-accent))]" />
          </div>
        )}

        {!loading && !groups.length && !error && (
          <div id="notifications-empty-state" className="mx-auto flex max-w-sm flex-col items-center px-4 pt-12 text-center">
            <div className="noq-glass-surface flex h-16 w-16 items-center justify-center rounded-2xl border text-[var(--noq-accent)]">
              <BellRing className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-lg font-bold text-[var(--noq-ink)]">
              {filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--noq-muted)]">
              {filter === 'unread'
                ? 'You have read everything in your inbox.'
                : 'Booking updates, membership reminders and business announcements will appear here.'}
            </p>
          </div>
        )}

        {groups.map((group) => (
          <section key={group.key} className="space-y-2.5">
            <h2 className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--noq-muted)]">{group.label}</h2>
            <div className="space-y-2.5">
              {group.items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={(route) => onOpen(notification, route)}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Honest transport reporting. The inbox above is fully real and
            persisted; this only states whether OS-level background delivery
            is configured for this build. It never claims a simulated push. */}
        {!pushTransport.configured && notifications.length > 0 && (
          <p className="noq-glass-surface flex items-start gap-2 rounded-2xl border p-3 text-[11px] leading-relaxed text-[var(--noq-muted)]">
            <MegaphoneIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Alerts are saved to this inbox in real time. Background device push is not enabled on this build, so open
              the app to see the newest updates.
            </span>
          </p>
        )}
      </div>
    </SafeAreaScreen>
  );
};
