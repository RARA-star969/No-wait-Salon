import React, { useState } from 'react';
import { Clock, FileText, ChevronRight, Scissors, User, X } from 'lucide-react';
import type { QueueItem, ServiceItem } from '../types';
import { isCompleted, outcomeBadge, sourceLabel, type BookingTab } from '../shared/bookingBuckets';
import { serviceSummary } from '../shared/queueCardState';

type Props = {
  item: QueueItem;
  tab: BookingTab;
  now: number;
  /** Salon's real service catalog, used only to look up a real per-service
   *  price when a booking's selected service name matches one. Never used to
   *  invent a price for a name that isn't found. */
  catalog?: ServiceItem[];
};

const formatTime = (ts?: number): string =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '';

const formatInr = (amount?: number): string => (typeof amount === 'number' ? `₹${amount}` : 'Amount not set');

const titleCase = (label: string): string =>
  label.charAt(0) + label.slice(1).toLowerCase().replace(/_/g, ' ');

/** Avatar tint, picked deterministically from the customer's name so the same
 *  booking always renders the same color across re-renders — never random. */
const AVATAR_TONES = [
  'bg-[#E3E8FE] text-[#3454FD]',
  'bg-[#F1E4FB] text-[#7B3FE4]',
  'bg-[#DFF3EA] text-[#1E9E6F]',
  'bg-[#FDE9DA] text-[#C2660B]',
];

function avatarTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

const SOURCE_TONE: Record<string, string> = {
  App: 'bg-[#E3E8FE] text-[#3454FD]',
  'Web QR': 'bg-[#DFF3EA] text-[#1E9E6F]',
  'QR Walk-in': 'bg-[#F1E4FB] text-[#7B3FE4]',
  'Walk-in': 'bg-[#F1E4FB] text-[#7B3FE4]',
};

/** One status pill per card. Live/upcoming/reserved read the item's own
 *  status; completed/cancelled read the richer outcome the salon actually
 *  recorded, never a fabricated generic label. */
