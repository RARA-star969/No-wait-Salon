import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronRight, LoaderCircle, Scissors, Sparkles, X } from 'lucide-react';
import type { Barber, CustomerProfile, QueueItem, Salon, ServiceItem } from '../types';
import { buildJoinPreview } from '../shared/joinPreview';
import { formatDurationLabel } from '../shared/durationFormat';
import { CustomerAvatar } from './CustomerAvatar';
import { LiveQueueScoreboard } from './LiveQueueScoreboard';
import { ServicesBillSheet } from './ServicesBillSheet';

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
  onClose,
  onConfirm,
}) => {
  const [stylist, setStylist] = useState<string>(ANY_STYLIST);
  const [viewServicesOpen, setViewServicesOpen] = useState(false);
  const preview = useMemo(() => buildJoinPreview(queue, barbers), [queue, barbers]);
  const totalDurationMin = useMemo(() => services.reduce((sum, item) => sum + (Number(item.durationMin) || 0), 0), [services]);
  const totalPriceInr = useMemo(() => services.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0), [services]);
  const serviceLabel = services.map((item) => item.name).join(' + ') || 'Service';
  const displayName = customerProfile?.name?.trim() || customerName;

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
          {/* Live queue facts — same reusable scoreboard language as the salon
              page's sticky capsule, so the two never visually drift apart. */}
          <LiveQueueScoreboard
            variant="panel"
            metrics={[
              { key: 'ahead', label: 'People ahead', value: preview.peopleAhead },
              { key: 'position', label: 'Your position', value: `#${preview.projectedPosition}` },
              { key: 'wait', label: 'Est. time', value: preview.estimatedWaitMinutes === 0 ? 'Now' : `${preview.estimatedWaitMinutes}m` },
              { key: 'chairs', label: 'Chairs available', value: preview.openChairs },
            ]}
          />

          {/* Session summary — this is the customer's own service duration,
              never to be confused with how long the queue itself will take. */}
          <section className="mt-4 rounded-2xl border border-[#E1E7E6] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#17201F]">{serviceLabel}</p>
                {totalDurationMin > 0 ? (
                  <p className="mt-1 text-[11px] font-semibold text-[#60716E]">
                    Your session · approx. {formatDurationLabel(totalDurationMin)}
                  </p>
                ) : null}
              </div>
              {totalPriceInr > 0 ? <span className="shrink-0 text-base font-bold text-[#17201F]">₹{totalPriceInr}</span> : null}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#EEF2F1] pt-3">
              <span className="text-[11px] font-semibold text-[#788582]">
                {services.length} {services.length === 1 ? 'service' : 'services'} selected
              </span>
              <button
                type="button"
                onClick={() => setViewServicesOpen(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-[#0F766E]"
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

            <div className="mt-3 space-y-2">
              <StylistOption
                id="stylist-any"
                title="Any available stylist"
                subtitle="Usually the fastest way to be seated"
                selected={stylist === ANY_STYLIST}
                onSelect={() => setStylist(ANY_STYLIST)}
              />
              {selectable.map((barber) => (
                <StylistOption
                  key={barber.id}
                  id={`stylist-${barber.id}`}
                  title={barber.name}
                  subtitle={barber.status === 'available' ? 'Free now' : 'With a customer'}
                  selected={stylist === barber.id}
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

      <ServicesBillSheet
        open={viewServicesOpen}
        title="Your services"
        eyebrow={`${services.length} ${services.length === 1 ? 'service' : 'services'} selected`}
        services={services}
        onClose={() => setViewServicesOpen(false)}
      />
    </div>
  );
};

const StylistOption: React.FC<{
  id: string;
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}> = ({ id, title, subtitle, selected, onSelect }) => (
  <button
    id={id}
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
      selected ? 'border-[#0F766E] bg-[#F1FAF9] shadow-[0_4px_14px_-8px_rgba(15,118,110,0.5)]' : 'border-[#E2EAE9] bg-white'
    }`}
  >
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
        selected ? 'bg-[#0F766E] text-white' : 'bg-[#EEF3F2] text-[#5C6B68]'
      }`}
    >
      {selected ? <Check className="h-4 w-4" /> : title.slice(0, 1).toUpperCase()}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-bold text-[#17201F]">{title}</span>
      <span className="mt-0.5 block truncate text-[11px] text-[#788582]">{subtitle}</span>
    </span>
  </button>
);
