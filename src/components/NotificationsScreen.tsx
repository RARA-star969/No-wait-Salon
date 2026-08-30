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
          ? 'border-white/[0.14] bg-white/[0.07]'
          : 'border-white/[0.07] bg-white/[0.025]'
      }`}
    >
      <span
        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          unread ? 'bg-[color:var(--category-tint-20,rgba(34,211,238,.2))] text-[color:var(--category-accent,#22D3EE)]' : 'bg-white/[0.06] text-slate-400'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {isAdmin && <ShieldCheck className="h-3 w-3 shrink-0 text-[color:var(--category-accent,#22D3EE)]" />}
            <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isAdmin ? 'NOQ Admin' : notification.sourceName}
            </span>
          </span>
          <span className="ml-auto shrink-0 text-[10px] font-medium text-slate-500">
            {relativeTimeLabel(notification.createdAt)}
          </span>
          {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--category-accent,#22D3EE)]" />}
        </span>
        <span className={`mt-1 block text-sm leading-snug ${unread ? 'font-bold text-white' : 'font-semibold text-slate-300'}`}>
          {notification.title}
        </span>
        {notification.body && (
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{notification.body}</span>
        )}
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--category-accent,#22D3EE)]">
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
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] transition active:scale-95"
            >
              <CheckCheck className="h-4 w-4 text-slate-300" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Notification settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] transition active:scale-95"
          >
            <Settings2 className="h-4 w-4 text-slate-300" />
          </button>
        </>
      }
    />
  );

  if (!auth) {
    return (
      <SafeAreaScreen id="customer-notifications-screen" header={header} className="bg-[#050B0C]" bottomInset="nav">
        <div className="mx-auto flex max-w-sm flex-col items-center px-6 pt-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] text-[color:var(--category-accent,#22D3EE)]">
            <BellRing className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-white">Sign in for your alerts</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Queue updates, membership reminders and business announcements are kept with your verified account.
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
    <SafeAreaScreen id="customer-notifications-screen" header={header} className="bg-[#050B0C]" bottomInset="nav">
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
                    ? 'border-transparent bg-[color:var(--category-accent,#22D3EE)] text-slate-950'
                    : 'border-white/10 bg-white/[0.05] text-slate-300'
                }`}
              >
                {value === 'all' ? 'All' : 'Unread'}
                {value === 'unread' && unreadCount > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-slate-950/20' : 'bg-white/10'}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {loading && !notifications.length && (
          <div className="grid place-items-center py-16">
            <LoaderCircle className="h-6 w-6 animate-spin text-[color:var(--category-accent,#22D3EE)]" />
          </div>
        )}

        {!loading && !groups.length && !error && (
          <div id="notifications-empty-state" className="mx-auto flex max-w-sm flex-col items-center px-4 pt-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] text-slate-400">
              <BellRing className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-lg font-bold text-white">
              {filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {filter === 'unread'
                ? 'You have read everything in your inbox.'
                : 'Booking updates, membership reminders and business announcements will appear here.'}
            </p>
          </div>
        )}

        {groups.map((group) => (
          <section key={group.key} className="space-y-2.5">
            <h2 className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group.label}</h2>
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
          <p className="flex items-start gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-500">
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
