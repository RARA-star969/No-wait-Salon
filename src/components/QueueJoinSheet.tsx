import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Clock, LoaderCircle, Scissors, Sparkles, Users, X } from 'lucide-react';
import type { Barber, QueueItem, Salon, ServiceItem } from '../types';
import { buildJoinPreview } from '../shared/joinPreview';

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
  onClose,
  onConfirm,
}) => {
  const [stylist, setStylist] = useState<string>(ANY_STYLIST);
  const preview = useMemo(() => buildJoinPreview(queue, barbers), [queue, barbers]);
  const totalDurationMin = useMemo(() => services.reduce((sum, item) => sum + (Number(item.durationMin) || 0), 0), [services]);
  const totalPriceInr = useMemo(() => services.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0), [services]);
  const serviceLabel = services.map((item) => item.name).join(' + ') || 'Service';

  // Each opening starts from "any available" rather than inheriting a stylist
  // chosen for an earlier visit.
  useEffect(() => {
    if (open) setStylist(ANY_STYLIST);
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
          {/* Live queue facts, from the same maths the live ticket uses. */}
          <section className="rounded-2xl border border-[#BFDAD6] bg-[#E6F3F1] p-4">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14B8A6] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0F766E]" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4E7772]">Live queue</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="People ahead" value={String(preview.peopleAhead)} />
              <Stat label="Your position" value={`#${preview.projectedPosition}`} />
              <Stat label="Est. wait" value={preview.estimatedWaitMinutes === 0 ? 'Now' : `${preview.estimatedWaitMinutes}m`} />
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#5C7773]">
              <Users className="h-3.5 w-3.5" />
              {preview.openChairs} of {preview.workingChairs} {preview.workingChairs === 1 ? 'chair' : 'chairs'} free right now
            </p>
          </section>

          {/* Service summary — chosen already, shown for confirmation only. */}
          <section className="mt-4 rounded-2xl border border-[#E1E7E6] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#73827F]">
              {services.length > 1 ? 'Your services' : 'Your service'}
            </p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#17201F]">{serviceLabel}</p>
                {services.length === 1 && services[0]?.description && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#788582]">{services[0].description}</p>
                )}
                {totalDurationMin > 0 ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#60716E]">
                    <Clock className="h-3 w-3" /> {totalDurationMin} min
                  </p>
                ) : null}
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

            <div className="mt-3 space-y-2.5">
              <AnyStylistCard selected={stylist === ANY_STYLIST} onSelect={() => setStylist(ANY_STYLIST)} openChairs={preview.openChairs} workingChairs={preview.workingChairs} />
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
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-white/70 p-2.5 text-center">
    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#5C7773]">{label}</p>
    <p className="mt-0.5 text-lg font-bold tracking-[-0.02em] text-[#125B54]">{value}</p>
  </div>
);

const AnyStylistCard: React.FC<{ selected: boolean; onSelect: () => void; openChairs: number; workingChairs: number }> = ({
  selected,
  onSelect,
  openChairs,
  workingChairs,
}) => (
  <button
    id="stylist-any"
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`relative flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
      selected ? 'border-transparent bg-gradient-to-br from-[#173B38] to-[#2C5B55] shadow-[0_10px_22px_-14px_rgba(15,118,110,0.6)]' : 'border-[#E2EAE9] bg-white'
    }`}
  >
    {selected && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-white text-[#173B38]"><Check className="h-3 w-3" /></span>}
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${selected ? 'bg-white/15' : 'bg-[#EEF3F2]'}`}>
      <Sparkles className={`h-4.5 w-4.5 ${selected ? 'text-white' : 'text-[#0F766E]'}`} />
    </span>
    <span className="min-w-0 flex-1">
      <span className={`block truncate text-sm font-bold ${selected ? 'text-white' : 'text-[#17201F]'}`}>Any available stylist</span>
      <span className={`mt-0.5 block truncate text-[11px] ${selected ? 'text-white/70' : 'text-[#788582]'}`}>
        {openChairs > 0 ? `Ready now · ${openChairs} of ${workingChairs} chairs free` : 'Usually the fastest way to be seated'}
      </span>
    </span>
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
