import React, { useState } from 'react';
import { BadgePercent, Receipt } from 'lucide-react';
import type { SalonProfileService } from '../shared/salonProfile';
import { BottomSheet } from './BottomSheet';

type Props = {
  open: boolean;
  services: SalonProfileService[];
  onClose: () => void;
};

/**
 * Ecommerce-style price breakdown, opened by tapping the total in the sticky
 * dock. Coupon apply is an honest placeholder: nothing is validated against a
 * backend yet, so it only ever reports "not available right now".
 */
export const PriceBreakdownSheet: React.FC<Props> = ({ open, services, onClose }) => {
  const [coupon, setCoupon] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const subtotal = services.reduce((sum, service) => sum + (Number(service.priceInr) || 0), 0);

  const applyCoupon = () => {
    if (!coupon.trim()) return;
    setCouponMessage('Coupons are not live yet — this total is unchanged.');
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setCoupon('');
        setCouponMessage('');
        onClose();
      }}
      label="Price breakdown"
      eyebrow={`${services.length} ${services.length === 1 ? 'service' : 'services'} selected`}
      title="Price breakdown"
      icon={<Receipt className="h-4.5 w-4.5" />}
      id="price-breakdown-sheet"
    >
      <div className="space-y-2">
        {services.map((service) => (
          <div key={service.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E1E7E6] bg-white px-4 py-3">
            <span className="min-w-0 truncate text-sm font-semibold text-[#17201F]">{service.name}</span>
            <span className="shrink-0 text-sm font-bold text-[#17201F]">₹{service.priceInr}</span>
          </div>
        ))}
        {services.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#D7E2E0] bg-white p-4 text-center text-xs text-[#788582]">
            No services selected yet.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
        <span className="font-semibold text-[#5A6866]">Subtotal</span>
        <span className="font-bold text-[#17201F]">₹{subtotal}</span>
      </div>

      <div className="mt-3 rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#5A6866]">
          <BadgePercent className="h-3.5 w-3.5 text-[#0F766E]" /> Coupon code
        </p>
        <div className="mt-2.5 flex gap-2">
          <input
            value={coupon}
            onChange={(event) => {
              setCoupon(event.target.value.toUpperCase());
              setCouponMessage('');
            }}
            placeholder="Enter code"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#D7E2E0] bg-[#F8FAFA] px-3.5 text-sm font-semibold uppercase tracking-wider outline-none focus:border-[#62AAA3]"
          />
          <button
            type="button"
            onClick={applyCoupon}
            disabled={!coupon.trim()}
            className="h-11 shrink-0 rounded-xl bg-[#0F766E] px-4 text-xs font-bold text-white disabled:opacity-40"
          >
            Apply
          </button>
        </div>
        {couponMessage && <p className="mt-2 text-[11px] text-[#8A6516]">{couponMessage}</p>}
      </div>

      <div className="mt-4 mb-1 flex items-center justify-between rounded-2xl bg-[#0F766E] px-4 py-3.5 text-white">
        <span className="text-sm font-bold">Total</span>
        <span className="text-lg font-extrabold tracking-[-0.02em]">₹{subtotal}</span>
      </div>
    </BottomSheet>
  );
};
