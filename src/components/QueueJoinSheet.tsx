import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronRight, Clock, LoaderCircle, Sparkles, Tag, Ticket, X } from 'lucide-react';
import type { Barber, QueueItem, Salon, SalonOffer, ServiceItem } from '../types';
import { LIVE_QUEUE_GRADIENT, LIVE_QUEUE_RIM_FULL } from '../shared/liveQueueVisual';
import { evaluateCoupon } from '../shared/couponPricing';
import { PriceBreakdownSheet } from './PriceBreakdownSheet';

/** "Any available stylist" is modelled as an explicit choice, not an absence. */
export const ANY_STYLIST = '';

type Props = {
  open: boolean;
  salon: Salon;
  /** Already-chosen services, shown for confirmation only — never selected here. */
  services: ServiceItem[];
  barbers: Barber[];
  queue: QueueItem[];
  busy?: boolean;
  error?: string;
  /** Name we already hold, shown so the customer can see we did not forget it. */
  customerName?: string;
  /** Offers available at this salon and the one currently applied, if any —
   *  owned by App.tsx so Salon Detail's own price breakdown and this sheet's
   *  TO PAY can never disagree about which offer is active. */
  offers: SalonOffer[];
  appliedOfferId: string | null;
  onApplyOffer: (offerId: string) => void;
  onRemoveOffer: () => void;
  onClose: () => void;
  onConfirm: (preferredBarberId: string) => void;
};

/**
 * The queue-join step for a customer we have already verified. It exists to
 * show what joining actually means right now — position, people ahead, wait —
 * and to let the customer pick a stylist. It never asks for details we hold.
 */
