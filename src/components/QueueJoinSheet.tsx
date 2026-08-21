import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronRight, Clock, LoaderCircle, Scissors, Sparkles, Star, X } from 'lucide-react';
import type { Barber, CustomerProfile, QueueItem, Salon, ServiceItem } from '../types';
import { buildJoinPreview } from '../shared/joinPreview';
import { formatDurationLabel } from '../shared/durationFormat';
import { sumDurationMinutes } from '../shared/serviceSelection';
import { selectableStylists, STYLIST_STATUS_LABEL, stylistLiveStatus } from '../shared/staffAvailability';
import type { LiveQueueMetrics } from '../shared/liveQueueMetrics';
import { couponTotals } from '../shared/couponValidation';
import { CustomerAvatar } from './CustomerAvatar';
import { LiveQueueScoreboard } from './LiveQueueScoreboard';
import { ServicesBillSheet } from './ServicesBillSheet';

/** Demo placeholder rating shown only when a stylist record has no real
 *  `rating` yet — never overwrites an actual rating the data model supplies. */
const DEMO_STYLIST_RATING = 4.8;

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
  /** Full profile, used to render the customer's actual uploaded photo. */
  customerProfile?: CustomerProfile | null;
  /**
   * When provided, the live section renders the exact same LiveQueueCard as
   * the customer Salon Detail page, fed by these already-derived metrics —
   * so the two surfaces can never disagree. Omit to keep the previous panel
   * summary computed from `buildJoinPreview`; the public QR page (which
   * renders this same sheet) intentionally never passes this, so its live
   * summary and calculations are unaffected by this prop's existence.
   */
  liveQueueMetrics?: LiveQueueMetrics;
  /**
   * The one applied-coupon source of truth, owned by the app shell. Resolved
   * here with the same `couponTotals` Salon Detail's Price Breakdown uses,
   * against this same salon's real offers — never a separately stored
   * discount. Omitted by the public QR page, which keeps its own checkout.
   */
  appliedCouponCode?: string | null;
  onApplyCoupon?: (code: string) => void;
  onRemoveCoupon?: () => void;
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
  customerProfile,
  liveQueueMetrics,
  appliedCouponCode,
  onApplyCoupon,
  onRemoveCoupon,
  onClose,
  onConfirm,
}) => {
  const [stylist, setStylist] = useState<string>(ANY_STYLIST);
  const [viewServicesOpen, setViewServicesOpen] = useState(false);
  const [profileBarber, setProfileBarber] = useState<Barber | null>(null);
  const preview = useMemo(() => buildJoinPreview(queue, barbers), [queue, barbers]);
  const totalDurationMin = useMemo(() => sumDurationMinutes(services), [services]);
  const totalPriceInr = useMemo(() => services.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0), [services]);
  // Same resolveCoupon math the Price Breakdown uses, over the same salon
  // offers and the same applied code, so "To pay" never disagrees with it.
  const bill = useMemo(() => couponTotals(appliedCouponCode, salon.offers || [], totalPriceInr), [appliedCouponCode, salon.offers, totalPriceInr]);
  const serviceLabel = services.map((item) => item.name).join(' + ') || 'Service';
  const displayName = customerProfile?.name?.trim() || customerName;

  // Each opening starts from "any available" rather than inheriting a stylist
  // chosen for an earlier visit.
  useEffect(() => {
    if (open) setStylist(ANY_STYLIST);
  }, [open]);

  if (!open) return null;

  const selectable = selectableStylists(barbers);

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
            {displayName && (
              <div className="mt-2 flex items-center gap-2">
                <CustomerAvatar profile={customerProfile ?? null} size={28} className="text-[10px]" />
                <p className="truncate text-xs font-semibold text-[#42524F]">{displayName}</p>
              </div>
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
          {/* Customer app (liveQueueMetrics present): no live card here —
              the floating capsule on Salon Detail stays visible behind this
              sheet for the whole flow, so this would just duplicate it. */}
          {!liveQueueMetrics && (
            /* Public QR page: unchanged panel summary from buildJoinPreview —
               that surface has no floating capsule, so this stays as-is. */
            <LiveQueueScoreboard
              variant="panel"
              metrics={[
                { key: 'ahead', label: 'People ahead', value: preview.peopleAhead },
                { key: 'position', label: 'Your position', value: `#${preview.projectedPosition}` },
                { key: 'wait', label: 'Est. time', value: preview.estimatedWaitMinutes === 0 ? 'Now' : `${preview.estimatedWaitMinutes}m` },
                { key: 'chairs', label: 'Chairs available', value: preview.openChairs },
              ]}
            />
          )}

          {/* Payment summary — "To pay" is the final, already-discounted
              amount; the service name(s) move to a small corner tag so the
              row still reads correctly whether one service is selected or
              five. Session duration is the customer's own service time,
              never to be confused with how long the queue itself will take. */}
          <section className="relative mt-4 rounded-[18px] border border-[#E3EAE8] bg-gradient-to-b from-white to-[#FBFDFC] p-4 shadow-[0_10px_24px_-18px_rgba(15,40,37,0.28)]">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[#5C7773]">To pay</p>
                <p className="mt-1 text-[26px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#0F2C28]">
                  <sup className="mr-0.5 text-sm font-bold text-[#3E5A55]">₹</sup>{bill.totalInr}
                </p>
              </div>
              {serviceLabel && <p className="max-w-[120px] shrink-0 truncate text-right text-[10.5px] font-bold text-[#8A9694]">{serviceLabel}</p>}
            </div>

            {totalDurationMin > 0 && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[#E1EEEA] bg-[#F1F8F6] px-2.5 py-2">
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#E4F3EF] to-[#D6ECE6] text-[#0F766E] shadow-[inset_0_0_0_1px_rgba(15,118,110,0.12)]">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#5C7773]">Session</span>
                  <span className="text-xs font-extrabold text-[#17332F]">{formatDurationLabel(totalDurationMin)}</span>
                </span>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-[#EDF2F1] pt-3">
              <span className="text-[10.5px] font-semibold text-[#8A9694]">
                {services.length} {services.length === 1 ? 'service' : 'services'} selected
              </span>
              <button
                type="button"
                onClick={() => setViewServicesOpen(true)}
                className="flex min-h-[26px] items-center gap-1 border-b border-dashed border-[#BFDAD6] py-0.5 text-[11px] font-bold text-[#0F766E]"
              >
                View services
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </section>

          {/* Stylist choice. */}
          <section className="mt-4">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#0F766E]" />
              <h3 className="text-sm font-bold tracking-[-0.02em] text-[#17201F]">Choose your stylist</h3>
            </div>
            <p className="mt-1 text-[11px] text-[#788582]">Pick a favourite, or let the salon seat you sooner.</p>

            {/* Quiet toggle, not a full card — individual stylists below are
                the primary visual focus. */}
            <button
              type="button"
              id="stylist-any"
              aria-pressed={stylist === ANY_STYLIST}
              onClick={() => setStylist(ANY_STYLIST)}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                stylist === ANY_STYLIST ? 'border-[#0F766E] bg-[#E7F5F2] text-[#0F766E]' : 'border-[#E2EAE9] bg-white text-[#5C6B68]'
              }`}
            >
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${stylist === ANY_STYLIST ? 'border-[#0F766E] bg-[#0F766E] text-white' : 'border-[#C5CECC] text-transparent'}`}>
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              Any available stylist
              <span className="font-semibold text-[10px] text-[#0F766E]/70">· Fastest option</span>
            </button>

            <div className="mt-3 space-y-2">
              {selectable.map((barber) => (
                <StylistOption
                  key={barber.id}
                  id={`stylist-${barber.id}`}
                  barber={barber}
                  selected={stylist === barber.id}
                  onSelect={() => setStylist(barber.id)}
                  onViewProfile={() => setProfileBarber(barber)}
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
          <button
            id="confirm-join-queue-btn"
            type="button"
            disabled={busy}
            onClick={() => onConfirm(stylist)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0F766E] text-[15px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
            Join Queue
          </button>
          <p className="mt-2 text-center text-[11px] text-[#788582]">
            You can cancel any time before you are called.
          </p>
        </div>
      </div>

      <ServicesBillSheet
        open={viewServicesOpen}
        title="Your services"
        eyebrow={`${services.length} ${services.length === 1 ? 'service' : 'services'} selected`}
        services={services}
        offers={salon.offers}
        appliedCouponCode={appliedCouponCode}
        onClose={() => setViewServicesOpen(false)}
      />

      {profileBarber && <StylistProfileSheet barber={profileBarber} onClose={() => setProfileBarber(null)} />}
    </div>
  );
};

const StylistOption: React.FC<{
  id: string;
  barber: Barber;
  selected: boolean;
  onSelect: () => void;
  onViewProfile: () => void;
}> = ({ id, barber, selected, onSelect, onViewProfile }) => {
  const liveStatus = stylistLiveStatus(barber);
  const statusPillClass =
    liveStatus === 'free'
      ? 'bg-[#E7F5F2] text-[#0F766E]'
      : liveStatus === 'with_customer'
        ? 'bg-[#FDF1DD] text-[#8A5A16]'
        : 'bg-[#F1F4F3] text-[#788582]';

  return (
    <div
      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
        selected ? 'border-[#0F766E] bg-[#F1FAF9] shadow-[0_4px_14px_-8px_rgba(15,118,110,0.5)]' : 'border-[#E2EAE9] bg-white'
      }`}
    >
      <button id={id} type="button" onClick={onSelect} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold ring-2 ring-offset-1 ring-offset-white ${selected ? 'ring-[#0F766E]' : 'ring-transparent'}`}>
          {barber.avatarUrl ? (
            <img src={barber.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className={`grid h-full w-full place-items-center ${selected ? 'bg-[#0F766E] text-white' : 'bg-[#EEF3F2] text-[#5C6B68]'}`}>
              {selected ? <Check className="h-4 w-4" /> : barber.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-[#17201F]">{barber.name}</span>
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-[#8A6516]">
              <Star className="h-3 w-3 fill-[#F5A524] text-[#F5A524]" />
              {(typeof barber.rating === 'number' && barber.rating > 0 ? barber.rating : DEMO_STYLIST_RATING).toFixed(1)}
            </span>
          </span>
          <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${statusPillClass}`}>
            {STYLIST_STATUS_LABEL[liveStatus]}
          </span>
        </span>
      </button>
      <button type="button" onClick={onViewProfile} className="shrink-0 text-[11px] font-bold text-[#0F766E] underline underline-offset-2">
        View profile
      </button>
    </div>
  );
};

/** Extensible profile preview — only ever shows fields the salon actually supplied. */
const StylistProfileSheet: React.FC<{ barber: Barber; onClose: () => void }> = ({ barber, onClose }) => {
  const liveStatus = stylistLiveStatus(barber);
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/55 sm:items-center" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={`${barber.name}'s profile`} className="w-full rounded-t-3xl bg-[#F8FAFA] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:max-w-sm sm:rounded-3xl sm:pb-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#C9D2D0] sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[#EEF3F2] text-lg font-bold text-[#5C6B68]">
              {barber.avatarUrl ? <img src={barber.avatarUrl} alt="" className="h-full w-full object-cover" /> : barber.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#17201F]">{barber.name}</h2>
              <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-[#8A6516]">
                <Star className="h-3.5 w-3.5 fill-[#F5A524] text-[#F5A524]" />
                {(typeof barber.rating === 'number' && barber.rating > 0 ? barber.rating : DEMO_STYLIST_RATING).toFixed(1)}
                {typeof barber.reviewCount === 'number' && barber.reviewCount > 0 && <span className="font-semibold text-[#A98A44]">({barber.reviewCount})</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#E2EAE9]"><X className="h-4 w-4" /></button>
        </div>
        <span className={`mt-4 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${liveStatus === 'free' ? 'bg-[#E7F5F2] text-[#0F766E]' : liveStatus === 'with_customer' ? 'bg-[#FDF1DD] text-[#8A5A16]' : 'bg-[#F1F4F3] text-[#788582]'}`}>
          {STYLIST_STATUS_LABEL[liveStatus]}
        </span>
        {barber.shortBio && <p className="mt-3 text-xs leading-5 text-[#657471]">{barber.shortBio}</p>}
      </section>
    </div>
  );
};
