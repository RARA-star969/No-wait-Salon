import React from 'react';
import { ArrowLeft, Bookmark, MapPin, Share2 } from 'lucide-react';
import { AnimatedSalonName } from './AnimatedSalonName';

export type BusinessHeroAction = {
  id: string;
  label: string;
  icon: React.ReactElement;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  primary?: boolean;
  variant?: 'standard' | 'primary' | 'gold';
};

type Props = {
  businessId: string;
  businessType: 'salon' | 'gym';
  name: string;
  category: string;
  subcategory?: string;
  address: string;
  distanceKm: number;
  isOpen: boolean;
  saved: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
  onShare: () => void;
  onAddress: () => void;
  logo: React.ReactNode;
  cover: React.ReactNode;
  rating: React.ReactNode;
  actions: BusinessHeroAction[];
};

const HeroControl: React.FC<{
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, active = false, children }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_24px_-12px_rgba(5,15,45,0.9)] backdrop-blur-xl transition active:scale-95 ${
      active
        ? 'border-white/80 bg-white text-[var(--noq-accent)]'
        : 'border-white/35 bg-[#17213D]/45 text-white'
    }`}
  >
    {children}
  </button>
);

const ActionTile: React.FC<{ action: BusinessHeroAction }> = ({ action }) => {
  const isGold = action.variant === 'gold';

  const tileClass = `group relative flex flex-col items-center justify-center rounded-[20px] py-3.5 px-1.5 text-center transition-all duration-200 active:scale-[0.96] min-h-[78px] w-full ${
    isGold
      ? 'border border-[#FDE68A] bg-gradient-to-b from-[#FFFDF7] to-[#FFF9EE] text-[#D97706] shadow-[0_2px_12px_-2px_rgba(245,158,11,0.12),0_1px_3px_rgba(245,158,11,0.04)]'
      : 'border border-[#E2E8F0]/80 bg-white/95 backdrop-blur-sm text-slate-800 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] hover:bg-white'
  } ${action.disabled ? 'pointer-events-none opacity-40' : ''}`;

  const content = (
    <>
      <span
        className={`relative flex items-center justify-center transition-transform duration-200 group-active:scale-95 [&>svg]:h-[22px] [&>svg]:w-[22px] [&>svg]:stroke-[2] ${
          isGold
            ? 'text-amber-500'
            : 'text-[#2563eb]'
        }`}
      >
        <span className="relative contents">{action.icon}</span>
      </span>
      <span
        className={`mt-1.5 line-clamp-1 w-full truncate text-[11px] font-semibold tracking-tight text-center leading-tight ${
          isGold ? 'text-[#D97706]' : 'text-slate-800'
        }`}
      >
        {action.label}
      </span>
    </>
  );

  return action.href && !action.disabled ? (
    <a href={action.href} aria-label={action.label} className={tileClass}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={action.onClick} disabled={action.disabled} className={tileClass}>
      {content}
    </button>
  );
};

const BusinessQuickActions: React.FC<{ actions: BusinessHeroAction[] }> = ({ actions }) => (
  <div className="relative px-4 pb-4">
    <div className="grid gap-2.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, actions.length)}, minmax(0, 1fr))` }}>
      {actions.map((action) => (
        <ActionTile key={action.id} action={action} />
      ))}
    </div>
  </div>
);

/** Shared customer-facing identity hero for every business detail page. */
export const BusinessDetailHero: React.FC<Props> = ({
  businessId,
  businessType,
  name,
  category,
  subcategory,
  address,
  distanceKm,
  isOpen,
  saved,
  onBack,
  onToggleSaved,
  onShare,
  onAddress,
  logo,
  cover,
  rating,
  actions,
}) => (
  <section id={`${businessType}-business-hero`} data-business-id={businessId} className="relative bg-[var(--noq-base)] text-[var(--noq-ink)]">
    <div className="relative h-[248px] w-full overflow-hidden bg-[var(--noq-accent-deep)]">
      <div className="absolute inset-0 [&>*]:h-full [&>*]:w-full">{cover}</div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#17213D]/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#17213D]/35 to-transparent" />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <HeroControl label={`Back to nearby ${businessType}s`} onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </HeroControl>
        <div className="flex items-center gap-2">
          <HeroControl label={saved ? `Remove saved ${businessType}` : `Save ${businessType}`} onClick={onToggleSaved} active={saved}>
            <Bookmark className={`h-[18px] w-[18px] ${saved ? 'fill-current' : ''}`} />
          </HeroControl>
          <HeroControl label={`Share ${businessType}`} onClick={onShare}>
            <Share2 className="h-[18px] w-[18px]" />
          </HeroControl>
        </div>
      </div>
    </div>

    {/* Smooth curved white shoulder edges overlapping cover image */}
    <div className="business-detail-surface relative z-10 -mt-6 rounded-t-[32px] bg-[var(--noq-base)] px-5 pb-3 pt-[52px] text-center shadow-[0_-6px_22px_-12px_rgba(13,22,118,0.14)]">
      <div className="absolute -top-[46px] left-1/2 flex h-[92px] w-[92px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-[26px] border-[4px] border-[var(--noq-base)] bg-white text-[var(--noq-accent)] shadow-[0_18px_38px_-18px_var(--noq-glow)]">
        {logo}
      </div>
      <AnimatedSalonName name={name} className="mx-auto max-w-[330px] text-[26px] font-bold leading-[1.08] tracking-[-0.04em] [overflow-wrap:anywhere]" />
      <p className="mt-1.5 text-[11px] font-semibold text-[var(--noq-muted)]">
        {category}{subcategory ? ` · ${subcategory}` : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[var(--noq-muted)]">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-emerald-500 open-dot-bounce' : 'bg-rose-500'}`} />
          {isOpen ? 'Open now' : 'Closed'}
        </span>
        <span className="h-3 w-px bg-[var(--noq-border)]" aria-hidden="true" />
        {rating}
        <span className="text-[var(--noq-border)]" aria-hidden="true">•</span>
        <span>{distanceKm} km away</span>
      </div>
      <button
        type="button"
        id={`${businessType}-address-row`}
        onClick={onAddress}
        aria-label={`View ${businessType} address and contact`}
        className="mx-auto mt-3 flex max-w-sm items-start justify-center gap-1.5 text-center text-[11px] leading-4 text-[var(--noq-muted)] transition active:text-[var(--noq-ink)]"
      >
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--noq-accent)]" />
        <span className="[overflow-wrap:anywhere]">{address}</span>
      </button>
    </div>

    <BusinessQuickActions actions={actions} />
  </section>
);
