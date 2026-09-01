import React from 'react';
import { Search, Sparkles, UserRound, WalletCards, Scissors, Dumbbell, ShoppingBag, Car, Dog, Building2, Utensils, Store, X, Volume2, Star, ChevronRight, Clock, SquarePlus, Grid2X2, UsersRound, CalendarDays } from 'lucide-react';
import type { NearbySalon } from '../types';
import type { SignalColor } from '../shared/signalColor';

export const WalletButton: React.FC<{ balance?: string; onClick?: () => void }> = ({ balance = '₹0', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Wallet balance ${balance}`}
    className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-slate-100 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.1] active:scale-[0.98]"
  >
    <WalletCards className="h-4 w-4" style={{ color: 'var(--category-accent, #22D3EE)' }} />
    <span className="text-xs font-bold">{balance}</span>
  </button>
);

export const ProfileButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Open customer profile"
    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.1] active:scale-[0.98]"
    style={{ color: 'var(--category-accent, #22D3EE)' }}
  >
    <UserRound className="h-[18px] w-[18px]" />
  </button>
);

export type CategoryTheme = {
  key: string;
  primary: string;
  accent: string;
  gradientFrom: string;
  gradientTo: string;
  badgeBg: string;
  badgeText: string;
  joinedBg: string;
  bannerGradient: string;
  /** Neon drop-shadow glow used behind focused cards / the hero / the QR dock. */
  glow: string;
  /** Ring color used around the active/focused card. */
  ring: string;
  /** Solid neon chip background used for live-count badges. */
  chip: string;
  /** Dark glossy card gradient (top-left to bottom-right) for the focused
   *  category card and the hero card. */
  cardBg: string;
  /** Muted supporting-text tint that stays legible on the dark card. */
  softText: string;
  // --- Added for the shared-architecture pass: premium glass surfaces
  // (Payment/success sheets, member cards, selected-state cards) all read
  // these instead of a component keeping its own copy of "what Gym purple
  // looks like." Every category gets real values (never just Salon/Gym) so
  // this stays one map, not a second one that only covers some categories.
  /** Deep, near-opaque surface for full-screen dark panels/quick-action
   *  tiles (raw hex, not a Tailwind class — consumed via inline style). */
  darkSurface: string;
  /** Translucent glass fill for premium blurred-mirror sheets. */
  glassSurface: string;
  /** Translucent rim/border highlight for the same glass sheets. */
  glassBorder: string;
  /** CTA/button gradient (raw `linear-gradient(...)` string). */
  ctaGradient: string;
  /** Glow color behind a selected/active card or confirmed state. */
  selectedGlow: string;
  /** Tint wash for modal/success-sheet accents. */
  modalTint: string;
  /** Light, low-saturation accent for subtle highlights on a dark surface. */
  subtleAccent: string;
};

/** Fields every category authors by hand; the glass/CTA/glow tokens on
 *  CategoryTheme are filled in below by `deriveTokensInPlace()` instead. */
type CategoryThemeBase = Omit<
  CategoryTheme,
  'darkSurface' | 'glassSurface' | 'glassBorder' | 'ctaGradient' | 'selectedGlow' | 'modalTint' | 'subtleAccent'
>;

export const CATEGORY_THEME_MAP = {
  salon: {
    key: 'salon',
    primary: '#22D3EE',
    accent: '#2DD4BF',
    gradientFrom: 'from-cyan-400',
    gradientTo: 'to-teal-600',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-200',
    joinedBg: 'bg-[#050B0C]',
    bannerGradient: 'from-cyan-500/18 via-teal-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(34,211,238,0.45)]',
    ring: 'ring-cyan-400/50',
    chip: 'bg-cyan-400 text-slate-950',
    cardBg: 'from-[#0B3033] to-[#061B1D]',
    softText: 'text-cyan-100/70',
  },
  gym: {
    key: 'gym',
    primary: '#A855F7',
    accent: '#C084FC',
    gradientFrom: 'from-fuchsia-500',
    gradientTo: 'to-purple-700',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-200',
    joinedBg: 'bg-[#0A0713]',
    bannerGradient: 'from-purple-500/18 via-fuchsia-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(168,85,247,0.45)]',
    ring: 'ring-purple-400/50',
    chip: 'bg-purple-400 text-slate-950',
    cardBg: 'from-[#251035] to-[#150A20]',
    softText: 'text-purple-100/70',
  },
  shop: {
    key: 'shop',
    primary: '#F59E0B',
    accent: '#FBBF24',
    gradientFrom: 'from-amber-400',
    gradientTo: 'to-orange-600',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-200',
    joinedBg: 'bg-[#0C0904]',
    bannerGradient: 'from-amber-500/18 via-orange-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(245,158,11,0.42)]',
    ring: 'ring-amber-400/50',
    chip: 'bg-amber-400 text-slate-950',
    cardBg: 'from-[#332008] to-[#1C1204]',
    softText: 'text-amber-100/70',
  },
  moto: {
    key: 'moto',
    primary: '#3B82F6',
    accent: '#60A5FA',
    gradientFrom: 'from-sky-400',
    gradientTo: 'to-blue-700',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-200',
    joinedBg: 'bg-[#050813]',
    bannerGradient: 'from-blue-500/18 via-sky-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(59,130,246,0.42)]',
    ring: 'ring-blue-400/50',
    chip: 'bg-blue-400 text-slate-950',
    cardBg: 'from-[#0C2038] to-[#071120]',
    softText: 'text-blue-100/70',
  },
  pets: {
    key: 'pets',
    primary: '#EC4899',
    accent: '#F472B6',
    gradientFrom: 'from-pink-400',
    gradientTo: 'to-rose-600',
    badgeBg: 'bg-pink-500/15',
    badgeText: 'text-pink-200',
    joinedBg: 'bg-[#0C0409]',
    bannerGradient: 'from-pink-500/18 via-rose-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(236,72,153,0.42)]',
    ring: 'ring-pink-400/50',
    chip: 'bg-pink-400 text-slate-950',
    cardBg: 'from-[#341123] to-[#1D0A13]',
    softText: 'text-pink-100/70',
  },
  mall: {
    key: 'mall',
    primary: '#6366F1',
    accent: '#818CF8',
    gradientFrom: 'from-indigo-400',
    gradientTo: 'to-indigo-700',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-200',
    joinedBg: 'bg-[#07071A]',
    bannerGradient: 'from-indigo-500/18 via-violet-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(99,102,241,0.42)]',
    ring: 'ring-indigo-400/50',
    chip: 'bg-indigo-400 text-slate-950',
    cardBg: 'from-[#181246] to-[#0D0A28]',
    softText: 'text-indigo-100/70',
  },
  food: {
    key: 'food',
    primary: '#F43F5E',
    accent: '#FB7185',
    gradientFrom: 'from-rose-400',
    gradientTo: 'to-red-700',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-200',
    joinedBg: 'bg-[#0C0507]',
    bannerGradient: 'from-rose-500/18 via-red-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(244,63,94,0.42)]',
    ring: 'ring-rose-400/50',
    chip: 'bg-rose-400 text-slate-950',
    cardBg: 'from-[#360F17] to-[#1E0A0F]',
    softText: 'text-rose-100/70',
  },
} satisfies Record<string, CategoryThemeBase> as unknown as Record<string, CategoryTheme>;
// The cast above is safe only because the derivation loop immediately below
// fills in every field CategoryTheme adds beyond CategoryThemeBase,
// synchronously, before any importer can observe the map.

/**
 * Semantic CSS custom properties that carry the active category's identity
 * onto the customer app root. Every category-sensitive surface (scanner,
 * wallet, profile, chips, listings, detail pages…) reads these instead of a
 * hardcoded Tailwind color, so switching category re-themes the whole app
 * from a single write site. `--category-*-tint` are pre-mixed translucent
 * variants for borders/backgrounds where a flat alpha hex is enough;
 * anything needing a live alpha blend can use `color-mix(in srgb, var(--category-primary) X%, transparent)`.
 */
function shadeHex(hex: string, percent: number): string {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!match) return hex;
  const num = parseInt(match[1], 16);
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const r = clamp(((num >> 16) & 0xff) + Math.round(255 * percent));
  const g = clamp(((num >> 8) & 0xff) + Math.round(255 * percent));
  const b = clamp((num & 0xff) + Math.round(255 * percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Fills the glass/CTA/glow tokens for every category from its own
// primary/accent — one formula, run for all 7, so none of them is a
// second hand-authored palette. Gym's real values (below) then override
// the formula with the exact, already-shipped hex constants pulled out of
// GymFloatingCapsule/GymLiveCard/GymDetailPage's quick-action tile, so
// consolidating the source changes nothing about how Gym already looks.
for (const theme of Object.values(CATEGORY_THEME_MAP)) {
  theme.darkSurface = shadeHex(theme.primary, -0.55);
  theme.glassSurface = `${theme.primary}14`;
  theme.glassBorder = `${theme.accent}29`;
  theme.ctaGradient = `linear-gradient(160deg, ${shadeHex(theme.primary, -0.15)} 0%, ${shadeHex(theme.primary, -0.7)} 75%)`;
  theme.selectedGlow = theme.primary;
  theme.modalTint = `linear-gradient(180deg, ${theme.primary}1F 0%, ${shadeHex(theme.primary, -0.55)}F2 60%)`;
  theme.subtleAccent = shadeHex(theme.accent, 0.35);
}
Object.assign(CATEGORY_THEME_MAP.gym, {
  darkSurface: '#241539',
  glassSurface: 'rgba(46,27,74,0.88)',
  glassBorder: 'rgba(192,132,252,0.16)',
  ctaGradient: 'linear-gradient(160deg, #5B21B6 0%, #2E1065 75%)',
  selectedGlow: '#8B5CF6',
  modalTint: 'linear-gradient(160deg,#180F28 0%,#241539 55%,#2E1B4A 100%)',
  subtleAccent: '#E9D5FF',
} satisfies Partial<CategoryTheme>);

export function categoryCssVars(theme: CategoryTheme): Record<string, string> {
  const surfaceMatch = theme.joinedBg.match(/#[0-9A-Fa-f]{3,8}/);
  return {
    '--category-primary': theme.primary,
    '--category-accent': theme.accent,
    // Glow/tint alphas are tuned ~30% down from their original values —
    // enough to pull the UI back from a neon/gaming feel toward polished
    // glass, without losing the category-colored halo entirely.
    '--category-glow': `${theme.primary}47`,
    '--category-border': `${theme.primary}40`,
    '--category-soft': `${theme.accent}B3`,
    '--category-surface': surfaceMatch ? surfaceMatch[0] : '#050B0C',
    '--category-tint-10': `${theme.primary}1A`,
    '--category-tint-20': `${theme.primary}24`,
    '--category-primary-dark': shadeHex(theme.primary, -0.35),
    '--category-primary-light': shadeHex(theme.primary, 0.3),
    '--category-dark-surface': theme.darkSurface,
    '--category-glass-surface': theme.glassSurface,
    '--category-glass-border': theme.glassBorder,
    '--category-cta-gradient': theme.ctaGradient,
    '--category-selected-glow': theme.selectedGlow,
    '--category-modal-tint': theme.modalTint,
    '--category-subtle-accent': theme.subtleAccent,
  };
}

export function resolveCategoryTheme(themeKeyOrId?: string | null): CategoryTheme {
  if (!themeKeyOrId) return CATEGORY_THEME_MAP.salon;
  return CATEGORY_THEME_MAP[themeKeyOrId.toLowerCase()] || CATEGORY_THEME_MAP.salon;
}

/** Approved Customer Home accents. These are deliberately separate from the
 * legacy/detail theme tokens: the NOQ shell stays brand blue while only Home's
 * selected tile, featured hero and category-owned listing accents use these. */
export const CUSTOMER_HOME_ACCENTS: Record<string, string> = {
  salon: '#FF5CC8',
  gym: '#23E08D',
  shop: '#FFD166',
  clinic: '#4DB7FF',
  spa: '#C77DFF',
};

export function customerHomeAccent(category?: Pick<CategoryItemConfig, 'id' | 'themeKey' | 'primaryColor'> | null): string {
  const key = (category?.themeKey || category?.id || '').toLowerCase();
  return CUSTOMER_HOME_ACCENTS[key] || category?.primaryColor || '#2A7BFF';
}

type SearchProps = {
  value: string;
  onChange: (value: string) => void;
  categories?: CategoryItemConfig[];
  activeCategoryName?: string;
  isListening?: boolean;
  onVoiceSearch?: () => void;
  voiceFeedback?: string | null;
};

export const SalonSearchBar: React.FC<SearchProps> = ({
  value,
  onChange,
  categories = [],
  activeCategoryName = 'Salon',
  isListening = false,
  onVoiceSearch,
  voiceFeedback,
}) => {
  void categories;
  void activeCategoryName;
  const placeholderText = 'Search salons, gyms, shops...';

  return (
    <div className="relative w-full space-y-2">
      <div
        className={`customer-search-glass flex h-[52px] w-full items-center gap-3 rounded-[17px] border px-4 backdrop-blur-xl transition-all duration-200 ${
          isListening
            ? 'border-red-400/60 ring-2 ring-red-400/20 shadow-[0_0_24px_-6px_rgba(248,113,113,0.5)]'
            : 'border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus-within:ring-2'
        }`}
        style={isListening ? undefined : ({ '--tw-ring-color': 'var(--category-tint-20, rgba(34,211,238,0.15))' } as React.CSSProperties)}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--category-border, rgba(34,211,238,0.5))'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-[#77A9F8]" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type="search"
          enterKeyHint="search"
          aria-label="Search businesses"
          placeholder={placeholderText}
          className="h-[52px] min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-slate-100 outline-none placeholder:font-medium placeholder:text-slate-500"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {voiceFeedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl p-3 text-xs font-bold backdrop-blur-md transition-all animate-in fade-in duration-200 border ${
            isListening
              ? 'bg-red-500/10 text-red-200 border-red-400/30'
              : voiceFeedback.includes('Heard')
                ? ''
                : 'bg-amber-500/10 text-amber-200 border-amber-400/30'
          }`}
          style={!isListening && voiceFeedback.includes('Heard') ? {
            backgroundColor: 'var(--category-tint-10, rgba(34,211,238,0.1))',
            color: 'var(--category-accent, #67E8F9)',
            borderColor: 'var(--category-tint-20, rgba(34,211,238,0.3))',
          } : undefined}
        >
          <div className="flex items-center gap-2">
            {isListening ? (
              <span className="flex h-2 w-2 rounded-full bg-red-400 animate-pulse" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0" style={{ color: 'var(--category-accent, #22D3EE)' }} />
            )}
            <span>{voiceFeedback}</span>
          </div>
          {!isListening && (
            <button type="button" onClick={() => onChange('')} className="text-[10px] underline uppercase tracking-wider">
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const HERO_COPY: Record<string, { headline: string; subheadline: string }> = {
  salon: { headline: 'Better grooming, less waiting.', subheadline: 'Discover trusted salons and reserve your chair before leaving home.' },
  gym: { headline: 'Train smarter, wait less.', subheadline: 'Book your slot, skip the crowd, and get straight into your session.' },
  shop: { headline: 'Find local products faster.', subheadline: 'Browse nearby shops with live stock and skip the checkout line.' },
  moto: { headline: 'Quick service, less delay.', subheadline: 'Get your ride serviced by trusted garages with live wait times.' },
  pets: { headline: 'Care faster, stress less.', subheadline: 'Reserve a grooming or vet slot so your pet spends less time waiting.' },
};

/**
 * Premium featured/hero card — glossy, category-themed, adapts headline and
 * color identity to whichever category is currently selected.
 */
export const PromotionalBanner: React.FC<{
  category?: CategoryItemConfig;
  featuredBusiness?: NearbySalon | null;
  operationalLabel?: string | null;
  onCtaClick?: () => void;
}> = ({ category, featuredBusiness, operationalLabel, onCtaClick }) => {
  const themeKey = category?.themeKey || category?.id || 'salon';
  const accent = customerHomeAccent(category);
  const copy = HERO_COPY[themeKey] || HERO_COPY.salon;
  const headline = featuredBusiness?.name || category?.bannerHeadline || copy.headline;
  const subheadline = featuredBusiness?.shortDescription || featuredBusiness?.description || category?.bannerSubheadline || copy.subheadline;
  return (
    <section
      className="customer-featured-hero relative h-[154px] overflow-hidden rounded-[23px] border px-[18px] py-4 transition-[transform,box-shadow] duration-300 active:scale-[0.992]"
      style={{ '--home-accent': accent } as React.CSSProperties}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.055] via-transparent to-black/30" />
      <div className="customer-hero-arcs pointer-events-none absolute inset-y-0 right-0 w-[46%]" aria-hidden="true">
        <span className="absolute -right-[72px] -top-[42px] h-[236px] w-[236px] rounded-full border" />
        <span className="absolute -right-[31px] -top-[9px] h-[170px] w-[170px] rounded-full border" />
        <span className="absolute right-[6px] top-[25px] h-[104px] w-[104px] rounded-full border" />
      </div>
      {featuredBusiness?.isOpen && (
        <span className="absolute right-3.5 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-[#FF3B30]/55 bg-[#FF3B30]/20 px-2 py-[3px] text-[8px] font-black uppercase tracking-[0.12em] text-[#FF6B63] shadow-[0_0_12px_rgba(255,59,48,.25)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B30]" /> Live now
        </span>
      )}
      <div className="relative z-10 flex h-full min-w-0 max-w-[73%] flex-col">
        <span className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: accent }}>Featured {category?.name || 'business'}</span>
        <h2 className="mt-2 truncate text-[18px] font-black leading-tight tracking-[-0.03em] text-[#E6E8F0]">{headline}</h2>
        <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-[14px] text-slate-300/70">{subheadline}</p>
        {operationalLabel && <span className="mt-auto min-w-0 truncate pr-3 text-[10px] font-bold text-slate-200">{operationalLabel}</span>}
      </div>
      <button type="button" onClick={onCtaClick} className="absolute bottom-3.5 right-3.5 z-20 inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-2 text-[10px] font-black text-[#07101D] shadow-lg transition active:translate-y-0.5 active:scale-[0.97]" style={{ backgroundColor: accent, boxShadow: `0 10px 24px -10px ${accent}` }}>
        Explore <ChevronRight className="h-3 w-3" />
      </button>
    </section>
  );
};

