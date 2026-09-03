import React from 'react';
import { Check, PhoneForwarded, Play, Trash2 } from 'lucide-react';
import type { QueueItem } from '../types';
import { bookingCardState, maskedPhone, sourceBadge, type CardAction, type CardKind } from '../shared/queueCardState';

type Props = {
  item: QueueItem;
  /** 1-based place in the live queue. */
  position: number;
  now: number;
  onAction: (item: QueueItem, action: 'Call' | 'Start' | 'Complete' | 'No-show' | 'Remove') => void;
  onCancelChair: (item: QueueItem) => void;
};

/**
 * One booking in the Staff live queue.
 *
 * Laid out as a responsive grid rather than a single horizontal row: identity,
 * status and actions each own a region, so nothing overlaps when a name is
 * long or the dashboard is narrow. Which actions appear is decided entirely by
 * bookingCardState, so a card can never offer an action that does not belong
 * to the state the server put it in.
 */
export const QueueBookingCard: React.FC<Props> = ({ item, position, now, onAction, onCancelChair }) => {
  const state = bookingCardState(item, now);
  const { kind } = state;

  const labelled = state.actions.filter((action) => !action.iconOnly);
  const iconActions = state.actions.filter((action) => action.iconOnly);

  const run = (action: CardAction) => {
    if (action.id === 'cancel_chair') return onCancelChair(item);
    if (action.id === 'call' || action.id === 'call_again') return onAction(item, 'Call');
    if (action.id === 'start') return onAction(item, 'Start');
    if (action.id === 'complete') return onAction(item, 'Complete');
    if (action.id === 'no_show') return onAction(item, 'No-show');
    return onAction(item, 'Remove');
  };

  return (
    <div
      id={`queue-entry-${item.id}`}
      data-state={kind}
      className={`rounded-2xl border p-3.5 transition-colors ${CARD_TONE[kind]} ${
        item.isUser && kind === 'waiting' ? 'ring-1 ring-[var(--noq-accent)]/20' : ''
      }`}
    >
      {/* One column on narrow dashboards, identity | status+actions on wide. */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
        {/* ---------------- Identity ---------------- */}
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold ${BADGE_TONE[kind]}`}>
            {kind === 'serving' ? '✂' : kind === 'called_active' || kind === 'call_expired' ? '!' : position}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <b className="min-w-0 max-w-full truncate font-sans text-sm font-bold text-[var(--noq-ink)]">{item.name}</b>
              {item.token && (
                <span className="shrink-0 rounded-md bg-[var(--noq-accent)]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--noq-accent)]">
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

            <p className="mt-1 truncate text-[11px] font-medium text-[var(--noq-ink)]">{item.service}</p>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-[var(--noq-muted)]">
              {item.createdAt && (
                <span>Joined {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
              )}
              {item.calledAt && (
                <span>&middot; Called {new Date(item.calledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
              )}
              {item.status === 'Called' && (
                item.acknowledgedAt ? (
                  <span className="font-bold text-[var(--noq-accent)]">&middot; Customer acknowledged &middot; On the way &check;</span>
                ) : (
                  <span className="font-semibold text-amber-700">&middot; Waiting for response</span>
                )
              )}
            </div>

            {/* Serving Billing & Payment Module */}
            {item.status === 'Serving' && (
              <div className="mt-2.5 rounded-xl border border-[var(--noq-accent)]/25 bg-white p-2.5 shadow-sm space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between font-bold text-[var(--noq-ink)]">
                  <span className="text-[#5E6C6A]">Bill Total</span>
                  <span className="font-mono text-sm font-black text-[var(--noq-accent)]">₹{item.totalPriceInr || 250}</span>
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

            {state.detailLines.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                {state.detailLines.map((line) => (
                  <span key={line} className="truncate text-[11px] text-[#5E6C6A]">
                    {line}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ------------- Status, then actions -------------
            The status chip and the timer each get their own line so neither
            can collide with the customer details or the buttons. */}
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[kind]}`}>
              {state.statusLabel}
            </span>
            {state.timerLabel && (
              <span
                id={`arrival-countdown-${item.id}`}
                title="Arrival window remaining"
                className="rounded-lg border border-amber-200/70 bg-amber-50 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-800"
              >
                {state.timerLabel}
              </span>
            )}
          </div>

          {/* Wraps instead of overflowing; every button is the same height. */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {item.status === 'Serving' && item.paymentStatus === 'cash_pending' && (
              <button
                id={`confirm-cash-btn-${item.id}`}
                type="button"
                onClick={() => onAction(item, 'Confirm-cash-payment')}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-600 text-white px-3 text-xs font-bold hover:bg-amber-700 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                Confirm Cash (₹{item.totalPriceInr || 250})
              </button>
            )}
            {labelled.map((action) => (
              <button
                key={action.id}
                id={`action-${action.id}-${item.id}`}
                type="button"
                onClick={() => run(action)}
                title={action.title}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition active:scale-95 ${ACTION_TONE[action.tone]}`}
              >
                {ACTION_ICON[action.id]}
                <span className="whitespace-nowrap">{action.label}</span>
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--noq-muted)] transition hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

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
};

const ACTION_ICON: Partial<Record<CardAction['id'], React.ReactNode>> = {
  call: <PhoneForwarded className="h-3 w-3" />,
  call_again: <PhoneForwarded className="h-3 w-3" />,
  start: <Play className="h-3 w-3" />,
  complete: <Check className="h-3.5 w-3.5" />,
};
