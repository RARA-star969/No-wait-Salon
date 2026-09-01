import React, { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import { CUSTOMER_CANCEL_REASONS, STAFF_CANCEL_REASONS } from '../shared/queueTiming';

type Props = {
  open: boolean;
  /** 'customer' shows the customer reason list, 'staff' the Cancel Chair list. */
  audience: 'customer' | 'staff';
  title?: string;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (reasonCode: string, reasonText: string) => void;
};

/**
 * One reason picker for both cancellation paths, so the customer app, the
 * public web page and the staff dashboard stay consistent.
 */
export const CancelBookingSheet: React.FC<Props> = ({ open, audience, title, busy, error, onClose, onConfirm }) => {
  const reasons = audience === 'staff' ? STAFF_CANCEL_REASONS : CUSTOMER_CANCEL_REASONS;
  const [code, setCode] = useState<string>(reasons[0].code);
  const [text, setText] = useState('');

  // Each opening starts fresh, so a reason abandoned last time is never
  // submitted by accident on the next cancellation.
  useEffect(() => {
    if (!open) return;
    setCode(reasons[0].code);
    setText('');
  }, [open, reasons]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/55 sm:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Cancel booking'}
        className="relative w-full rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-3xl sm:pb-5"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-base font-bold text-[var(--noq-ink)]">{title || 'Cancel booking'}</h2>
            <p className="mt-1 text-xs text-[#667371]">Tell us why, so the salon can plan the queue.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F1F5F4] text-[#42524F]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-5 pt-4">
          <div className="space-y-2">
            {reasons.map((reason) => (
              <button
                key={reason.code}
                type="button"
                onClick={() => setCode(reason.code)}
                aria-pressed={code === reason.code}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold transition ${
                  code === reason.code ? 'border-[var(--noq-accent)] bg-[#F1FAF9] text-[var(--noq-accent)]' : 'border-[var(--noq-border)] bg-white text-[#25302F]'
                }`}
              >
                <span
                  className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                    code === reason.code ? 'border-[var(--noq-accent)] bg-[var(--noq-accent)]' : 'border-[#CBD8D6]'
                  }`}
                />
                {reason.label}
              </button>
            ))}
          </div>

          {code === 'other' && (
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Tell us a little more (optional)"
              className="mt-3 w-full rounded-xl border border-[var(--noq-border)] bg-[var(--noq-base)] p-3 text-sm outline-none focus:border-[#62AAA3]"
            />
          )}

          {error && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-[#F0D6D1] bg-[#FFF7F5] p-3 text-xs leading-5 text-[#8A3E35]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pt-4">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-[var(--noq-border)] bg-white text-sm font-bold text-[#42524F]">
            Keep booking
          </button>
          <button
            type="button"
            onClick={() => onConfirm(code, text.trim())}
            disabled={busy}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#B4483A] text-sm font-bold text-white disabled:opacity-60"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