export type CategoryItemConfig = {
  id: string;
  name: string;
  iconName: string;
  label: string;
  description?: string;
  active?: boolean;
  businessCount?: number;
  themeKey?: string;
  primaryColor?: string;
  accentColor?: string;
  bannerImageUrl?: string;
  bannerHeadline?: string;
  bannerSubheadline?: string;
  bannerCtaText?: string;
  /** Short one-line tagline shown on the focused floating category card. */
  tagline?: string;
};

const categoryIconMap: Record<string, React.FC<{ className?: string }>> = {
  Scissors: (props) => <Scissors {...props} />,
  Dumbbell: (props) => <Dumbbell {...props} />,
  ShoppingBag: (props) => <ShoppingBag {...props} />,
  Car: (props) => <Car {...props} />,
  Dog: (props) => <Dog {...props} />,
  Building2: (props) => <Building2 {...props} />,
  Utensils: (props) => <Utensils {...props} />,
  Store: (props) => <Store {...props} />,
  Sparkles: (props) => <Sparkles {...props} />,
  Stethoscope: (props) => <SquarePlus {...props} />,
  SquarePlus: (props) => <SquarePlus {...props} />,
  Grid2X2: (props) => <Grid2X2 {...props} />,
};

export function getCategoryIcon(iconName: string): React.FC<{ className?: string }> {
  return categoryIconMap[iconName] || categoryIconMap.Scissors;
}

