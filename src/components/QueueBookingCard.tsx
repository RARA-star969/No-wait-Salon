import React, { useState } from 'react';
import { Check, Clock, PhoneForwarded, Play, Smartphone, Trash2, Wallet, X } from 'lucide-react';
import type { QueueItem, ServiceItem } from '../types';
import { bookingCardState, maskedPhone, serviceSummary, sourceBadge, type CardAction, type CardKind } from '../shared/queueCardState';

type Props = {
  item: QueueItem;
  /** 1-based place in the live queue. */
  position: number;
  now: number;
  onAction: (
    item: QueueItem,
    action: 'Call' | 'Start' | 'Complete' | 'No-show' | 'Remove',
    paymentMethod?: 'cash' | 'online'
  ) => void;
  onCancelChair: (item: QueueItem) => void;
  /** Salon's real service catalog, used only to look up a real per-service
   *  price when a booking's selected service name matches one. Never used to
   *  invent a price for a name that isn't found. */
  catalog?: ServiceItem[];
};

const formatTime = (ts?: number): string =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '';

const formatInr = (amount?: number): string => (typeof amount === 'number' ? `₹${amount}` : 'Amount not set');

/** Real per-line prices where the booking's service name matches the salon's
 *  own catalog — never a fabricated figure for a name that isn't found. */
function buildServiceLines(item: QueueItem, catalog: ServiceItem[] | undefined): Array<{ name: string; priceInr?: number }> {
  const names = item.services && item.services.length > 0 ? item.services : item.service ? [item.service] : [];
  return names.map((name) => {
    const match = catalog?.find((service) => service.name.trim().toLowerCase() === name.trim().toLowerCase());
    return { name, priceInr: match?.priceInr };
  });
}

/**
 * One booking in the Staff live queue.
 *
 * Every card follows one fixed vertical order — identity+status, then service
 * and timing details, then actions in their own row — so nothing ever depends
 * on a viewport breakpoint to stay readable. That matters here specifically
 * because the hosted test panel can report a wide viewport while actually
 * rendering narrow, which made the old sm:/md:-driven grid unreliable.
 */
