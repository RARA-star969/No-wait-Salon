import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronRight, Clock, LoaderCircle, Sparkles, Star, Tag, Ticket, X } from 'lucide-react';
import type { Barber, QueueItem, Salon, SalonOffer, ServiceItem } from '../types';
import { NOQ_CUSTOMER_LIVE_QUEUE_GRADIENT, NOQ_CUSTOMER_LIVE_QUEUE_RIM_FULL } from '../shared/liveQueueVisual';
import { evaluateCoupon } from '../shared/couponPricing';
import { PriceBreakdownSheet } from './PriceBreakdownSheet';
import { StaffProfileSheet } from './StaffProfileSheet';

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
  offers?: SalonOffer[];
  appliedOfferId?: string | null;
  onApplyOffer?: (offerId: string) => void;
  onRemoveOffer?: () => void;
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
  offers = [],
  appliedOfferId = null,
  onApplyOffer,
  onRemoveOffer,
  onClose,
  onConfirm,
}) => {
  const [stylist, setStylist] = useState<string>(ANY_STYLIST);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [profileBarber, setProfileBarber] = useState<Barber | null>(null);
  const [mounted, setMounted] = useState(open);
  const [active, setActive] = useState(open);

  const totalDurationMin = useMemo(() => services.reduce((sum, item) => sum + (Number(item.durationMin) || 0), 0), [services]);
  const subtotalInr = useMemo(() => services.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0), [services]);
  const serviceIds = useMemo(() => services.map((item) => item.id), [services]);
  const appliedOffer = offers.find((offer) => offer.id === appliedOfferId);
  const appliedResult = appliedOffer ? evaluateCoupon(appliedOffer, { subtotalInr, serviceIds }) : undefined;
  const discountInr = appliedResult?.eligible ? appliedResult.discountInr : 0;
  const totalPriceInr = Math.max(0, subtotalInr - discountInr);

  // Smooth slide-up transition upon open, and graceful slide-down before unmounting on close.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setStylist(ANY_STYLIST);
      setBreakdownOpen(false);
      setProfileBarber(null);
      const raf = requestAnimationFrame(() => setActive(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setActive(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleClose = () => {
    setActive(false);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  if (!mounted) return null;

  const selectable = barbers.filter((barber) => barber.status !== 'unavailable');

  return (
    <div
      className={`fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 transition-opacity duration-300 ease-out sm:items-center motion-reduce:transition-none ${
        active ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <button type="button" aria-label="Close" onClick={handleClose} className="absolute inset-0 cursor-default" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Join the queue"
        id="queue-join-sheet"
        className={`relative flex max-h-[calc(100dvh-5.5rem)] w-full flex-col rounded-t-3xl bg-[var(--noq-base)] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:max-h-[85vh] sm:max-w-md sm:rounded-3xl sm:pb-4 motion-reduce:transition-none motion-reduce:transform-none ${
          active ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-90 sm:translate-y-4 sm:scale-95'
        }`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--noq-accent)]">Join the queue</p>
            <h2 className="mt-1 truncate text-xl font-bold tracking-[-0.03em] text-[var(--noq-ink)]">{salon.name}</h2>
            {customerName && (
              <p className="mt-1 truncate text-xs text-[#667371]">Booking as {customerName}</p>
            )}
          </div>
          <button
            id="close-queue-join-sheet-btn"
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#42524F] ring-1 ring-[var(--noq-border)] transition hover:bg-[#F0F6F5]"
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
          <section className="rounded-2xl border border-[var(--noq-border)] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#73827F]">To pay</p>
            </div>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-[-0.02em] text-[var(--noq-ink)]">₹{totalPriceInr}</p>
            {discountInr > 0 && appliedOffer && (
              <p id="to-pay-discount-note" className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[var(--noq-accent)]">
                <Tag className="h-3 w-3" /> {appliedOffer.title} applied · saved ₹{discountInr}
              </p>
            )}
            {totalDurationMin > 0 && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[#E7EEEC] bg-[#F6FAF9] px-2.5 py-2">
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[var(--noq-accent-light)] to-[var(--noq-accent-deep)] text-white shadow-[0_1px_3px_rgba(52,84,253,0.24)]">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--noq-ink)]">Session</span>
                  <span className="text-xs font-extrabold text-[var(--noq-ink)]">{totalDurationMin} min</span>
                </span>
              </div>
            )}
            <button
              type="button"
              id="view-services-btn"
              onClick={() => setBreakdownOpen(true)}
              className="mt-3 flex w-full items-center justify-between gap-3 border-t border-[var(--noq-surface-soft)] pt-3 text-left"
            >
              <span className="text-[11px] font-semibold text-[#4C5A58]">{services.length} {services.length === 1 ? 'service' : 'services'} selected</span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--noq-accent)]">
                View services
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </section>

          {/* Stylist choice. */}
          <section className="mt-4">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[var(--noq-accent)]" />
              <h3 className="text-sm font-bold tracking-[-0.02em] text-[var(--noq-ink)]">Choose your stylist</h3>
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
                  onViewProfile={(targetBarber) => setProfileBarber(targetBarber)}
                />
              ))}
              {selectable.length === 0 && (
                <p className="rounded-2xl border border-[var(--noq-border)] bg-white p-4 text-center text-xs text-[#788582]">
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
            style={{ background: NOQ_CUSTOMER_LIVE_QUEUE_GRADIENT }}
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-2xl p-px"
              style={{
                background: NOQ_CUSTOMER_LIVE_QUEUE_RIM_FULL,
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
          onApplyOffer={onApplyOffer || (() => undefined)}
          onRemoveOffer={onRemoveOffer || (() => undefined)}
          onClose={() => setBreakdownOpen(false)}
        />
      )}

      {profileBarber && (
        <StaffProfileSheet
          open={Boolean(profileBarber)}
          barber={profileBarber}
          allServices={salon.services}
          selectable={profileBarber.status !== 'unavailable'}
          isSelected={stylist === profileBarber.id}
          busy={busy}
          onSelectAndConfirm={(selectedId) => {
            setStylist(selectedId);
            setProfileBarber(null);
            onConfirm(selectedId);
          }}
          onClose={() => setProfileBarber(null)}
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
    className={`flex w-full items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-left transition ${
      selected ? 'border-[var(--noq-accent)] bg-[#F1FAF9] shadow-sm ring-1 ring-[var(--noq-accent)]' : 'border-[var(--noq-border)] bg-white'
    }`}
  >
    <Sparkles className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-[var(--noq-accent)]' : 'text-[#788582]'}`} />
    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--noq-ink)]">
      Any available stylist <span className="font-semibold text-[#788582]">· Fastest option</span>
    </span>
    {selected ? (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--noq-accent)] text-white">
        <Check className="h-3 w-3" />
      </span>
    ) : (
      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-[#D1DCDA] bg-white" />
    )}
  </button>
);

const STATUS_LABEL: Record<Barber['status'], string> = { available: 'Available', busy: 'In chair', unavailable: 'Off duty' };
const STATUS_DOT: Record<Barber['status'], string> = { available: 'bg-[var(--noq-accent)]', busy: 'bg-[#A66020]', unavailable: 'bg-[#9AA6A3]' };
const STATUS_PILL: Record<Barber['status'], string> = {
  available: 'bg-[#E7F5F2] text-[var(--noq-accent)] border border-[var(--noq-accent)]/20',
  busy: 'bg-[#FAF0E6] text-[#A66020] border border-[#A66020]/20',
  unavailable: 'bg-[var(--noq-surface-soft)] text-[var(--noq-muted)] border border-[var(--noq-muted)]/20',
};

const StylistCard: React.FC<{
  barber: Barber;
  allServices: ServiceItem[];
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
  onViewProfile: (barber: Barber) => void;
}> = ({ barber, allServices, selected, selectable, onSelect, onViewProfile }) => {
  const rating = barber.rating ?? 4.8;
  const reviewCount = barber.reviewCount ?? 50;

  const skills = (barber.serviceIds || [])
    .map((id) => allServices.find((service) => service.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 2);

  return (
    <div
      id={`stylist-${barber.id}`}
      role="button"
      tabIndex={selectable ? 0 : -1}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={(e) => {
        if (selectable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      aria-disabled={!selectable}
      className={`relative w-full rounded-2xl border p-3 text-left transition-all duration-200 cursor-pointer select-none ${
        selected
          ? 'border-[var(--noq-accent)] bg-[#F1FAF9] shadow-[0_4px_16px_-8px_rgba(52,84,253,0.30)] ring-1 ring-[var(--noq-accent)]'
          : selectable
            ? 'border-[var(--noq-border)] bg-white hover:border-[#BFD5D2]'
            : 'border-[var(--noq-border)] bg-[#FAFCFC] opacity-65 cursor-not-allowed'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0 pt-0.5">
          {barber.photoUrl ? (
            <img src={barber.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-black/5" />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#173B38] to-[#3F746D] text-sm font-bold text-white shadow-sm">
              {barber.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className={`absolute bottom-0 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${STATUS_DOT[barber.status]}`} />
        </div>

        {/* Info Column */}
        <div className="min-w-0 flex-1">
          {/* Top Row: Name + Rating on left, Status Pill + Selection Indicator on right */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-bold text-[var(--noq-ink)]">{barber.name}</span>
                <span className="inline-flex items-center gap-0.5 rounded-md bg-[#FEF9C3] px-1.5 py-0.5 text-[10px] font-bold text-[#854D0E]">
                  <Star className="h-2.5 w-2.5 fill-[#CA8A04] text-[#CA8A04]" />
                  {rating.toFixed(1)}
                  {reviewCount > 0 && <span className="font-medium text-[#A16207]">({reviewCount})</span>}
                </span>
              </div>
              {barber.role && <p className="mt-0.5 truncate text-[11px] font-medium text-[#788582]">{barber.role}</p>}
            </div>

            {/* Status Pill & Dedicated Selection Radio Indicator (no collision!) */}
            <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide ${STATUS_PILL[barber.status]}`}>
                {STATUS_LABEL[barber.status]}
              </span>
              {selected ? (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--noq-accent)] text-white shadow-sm ring-2 ring-white">
                  <Check className="h-3 w-3" />
                </span>
              ) : (
                <span className="h-5 w-5 rounded-full border-2 border-[#D1DCDA] bg-white transition" />
              )}
            </div>
          </div>

          {/* Skill Chips */}
          {skills.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {skills.map((skill) => (
                <span key={skill} className="rounded-md bg-[var(--noq-surface-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[#536966]">
                  {skill}
                </span>
              ))}
            </div>
          )}

          {/* Bottom Row: Live Status on left, Clickable 'View profile' on right */}
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#E8EFEB] pt-2">
            <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[var(--noq-accent)]">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[barber.status]}`} />
              {barber.status === 'available'
                ? 'Free now'
                : barber.status === 'busy'
                  ? 'With customer'
                  : 'Not working today'}
            </span>

            <button
              type="button"
              id={`view-profile-${barber.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile(barber);
              }}
              aria-label={`View profile for ${barber.name}`}
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-[var(--noq-accent)] transition hover:bg-[#E6F4F1] active:scale-95"
            >
              View profile
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