export const CustomerCategoryGrid: React.FC<{
  categories: CategoryItemConfig[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
  onMore: () => void;
}> = ({ categories, selectedCategoryId, onSelect, onMore }) => {
  const preferred = ['salon', 'gym', 'shop', 'clinic', 'spa'];
  const ordered = [
    ...preferred.map((id) => categories.find((category) => category.id.toLowerCase() === id)).filter(Boolean),
    ...categories.filter((category) => !preferred.includes(category.id.toLowerCase())),
  ] as CategoryItemConfig[];
  const visible = ordered.slice(0, 5);
  const hasMore = categories.some((category) => !visible.some((item) => item.id === category.id));

  return (
    <section aria-label="Business categories" className="grid grid-cols-3 gap-2.5">
      {visible.map((category) => {
        const active = category.id.toLowerCase() === selectedCategoryId.toLowerCase();
        const Icon = getCategoryIcon(category.iconName);
        const accent = customerHomeAccent(category);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            aria-pressed={active}
            className={`customer-category-tile relative flex h-[66px] items-center gap-2.5 overflow-hidden rounded-[16px] border px-3 text-left transition-[transform,border-color,box-shadow,background] duration-200 active:translate-y-0.5 active:scale-[0.975] ${active ? 'is-selected -translate-y-px' : ''}`}
            style={{ '--home-accent': accent } as React.CSSProperties}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: active ? accent : '#97A3B7' }} />
            <span className="min-w-0">
              <b className="block truncate text-[11px] font-extrabold" style={{ color: active ? accent : '#E6E8F0' }}>{category.name}</b>
              <span className="mt-0.5 block truncate text-[8px] font-semibold text-slate-500">{category.businessCount ?? 0} nearby</span>
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        aria-label={hasMore ? 'Explore all categories' : 'View categories'}
        className="customer-category-tile relative flex h-[66px] items-center gap-2.5 rounded-[16px] border px-3 text-left transition active:translate-y-0.5 active:scale-[0.975]"
      >
        <Grid2X2 className="h-[18px] w-[18px] shrink-0 text-slate-400" />
        <span><b className="block text-[11px] font-extrabold text-[#E6E8F0]">More</b><span className="mt-0.5 block text-[8px] font-semibold text-slate-500">Explore all</span></span>
      </button>
    </section>
  );
};

const CATEGORY_TAGLINES: Record<string, string> = {
  salon: 'Live chairs nearby',
  gym: 'Slots, not queues',
  shop: 'Stock in real time',
  moto: 'Skip the garage line',
  pets: 'Gentle, on time',
  mall: 'Outlets & offers',
  food: 'Tables without the wait',
};

export const DEFAULT_MAIN_CATEGORIES: CategoryItemConfig[] = [
  { id: 'salon', name: 'Salon', iconName: 'Scissors', label: 'Salons', description: 'Live Salons & Barbershops', themeKey: 'salon', tagline: CATEGORY_TAGLINES.salon },
  { id: 'gym', name: 'Gym', iconName: 'Dumbbell', label: 'Gym', description: 'Fitness Centers & Gyms', themeKey: 'gym', tagline: CATEGORY_TAGLINES.gym },
  { id: 'shop', name: 'Shop', iconName: 'ShoppingBag', label: 'Shop', description: 'Retail Stores & Boutiques', themeKey: 'shop', tagline: CATEGORY_TAGLINES.shop },
  { id: 'moto', name: 'Moto', iconName: 'Car', label: 'Moto', description: 'Auto Care & Detailing', themeKey: 'moto', tagline: CATEGORY_TAGLINES.moto },
  { id: 'pets', name: 'Pets', iconName: 'Dog', label: 'Pets', description: 'Pet Grooming & Spa', themeKey: 'pets', tagline: CATEGORY_TAGLINES.pets },
  { id: 'mall', name: 'Mall', iconName: 'Building2', label: 'Mall', description: 'Shopping Malls & Outlets', themeKey: 'mall', tagline: CATEGORY_TAGLINES.mall },
  { id: 'food', name: 'Food', iconName: 'Utensils', label: 'Food', description: 'Restaurants & Dining', themeKey: 'food', tagline: CATEGORY_TAGLINES.food },
];

export const CategoryLandingState: React.FC<{
  category: CategoryItemConfig;
  onExploreSalons: () => void;
}> = ({ category, onExploreSalons }) => {
  const theme = CATEGORY_THEME_MAP[category.themeKey || category.id] || CATEGORY_THEME_MAP.salon;
  const IconComponent = getCategoryIcon(category.iconName);
  return (
    <section className={`relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b ${theme.cardBg} p-6 text-center`}>
      <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-lg ${theme.glow}`}>
        <IconComponent className="h-8 w-8" />
      </div>

      <h3 className="relative mt-4 text-xl font-black text-white">
        No {category.name} businesses nearby yet
      </h3>

      <p className={`relative mt-2 text-xs leading-relaxed max-w-sm mx-auto ${theme.softText}`}>
        {category.description || `There are no supported ${category.name.toLowerCase()} listings in the selected area right now.`}
      </p>

      <div className="relative mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onExploreSalons}
          className="h-11 rounded-xl border border-white/15 bg-white/[0.06] px-5 text-xs font-bold text-slate-100 hover:bg-white/[0.1] transition active:scale-[0.98]"
        >
          Explore Live Salons
        </button>
      </div>
    </section>
  );
};

const SIGNAL_STYLES: Record<SignalColor, { bar: string; text: string; bg: string }> = {
  green: { bar: '#34D399', text: 'text-emerald-300', bg: 'bg-emerald-400/15' },
  yellow: { bar: '#FBBF24', text: 'text-amber-300', bg: 'bg-amber-400/15' },
  orange: { bar: '#FB923C', text: 'text-orange-300', bg: 'bg-orange-400/15' },
  red: { bar: '#F87171', text: 'text-red-300', bg: 'bg-red-400/15' },
};

/** How many of the three bars light up per signal color — a busier state
 *  lights more bars, on top of the color change, so the signal never relies
 *  on color alone. Heights are ~15-20% smaller than the chip's first pass. */
const SIGNAL_ACTIVE_BARS: Record<SignalColor, number> = { green: 1, yellow: 2, orange: 3, red: 3 };
const SIGNAL_BAR_HEIGHTS = [4, 6.5, 9];

const SignalBars: React.FC<{ color: SignalColor }> = ({ color }) => {
  const active = SIGNAL_ACTIVE_BARS[color];
  const barColor = SIGNAL_STYLES[color].bar;
  return (
    <span className="flex items-end gap-[1.5px]" aria-hidden="true">
      {SIGNAL_BAR_HEIGHTS.map((height, index) => (
        <span
          key={height}
          className="w-[2.5px] rounded-sm"
          style={{ height: `${height}px`, backgroundColor: index < active ? barColor : 'rgba(255,255,255,0.18)' }}
        />
      ))}
    </span>
  );
};

/** Traffic-light live-status chip shared by Salon and Gym listing cards —
 *  always icon + text together, never color alone. Sized down ~15-20% from
 *  its first pass so it reads as a small status marker, not a headline. */
export const SignalStatusChip: React.FC<{ color: SignalColor; label: string }> = ({ color, label }) => {
  const style = SIGNAL_STYLES[color];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] text-[9px] font-bold ${style.bg} ${style.text}`}>
      <SignalBars color={color} />
      {label}
    </span>
  );
};

/** Occupied/available counts for the Gym listing's Live Floor capsule —
 *  always derived from the same real currentOccupancy/maxCapacity and the
 *  one shared crowd-color resolver, never a second/local computation. */
export interface LiveFloorMeterData {
  occupancy: number;
  maxCapacity: number;
  color: SignalColor;
}

/** Below this share of the unfilled track, the compact "N/M" value has no
 *  room to sit inside it without crowding the rounded cap — it moves just
 *  outside the bar's right edge instead of clipping. */
const LIVE_FLOOR_VALUE_FIT_THRESHOLD = 32;

/**
 * Compact premium glass/mirror occupancy capsule for a Gym listing card —
 * short and fixed-width so it never dominates the row the crowd-status chip
 * shares it with. The filled portion is only ever the crowd-status color
 * (no text), and the unfilled (smoked) portion carries one compact value —
 * "7/10" — never extra words like inside/free/left. When occupancy leaves
 * too little unfilled track to hold the value, it moves just outside the
 * bar's right edge instead of clipping. The fill color comes from the same
 * resolver-driven signal color as the crowd chip, never a competing
 * formula.
 */
const LiveFloorMeter: React.FC<{ data: LiveFloorMeterData }> = ({ data }) => {
  const capacity = Math.max(1, data.maxCapacity);
  const occupancy = Math.min(capacity, Math.max(0, data.occupancy));
  const available = Math.max(0, capacity - occupancy);
  const percentage = Math.min(100, Math.max(0, (occupancy / capacity) * 100));
  const fillHex = SIGNAL_STYLES[data.color].bar;
  const valueFits = 100 - percentage >= LIVE_FLOOR_VALUE_FIT_THRESHOLD;
  const valueLabel = `${occupancy}/${capacity}`;

  return (
    <div className="min-w-0 shrink-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Live Floor</p>
      <div
        role="img"
        aria-label={`${occupancy} of ${capacity} occupied, ${available} spaces free`}
        className="relative mt-1 h-5 w-[92px] overflow-hidden rounded-full bg-[#0A0F0E] ring-1 ring-white/[0.07] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]"
      >
        {/* smoked translucent unfilled side */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/30" />
        {/* filled glass/mirror capsule — color only, no text */}
        <div
          className="absolute inset-y-0 left-0 overflow-hidden rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${percentage}%`, background: `linear-gradient(180deg, ${fillHex}E6 0%, ${fillHex}B3 55%, ${fillHex}80 100%)` }}
        >
          {/* reflective highlight + inner gloss depth */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/45 to-transparent" />
          <div className="absolute inset-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.55),inset_0_-3px_5px_rgba(0,0,0,0.3)]" />
        </div>
        <span
          className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] font-bold tabular-nums transition-all duration-700 ease-out ${valueFits ? 'text-slate-300' : 'text-white'}`}
          style={valueFits ? { right: 6 } : { right: `calc(${100 - percentage}% + 5px)` }}
        >
          {valueLabel}
        </span>
      </div>
    </div>
  );
};

/**
 * Premium dark listing card for a nearby business. Renders only real data
 * already carried on `NearbySalon` (plus values passed in that were derived
 * from it via the shared resolvers) — no invented fields.
 */
export const PremiumBusinessCard: React.FC<{
  salon: NearbySalon;
  theme: CategoryTheme;
  icon: React.FC<{ className?: string }>;
  isSelected: boolean;
  /** Gold MEMBER badge outranks "Last viewed" for an authenticated customer
   *  with a current, valid Gym membership — never shown together. */
  isMember?: boolean;
  /** Compact "Locality · 0.4 km" — no full street address on the listing;
   *  the full address stays on the Detail page. */
  localityLabel: string;
  /** Primary live-data line, e.g. "1 ahead" (unused for Gym — see liveFloorMeter). */
  liveLine1: string;
  /** Secondary live-data line, e.g. "~8 min wait" (unused for Gym). */
  liveLine2: string;
  /** Gym-only: renders the "Live Floor" heading + occupancy capsule in place
   *  of liveLine1/liveLine2. */
  liveFloorMeter?: LiveFloorMeterData;
  signalColor: SignalColor;
  signalLabel: string;
  /** "You'd be #3" — salon only, and only while there's an actual wait. */
  positionLabel?: string | null;
  onClick: () => void;
}> = ({ salon, theme, icon: IconComponent, isSelected, isMember, localityLabel, liveLine1, liveLine2, liveFloorMeter, signalColor, signalLabel, positionLabel, onClick }) => {
  const categoryId = (salon.mainCategoryId || 'salon').toLowerCase();
  const isSalon = categoryId === 'salon';
  const isGym = categoryId === 'gym';
  const occupancyPercent = liveFloorMeter
    ? Math.min(100, Math.max(0, (liveFloorMeter.occupancy / Math.max(1, liveFloorMeter.maxCapacity)) * 100))
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`customer-home-business-card group relative w-full overflow-hidden rounded-[18px] border text-left transition-all duration-200 ${
        isSelected
          ? 'border-white/[0.13] bg-white/[0.045] shadow-[0_13px_30px_-24px_var(--home-accent)]'
          : 'border-white/[0.075] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.055]'
      }`}
      style={{ '--home-accent': theme.accent } as React.CSSProperties}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex min-h-[76px] items-center gap-3 px-3 py-2.5">
        {/* Thumbnail priority: the business's real logo first (its clearest
            identity signal), then its real cover photo, otherwise the
            category-icon tile — no placeholder imagery invented for a
            business that carries neither. object-cover on a fixed square
            box crops to fit without ever stretching the source image. */}
        {salon.logoImageUrl || salon.coverImageUrl ? (
          <div className="relative h-[50px] w-[50px] shrink-0 overflow-hidden rounded-[14px] bg-white/5 shadow-md">
            <img src={salon.logoImageUrl || salon.coverImageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[14px] text-white shadow-md" style={{ background: `linear-gradient(145deg, ${theme.primary}E6, ${theme.primary}73 62%, #07101D)` }}>
            <IconComponent className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1 self-center">
          <b className="block truncate text-[13px] font-bold leading-4 text-[#E6E8F0]">{salon.name}</b>
          <span className="mt-0.5 block truncate text-[9px] font-medium text-slate-400">{salon.category || localityLabel} · {salon.distanceKm} km</span>
          <span className="mt-1 flex min-w-0 items-center gap-1 text-[9px] font-medium text-slate-400">
            <Star className="h-2.5 w-2.5 shrink-0 fill-[#FFD166] text-[#FFD166]" />
            <span className="shrink-0 text-slate-300">{salon.rating}</span>
            <span className="truncate">· {salon.reviewCount} {isMember ? '· Member access' : 'reviews'}</span>
          </span>
        </div>
        <div className="w-[74px] shrink-0 self-start pt-1 text-right">
          {isGym && liveFloorMeter ? (
            <><b className="block text-[13px] font-black tabular-nums text-[#E6E8F0]">{liveFloorMeter.occupancy} / {liveFloorMeter.maxCapacity}</b><span className="block text-[8px] font-semibold text-slate-500">inside now</span></>
          ) : isSalon ? (
            <><b className="block text-[13px] font-black text-[#E6E8F0]">{salon.waitingCustomers === 0 ? 'Ready now' : `${salon.liveWaitMinutes} min`}</b><span className="block text-[8px] font-semibold text-slate-500">{salon.waitingCustomers === 0 ? 'walk in' : 'estimated wait'}</span></>
          ) : (
            <><b className="block text-[12px] font-black text-[#E6E8F0]">{salon.isOpen ? 'Open now' : 'Closed'}</b>{salon.openingHours && <span className="block truncate text-[8px] font-semibold text-slate-500">{salon.openingHours}</span>}</>
          )}
        </div>
      </div>

      <div className="flex h-[34px] items-center justify-between gap-3 border-t border-white/[0.055] bg-black/20 px-3">
        {isGym && liveFloorMeter ? (
          <>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[8px] font-black uppercase tracking-wide" style={{ color: theme.accent }}><span className="text-[11px]">⌁</span> Live floor</span>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <span className="h-1 w-[62px] overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full" style={{ width: `${occupancyPercent}%`, backgroundColor: SIGNAL_STYLES[signalColor].bar }} /></span>
              <span className="w-[45px] text-right text-[8px] font-semibold text-slate-400">{signalLabel}</span>
            </div>
          </>
        ) : isSalon ? (
          <>
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[8px] font-semibold text-slate-400"><UsersRound className="h-3 w-3 shrink-0" style={{ color: theme.accent }} />{liveLine1}</span>
            {positionLabel && <span className="min-w-0 flex-1 truncate text-[8px] font-semibold text-slate-400"><CalendarDays className="mr-1 inline h-3 w-3" />{positionLabel}</span>}
            <SignalStatusChip color={signalColor} label={signalLabel} />
          </>
        ) : (
          <>
            <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[8px] font-semibold text-slate-400"><Clock className="h-3 w-3 shrink-0" style={{ color: theme.accent }} />{liveLine2}</span>
          </>
        )}
      </div>
    </button>
  );
};