export const QueueBookingCard: React.FC<Props> = ({ item, position, now, onAction, onCancelChair, catalog }) => {
  const state = bookingCardState(item, now);
  const { kind } = state;
  const [showPackages, setShowPackages] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);

  const labelled = state.actions.filter((action) => !action.iconOnly);
  const iconActions = state.actions.filter((action) => action.iconOnly);
  const summary = serviceSummary(item);

  const run = (action: CardAction) => {
    if (action.id === 'cancel_chair') return onCancelChair(item);
    // Completing a service never frees the chair on its own tap: it opens the
    // Payment Confirmation sheet, and only a real confirmation there commits
    // the transition (see requirement: durable payment before completion).
    if (action.id === 'complete') { setShowPaymentSheet(true); return; }
    if (action.id === 'call' || action.id === 'call_again') return onAction(item, 'Call');
    if (action.id === 'start') return onAction(item, 'Start');
    if (action.id === 'no_show') return onAction(item, 'No-show');
    return onAction(item, 'Remove');
  };

  const confirmPayment = (method: 'cash' | 'online') => {
    setShowPaymentSheet(false);
    onAction(item, 'Complete', method);
  };

  return (
    <div
      id={`queue-entry-${item.id}`}
      data-state={kind}
      className={`rounded-2xl border p-3.5 transition-colors ${CARD_TONE[kind]} ${
        item.isUser && kind === 'waiting' ? 'ring-1 ring-[var(--noq-accent)]/20' : ''
      }`}
    >
      {/* ---------------- TOP: identity, separated from status ---------------- */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold ${BADGE_TONE[kind]}`}>
            {kind === 'serving' ? '✂' : kind === 'called_active' || kind === 'call_expired' ? '!' : position}
          </span>
          <div className="min-w-0">
            <b className="block max-w-full truncate font-sans text-sm font-bold text-[var(--noq-ink)]">{item.name}</b>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              {item.token && (
                <span className="shrink-0 rounded-md bg-[#EEF1F0] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#4E625F]">
                  {item.token}
                </span>
              )}
              <span className="shrink-0 rounded bg-[var(--noq-surface-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#4E625F]">
                {sourceBadge(item)}
              </span>
              {maskedPhone(item.phone) && (
                <span className="shrink-0 font-mono text-[10px] text-[var(--noq-muted)]">{maskedPhone(item.phone)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[kind]}`}>
            {state.statusLabel}
          </span>
          {state.timerLabel && (
            <span
              id={`arrival-countdown-${item.id}`}
              title="Arrival window remaining"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200/70 bg-amber-50 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-800"
            >
              <Clock className="h-3 w-3" />
              {state.timerLabel}
            </span>
          )}
        </div>
      </div>

      {/* -------------- MIDDLE: service, timing, staff, billing -------------- */}
      <div className="mt-2.5 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-[11px] font-medium text-[var(--noq-ink)]">
            {summary.primary}
            {summary.moreCount > 0 && <span className="text-[var(--noq-muted)]"> + {summary.moreCount} more</span>}
          </p>
          {summary.moreCount > 0 && (
            <button
              type="button"
              id={`view-packages-${item.id}`}
              onClick={() => setShowPackages(true)}
              className="shrink-0 text-[10.5px] font-bold text-[var(--noq-accent)] underline underline-offset-2"
            >
              View Packages
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-[var(--noq-muted)]">
          {item.createdAt && <span>Joined {formatTime(item.createdAt)}</span>}
          {/* Only ever shown for Waiting / Called / arrival-window-expired —
              never for a customer already in the chair (bookingCardState
              omits waitingLabel for 'serving'). */}
          {state.waitingLabel && <span className="font-bold text-[var(--noq-ink)]">&middot; {state.waitingLabel}</span>}
          {item.calledAt && <span>&middot; Called {formatTime(item.calledAt)}</span>}
        </div>

        {kind === 'serving' && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-[var(--noq-muted)]">
            {item.barberName && <span>With {item.barberName}</span>}
            {item.serviceStartedAt && <span>&middot; Started {formatTime(item.serviceStartedAt)}</span>}
          </div>
        )}

        {item.status === 'Called' && (
          <div className="text-[10px] font-semibold">
            {item.acknowledgedAt ? (
              <span className="font-bold text-[var(--noq-accent)]">Customer acknowledged &middot; On the way &check;</span>
            ) : (
              <span className="font-semibold text-amber-700">Waiting for response</span>
            )}
          </div>
        )}

        {state.detailLines.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {state.detailLines.map((line) => (
              <span key={line} className="truncate text-[11px] text-[#5E6C6A]">
                {line}
              </span>
            ))}
          </div>
        )}

        {/* Serving billing mini-box. Never a fabricated amount: an honest
            "Amount not set" when the booking carries no real price yet. */}
        {kind === 'serving' && (
          <div className="rounded-xl border border-[var(--noq-accent)]/25 bg-white p-2.5 shadow-sm space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between font-bold">
              <span className="text-[#5E6C6A]">Bill Total</span>
              <span
                className={
                  typeof item.totalPriceInr === 'number'
                    ? 'font-mono text-sm font-black text-[var(--noq-accent)]'
                    : 'text-[11px] font-semibold italic text-[var(--noq-muted)]'
                }
              >
                {formatInr(item.totalPriceInr)}
              </span>
            </div>
            {item.discountInr ? (
              <div className="flex items-center justify-between text-[10px] text-emerald-700 font-semibold">
                <span>Discount Applied</span>
                <span>-₹{item.discountInr}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between pt-1.5 border-t border-[var(--noq-border)]">
              <span className="font-bold text-[#5E6C6A]">Payment</span>
              {item.paymentStatus === 'cash_pending' ? (
                <span id={`cash-pending-pill-${item.id}`} className="flex items-center gap-1 font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full text-[9.5px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-ping" />
                  CASH PENDING
                </span>
              ) : item.paymentStatus === 'paid' ? (
                <span className="font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full text-[9.5px]">
                  ✓ PAID ({item.paymentMethod === 'online' ? 'Online' : 'Cash'})
                </span>
              ) : (
                <span className="font-semibold text-[var(--noq-muted)] bg-[var(--noq-border)] px-2 py-0.5 rounded-full text-[9.5px]">
                  UNPAID
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------------- BOTTOM: actions, their own dedicated row ---------------- */}
      <div className={`mt-3 ${kind === 'call_expired' ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap items-center gap-2'}`}>
        {labelled.map((action) => (
          <button
            key={action.id}
            id={`action-${action.id}-${item.id}`}
            type="button"
            onClick={() => run(action)}
            title={action.title}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition active:scale-95 ${
              kind === 'serving' ? 'w-full' : ''
            } ${buttonToneClass(kind, action)}`}
          >
            {ACTION_ICON[action.id]}
            <span className="whitespace-nowrap">{action.id === 'complete' ? 'Complete Service' : action.label}</span>
          </button>
        ))}
        {iconActions.map((action) => (
          <button
            key={action.id}
            id={`action-${action.id}-${item.id}`}
            type="button"
            onClick={() => run(action)}
            title={action.title}
            aria-label={action.title}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200/70 text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      {kind === 'called_active' && (
        <p className="mt-2 text-[10px] font-medium text-[#8A6516]">Call again appears after arrival window ends</p>
      )}

      {showPackages && (
        <PackagesSheet item={item} catalog={catalog} onClose={() => setShowPackages(false)} />
      )}

      {showPaymentSheet && (
        <PaymentConfirmationSheet
          item={item}
          catalog={catalog}
          onClose={() => setShowPaymentSheet(false)}
          onConfirm={confirmPayment}
        />
      )}
    </div>
  );
};

/** Amber fill for the one action ("Start Service") that belongs to the
 *  soft-amber CALLED language, rather than the app's default blue primary —
 *  every other button keeps its normal tone-driven color. */
function buttonToneClass(kind: CardKind, action: CardAction): string {
  if (action.id === 'start' && (kind === 'called_active' || kind === 'call_expired')) {
    return 'bg-[#A66020] text-white hover:bg-[#8F5219]';
  }
  return ACTION_TONE[action.tone];
}

/** Real booking data only: every line comes from `item.services`/`service`,
 *  `item.totalPriceInr` and `item.discountInr` — nothing here is invented. */
const PackagesSheet: React.FC<{ item: QueueItem; catalog?: ServiceItem[]; onClose: () => void }> = ({ item, catalog, onClose }) => {
  const lines = buildServiceLines(item, catalog);
  const knownTotal = lines.reduce((sum, line) => (typeof line.priceInr === 'number' ? sum + line.priceInr : sum), 0);
  const anyKnown = lines.some((line) => typeof line.priceInr === 'number');
  return (
    <SheetShell title="Selected Packages" onClose={onClose}>
      <div className="space-y-2">
        {lines.map((line, index) => (
          <div key={`${line.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--noq-border)] bg-[#F8FAFA] px-3 py-2">
            <span className="min-w-0 truncate text-xs font-semibold text-[var(--noq-ink)]">{line.name}</span>
            <span className="shrink-0 font-mono text-xs font-bold text-[var(--noq-muted)]">
              {typeof line.priceInr === 'number' ? `₹${line.priceInr}` : '—'}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1 border-t border-[var(--noq-border)] pt-3 text-xs font-semibold">
        {item.discountInr ? (
          <div className="flex items-center justify-between text-emerald-700">
            <span>Discount Applied</span>
            <span>-₹{item.discountInr}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-sm font-extrabold text-[var(--noq-ink)]">
          <span>Final Total</span>
          <span>{formatInr(typeof item.totalPriceInr === 'number' ? item.totalPriceInr : anyKnown ? knownTotal : undefined)}</span>
        </div>
      </div>
    </SheetShell>
  );
};

/** Gates "Complete" behind a real confirmation: the chair only frees up, and
 *  the booking only turns Completed, after the owner picks how payment was
 *  received and taps the final CTA here. No gateway integration exists —
 *  Cash/Online are both an owner attestation, never a claim NOQ processed
 *  anything. */
const PaymentConfirmationSheet: React.FC<{
  item: QueueItem;
  catalog?: ServiceItem[];
  onClose: () => void;
  onConfirm: (method: 'cash' | 'online') => void;
}> = ({ item, catalog, onClose, onConfirm }) => {
  const alreadyPaid = item.paymentStatus === 'paid';
  const [method, setMethod] = useState<'cash' | 'online'>(item.paymentMethod === 'online' ? 'online' : 'cash');
  const summary = serviceSummary(item);
  const [showPackages, setShowPackages] = useState(false);

  return (
    <SheetShell title="Payment Confirmation" onClose={onClose}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--noq-ink)]">{item.name}</p>
          <p className="truncate text-[11px] text-[var(--noq-muted)]">
            {summary.primary}
            {summary.moreCount > 0 && ` + ${summary.moreCount} more`}
          </p>
        </div>
        {item.token && (
          <span className="shrink-0 rounded-md bg-[#EEF1F0] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#4E625F]">{item.token}</span>
        )}
      </div>

      {summary.moreCount > 0 && (
        <button
          type="button"
          onClick={() => setShowPackages(true)}
          className="mt-2 text-[10.5px] font-bold text-[var(--noq-accent)] underline underline-offset-2"
        >
          View Packages
        </button>
      )}

      <div className="mt-3 space-y-1 rounded-xl border border-[var(--noq-border)] bg-[#F8FAFA] p-3 text-xs font-semibold">
        {item.discountInr ? (
          <div className="flex items-center justify-between text-emerald-700">
            <span>Discount Applied</span>
            <span>-₹{item.discountInr}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-sm font-extrabold text-[var(--noq-ink)]">
          <span>Final Amount</span>
          <span className={typeof item.totalPriceInr === 'number' ? '' : 'italic text-[var(--noq-muted)]'}>
            {formatInr(item.totalPriceInr)}
          </span>
        </div>
      </div>

      {alreadyPaid ? (
        <p className="mt-3 text-[11px] font-semibold text-emerald-700">
          Already marked received via {item.paymentMethod === 'online' ? 'Online' : 'Cash'}.
        </p>
      ) : (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#7A8785]">Payment Method</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="payment-method-cash"
              onClick={() => setMethod('cash')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                method === 'cash' ? 'border-[var(--noq-accent)] bg-[var(--noq-accent)]/10 text-[var(--noq-accent)]' : 'border-[var(--noq-border)] text-[var(--noq-muted)]'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" /> Cash
            </button>
            <button
              type="button"
              id="payment-method-online"
              onClick={() => setMethod('online')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                method === 'online' ? 'border-[var(--noq-accent)] bg-[var(--noq-accent)]/10 text-[var(--noq-accent)]' : 'border-[var(--noq-border)] text-[var(--noq-muted)]'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" /> Online
            </button>
          </div>
          <p className="mt-1.5 text-[9.5px] text-[var(--noq-muted)]">
            {method === 'cash' ? 'Confirms cash was physically received.' : 'Marks payment as received online — no gateway is verified here.'}
          </p>
        </div>
      )}

      <button
        type="button"
        id="confirm-payment-and-complete"
        onClick={() => onConfirm(method)}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--noq-accent)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--noq-accent-hover)] active:scale-[0.98]"
      >
        <Check className="h-4 w-4" /> Confirm Payment &amp; Complete
      </button>

      {showPackages && <PackagesSheet item={item} catalog={catalog} onClose={() => setShowPackages(false)} />}
    </SheetShell>
  );
};

/** Shared bottom-sheet chrome for both modals above — a fixed backdrop plus a
 *  sheet pinned to the bottom of the viewport so it works the same in the
 *  narrow hosted test panel and a real mobile viewport. */
const SheetShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
    <div
      className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--noq-border)] bg-white p-4 shadow-2xl max-h-[85vh] overflow-y-auto"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-[var(--noq-ink)]">{title}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--noq-muted)] hover:bg-[#F1F5F4]">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const CARD_TONE: Record<CardKind, string> = {
  serving: 'border-[var(--noq-accent)]/40 bg-[var(--noq-tint-10)]',
  called_active: 'border-[#A66020]/40 bg-[#FAF0E6] ring-1 ring-[#A66020]/30',
  call_expired: 'border-[#A66020]/50 bg-[#FBF3E9] ring-1 ring-[#A66020]/35',
  reserved: 'border-[var(--noq-accent)]/30 bg-white',
  waiting: 'border-[var(--noq-border)] bg-white',
};

const BADGE_TONE: Record<CardKind, string> = {
  serving: 'bg-[var(--noq-accent)] text-white',
  called_active: 'bg-[#A66020] text-white',
  call_expired: 'bg-[#A66020] text-white',
  reserved: 'bg-[var(--noq-accent)]/10 text-[var(--noq-accent)]',
  waiting: 'bg-[var(--noq-border)] text-[var(--noq-ink)]',
};

const STATUS_TONE: Record<CardKind, string> = {
  serving: 'border border-[var(--noq-accent)]/30 bg-[var(--noq-tint-10)] text-[var(--noq-accent)]',
  called_active: 'border border-[#A66020]/30 bg-[#FFF6EA] text-[#A66020]',
  // Informational, not an alarm: the action row carries the urgency here.
  call_expired: 'border border-[#C9A227]/40 bg-[#FFF8E7] text-[#8A6516]',
  reserved: 'bg-[var(--noq-accent)]/10 text-[var(--noq-accent)]',
  waiting: 'bg-[var(--noq-border)]/60 text-[#5E6C6A]',
};

const ACTION_TONE: Record<CardAction['tone'], string> = {
  primary: 'bg-[var(--noq-accent)] text-white hover:bg-[var(--noq-accent-hover)]',
  secondary: 'border border-[#EBD2CD] bg-white text-[#8A3E35] hover:bg-[#FDF6F5]',
  destructive: 'border border-rose-200/70 bg-rose-50 text-rose-700 hover:bg-rose-100',
  ghost: 'text-[var(--noq-muted)] hover:bg-[#F1F5F4]',
  outline: 'border border-[var(--noq-border)] bg-white text-[var(--noq-ink)] hover:bg-[#F4F7F6]',
};

const ACTION_ICON: Partial<Record<CardAction['id'], React.ReactNode>> = {
  call: <PhoneForwarded className="h-3 w-3" />,
  call_again: <PhoneForwarded className="h-3 w-3" />,
  start: <Play className="h-3 w-3" />,
  complete: <Check className="h-3.5 w-3.5" />,
};
