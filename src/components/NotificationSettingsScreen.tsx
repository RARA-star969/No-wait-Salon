import React, { useEffect, useState } from 'react';
import { BellRing, Clock, Lock, Megaphone, Store } from 'lucide-react';
import type { NotificationPreferences } from '../shared/customerNotifications';
import type { PushTransportStatus } from '../services/customerNotificationService';
import { SafeAreaHeader, SafeAreaScreen } from './SafeAreaScreen';

/**
 * Notification preferences.
 *
 * Transactional alerts (your turn, booking confirmed, payment, membership
 * status) are deliberately NOT switchable — the shared preference resolver
 * refuses to suppress them, so exposing a switch here would be a lie. Only
 * promotional and non-urgent business traffic is mutable.
 *
 * Quiet hours are surfaced and stored (the settings architecture supports
 * them end to end) but are documented as applying to promotional traffic
 * only; nothing here can silence an urgent transactional alert.
 */

export interface NotificationSettingsScreenProps {
  preferences: NotificationPreferences;
  pushTransport: PushTransportStatus;
  saving: boolean;
  error: string;
  onBack: () => void;
  onSave: (preferences: NotificationPreferences) => void;
}

const Toggle: React.FC<{
  label: string;
  description: string;
  icon: React.ReactElement;
  checked: boolean;
  disabled?: boolean;
  lockedNote?: string;
  onChange?: (next: boolean) => void;
}> = ({ label, description, icon, checked, disabled, lockedNote, onChange }) => (
  <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-4 last:border-0">
    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-[color:var(--category-accent,#22D3EE)] [&>svg]:h-4 [&>svg]:w-4">
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{description}</p>
      {disabled && lockedNote && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <Lock className="h-3 w-3" />
          {lockedNote}
        </p>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`mt-1 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
        checked ? 'bg-[color:var(--category-accent,#22D3EE)]' : 'bg-white/15'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

export const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({
  preferences,
  pushTransport,
  saving,
  error,
  onBack,
  onSave,
}) => {
  const [draft, setDraft] = useState(preferences);
  useEffect(() => { setDraft(preferences); }, [preferences]);

  const update = (patch: Partial<NotificationPreferences>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onSave(next);
  };

  return (
    <SafeAreaScreen
      id="notification-settings-screen"
      className="bg-[#050B0C]"
      bottomInset="nav"
      header={
        <SafeAreaHeader
          title="Notification settings"
          subtitle={saving ? 'Saving…' : 'Choose what reaches you'}
          onBack={onBack}
        />
      }
    >
      <div className="space-y-5 px-4 pt-4 sm:px-5">
        {error && (
          <div role="alert" className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <Toggle
            icon={<BellRing />}
            label="Booking & queue alerts"
            description="Your turn, booking confirmations, payments, membership status and check-ins."
            checked
            disabled
            lockedNote="Always on"
          />
          <Toggle
            icon={<Store />}
            label="Business updates"
            description="Schedule changes, temporary closures and trainer changes from businesses you use."
            checked={draft.businessUpdatesEnabled}
            onChange={(next) => update({ businessUpdatesEnabled: next })}
          />
          <Toggle
            icon={<Megaphone />}
            label="Offers & announcements"
            description="Promotional offers, renewal nudges and platform announcements."
            checked={draft.promotionalEnabled}
            onChange={(next) => update({ promotionalEnabled: next })}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[color:var(--category-accent,#22D3EE)]" />
            <p className="text-sm font-semibold text-white">Quiet hours</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Hold promotional messages during these hours. Urgent booking alerts are never held.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">From</span>
              <input
                type="time"
                value={draft.quietHoursStart}
                onChange={(event) => update({ quietHoursStart: event.target.value })}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-white outline-none"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">To</span>
              <input
                type="time"
                value={draft.quietHoursEnd}
                onChange={(event) => update({ quietHoursEnd: event.target.value })}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-white outline-none"
              />
            </label>
          </div>
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-slate-500">
          {pushTransport.configured
            ? 'Background device push is enabled for this build.'
            : 'Background device push is not configured on this build. Every alert is still saved to your in-app inbox.'}
        </p>
      </div>
    </SafeAreaScreen>
  );
};
