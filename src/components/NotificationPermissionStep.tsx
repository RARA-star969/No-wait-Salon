import React, { useState } from 'react';
import { BellRing, LoaderCircle } from 'lucide-react';
import { customerUi as ui } from './ui';
import { requestPushPermission } from '../services/notificationService';

type Props = {
  onDone: () => void;
};

/**
 * One guided permission ask, shown only when the browser has not already
 * decided (`Notification.permission` still 'default'). Turn alerts are core
 * to the product, but the permission itself is never mandatory — skipping
 * still lets the customer into the app; they can enable it later.
 */
export const NotificationPermissionStep: React.FC<Props> = ({ onDone }) => {
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    try {
      await requestPushPermission();
    } finally {
      setBusy(false);
      onDone();
    }
  };

  return (
    <div id="onboarding-notifications-step" className={`flex min-h-full flex-col px-5 pb-7 pt-10 ${ui.page}`}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="noq-glass-surface mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border text-[var(--noq-accent)]">
          <BellRing className="h-7 w-7" />
        </div>
        <p className={ui.eyebrow}>Turn alerts</p>
        <h1 className="mt-2 text-[29px] font-bold leading-[1.12] tracking-[-0.04em]">Never miss your turn.</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--noq-muted)]">
          We'll notify you when you're almost up, so you don't have to keep the app open and watch the queue.
        </p>

        <button
          type="button"
          id="onboarding-enable-notifications-btn"
          onClick={() => void enable()}
          disabled={busy}
          className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--noq-accent)] px-4 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          Enable notifications
        </button>

        <button type="button" id="onboarding-skip-notifications-btn" onClick={onDone} className="mt-2 w-full rounded-xl px-3 py-2 text-sm font-semibold text-[var(--noq-muted)] transition hover:bg-[var(--noq-tint-10)] hover:text-[var(--noq-accent)] active:scale-[0.99]">
          Not now
        </button>

        <p className="mt-6 text-[11px] leading-5 text-[var(--noq-muted)]">
          You can change this anytime from the notification bell.
        </p>
      </div>
    </div>
  );
};
