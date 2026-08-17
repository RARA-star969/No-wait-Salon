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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="notification-center-dialog"
        className="relative w-full max-w-md rounded-3xl bg-[#FAF9F6] p-6 shadow-2xl border border-[#E5E5DF] text-[#1A1A1A] max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E5DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#5A5A40] text-white flex items-center justify-center shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-[#1A1A1A]">Push Notifications</h3>
              <p className="text-xs text-[#7A7A70]">Live queue &amp; slot alerts</p>
            </div>
          </div>
          <button
            id="notification-modal-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7A7A70] hover:bg-[#E5E5DF] hover:text-[#1A1A1A] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission Status Box */}
        <div className="mt-4 p-4 rounded-2xl bg-white border border-[#E5E5DF] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-[#5A5A40]" />
              <span className="text-xs font-bold text-[#1A1A1A]">Device Push Permission</span>
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                permissionStatus === 'granted'
                  ? 'bg-[#E8F0E6] text-[#3D6B37]'
                  : permissionStatus === 'denied'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-[#5A5A40]/10 text-[#5A5A40]'
              }`}
            >
              {permissionStatus === 'granted'
                ? 'Active / Allowed'
                : permissionStatus === 'denied'
                  ? 'Blocked'
                  : 'Action Needed'}
            </span>
          </div>

          <p className="text-xs text-[#7A7A70] leading-relaxed">
            {permissionStatus === 'granted'
              ? 'Push notifications are enabled. You will receive alerts even when browsing other apps.'
              : 'Allow notifications to receive an alert 10–15 minutes before your turn and when your slot arrives.'}
          </p>

          {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
            <button
              id="enable-browser-push-btn"
              onClick={onRequestPermission}
              className="w-full py-2.5 px-3 rounded-xl bg-[#5A5A40] hover:bg-[#4A4A34] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Enable Device Push Notifications</span>
            </button>
          )}
        </div>

        {/* Test Trigger Quick Buttons */}
        <div className="mt-4 p-3.5 rounded-2xl bg-[#E5E5DF]/40 border border-[#E5E5DF] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A7A70]">
              Simulate Push Trigger
            </span>
            <span className="text-[10px] text-[#7A7A70]">Test alerts immediately</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              id="test-nearing-alert-btn"
              onClick={() => onSendTestNotification('approaching')}
              className="p-2 rounded-xl bg-white hover:bg-[#FAF9F6] border border-[#E5E5DF] text-left transition cursor-pointer shadow-2xs group"
            >
              <span className="block text-[11px] font-bold text-[#1A1A1A] group-hover:text-[#5A5A40]">
                10-15 Min Alert
              </span>
              <span className="block text-[9px] text-[#7A7A70]">1 person ahead</span>
            </button>

            <button
              id="test-slot-alert-btn"
              onClick={() => onSendTestNotification('reserved_nearing')}
              className="p-2 rounded-xl bg-white hover:bg-[#FAF9F6] border border-[#E5E5DF] text-left transition cursor-pointer shadow-2xs group"
            >
              <span className="block text-[11px] font-bold text-[#1A1A1A] group-hover:text-[#5A5A40]">
                Slot Nearing
              </span>
              <span className="block text-[9px] text-[#7A7A70]">15 min to window</span>
            </button>

            <button
              id="test-called-alert-btn"
              onClick={() => onSendTestNotification('called')}
              className="p-2 rounded-xl bg-white hover:bg-[#FAF9F6] border border-[#E5E5DF] text-left transition cursor-pointer shadow-2xs group"
            >
              <span className="block text-[11px] font-bold text-[#1A1A1A] group-hover:text-[#5A5A40]">
                Barber Ready
              </span>
              <span className="block text-[9px] text-[#7A7A70]">Counter call</span>
            </button>
          </div>
        </div>

        {/* Notification History Log */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A7A70]">
              Alerts History ({notifications.length})
            </span>
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-[11px] font-semibold text-[#7A7A70] hover:text-rose-600 cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-[#E5E5DF] bg-white">
              <Bell className="w-6 h-6 text-[#7A7A70] mx-auto mb-1 opacity-50" />
              <p className="text-xs font-semibold text-[#1A1A1A]">No notifications yet</p>
              <p className="text-[11px] text-[#7A7A70] mt-0.5">
                Notifications will appear when your queue position or reserved slot nears.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="p-3 rounded-2xl bg-white border border-[#E5E5DF] shadow-2xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif text-xs font-bold text-[#1A1A1A]">{n.title}</span>
                  <span className="text-[10px] text-[#7A7A70]">
                    {new Date(n.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-[#7A7A70] leading-snug">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
