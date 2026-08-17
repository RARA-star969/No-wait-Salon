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
        className={`rounded-2xl border bg-white/95 p-4 text-[#17201F] shadow-xl backdrop-blur-md transition-all ${isUrgent ? 'border-[#62AAA3] ring-1 ring-[#62AAA3]' : 'border-[#E1E7E6]'}`}
      >
        {/* Header meta */}
        <div className="mb-2 flex items-center justify-between border-b border-[#E8EDEC] pb-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                isUrgent ? 'bg-[#E7F5F2] text-[#0F766E]' : 'bg-[#0F766E]/10 text-[#0F766E]'
              }`}
            >
              {notification.type === 'reserved_nearing' ? (
                <Clock className="w-3.5 h-3.5" />
              ) : (
                <Scissors className="w-3.5 h-3.5" />
              )}
            </div>
            <span
              className="text-[11px] font-bold uppercase tracking-wider text-[#6F7C7A]"
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
              className="cursor-pointer rounded-md p-1 text-[#6F7C7A] transition hover:bg-[#E1E7E6] hover:text-[#17201F]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h4
              className="font-sans text-sm font-bold leading-tight text-[#17201F]"
            >
              {notification.title}
            </h4>
            <p
              className="mt-1 text-xs leading-relaxed text-[#6F7C7A]"
            >
              {notification.body}
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="mt-3 flex items-center justify-between border-t border-[#E8EDEC] pt-2.5">
          <span
            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
              notification.type === 'called'
                ? 'bg-amber-500/20 text-amber-300'
                : notification.type === 'approaching'
                  ? 'bg-[#E7F5F2] text-[#0F766E]'
                  : notification.type === 'reserved_nearing'
                    ? 'bg-sky-50 text-sky-700'
                    : 'bg-[#0F766E]/15 text-[#0F766E]'
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
                ? 'bg-[#0F766E] text-white hover:bg-[#0B665F]'
                : 'bg-[#0F766E] text-white hover:bg-[#0B665F]'
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
