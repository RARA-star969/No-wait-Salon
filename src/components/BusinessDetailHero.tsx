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

const ActionContent: React.FC<{ action: BusinessHeroAction }> = ({ action }) => (
  <>
    <span
      className={`relative flex h-11 w-11 items-center justify-center rounded-[16px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_9px_18px_-12px_var(--noq-glow)] [&>svg]:h-[18px] [&>svg]:w-[18px] ${
        action.primary
          ? 'border-[var(--noq-accent)] bg-[var(--noq-accent)] text-white'
          : 'border-white bg-white/90 text-[var(--noq-accent)]'
      }`}
    >
      {action.primary && <span className="pointer-events-none absolute inset-x-1 top-px h-1/2 rounded-t-[14px] bg-gradient-to-b from-white/25 to-transparent" />}
      <span className="relative contents">{action.icon}</span>
    </span>
    <span className={`mt-2 whitespace-nowrap text-[10px] font-bold leading-none ${action.primary ? 'text-[var(--noq-accent)]' : 'text-[var(--noq-ink)]'}`}>
      {action.label}
    </span>
  </>
);

const BusinessQuickActions: React.FC<{ actions: BusinessHeroAction[] }> = ({ actions }) => (
  <div className="relative -mt-0.5 px-4 pb-4">
    <div className="noq-glass-surface flex min-w-0 items-start justify-between gap-1 overflow-x-auto rounded-[24px] border px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_40px_-28px_var(--noq-glow)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {actions.map((action) => {
        const className = `flex min-w-[60px] flex-1 flex-col items-center px-1 py-0.5 text-center transition active:scale-[0.96] ${action.disabled ? 'pointer-events-none opacity-40' : ''}`;
        return action.href && !action.disabled ? (
          <a key={action.id} href={action.href} aria-label={action.label} className={className}>
            <ActionContent action={action} />
          </a>
        ) : (
          <button key={action.id} type="button" onClick={action.onClick} disabled={action.disabled} className={className}>
            <ActionContent action={action} />
          </button>
        );
      })}
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

    <div className="relative px-5 pb-4 pt-[54px] text-center">
      <div className="absolute left-1/2 top-0 flex h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-[26px] border-[4px] border-[var(--noq-base)] bg-white text-[var(--noq-accent)] shadow-[0_18px_38px_-18px_var(--noq-glow)]">
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
