import React, { useState } from 'react';
import { Tag, X } from 'lucide-react';
import type { ServiceItem } from '../types';
import { formatDurationLabel } from '../shared/durationFormat';

/**
 * The one financial-summary sheet design shared by "tap the price" on the
 * salon page/action dock (Price Breakdown) and "View services" inside the
 * Join Queue sheet (View Services). Same row alignment, same divider, same
 * Subtotal/Total footer — so the two never drift into separate designs.
 *
 * Deliberately has no discount/coupon logic wired up yet: `showCoupon` opts
 * a call site into an honest coupon-code input that never fabricates a
 * discount — applying always reports that coupons aren't live yet, so the
 * footer structure (Subtotal → Discount → Total) is ready for a real one
 * without inventing production pricing behaviour today.
 */
type Props = {
  open: boolean;
  title: string;
  eyebrow: string;
  services: ServiceItem[];
  showDuration?: boolean;
  showCoupon?: boolean;
  onClose: () => void;
};

export const ServicesBillSheet: React.FC<Props> = ({ open, title, eyebrow, services, showDuration = true, showCoupon = false, onClose }) => {
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  if (!open) return null;
  const subtotal = services.reduce((sum, item) => sum + (Number(item.priceInr) || 0), 0);
  // No fees/discounts wired up yet, so total mirrors subtotal — the two rows
  // stay separate so a future discount line only has to change the total.
  const total = subtotal;

  const applyCoupon = () => {
    if (!couponCode.trim()) return;
    setCouponMessage("Coupons aren't live yet — your total is unchanged.");
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
          <div className="rounded-2xl border border-[#E1E7E6] bg-white p-4">
            <div className="space-y-3">
              {services.map((service) => (
                <div key={service.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#17201F]">{service.name}</p>
                    {showDuration && (
                      <p className="mt-0.5 text-[11px] text-[#788582]">{formatDurationLabel(service.durationMin)}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[#17201F]">₹{service.priceInr}</span>
                </div>
              ))}
              {services.length === 0 && (
                <p className="py-2 text-center text-xs text-[#788582]">No services selected.</p>
              )}
            </div>

            <div className="my-4 h-px bg-[#E7ECEB]" />

            {showCoupon && (
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#DDE7E5] bg-[#F8FAFA] px-3">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-[#0F766E]" />
                    <input
                      value={couponCode}
                      onChange={(event) => { setCouponCode(event.target.value); setCouponMessage(''); }}
                      placeholder="Coupon code"
                      className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#17201F] outline-none placeholder:text-[#9AA6A3]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyCoupon}
                    className="h-11 shrink-0 rounded-xl bg-[#0F766E] px-4 text-xs font-bold text-white transition active:scale-[0.98]"
                  >
                    Apply
                  </button>
                </div>
                {couponMessage && <p className="mt-2 text-[11px] font-medium text-[#8A6516]" role="status">{couponMessage}</p>}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#5C6B68]">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-base font-bold text-[#17201F]">
                <span>Total</span>
                <span>₹{total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