export const QueueJoinSheet: React.FC<Props> = ({
  open,
  salon,
  services,
  barbers,
  queue,
  busy,
  error,
  customerName,
  offers,
  appliedOfferId,
  onApplyOffer,
  onRemoveOffer,
  onClose,
  onConfirm,
}) => {
  const [stylist, setStylist] = useState<string>(ANY_STYLIST);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const totalDurationMin = useMemo(() => services.reduce((sum, item) => sum + (Number(item.durationMin) || 0), 0), [services]);
  const subtotalInr = useMemo(() => services.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0), [services]);
  const serviceIds = useMemo(() => services.map((item) => item.id), [services]);
  const appliedOffer = offers.find((offer) => offer.id === appliedOfferId);
  const appliedResult = appliedOffer ? evaluateCoupon(appliedOffer, { subtotalInr, serviceIds }) : undefined;
  const discountInr = appliedResult?.eligible ? appliedResult.discountInr : 0;
  const totalPriceInr = Math.max(0, subtotalInr - discountInr);

  // Each opening starts from "any available" rather than inheriting a stylist
  // chosen for an earlier visit, and the breakdown sheet starts closed.
  useEffect(() => {
    if (open) {
      setStylist(ANY_STYLIST);
      setBreakdownOpen(false);
    }
  }, [open]);

  if (!open) return null;

  const selectable = barbers.filter((barber) => barber.status !== 'unavailable');

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 sm:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Join the queue"
        id="queue-join-sheet"
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-[#F8FAFA] pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl sm:pb-4"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0F766E]">Join the queue</p>
            <h2 className="mt-1 truncate text-xl font-bold tracking-[-0.03em] text-[#17201F]">{salon.name}</h2>
            {customerName && (
              <p className="mt-1 truncate text-xs text-[#667371]">Booking as {customerName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#42524F] ring-1 ring-[#E2EAE9]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5">
          {/* TO PAY — total + session, deliberately no service name here: the
              header stays clean/breathable whether 1 or many services are
              selected. Live queue facts (people ahead/position/wait) already
              live on the salon page's Live Queue card, directly above this
              sheet's trigger — repeating them here was redundant. */}
          <section className="rounded-2xl border border-[#E1E7E6] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#73827F]">To pay</p>
            </div>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-[-0.02em] text-[#17201F]">₹{totalPriceInr}</p>
            {discountInr > 0 && appliedOffer && (
              <p id="to-pay-discount-note" className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#0F766E]">
                <Tag className="h-3 w-3" /> {appliedOffer.title} applied · saved ₹{discountInr}
              </p>
            )}
            {totalDurationMin > 0 && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[#E7EEEC] bg-[#F6FAF9] px-2.5 py-2">
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#0F766E] to-[#0B4A44] text-white shadow-[0_1px_3px_rgba(11,61,56,0.35)]">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#173832]">Session</span>
                  <span className="text-xs font-extrabold text-[#0B211E]">{totalDurationMin} min</span>
                </span>
              </div>
            )}
            <button
              type="button"
              id="view-services-btn"
              onClick={() => setBreakdownOpen(true)}
              className="mt-3 flex w-full items-center justify-between gap-3 border-t border-[#EEF3F2] pt-3 text-left"
            >
              <span className="text-[11px] font-semibold text-[#4C5A58]">{services.length} {services.length === 1 ? 'service' : 'services'} selected</span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#0F766E]">
                View services
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </section>

          {/* Stylist choice. */}
          <section className="mt-4">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#0F766E]" />
              <h3 className="text-sm font-bold tracking-[-0.02em] text-[#17201F]">Choose your stylist</h3>
            </div>
            <p className="mt-1 text-[11px] text-[#788582]">Pick a favourite, or let the salon seat you sooner.</p>

            <div className="mt-3 space-y-2.5">
              <AnyStylistCard selected={stylist === ANY_STYLIST} onSelect={() => setStylist(ANY_STYLIST)} />
              {barbers.filter((barber) => barber.active !== false).map((barber) => (
                <StylistCard
                  key={barber.id}
                  barber={barber}
                  allServices={salon.services}
                  selected={stylist === barber.id}
                  selectable={barber.status !== 'unavailable'}
                  onSelect={() => setStylist(barber.id)}
                />
              ))}
              {selectable.length === 0 && (
                <p className="rounded-2xl border border-[#E1E7E6] bg-white p-4 text-center text-xs text-[#788582]">
                  No stylists are on duty right now. You can still join and the salon will seat you.
                </p>
              )}
            </div>
          </section>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-[#F0D6D1] bg-[#FFF7F5] p-3 text-xs leading-5 text-[#8A3E35]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="px-5 pt-4">
          {/* Get Token — same premium teal mirror/lens material as the Salon
              Detail Live Queue card, floating directly on the sheet with no
              white slab behind it. */}
          <button
            id="confirm-join-queue-btn"
            type="button"
            disabled={busy}
            onClick={() => onConfirm(stylist)}
            className="relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-[15px] font-bold text-white shadow-[0_16px_32px_-16px_rgba(6,44,40,0.6)] transition active:scale-[0.99] disabled:opacity-60"
            style={{ background: LIVE_QUEUE_GRADIENT }}
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-2xl p-px"
              style={{
                background: LIVE_QUEUE_RIM_FULL,
                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
              aria-hidden="true"
            />
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/[0.14] to-transparent" aria-hidden="true" />
            <span className="relative flex items-center gap-2">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
              Get Token
            </span>
          </button>
          <p className="mt-2 text-center text-[11px] text-[#788582]">
            You can cancel any time before you are called.
          </p>
        </div>
      </div>

      {breakdownOpen && (
        <PriceBreakdownSheet
          services={services}
          offers={offers}
          appliedOfferId={appliedOfferId}
          onApplyOffer={onApplyOffer}
          onRemoveOffer={onRemoveOffer}
          onClose={() => setBreakdownOpen(false)}
        />
      )}
    </div>
  );
};

/** Compact outlined pill — deliberately smaller/quieter than the named
 *  stylist profile cards below it, since "any available" isn't a person. */
const AnyStylistCard: React.FC<{ selected: boolean; onSelect: () => void }> = ({ selected, onSelect }) => (
  <button
    id="stylist-any"
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`flex w-full items-center gap-2 rounded-full border px-3.5 py-2.5 text-left transition ${
      selected ? 'border-[#0F766E] bg-[#F1FAF9]' : 'border-[#E2EAE9] bg-white'
    }`}
  >
    <Sparkles className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-[#0F766E]' : 'text-[#788582]'}`} />
    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#17201F]">
      Any available stylist <span className="font-semibold text-[#788582]">· Fastest option</span>
    </span>
    {selected && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0F766E] text-white"><Check className="h-3 w-3" /></span>}
  </button>
);

const STATUS_LABEL: Record<Barber['status'], string> = { available: 'Available', busy: 'In chair', unavailable: 'Off duty' };
const STATUS_DOT: Record<Barber['status'], string> = { available: 'bg-[#0F766E]', busy: 'bg-[#A66020]', unavailable: 'bg-[#9AA6A3]' };
const STATUS_PILL: Record<Barber['status'], string> = {
  available: 'bg-[#E7F5F2] text-[#0F766E]',
  busy: 'bg-[#FAF0E6] text-[#A66020]',
  unavailable: 'bg-[#EEF3F2] text-[#6F7C7A]',
};

const StylistCard: React.FC<{
  barber: Barber;
  allServices: ServiceItem[];
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
}> = ({ barber, allServices, selected, selectable, onSelect }) => {
  const skills = (barber.serviceIds || [])
    .map((id) => allServices.find((service) => service.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
  return (
    <button
      id={`stylist-${barber.id}`}
      type="button"
      onClick={onSelect}
      disabled={!selectable}
      aria-pressed={selected}
      className={`relative flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
        selected
          ? 'border-[#0F766E] bg-[#F1FAF9] shadow-[0_4px_14px_-8px_rgba(15,118,110,0.5)]'
          : selectable
            ? 'border-[#E2EAE9] bg-white'
            : 'border-[#E2EAE9] bg-white opacity-60'
      }`}
    >
      {selected && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[#0F766E] text-white"><Check className="h-3 w-3" /></span>}
      <span className="relative shrink-0">
        {barber.photoUrl ? (
          <img src={barber.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#173B38] to-[#3F746D] text-sm font-bold text-white">
            {barber.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${STATUS_DOT[barber.status]}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-[#17201F]">{barber.name}</span>
            {barber.role && <span className="mt-0.5 block truncate text-[10px] text-[#788582]">{barber.role}</span>}
          </span>
          <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_PILL[barber.status]}`}>
            {STATUS_LABEL[barber.status]}
          </span>
        </span>
        {skills.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {skills.map((skill) => (
              <span key={skill} className="rounded-md bg-[#F0F5F4] px-1.5 py-0.5 text-[9px] font-semibold text-[#536966]">{skill}</span>
            ))}
          </span>
        )}
        <span className="mt-1.5 block text-[10px] font-semibold text-[#0F766E]">
          {barber.status === 'available' ? 'Free now' : barber.status === 'busy' ? `With ${barber.currentCustomerName || 'a customer'}` : 'Not working today'}
        </span>
      </span>
    </button>
  );
};
