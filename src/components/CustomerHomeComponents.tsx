import React from 'react';
import { Mic, Search, Sparkles, UserRound, WalletCards, Scissors, Dumbbell, ShoppingBag, Car, Dog, Building2, Utensils, Store, X, Volume2, Star, ChevronRight, Clock, Users } from 'lucide-react';
import type { NearbySalon } from '../types';
import { deriveCrowdStatus } from '../shared/crowdStatus';

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
};

export const CATEGORY_THEME_MAP: Record<string, CategoryTheme> = {
  salon: {
    key: 'salon',
    primary: '#22D3EE',
    accent: '#2DD4BF',
    gradientFrom: 'from-cyan-400',
    gradientTo: 'to-teal-600',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-200',
    joinedBg: 'bg-[#050B0C]',
    bannerGradient: 'from-cyan-500/25 via-teal-600/10 to-transparent',
    glow: 'shadow-[0_0_45px_-10px_rgba(34,211,238,0.65)]',
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
    bannerGradient: 'from-purple-500/25 via-fuchsia-600/10 to-transparent',
    glow: 'shadow-[0_0_45px_-10px_rgba(168,85,247,0.65)]',
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
    bannerGradient: 'from-amber-500/25 via-orange-600/10 to-transparent',
    glow: 'shadow-[0_0_45px_-10px_rgba(245,158,11,0.6)]',
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
    bannerGradient: 'from-blue-500/25 via-sky-600/10 to-transparent',
    glow: 'shadow-[0_0_45px_-10px_rgba(59,130,246,0.6)]',
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
    bannerGradient: 'from-pink-500/25 via-rose-600/10 to-transparent',
    glow: 'shadow-[0_0_45px_-10px_rgba(236,72,153,0.6)]',
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
    bannerGradient: 'from-indigo-500/25 via-violet-600/10 to-transparent',
    glow: 'shadow-[0_0_45px_-10px_rgba(99,102,241,0.6)]',
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
    bannerGradient: 'from-rose-500/25 via-red-600/10 to-transparent',
    glow: 'shadow-[0_0_45px_-10px_rgba(244,63,94,0.6)]',
    ring: 'ring-rose-400/50',
    chip: 'bg-rose-400 text-slate-950',
    cardBg: 'from-[#360F17] to-[#1E0A0F]',
    softText: 'text-rose-100/70',
  },
};

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

