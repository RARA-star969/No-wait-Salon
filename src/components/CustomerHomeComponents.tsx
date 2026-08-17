import React from 'react';
import { Mic, Search, Sparkles, UserRound, WalletCards } from 'lucide-react';

export const WalletButton: React.FC<{ balance?: string; onClick?: () => void }> = ({ balance = '₹0', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Wallet balance ${balance}`}
    className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE5E3] bg-white px-3 text-[#29413E] transition hover:border-[#9CCBC6] active:scale-[0.98]"
  >
    <WalletCards className="h-4 w-4 text-[#0F766E]" />
    <span className="text-xs font-bold">{balance}</span>
  </button>
);

export const ProfileButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Open customer profile"
    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE5E3] bg-white text-[#0F766E] transition hover:border-[#9CCBC6] active:scale-[0.98]"
  >
    <UserRound className="h-[18px] w-[18px]" />
  </button>
);

type SearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export const SalonSearchBar: React.FC<SearchProps> = ({ value, onChange }) => (
  <label className="flex min-h-13 w-full items-center gap-3 rounded-2xl border border-[#D8E3E1] bg-white px-4 transition focus-within:border-[#62AAA3] focus-within:ring-2 focus-within:ring-[#DDF0ED]">
    <Search className="h-5 w-5 shrink-0 text-[#0F766E]" />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      type="search"
      enterKeyHint="search"
      aria-label="Search nearby salons"
      placeholder={'Search "Nearby Salon"'}
      className="h-13 min-w-0 flex-1 bg-transparent text-sm font-medium text-[#25302F] outline-none placeholder:font-normal placeholder:text-[#8B9795]"
    />
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F6F5] text-[#82918F]">
      <Mic className="h-4 w-4" />
    </span>
  </label>
);

export const PromotionalBanner: React.FC<{ imageSrc?: string }> = ({ imageSrc }) => (
  <section className="relative aspect-[2.35/1] min-h-[132px] max-h-[190px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#DFF1EE] via-[#EFF8F6] to-[#F7F2E9]">
    {imageSrc ? (
      <img src={imageSrc} alt="Featured salon offer" className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="max-w-[70%]">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#0F766E]">
            <Sparkles className="h-3 w-3" /> Featured
          </span>
          <h2 className="mt-3 text-lg font-bold leading-tight tracking-[-0.025em] text-[#173D39] sm:text-xl">
            Better grooming, less waiting.
          </h2>
          <p className="mt-1 text-[11px] leading-4 text-[#607572]">Discover trusted salons and reserve your place before you leave.</p>
        </div>
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[10px] border-white/40 bg-[#B9DCD7] text-2xl font-bold text-[#0F766E] sm:h-24 sm:w-24">
          ✂
        </div>
      </div>
    )}
  </section>
);
