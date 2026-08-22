import React, { useMemo } from 'react';
import { Check, Clock, Tag, X } from 'lucide-react';
import type { SalonOffer, ServiceItem } from '../types';
import { evaluateCoupon, offerDiscountLabel } from '../shared/couponPricing';

/**
 * The one price-breakdown surface, opened from both Salon Detail's dock
 * summary and the Join Queue sheet's "View services" — same services list,
 * same offers list, same applied-offer state (owned by App.tsx), so the
 * subtotal/discount/final total can never read differently between them.
 */
export type PriceBreakdownSheetProps = {
  services: ServiceItem[];
  offers: SalonOffer[];
  appliedOfferId: string | null;
  onApplyOffer: (offerId: string) => void;
  onRemoveOffer: () => void;
  onClose: () => void;
};

export const PriceBreakdownSheet: React.FC<PriceBreakdownSheetProps> = ({ services, offers, appliedOfferId, onApplyOffer, onRemoveOffer, onClose }) => {
  const serviceIds = useMemo(() => services.map((service) => service.id), [services]);
  const subtotalInr = useMemo(() => services.reduce((sum, service) => sum + (Number(service.priceInr) || 0), 0), [services]);
  const totalDurationMin = useMemo(() => services.reduce((sum, service) => sum + (Number(service.durationMin) || 0), 0), [services]);

  // Redundant-safe: every real offer, evaluated fresh against the current
  // selection so an offer that was eligible a moment ago (before a service
  // was removed) drops out on its own instead of lingering as "applied".
  const evaluated = useMemo(
    () => offers
      .filter((offer) => offer.discountType && offer.discountValue)
      .map((offer) => ({ offer, result: evaluateCoupon(offer, { subtotalInr, serviceIds }) })),
    [offers, subtotalInr, serviceIds],
  );
  const appliedEntry = evaluated.find((entry) => entry.offer.id === appliedOfferId && entry.result.eligible);
  const discountInr = appliedEntry && appliedEntry.result.eligible ? appliedEntry.result.discountInr : 0;
  const finalTotalInr = Math.max(0, subtotalInr - discountInr);

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/55 sm:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Price breakdown"
        id="price-breakdown-sheet"
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-[#F8FAFA] pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl sm:pb-4"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0F766E]">Price breakdown</p>
            <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#17201F]">
              {services.length} {services.length === 1 ? 'service' : 'services'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#42524F] ring-1 ring-[#E2EAE9]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5">
          <section className="rounded-2xl border border-[#E1E7E6] bg-white p-4">
            <div className="space-y-2">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[13px] font-semibold text-[#17201F]">{service.name}</span>
                  <span className="shrink-0 text-[13px] font-bold text-[#4C5A58]">₹{service.priceInr}</span>
                </div>
              ))}
              {services.length === 0 && <p className="text-[12px] text-[#788582]">No services selected yet.</p>}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#EEF3F2] pt-3">
              <span className="text-[12px] font-semibold text-[#4C5A58]">Subtotal</span>
              <span className="text-[13px] font-bold text-[#17201F]">₹{subtotalInr}</span>
            </div>
            {discountInr > 0 && appliedEntry && (
              <div id="price-breakdown-discount-row" className="mt-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0F766E]">
                  <Tag className="h-3 w-3" /> {appliedEntry.offer.title}
                </span>
                <span className="text-[13px] font-bold text-[#0F766E]">−₹{discountInr}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-[#EEF3F2] pt-2.5">
              <span className="text-[13px] font-bold text-[#17201F]">Final total</span>
              <span id="price-breakdown-final-total" className="text-[20px] font-bold leading-none tracking-[-0.02em] text-[#17201F]">₹{finalTotalInr}</span>
            </div>
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
          </section>

          {evaluated.length > 0 && (
            <section className="mt-4">
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-[#0F766E]" />
                <h3 className="text-sm font-bold tracking-[-0.02em] text-[#17201F]">Offers for you</h3>
              </div>
              <div className="mt-3 space-y-2.5">
                {evaluated.map(({ offer, result }) => {
                  const applied = offer.id === appliedOfferId && result.eligible;
                  return (
                    <div
                      key={offer.id}
                      id={`offer-${offer.id}`}
                      className={`rounded-2xl border p-3.5 transition ${
                        applied ? 'border-[#0F766E] bg-[#F1FAF9]' : result.eligible ? 'border-[#E2EAE9] bg-white' : 'border-[#E2EAE9] bg-white opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#17201F]">{offer.title}</p>
                          <p className="mt-0.5 text-[11px] font-bold text-[#0F766E]">{offerDiscountLabel(offer)}{offer.code ? ` · ${offer.code}` : ''}</p>
                          {!result.eligible && <p className="mt-1 text-[10px] leading-4 text-[#A3564C]">{result.reason}</p>}
                        </div>
                        {applied ? (
                          <button
                            type="button"
                            onClick={onRemoveOffer}
                            className="flex shrink-0 items-center gap-1 rounded-full bg-[#0F766E] px-2.5 py-1 text-[10px] font-bold text-white"
                          >
                            <Check className="h-3 w-3" /> Applied
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!result.eligible}
                            onClick={() => onApplyOffer(offer.id)}
                            className="shrink-0 rounded-full border border-[#0F766E]/30 px-2.5 py-1 text-[10px] font-bold text-[#0F766E] disabled:opacity-50"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="px-5 pt-4">
          <button type="button" onClick={onClose} className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#DDE7E5] bg-white text-[13px] font-bold text-[#17201F]">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
