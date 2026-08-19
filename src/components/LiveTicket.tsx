import React from 'react';
import { BellRing, Check, CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
import type { Barber, QueueItem } from '../types';
import { buildLiveTicket } from '../shared/liveTicket';

type Props = {
  entry: QueueItem;
  queue: QueueItem[];
  barbers: Barber[];
  salonName: string;
  /** Ticking value both surfaces already hold; injected so they stay in step. */
  now: number;
  busy?: boolean;
  /**
   * Which product this is rendering in. The ONLY thing it may change is
   * surface-specific chrome — never the status logic, wording or hierarchy.
   * The app-download CTA is web-only and must never appear inside the app.
   */
  surface: 'app' | 'web';
  onAcknowledge?: () => void;
  onCancel?: () => void;
  onRejoin?: () => void;
};

/**
 * The customer's live ticket, rendered identically in the Customer app and on
 * the public QR web page. Both are handed the same server snapshot and derive
 * their state from the same `buildLiveTicket` view model, so a booking can
 * never read one way in the app and another way on the web.
 */
export const LiveTicket: React.FC<Props> = ({
  entry,
  queue,
  barbers,
  salonName,
  now,
  busy,
  surface,
  onAcknowledge,
  onCancel,
  onRejoin,
}) => {
  const ticket = buildLiveTicket(entry, queue, barbers, now);
  const terminal = ticket.isCompleted || ticket.isNoShow || ticket.isCancelled;
  const canAcknowledge = ticket.availableActions.includes('acknowledge');
  const canCancelNow = ticket.availableActions.includes('cancel');

  return (
    <div
      id="live-ticket"
      data-surface={surface}
      data-phase={ticket.phase}
      className={`rounded-3xl border p-5 text-center ${
        ticket.isCompleted || ticket.isCancelled || ticket.isNoShow
          ? 'border-[#CBD8D6] bg-white'
          : ticket.isCalled || ticket.needsCallAgain
            ? 'border-[#F3C79A] bg-[#FFF6EA]'
            : 'border-[#B9DAD6] bg-[#EDF7F5]'
      }`}
    >
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#0F766E] ring-1 ring-[#D3E7E4]">
        {ticket.isCompleted ? (
          <CheckCircle2 className="h-6 w-6" />
        ) : ticket.isCancelled || ticket.isNoShow ? (
          <XCircle className="h-6 w-6 text-[#8A3E35]" />
        ) : ticket.isCalled || ticket.needsCallAgain ? (
          <BellRing className="h-6 w-6 text-[#B4761C]" />
        ) : (
          <Check className="h-6 w-6" />
        )}
      </div>

      <h2 id="live-ticket-headline" className="mt-3 text-[17px] font-bold text-[#17201F]">
        {ticket.acknowledged && ticket.isCalled ? 'On your way' : ticket.headline}
      </h2>
      <p className="mt-1 text-xs text-[#4F7F7A]">
        {salonName} · {entry.service}
      </p>

      {/* Arrival countdown — server deadline, never a local timer. */}
      {ticket.arrivalWindowOpen && (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A8785]">
            {ticket.acknowledged ? 'Please reach the salon within' : 'Please arrive within'}
          </p>
          <p id="live-ticket-countdown" className="mt-1 text-3xl font-bold tabular-nums text-[#B4761C]">
            {ticket.arrivalCountdown}
          </p>
          {(entry.callAttempt || 0) > 1 && (
            <p className="mt-1 text-[11px] font-semibold text-[#8A6516]">Call attempt {entry.callAttempt}</p>
          )}
        </div>
      )}

      {(ticket.needsCallAgain || ticket.isNoShow || ticket.isCancelled || ticket.isCompleted) && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#5A6866]">{ticket.detail}</div>
      )}

      {/* Position block: only while the ticket is genuinely still in the queue. */}
      {!terminal && !ticket.isCalled && !ticket.needsCallAgain && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-left">
          <Cell label="Position" value={String(ticket.position)} />
          <Cell label="Ahead" value={String(ticket.peopleAhead)} />
          <Cell label={ticket.isInService ? 'Status' : 'Est. wait'} value={ticket.isInService ? 'In service' : ticket.estimatedWaitLabel} />
        </div>
      )}

      {canAcknowledge && onAcknowledge && (
        <button
          id="live-ticket-acknowledge"
          type="button"
          onClick={onAcknowledge}
          disabled={busy}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} I'm on my way
        </button>
      )}

      {terminal && onRejoin && (
        <button
          id="live-ticket-rejoin"
          type="button"
          onClick={onRejoin}
          disabled={busy}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60"
        >
          Join queue again
        </button>
      )}

      {!terminal && (
        <>
          <p className="mt-3 text-[11px] text-[#4F7F7A]">Live · updates automatically, no need to refresh.</p>
          {canCancelNow && onCancel && (
            <button
              id="live-ticket-cancel"
              type="button"
              onClick={onCancel}
              className="mt-3 text-xs font-bold text-[#8A3E35] underline underline-offset-2"
            >
              Cancel booking
            </button>
          )}
        </>
      )}
    </div>
  );
};

const Cell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-white p-2.5">
    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#7A8785]">{label}</p>
    <p className="mt-0.5 text-base font-bold text-[#17201F]">{value}</p>
  </div>
);