export function categoryCssVars(theme: CategoryTheme): Record<string, string> {
  const surfaceMatch = theme.joinedBg.match(/#[0-9A-Fa-f]{3,8}/);
  return {
    '--category-primary': theme.primary,
    '--category-accent': theme.accent,
    '--category-glow': `${theme.primary}66`,
    '--category-border': `${theme.primary}40`,
    '--category-soft': `${theme.accent}B3`,
    '--category-surface': surfaceMatch ? surfaceMatch[0] : '#050B0C',
    '--category-tint-10': `${theme.primary}1A`,
    '--category-tint-20': `${theme.primary}33`,
    '--category-primary-dark': shadeHex(theme.primary, -0.35),
    '--category-primary-light': shadeHex(theme.primary, 0.3),
  };
}

export function resolveCategoryTheme(themeKeyOrId?: string | null): CategoryTheme {
  if (!themeKeyOrId) return CATEGORY_THEME_MAP.salon;
  return CATEGORY_THEME_MAP[themeKeyOrId.toLowerCase()] || CATEGORY_THEME_MAP.salon;
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
  const [placeholderIndex, setPlaceholderIndex] = React.useState(0);
  const activeList = categories.length ? categories : DEFAULT_MAIN_CATEGORIES;

  React.useEffect(() => {
    if (!activeList.length) return;
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % activeList.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [activeList]);

  const activeCategory = activeList[placeholderIndex] || activeList[0] || { name: activeCategoryName };
  const placeholderText = `Search for ‘${activeCategory.name}’...`;

  return (
    <div className="relative w-full space-y-2">
      <div
        className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-white/[0.06] px-4 backdrop-blur-md transition-all duration-200 ${
          isListening
            ? 'border-red-400/60 ring-2 ring-red-400/20 shadow-[0_0_24px_-6px_rgba(248,113,113,0.5)]'
            : 'border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus-within:ring-2'
        }`}
        style={isListening ? undefined : ({ '--tw-ring-color': 'var(--category-tint-20, rgba(34,211,238,0.15))' } as React.CSSProperties)}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--category-border, rgba(34,211,238,0.5))'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
      >
        <Search className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type="search"
          enterKeyHint="search"
          aria-label="Search businesses"
          placeholder={placeholderText}
          className="h-14 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:font-normal placeholder:text-slate-500"
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
        <button
          type="button"
          onClick={onVoiceSearch}
          aria-label={isListening ? "Stop listening" : "Start voice search"}
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-95 ${
            isListening
              ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
              : 'bg-white/10 text-slate-200 hover:bg-white/20'
          }`}
        >
          {isListening && (
            <span className="absolute inset-0 rounded-xl bg-red-400 opacity-75 animate-ping" />
          )}
          <Mic className={`relative h-4.5 w-4.5 ${isListening ? 'animate-bounce' : ''}`} />
        </button>
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
export const PromotionalBanner: React.FC<{ category?: CategoryItemConfig; imageSrc?: string; onCtaClick?: () => void }> = ({ category, imageSrc, onCtaClick }) => {
  const themeKey = category?.themeKey || category?.id || 'salon';
  const theme = CATEGORY_THEME_MAP[themeKey] || CATEGORY_THEME_MAP.salon;
  const copy = HERO_COPY[themeKey] || HERO_COPY.salon;
  const headline = category?.bannerHeadline || copy.headline;
  const subheadline = category?.bannerSubheadline || copy.subheadline;
  const ctaText = category?.bannerCtaText || `Explore ${category?.name || 'Chairs'}`;
  const IconComponent = getCategoryIcon(category?.iconName || 'Scissors');

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${theme.cardBg} p-5 sm:p-6 transition-all duration-500 ${theme.glow}`}
    >
      {/* Glossy top highlight */}
      <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
      <div className={`pointer-events-none absolute -right-10 -bottom-14 h-48 w-48 rounded-full bg-gradient-to-br ${theme.bannerGradient} blur-2xl`} />

      {imageSrc ? (
        <img src={imageSrc} alt="Featured offer" className="relative h-full w-full rounded-2xl object-cover" />
      ) : (
        <div className="relative flex items-center justify-between gap-4">
          <div className="max-w-[70%]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white backdrop-blur-md">
              <Sparkles className="h-3 w-3" style={{ color: theme.accent }} /> Featured {category?.name || 'Category'}
            </span>
            <h2 className="mt-3 text-lg font-black leading-tight tracking-[-0.025em] text-white sm:text-2xl">
              {headline}
            </h2>
            <p className={`mt-1.5 text-[11px] leading-4 font-medium sm:text-xs ${theme.softText}`}>{subheadline}</p>
            <button
              type="button"
              onClick={onCtaClick}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold text-slate-950 shadow-lg transition active:scale-[0.97]"
              style={{ backgroundColor: theme.accent, boxShadow: `0 8px 20px -6px ${theme.primary}88` }}
            >
              {ctaText}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 -m-3 rounded-[2rem] blur-xl"
              style={{ background: `radial-gradient(circle, ${theme.primary}55, transparent 70%)` }}
            />
            <div
              className={`relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/20 bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-2xl sm:h-24 sm:w-24`}
            >
              <div className="absolute inset-x-2 top-1.5 h-1/3 rounded-full bg-white/25 blur-[2px]" />
              <IconComponent className="relative h-10 w-10 drop-shadow" />
            </div>
          </div>
        </div>
      )}
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
};

export function getCategoryIcon(iconName: string): React.FC<{ className?: string }> {
  return categoryIconMap[iconName] || categoryIconMap.Scissors;
}

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
  const [notified, setNotified] = React.useState(false);

  return (
    <section className={`relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b ${theme.cardBg} p-6 text-center`}>
      <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-lg ${theme.glow}`}>
        <IconComponent className="h-8 w-8" />
      </div>

      <div className="relative mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-200">
        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
        <span>EXPANDING TO {category.name.toUpperCase()}</span>
      </div>

      <h3 className="relative mt-3 text-xl font-black text-white">
        {category.name} Services Coming Soon
      </h3>

      <p className={`relative mt-2 text-xs leading-relaxed max-w-sm mx-auto ${theme.softText}`}>
        {category.description || `We are onboarding premier ${category.name.toLowerCase()} businesses and service providers near Indiranagar, Bengaluru.`}
      </p>

      <div className="relative mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => setNotified(!notified)}
          className={`h-11 rounded-xl px-5 text-xs font-bold transition active:scale-[0.98] ${
            notified
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-950 shadow-md'
          }`}
          style={notified ? undefined : { backgroundColor: theme.accent, boxShadow: `0 8px 20px -6px ${theme.primary}88` }}
        >
          {notified ? '✓ You will be notified' : `Notify Me When ${category.name} Launches`}
        </button>

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

/**
 * Premium dark listing card for a nearby business. Renders only real data
 * already carried on `NearbySalon` — no invented fields. Crowd status is a
 * deterministic front-end read of the same wait/queue numbers shown below it.
 */
const CROWD_DOT_COLOR: Record<'busy' | 'moderate' | 'low', (theme: CategoryTheme) => string> = {
  busy: (theme) => theme.accent,
  moderate: (theme) => `${theme.accent}B3`,
  low: () => 'rgba(148,163,184,0.7)',
};

/**
 * Premium dark listing card for a nearby business. Renders only real data
 * already carried on `NearbySalon` — no invented fields. Crowd status is a
 * deterministic front-end read of the same wait/queue numbers shown in the
 * status line below it (never a separately-invented time slot).
 */
export const PremiumBusinessCard: React.FC<{
  salon: NearbySalon;
  theme: CategoryTheme;
  icon: React.FC<{ className?: string }>;
  isSelected: boolean;
  waitLabel: string;
  isNoWait: boolean;
  onClick: () => void;
}> = ({ salon, theme, icon: IconComponent, isSelected, waitLabel, isNoWait, onClick }) => {
  const crowd = deriveCrowdStatus({ liveWaitMinutes: salon.liveWaitMinutes, waitingCustomers: salon.waitingCustomers });
  const areaLabel = salon.area || salon.address;
  // One concise text line instead of a row of tag chips — real service names,
  // just typeset as prose rather than pills.
  const servicesLine = salon.services.slice(0, 3).map((service) => service.name).join(' • ');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
        isSelected
          ? `border-white/20 bg-gradient-to-br ${theme.cardBg} ring-1 ${theme.ring} ${theme.glow}`
          : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.06]'
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-start gap-3.5 p-4 pb-3">
        {/* Thumbnail: real cover photo when the business has one, otherwise
            the same category-icon tile as before — no placeholder imagery
            invented for businesses that don't carry a photo. */}
        {salon.coverImageUrl ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-md">
            <img src={salon.coverImageUrl} alt="" className="h-full w-full object-cover" />
            <span
              className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-tl-lg text-white"
              style={{ backgroundColor: theme.accent }}
            >
              <IconComponent className="h-3 w-3" />
            </span>
          </div>
        ) : (
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-md`}>
            <IconComponent className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <b className="truncate text-[15px] font-bold text-white">
              {salon.name}
            </b>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] font-medium text-slate-400">
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-slate-300">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {salon.rating}
            </span>
            <span className="shrink-0 text-slate-600">•</span>
            <span className="shrink-0 whitespace-nowrap">{salon.distanceKm} km</span>
            <span className="shrink-0 text-slate-600">•</span>
            <span className="min-w-0 truncate">{areaLabel}</span>
          </div>
          {!!servicesLine && (
            <p className="mt-1.5 truncate text-[11px] font-medium text-slate-400">
              {servicesLine}
            </p>
          )}
        </div>
      </div>

      {/* Status section — the primary visual weight of the card, not a chip
          row: live queue size / wait estimate on the left, crowd read on the
          right with its own small indicator dot. */}
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-black/20 px-4 py-3">
        <div className="min-w-0">
          {isNoWait ? (
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-300">
              <Clock className="h-3.5 w-3.5" />
              No wait · Ready now
            </p>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-white">
                <Users className="h-3.5 w-3.5" style={{ color: theme.accent }} />
                Live queue: {salon.waitingCustomers} {salon.waitingCustomers === 1 ? 'person' : 'people'}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                Est. wait <span style={{ color: theme.accent }}>{waitLabel}</span>
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: CROWD_DOT_COLOR[crowd.level](theme) }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CROWD_DOT_COLOR[crowd.level](theme) }} />
            {crowd.label}
          </span>
          {isSelected && (
            <span className={`rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider ${theme.badgeBg} ${theme.badgeText}`}>
              Selected
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
