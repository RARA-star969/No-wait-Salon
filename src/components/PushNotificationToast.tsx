import React, { useEffect } from 'react';
import { Bell, X, Scissors, Clock, ArrowRight, Volume2 } from 'lucide-react';
import { PushNotification } from '../types';

interface PushNotificationToastProps {
  notification: PushNotification | null;
  onDismiss: () => void;
  onView: () => void;
}

export const PushNotificationToast: React.FC<PushNotificationToastProps> = ({
  notification,
  onDismiss,
  onView,
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 7000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const isUrgent = notification.type === 'called' || notification.type === 'approaching';

  return (
    <div
      id="push-notification-banner"
      className="fixed top-4 right-4 sm:right-6 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-96 animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto"
    >
      <div
        className={`rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all ${
          isUrgent
            ? 'bg-[#1A1A1A] text-white border-[#5A5A40]'
            : 'bg-white/95 text-[#1A1A1A] border-[#E5E5DF]'
        }`}
      >
        {/* Header meta */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 dark:border-black/5">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                isUrgent ? 'bg-[#5A5A40] text-white' : 'bg-[#5A5A40]/10 text-[#5A5A40]'
              }`}
            >
              {notification.type === 'reserved_nearing' ? (
                <Clock className="w-3.5 h-3.5" />
              ) : (
                <Scissors className="w-3.5 h-3.5" />
              )}
            </div>
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                isUrgent ? 'text-white/80' : 'text-[#7A7A70]'
              }`}
            >
              {notification.salonName || 'No-Wait Salon'} · PUSH ALERT
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10px] font-medium opacity-60">
              <Volume2 className="w-3 h-3" />
              <span>Just now</span>
            </span>
            <button
              id="push-toast-dismiss-btn"
              onClick={onDismiss}
              aria-label="Dismiss alert"
              className={`p-1 rounded-md transition cursor-pointer ${
                isUrgent
                  ? 'hover:bg-white/10 text-white/70 hover:text-white'
                  : 'hover:bg-[#E5E5DF] text-[#7A7A70] hover:text-[#1A1A1A]'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h4
              className={`font-serif text-sm font-bold leading-tight ${
                isUrgent ? 'text-white' : 'text-[#1A1A1A]'
              }`}
            >
              {notification.title}
            </h4>
            <p
              className={`text-xs mt-1 leading-relaxed ${
                isUrgent ? 'text-white/85' : 'text-[#7A7A70]'
              }`}
            >
              {notification.body}
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-white/10 dark:border-black/5">
          <span
            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
              notification.type === 'called'
                ? 'bg-amber-500/20 text-amber-300'
                : notification.type === 'approaching'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : notification.type === 'reserved_nearing'
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-[#5A5A40]/15 text-[#5A5A40]'
            }`}
          >
            {notification.type === 'called'
              ? 'Counter Ready'
              : notification.type === 'approaching'
                ? '10–15 Min Warning'
                : notification.type === 'reserved_nearing'
                  ? 'Slot Approaching'
                  : 'Queue Status'}
          </span>

          <button
            id="push-toast-view-btn"
            onClick={() => {
              onView();
              onDismiss();
            }}
            className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl transition cursor-pointer ${
              isUrgent
                ? 'bg-white text-[#1A1A1A] hover:bg-[#FAF9F6]'
                : 'bg-[#5A5A40] text-white hover:bg-[#4A4A34]'
            }`}
          >
            <span>View Ticket</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
