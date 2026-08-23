import React, { useState } from 'react';
import { Check, Tag, X } from 'lucide-react';
import type { SalonOffer, ServiceItem } from '../types';
import { formatDurationLabel } from '../shared/durationFormat';
import { resolveCoupon } from '../shared/couponValidation';

/**
 * The one financial-summary sheet design shared by "tap the price" on the
 * salon page/action dock (Price Breakdown) and "View services" inside the
 * Join Queue sheet (View Services). Same row alignment, same divider, same
 * Subtotal → Discount → Total footer — so the two never drift into separate
 * designs, and — because both call sites pass the same `appliedCouponCode`
 * and the same salon `offers`, resolved here through the one shared
 * `resolveCoupon` — never drift into separate numbers either.
 *
 * `showCoupon` opts a call site into the code-entry row (Price Breakdown);
 * View Services only ever displays whatever is already applied.
 */
type Props = {
  open: boolean;
  title: string;
  eyebrow: string;
  services: ServiceItem[];
  showDuration?: boolean;
  showCoupon?: boolean;
  offers?: SalonOffer[];
  appliedCouponCode?: string | null;
  onApplyCoupon?: (code: string) => void;
  onRemoveCoupon?: () => void;
  onClose: () => void;
};

export const ServicesBillSheet: React.FC<Props> = ({
  open,
  title,
  eyebrow,
  services,
  showDuration = true,
  showCoupon = false,
  offers = [],
  appliedCouponCode = null,
  onApplyCoupon,
  onRemoveCoupon,
  onClose,
}) => {
  const [couponInput, setCouponInput] = useState('');
  if (!open) return null;

  const subtotal = services.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0);
  const coupon = resolveCoupon(appliedCouponCode, offers, subtotal);
  const discountInr = coupon.status === 'applied' ? coupon.discountInr : 0;
  const total = Math.max(0, subtotal - discountInr);

  const submitCoupon = () => {
    const code = couponInput.trim();
    if (!code || !onApplyCoupon) return;
    onApplyCoupon(code);
    setCouponInput('');
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/55 sm:items-center" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-[#F8FAFA] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl sm:pb-5"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0F766E]">{eyebrow}</p>
            <h2 className="mt-1 truncate text-lg font-bold tracking-[-0.02em] text-[#17201F]">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#42524F] ring-1 ring-[#E2EAE9]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5">
          <div className="overflow-hidden rounded-2xl border border-[#E3EAE8] bg-white shadow-[0_8px_20px_-16px_rgba(15,40,37,0.3)]">
            <div className="space-y-3 px-4 pb-1 pt-4">
              {services.map((service) => (
                <div key={service.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold text-[#17201F]">{service.name}</p>
                    {showDuration && (
                      <p className="mt-0.5 text-[10px] font-semibold text-[#8A9694]">{formatDurationLabel(service.durationMin)}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-[#17201F]">₹{service.priceInr}</span>
                </div>
              ))}
              {services.length === 0 && (
                <p className="py-2 text-center text-xs text-[#788582]">No services selected.</p>
              )}
            </div>

            {showCoupon && (
              <div className="px-4 pb-1 pt-3">
                {coupon.status === 'applied' || coupon.status === 'below_minimum' ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E1E7E6] bg-[#F8FAFA] px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-[#0F766E]">
                      <Tag className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate uppercase tracking-[0.04em]">{coupon.offer.code}</span>
                      <span className="font-semibold text-[#5C7773]">applied</span>
                    </span>
                    <button type="button" onClick={onRemoveCoupon} className="shrink-0 text-[11px] font-bold text-[#8A9694] underline underline-offset-2">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#DDE7E5] bg-[#F8FAFA] px-3">
                      <Tag className="h-3.5 w-3.5 shrink-0 text-[#0F766E]" />
                      <input
                        value={couponInput}
                        onChange={(event) => setCouponInput(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') submitCoupon(); }}
                        placeholder="Coupon code"
                        className="min-w-0 flex-1 bg-transparent text-xs font-semibold uppercase tracking-[0.04em] text-[#17201F] outline-none placeholder:text-[#9AA6A3] placeholder:normal-case placeholder:tracking-normal"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={submitCoupon}
                      className="h-11 shrink-0 rounded-xl bg-[#0F766E] px-4 text-xs font-bold text-white transition active:scale-[0.98]"
                    >
                      Apply
                    </button>
                  </div>
                )}
                {coupon.status === 'invalid' && (
                  <p role="alert" className="mt-2 text-[11px] font-semibold text-[#B4472F]">That code isn't valid for this salon.</p>
                )}
                {coupon.status === 'below_minimum' && (
                  <p role="alert" className="mt-2 text-[11px] font-semibold text-[#8A6516]">
                    Add ₹{coupon.shortfallInr} more to unlock this offer (minimum bill ₹{coupon.minimumBillInr}).
                  </p>
                )}
                {coupon.status === 'applied' && (
                  <p role="status" className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#0F766E]">
                    <Check className="h-3 w-3" /> {coupon.offer.title} applied — you saved ₹{coupon.discountInr}.
                  </p>
                )}
              </div>
            )}

            <div className="mt-1 space-y-1.5 px-4 pb-4 pt-3">
              <div className="flex items-center justify-between text-[11.5px] font-semibold text-[#788582]">
                <span>Subtotal</span>
                <span className="tabular-nums">₹{subtotal}</span>
              </div>
              {coupon.status === 'applied' && discountInr > 0 && (
                <div className="flex items-center justify-between text-[11.5px] font-semibold text-[#0F766E]">
                  <span className="flex items-center gap-1.5">
                    Discount
                    <span className="rounded-full border border-[#BFE3D5] bg-[#E9F6F2] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.04em] text-[#0F766E]">
                      {coupon.offer.code}
                    </span>
                  </span>
                  <span className="tabular-nums">−₹{discountInr}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between bg-gradient-to-b from-[#0F2C28] to-[#0F766E] px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">Total</span>
              <span className="text-xl font-extrabold tracking-[-0.02em] tabular-nums text-white">₹{total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