function statusPill(item: QueueItem, tab: BookingTab): { label: string; tone: string } {
  if (tab === 'completed' || tab === 'cancelled') {
    const badge = outcomeBadge(item);
    const tone =
      badge.tone === 'good'
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : badge.tone === 'bad'
          ? 'bg-rose-50 text-rose-700 border border-rose-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200';
    return { label: badge.label === 'DONE' ? 'Completed' : titleCase(badge.label), tone };
  }
  if (item.status === 'Serving') return { label: 'Serving', tone: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
  if (item.status === 'Called') return { label: 'Called', tone: 'bg-amber-50 text-amber-700 border border-amber-200' };
  if (item.status === 'Reserved') return { label: 'Reserved', tone: 'bg-[#3454FD]/10 text-[#3454FD] border border-[#3454FD]/20' };
  return { label: 'Waiting', tone: 'bg-amber-50 text-amber-700 border border-amber-200' };
}

/** The one meta timestamp line under the service — which moment matters
 *  changes with the bucket, so each bucket picks its own real field rather
 *  than always showing "Joined". */
function metaTimeLabel(item: QueueItem, tab: BookingTab): string {
  if (tab === 'completed') return item.serviceCompletedAt ? `Completed ${formatTime(item.serviceCompletedAt)}` : '';
  if (tab === 'cancelled') {
    const ts = item.cancelledAt || item.noShowAt;
    return ts ? `Cancelled ${formatTime(ts)}` : '';
  }
  if (tab === 'reserved') return item.reservedFor ? `Reserved for ${item.reservedFor}` : item.createdAt ? `Booked ${formatTime(item.createdAt)}` : '';
  return item.createdAt ? `Joined ${formatTime(item.createdAt)}` : '';
}

/** Amount + payment status is only worth a line when the booking is actually
 *  in or past service — not for a customer still waiting, and never a
 *  fabricated figure when the queue carries no real price. */
function showsPayment(item: QueueItem, tab: BookingTab): boolean {
  if (typeof item.totalPriceInr !== 'number' && !item.paymentStatus) return false;
  return item.status === 'Serving' || tab === 'completed';
}

export const BookingRecordCard: React.FC<Props> = ({ item, tab, now, catalog }) => {
  const [open, setOpen] = useState(false);
  const pill = statusPill(item, tab);
  const summary = serviceSummary(item);
  const timeLabel = metaTimeLabel(item, tab);
  const staffLabel = item.barberName || 'Unassigned';

  return (
    <div id={`booking-record-${item.id}`} className="rounded-2xl border border-[#E1E7E6] bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${avatarTone(item.name)}`}>
            {(item.name || '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <b className="truncate font-sans text-sm font-bold text-[#17201F]">{item.name}</b>
              {item.token && (
                <span className="shrink-0 rounded-md bg-[#EEF1F0] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#4E625F]">
                  {item.token}
                </span>
              )}
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${SOURCE_TONE[sourceLabel(item)] || SOURCE_TONE.App}`}>
                {sourceLabel(item)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11.5px] font-medium text-[#4E625F]">
              {summary.primary}
              {summary.moreCount > 0 && <span className="text-[#7A8785]"> + {summary.moreCount} more</span>}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${pill.tone}`}>{pill.label}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-semibold text-[#7A8785]">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" /> Staff: {staffLabel}
          </span>
          {timeLabel && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {timeLabel}
            </span>
          )}
        </div>
        {showsPayment(item, tab) && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={typeof item.totalPriceInr === 'number' ? 'font-mono text-sm font-extrabold text-[#17201F]' : 'text-[10px] font-semibold italic text-[#7A8785]'}>
              {formatInr(item.totalPriceInr)}
            </span>
            {item.paymentStatus === 'paid' ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">
                Paid{item.paymentMethod ? ` · ${item.paymentMethod === 'online' ? 'Online' : 'Cash'}` : ''}
              </span>
            ) : item.paymentStatus === 'cash_pending' ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold text-amber-700">
                Cash Pending
              </span>
            ) : (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-extrabold text-rose-700">
                Unpaid
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        id={`booking-record-view-details-${item.id}`}
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center gap-2 rounded-xl border-t border-[#F0F3F2] pt-3 text-left text-[11.5px] font-bold text-[#4E625F] transition hover:text-[#17201F]"
      >
        <FileText className="h-3.5 w-3.5" />
        <span className="flex-1">View details</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {open && <BookingDetailSheet item={item} tab={tab} catalog={catalog} onClose={() => setOpen(false)} />}
    </div>
  );
};

/** Full-detail read-only sheet for one booking. Every field is real existing
 *  booking data — nothing here is fabricated, and a missing field is simply
 *  omitted rather than guessed. */
const BookingDetailSheet: React.FC<{ item: QueueItem; tab: BookingTab; catalog?: ServiceItem[]; onClose: () => void }> = ({
  item,
  tab,
  catalog,
  onClose,
}) => {
  const pill = statusPill(item, tab);
  const services = item.services && item.services.length > 0 ? item.services : item.service ? [item.service] : [];
  const cancelReason = item.cancelReasonText || (item.cancelReasonCode ? item.cancelReasonCode.replace(/_/g, ' ') : '');

  const rows: Array<[string, React.ReactNode]> = [
    ['Customer', item.name],
    ...(item.token ? ([['Token', item.token]] as [string, React.ReactNode][]) : []),
    ['Source', sourceLabel(item)],
    ['Staff', item.barberName || 'Unassigned'],
    ...(item.createdAt ? ([['Joined / Booked', formatTime(item.createdAt)]] as [string, React.ReactNode][]) : []),
    ...(item.reservedFor ? ([['Reserved for', item.reservedFor]] as [string, React.ReactNode][]) : []),
    ...(item.serviceStartedAt ? ([['Started', formatTime(item.serviceStartedAt)]] as [string, React.ReactNode][]) : []),
    ...(item.serviceCompletedAt ? ([['Completed', formatTime(item.serviceCompletedAt)]] as [string, React.ReactNode][]) : []),
    ...(item.cancelledAt ? ([['Cancelled', formatTime(item.cancelledAt)]] as [string, React.ReactNode][]) : []),
    ...(item.noShowAt ? ([['No-show recorded', formatTime(item.noShowAt)]] as [string, React.ReactNode][]) : []),
    ...(cancelReason ? ([['Reason', cancelReason]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-[#E1E7E6] bg-white p-4 shadow-2xl max-h-[85vh] overflow-y-auto sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-[#17201F]">Booking details</h3>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${pill.tone}`}>{pill.label}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#7A8785] hover:bg-[#F1F5F4]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-[#E1E7E6] bg-[#F8FAFA] p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#7A8785]">
            <Scissors className="h-3 w-3" /> Services
          </div>
          <div className="space-y-1">
            {services.map((name, index) => {
              const match = catalog?.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
              return (
                <div key={`${name}-${index}`} className="flex items-center justify-between gap-2 text-xs font-semibold text-[#17201F]">
                  <span className="min-w-0 truncate">{name}</span>
                  <span className="shrink-0 font-mono text-[#4E625F]">{typeof match?.priceInr === 'number' ? `₹${match.priceInr}` : ''}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-[#7A8785]">{label}</span>
              <span className="min-w-0 truncate text-right font-semibold text-[#17201F]">{value}</span>
            </div>
          ))}
        </div>

        {(typeof item.totalPriceInr === 'number' || item.paymentStatus) && (
          <div className="mt-3 space-y-1.5 rounded-xl border border-[#E1E7E6] bg-[#F8FAFA] p-3 text-xs font-semibold">
            {item.discountInr ? (
              <div className="flex items-center justify-between text-emerald-700">
                <span>Discount Applied</span>
                <span>-₹{item.discountInr}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-sm font-extrabold text-[#17201F]">
              <span>Amount</span>
              <span>{formatInr(item.totalPriceInr)}</span>
            </div>
            {item.paymentStatus && (
              <div className="flex items-center justify-between">
                <span className="text-[#7A8785]">Payment</span>
                <span className="text-[#17201F]">
                  {item.paymentStatus === 'paid'
                    ? `Paid${item.paymentMethod ? ` · ${item.paymentMethod === 'online' ? 'Online' : 'Cash'}` : ''}`
                    : item.paymentStatus === 'cash_pending'
                      ? 'Cash pending'
                      : 'Unpaid'}
                </span>
              </div>
            )}
          </div>
        )}

        {isCompleted(item) && item.rating && (
          <p className="mt-3 text-[11px] font-semibold text-[#4E625F]">Customer rating &middot; {item.rating}/5</p>
        )}
      </div>
    </div>
  );
};
