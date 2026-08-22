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
        item.isUser && kind === 'waiting' ? 'ring-1 ring-[#0F766E]/20' : ''
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
              <b className="min-w-0 max-w-full truncate font-sans text-sm font-bold text-[#17201F]">{item.name}</b>
              {item.token && (
                <span className="shrink-0 rounded-md bg-[#0F766E]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#0F766E]">
                  {item.token}
                </span>
              )}
              <span className="shrink-0 rounded bg-[#EEF3F2] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#4E625F]">
                {sourceBadge(item)}
              </span>
              {maskedPhone(item.phone) && (
                <span className="shrink-0 font-mono text-[10px] text-[#6F7C7A]">{maskedPhone(item.phone)}</span>
              )}
            </div>

            <p className="mt-1 truncate text-[11px] font-medium text-[#17201F]">{item.service}</p>

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
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#6F7C7A] transition hover:bg-rose-50 hover:text-rose-700"
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
  serving: 'border-[#0F766E]/40 bg-[#E7F5F2]/70',
  called_active: 'border-[#A66020]/40 bg-[#FAF0E6] ring-1 ring-[#A66020]/30',
  call_expired: 'border-[#A66020]/50 bg-[#FBF3E9] ring-1 ring-[#A66020]/35',
  reserved: 'border-[#0F766E]/30 bg-white',
  waiting: 'border-[#E1E7E6] bg-white',
};

const BADGE_TONE: Record<CardKind, string> = {
  serving: 'bg-[#0F766E] text-white',
  called_active: 'bg-[#A66020] text-white',
  call_expired: 'bg-[#A66020] text-white',
  reserved: 'bg-[#0F766E]/10 text-[#0F766E]',
  waiting: 'bg-[#E1E7E6] text-[#17201F]',
};

const STATUS_TONE: Record<CardKind, string> = {
  serving: 'border border-[#0F766E]/30 bg-[#E7F5F2] text-[#0F766E]',
  called_active: 'border border-[#A66020]/30 bg-[#FFF6EA] text-[#A66020]',
  // Informational, not an alarm: the action row carries the urgency here.
  call_expired: 'border border-[#C9A227]/40 bg-[#FFF8E7] text-[#8A6516]',
  reserved: 'bg-[#0F766E]/10 text-[#0F766E]',
  waiting: 'bg-[#E1E7E6]/60 text-[#5E6C6A]',
};

const ACTION_TONE: Record<CardAction['tone'], string> = {
  primary: 'bg-[#0F766E] text-white hover:bg-[#0B665F]',
  secondary: 'border border-[#EBD2CD] bg-white text-[#8A3E35] hover:bg-[#FDF6F5]',
  destructive: 'border border-rose-200/70 bg-rose-50 text-rose-700 hover:bg-rose-100',
  ghost: 'text-[#6F7C7A] hover:bg-[#F1F5F4]',
};

const ACTION_ICON: Partial<Record<CardAction['id'], React.ReactNode>> = {
  call: <PhoneForwarded className="h-3 w-3" />,
  call_again: <PhoneForwarded className="h-3 w-3" />,
  start: <Play className="h-3 w-3" />,
  complete: <Check className="h-3.5 w-3.5" />,
};
