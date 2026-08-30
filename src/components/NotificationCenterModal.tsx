import React from 'react';
import { Bell, X, Check, BellRing, Volume2, ShieldCheck, Clock, Scissors, Send } from 'lucide-react';
import { PushNotification } from '../types';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: PushNotification[];
  permissionStatus: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
  onSendTestNotification: (type: 'approaching' | 'called' | 'reserved_nearing') => void;
  onClearAll: () => void;
}

/**
 * DEVELOPER / QA CONSOLE — not a customer surface.
 *
 * This dialog intentionally exposes push diagnostics (device permission
 * state, simulated push triggers, the raw local alert log). It is mounted
 * only on the dev/split workspace; the packaged Customer app routes its
 * bottom "Alerts" tab to NotificationsScreen, the real server-persisted
 * inbox, which carries none of this. See App.tsx for the gate.
 */
export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  permissionStatus,
  onRequestPermission,
  onSendTestNotification,
  onClearAll,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="notification-center-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#17201F]/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="notification-center-dialog"
        className="relative w-full max-w-md rounded-2xl bg-[#F8FAFA] p-6 shadow-xl border border-[#E1E7E6] text-[#17201F] max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E1E7E6]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#0F766E] text-white flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans text-xl font-bold text-[#17201F]">Push Notifications</h3>
              <p className="text-xs text-[#6F7C7A]">Live queue &amp; slot alerts</p>
            </div>
          </div>
          <button
            id="notification-modal-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#6F7C7A] hover:bg-[#E1E7E6] hover:text-[#17201F] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission Status Box */}
        <div className="mt-4 p-4 rounded-2xl bg-white border border-[#E1E7E6] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-[#0F766E]" />
              <span className="text-xs font-bold text-[#17201F]">Device Push Permission</span>
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                permissionStatus === 'granted'
                  ? 'bg-[#E7F5F2] text-[#0F766E]'
                  : permissionStatus === 'denied'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-[#0F766E]/10 text-[#0F766E]'
              }`}
            >
              {permissionStatus === 'granted'
                ? 'Active / Allowed'
                : permissionStatus === 'denied'
                  ? 'Blocked'
                  : 'Action Needed'}
            </span>
          </div>

          <p className="text-xs text-[#6F7C7A] leading-relaxed">
            {permissionStatus === 'granted'
              ? 'Push notifications are enabled. You will receive alerts even when browsing other apps.'
              : 'Allow notifications to receive an alert 10–15 minutes before your turn and when your slot arrives.'}
          </p>

          {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
            <button
              id="enable-browser-push-btn"
              onClick={onRequestPermission}
              className="w-full py-2.5 px-3 rounded-xl bg-[#0F766E] hover:bg-[#0B665F] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Enable Device Push Notifications</span>
            </button>
          )}
        </div>

        {/* Test Trigger Quick Buttons */}
        <div className="mt-4 p-3.5 rounded-2xl bg-[#E1E7E6]/40 border border-[#E1E7E6] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F7C7A]">
              Simulate Push Trigger
            </span>
            <span className="text-[10px] text-[#6F7C7A]">Test alerts immediately</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              id="test-nearing-alert-btn"
              onClick={() => onSendTestNotification('approaching')}
              className="p-2 rounded-xl bg-white hover:bg-[#F8FAFA] border border-[#E1E7E6] text-left transition cursor-pointer group"
            >
              <span className="block text-[11px] font-bold text-[#17201F] group-hover:text-[#0F766E]">
                10-15 Min Alert
              </span>
              <span className="block text-[9px] text-[#6F7C7A]">1 person ahead</span>
            </button>

            <button
              id="test-slot-alert-btn"
              onClick={() => onSendTestNotification('reserved_nearing')}
              className="p-2 rounded-xl bg-white hover:bg-[#F8FAFA] border border-[#E1E7E6] text-left transition cursor-pointer group"
            >
              <span className="block text-[11px] font-bold text-[#17201F] group-hover:text-[#0F766E]">
                Slot Nearing
              </span>
              <span className="block text-[9px] text-[#6F7C7A]">15 min to window</span>
            </button>

            <button
              id="test-called-alert-btn"
              onClick={() => onSendTestNotification('called')}
              className="p-2 rounded-xl bg-white hover:bg-[#F8FAFA] border border-[#E1E7E6] text-left transition cursor-pointer group"
            >
              <span className="block text-[11px] font-bold text-[#17201F] group-hover:text-[#0F766E]">
                Barber Ready
              </span>
              <span className="block text-[9px] text-[#6F7C7A]">Counter call</span>
            </button>
          </div>
        </div>

        {/* Notification History Log */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F7C7A]">
              Alerts History ({notifications.length})
            </span>
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-[11px] font-semibold text-[#6F7C7A] hover:text-rose-600 cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-[#E1E7E6] bg-white">
              <Bell className="w-6 h-6 text-[#6F7C7A] mx-auto mb-1 opacity-50" />
              <p className="text-xs font-semibold text-[#17201F]">No notifications yet</p>
              <p className="text-[11px] text-[#6F7C7A] mt-0.5">
                Notifications will appear when your queue position or reserved slot nears.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="p-3 rounded-2xl bg-white border border-[#E1E7E6] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-sans text-xs font-bold text-[#17201F]">{n.title}</span>
                  <span className="text-[10px] text-[#6F7C7A]">
                    {new Date(n.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-[#6F7C7A] leading-snug">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
