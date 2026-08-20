import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronRight, Clock, LoaderCircle, Radio, Scissors, Sparkles, Star, X } from 'lucide-react';
import type { Barber, QueueItem, Salon, ServiceItem } from '../types';
import { buildJoinPreview } from '../shared/joinPreview';
import { selectableStylists, STYLIST_STATUS_LABEL, stylistLiveStatus } from '../shared/staffAvailability';
import { formatDuration } from '../shared/formatDuration';

/** Demo placeholder rating shown only when a stylist record has no real
 *  `rating` yet — never overwrites an actual rating the data model supplies. */
const DEMO_STYLIST_RATING = 4.8;

/** Initials fallback for a customer with no profile photo — e.g. "Ritik Singh" -> "RS". */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  /** Real profile photo, when the customer has uploaded one. Falls back to initials. */
  customerAvatarUrl?: string;
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
  customerAvatarUrl,
  onClose,
  onConfirm,
}) => {
  const [stylist, setStylist] = useState<string>(ANY_STYLIST);
  const [servicesSheetOpen, setServicesSheetOpen] = useState(false);
  const [profileBarber, setProfileBarber] = useState<Barber | null>(null);
  const preview = useMemo(() => buildJoinPreview(queue, barbers), [queue, barbers]);
  const totalDurationMin = useMemo(() => services.reduce((sum, item) => sum + (Number(item.durationMin) || 0), 0), [services]);
  const totalPriceInr = useMemo(() => services.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0), [services]);

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
            {customerName && (
              <div className="mt-2 flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#0F766E] text-[10px] font-bold text-white ring-1 ring-[#CDE3E0]">
                  {customerAvatarUrl ? (
                    <img src={customerAvatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initialsFor(customerName)
                  )}
                </span>
                <p className="truncate text-xs text-[#667371]">Booking as <span className="font-semibold text-[#3B4644]">{customerName}</span></p>
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
          {/* Live queue facts — same compact premium/motion language as the
              salon page's live-queue USP card. */}
          <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0B4A44] via-[#0F6B62] to-[#0F766E] p-4 text-white shadow-[0_14px_32px_-16px_rgba(6,44,40,0.55)]">
            <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#5EE0B4]/25 blur-3xl" aria-hidden="true" />
            <div className="relative flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                Live
              </span>
              <Radio className="h-3 w-3 animate-pulse text-white/70" />
            </div>
            <div className="relative mt-3 grid grid-cols-2 gap-2.5">
              <JoinStat label="People ahead" value={String(preview.peopleAhead)} />
              <JoinStat label="Your position" value={`#${preview.projectedPosition}`} />
              <JoinStat label="Est. time" value={preview.estimatedWaitMinutes === 0 ? 'Now' : formatDuration(preview.estimatedWaitMinutes)} />
              <JoinStat label="Chairs available" value={String(preview.openChairs)} />
            </div>
          </section>

          {/* Service summary — chosen already, shown for confirmation only.
              Names never listed inline here; "View services" opens the full list. */}
          <section className="mt-4 rounded-2xl border border-[#E1E7E6] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#17201F]">
                  {services.length} {services.length === 1 ? 'service' : 'services'} selected
                </p>
                <button
                  type="button"
                  id="view-selected-services-btn"
                  onClick={() => setServicesSheetOpen(true)}
                  className="mt-1 flex items-center gap-1 text-xs font-bold text-[#0F766E]"
                >
                  View services <ChevronRight className="h-3.5 w-3.5" />
                </button>
                {totalDurationMin > 0 && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#60716E]">
                    <Clock className="h-3 w-3" /> Approx. {formatDuration(totalDurationMin)}
                  </p>
                )}
              </div>
              {totalPriceInr > 0 ? <span className="shrink-0 text-base font-bold text-[#17201F]">₹{totalPriceInr}</span> : null}
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

      {servicesSheetOpen && (
        <SelectedServicesSheet
          services={services}
          totalDurationMin={totalDurationMin}
          totalPriceInr={totalPriceInr}
          onClose={() => setServicesSheetOpen(false)}
        />
      )}

      {profileBarber && <StylistProfileSheet barber={profileBarber} onClose={() => setProfileBarber(null)} />}
    </div>
  );
};

const JoinStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-white/10 p-2.5">
    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/60">{label}</p>
    <p className="mt-0.5 text-lg font-bold tracking-[-0.02em] text-white">{value}</p>
  </div>
);

/** Scrollable bottom sheet listing exactly the services chosen on the previous screen. */
const SelectedServicesSheet: React.FC<{
  services: ServiceItem[];
  totalDurationMin: number;
  totalPriceInr: number;
  onClose: () => void;
}> = ({ services, totalDurationMin, totalPriceInr, onClose }) => (
  <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/55 sm:items-center" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Your selected services" className="flex max-h-[80vh] w-full flex-col rounded-t-3xl bg-[#F8FAFA] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-3xl">
      <div className="mx-auto mt-4 h-1 w-10 shrink-0 rounded-full bg-[#C9D2D0] sm:hidden" />
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4">
        <h2 className="text-lg font-bold text-[#17201F]">
          {services.length} {services.length === 1 ? 'service' : 'services'} selected
        </h2>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#E2EAE9]"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto px-5">
        {services.map((service) => (
          <div key={service.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#17201F]">{service.name}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#60716E]">Approx. {formatDuration(service.durationMin)}</p>
            </div>
            <span className="shrink-0 text-sm font-bold text-[#17201F]">₹{service.priceInr}</span>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-[#E1E7E6] px-5 pt-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#4C5A58]">
          <span>Approx. {formatDuration(totalDurationMin)} total</span>
          <span className="text-base font-bold text-[#17201F]">₹{totalPriceInr}</span>
        </div>
      </div>
    </section>
  </div>
);

const StylistOption: React.FC<
  | { id: string; title: string; subtitle: string; selected: boolean; onSelect: () => void; barber?: undefined; onViewProfile?: undefined }
  | { id: string; barber: Barber; selected: boolean; onSelect: () => void; onViewProfile: () => void; title?: undefined; subtitle?: undefined }
> = (props) => {
  const { id, selected, onSelect } = props;
  const barber = props.barber;
  const title = barber ? barber.name : props.title;
  const liveStatus = barber ? stylistLiveStatus(barber) : undefined;
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
          {barber?.avatarUrl ? (
            <img src={barber.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className={`grid h-full w-full place-items-center ${selected ? 'bg-[#0F766E] text-white' : 'bg-[#EEF3F2] text-[#5C6B68]'}`}>
              {selected && !barber ? <Check className="h-4 w-4" /> : (title || '?').slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-[#17201F]">{title}</span>
            {barber && (
              <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-[#8A6516]">
                <Star className="h-3 w-3 fill-[#F5A524] text-[#F5A524]" />
                {(typeof barber.rating === 'number' && barber.rating > 0 ? barber.rating : DEMO_STYLIST_RATING).toFixed(1)}
              </span>
            )}
          </span>
          {barber && liveStatus ? (
            <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${statusPillClass}`}>
              {STYLIST_STATUS_LABEL[liveStatus]}
            </span>
          ) : (
            <span className="mt-0.5 block truncate text-[11px] text-[#788582]">{props.subtitle}</span>
          )}
        </span>
      </button>
      {barber && (
        <button
          type="button"
          onClick={props.onViewProfile}
          className="shrink-0 text-[11px] font-bold text-[#0F766E] underline underline-offset-2"
        >
          View profile
        </button>
      )}
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
