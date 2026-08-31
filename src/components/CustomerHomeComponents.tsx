import React from 'react';
import { Mic, Search, Sparkles, UserRound, WalletCards, Scissors, Dumbbell, ShoppingBag, Car, Dog, Building2, Utensils, Store, X, Volume2, Star, Crown, ChevronRight, Clock, Stethoscope } from 'lucide-react';
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
    primary: '#FF5CC8',
    accent: '#FF5CC8',
    gradientFrom: 'from-[#FF5CC8]',
    gradientTo: 'to-[#A82783]',
    badgeBg: 'bg-pink-500/15',
    badgeText: 'text-pink-200',
    joinedBg: 'bg-[#0D1118]',
    bannerGradient: 'from-pink-500/18 via-fuchsia-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(255,92,200,0.38)]',
    ring: 'ring-pink-400/50',
    chip: 'bg-[#FF5CC8] text-[#0D1118]',
    cardBg: 'from-[#321327] to-[#17101A]',
    softText: 'text-pink-100/70',
  },
  gym: {
    key: 'gym',
    primary: '#23E08D',
    accent: '#23E08D',
    gradientFrom: 'from-[#23E08D]',
    gradientTo: 'to-[#08764A]',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-200',
    joinedBg: 'bg-[#0D1118]',
    bannerGradient: 'from-emerald-500/18 via-green-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(35,224,141,0.38)]',
    ring: 'ring-emerald-400/50',
    chip: 'bg-[#23E08D] text-[#0D1118]',
    cardBg: 'from-[#103126] to-[#0D1915]',
    softText: 'text-emerald-100/70',
  },
  shop: {
    key: 'shop',
    primary: '#FFD166',
    accent: '#FFD166',
    gradientFrom: 'from-amber-400',
    gradientTo: 'to-orange-600',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-200',
    joinedBg: 'bg-[#0D1118]',
    bannerGradient: 'from-amber-500/18 via-orange-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(245,158,11,0.42)]',
    ring: 'ring-amber-400/50',
    chip: 'bg-[#FFD166] text-[#0D1118]',
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
    joinedBg: 'bg-[#0D1118]',
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
    joinedBg: 'bg-[#0D1118]',
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
    joinedBg: 'bg-[#0D1118]',
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
    joinedBg: 'bg-[#0D1118]',
    bannerGradient: 'from-rose-500/18 via-red-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(244,63,94,0.42)]',
    ring: 'ring-rose-400/50',
    chip: 'bg-rose-400 text-slate-950',
    cardBg: 'from-[#360F17] to-[#1E0A0F]',
    softText: 'text-rose-100/70',
  },
  clinic: {
    key: 'clinic',
    primary: '#4DB7FF',
    accent: '#4DB7FF',
    gradientFrom: 'from-[#4DB7FF]',
    gradientTo: 'to-[#126CA8]',
    badgeBg: 'bg-sky-500/15',
    badgeText: 'text-sky-200',
    joinedBg: 'bg-[#0D1118]',
    bannerGradient: 'from-sky-500/18 via-blue-600/7 to-transparent',
    glow: 'shadow-[0_0_32px_-9px_rgba(77,183,255,0.38)]',
    ring: 'ring-sky-400/50',
    chip: 'bg-[#4DB7FF] text-[#0D1118]',
    cardBg: 'from-[#10283A] to-[#0D171F]',
    softText: 'text-sky-100/70',
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
        style={isListening ? undefined : ({ '--tw-ring-color': 'rgba(42,123,255,0.22)' } as React.CSSProperties)}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(42,123,255,0.55)'; }}
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
            backgroundColor: 'rgba(42,123,255,0.10)',
            color: '#79A9FF',
            borderColor: 'rgba(42,123,255,0.24)',
          } : undefined}
        >
          <div className="flex items-center gap-2">
            {isListening ? (
              <span className="flex h-2 w-2 rounded-full bg-red-400 animate-pulse" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0" style={{ color: '#2A7BFF' }} />
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

export const LiveNowBadge: React.FC = () => (
  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#FF3B30]/20 bg-[#FF3B30]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#FF6B63]">
    <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_8px_rgba(255,59,48,0.75)]" />
    Live now
  </span>
);

/**
 * Premium featured/hero card — glossy, category-themed, adapts headline and
 * color identity to whichever category is currently selected.
 */
export const PromotionalBanner: React.FC<{
  category?: CategoryItemConfig;
  featuredBusiness?: NearbySalon;
  livePrimary?: string;
  liveSecondary?: string;
  onCtaClick?: () => void;
}> = ({ category, featuredBusiness, livePrimary, liveSecondary, onCtaClick }) => {
  const themeKey = category?.themeKey || category?.id || 'salon';
  const theme = CATEGORY_THEME_MAP[themeKey] || CATEGORY_THEME_MAP.salon;
  const copy = HERO_COPY[themeKey] || HERO_COPY.salon;
  const headline = featuredBusiness?.name || category?.bannerHeadline || copy.headline;
  const subheadline = featuredBusiness
    ? [livePrimary, liveSecondary].filter(Boolean).join(' · ') || deriveFeaturedLocation(featuredBusiness)
    : category?.bannerSubheadline || copy.subheadline;
  const ctaText = featuredBusiness ? 'Explore' : category?.bannerCtaText || `Explore ${category?.name || 'Businesses'}`;
  const IconComponent = getCategoryIcon(category?.iconName || 'Scissors');
  const imageSrc = featuredBusiness?.coverImageUrl || featuredBusiness?.logoImageUrl || category?.bannerImageUrl;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${theme.cardBg} p-5 sm:p-6 transition-all duration-500 ${theme.glow}`}
    >
      {/* Glossy top highlight */}
      <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
      <div className={`pointer-events-none absolute -right-10 -bottom-14 h-48 w-48 rounded-full bg-gradient-to-br ${theme.bannerGradient} blur-2xl`} />

      {imageSrc && (
        <img src={imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
      )}
      {imageSrc && <div className="absolute inset-0 bg-gradient-to-r from-[#0D1118]/95 via-[#0D1118]/78 to-[#0D1118]/20" />}
      <div className="relative flex min-h-36 items-center justify-between gap-4">
          <div className="max-w-[76%]">
            <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white backdrop-blur-md">
              <Sparkles className="h-3 w-3" style={{ color: theme.accent }} /> Featured {category?.name || 'Category'}
            </span>
            {featuredBusiness && <LiveNowBadge />}
            </div>
            <h2 className="mt-3 text-lg font-black leading-tight tracking-[-0.025em] text-white sm:text-2xl">
              {headline}
            </h2>
            <p className={`mt-1.5 text-[11px] leading-4 font-medium sm:text-xs ${theme.softText}`}>{subheadline}</p>
            <button
              type="button"
              onClick={onCtaClick}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold text-slate-950 shadow-lg transition active:scale-[0.97]"
              style={{ backgroundColor: theme.accent, boxShadow: `0 6px 16px -6px ${theme.primary}5F` }}
            >
              {ctaText}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {!imageSrc && <div className="relative shrink-0">
            <div
              className="absolute inset-0 -m-3 rounded-[2rem] blur-xl"
              style={{ background: `radial-gradient(circle, ${theme.primary}3C, transparent 70%)` }}
            />
            <div
              className={`relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/20 bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-2xl sm:h-24 sm:w-24`}
            >
              <div className="absolute inset-x-2 top-1.5 h-1/3 rounded-full bg-white/25 blur-[2px]" />
              <IconComponent className="relative h-10 w-10 drop-shadow" />
            </div>
          </div>}
        </div>
    </section>
  );
};

function deriveFeaturedLocation(business: NearbySalon): string {
  return business.area || business.city || business.address || 'Nearby';
}

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
  Stethoscope: (props) => <Stethoscope {...props} />,
};

export function getCategoryIcon(iconName: string): React.FC<{ className?: string }> {
  return categoryIconMap[iconName] || categoryIconMap.Scissors;
}

export const CategoryGrid: React.FC<{
  categories: CategoryItemConfig[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}> = ({ categories, selectedCategoryId, onSelectCategory }) => (
  <section aria-label="Browse categories">
    <div className="mb-3 flex items-end justify-between px-1">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Browse</p>
        <h2 className="mt-0.5 text-lg font-black tracking-[-0.025em] text-[#E6E8F0]">What do you need?</h2>
      </div>
      <span className="text-[10px] font-semibold text-slate-500">{categories.length} categories</span>
    </div>
    <div className="grid grid-cols-3 gap-2.5">
      {categories.map((category) => {
        const selected = category.id.toLowerCase() === selectedCategoryId.toLowerCase();
        const theme = resolveCategoryTheme(category.themeKey || category.id);
        const Icon = getCategoryIcon(category.iconName);
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectCategory(category.id)}
            className="relative min-h-[88px] overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[0.97]"
            style={{
              borderColor: selected ? `${theme.primary}8A` : 'rgba(255,255,255,0.07)',
              background: selected
                ? `linear-gradient(145deg, ${theme.primary}28 0%, #141922 72%)`
                : '#141922',
              boxShadow: selected ? `0 10px 26px -18px ${theme.primary}` : 'none',
            }}
          >
            <div className="flex items-start justify-between gap-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ color: theme.accent, backgroundColor: `${theme.primary}18` }}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-400">
                {category.businessCount ?? 0}
              </span>
            </div>
            <p className="mt-2 truncate text-[11px] font-extrabold text-[#E6E8F0]">{category.name}</p>
            <p className="mt-0.5 truncate text-[8px] font-semibold text-slate-500">{category.tagline || category.label}</p>
          </button>
        );
      })}
    </div>
  </section>
);

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
          style={notified ? undefined : { backgroundColor: theme.accent, boxShadow: `0 6px 16px -6px ${theme.primary}5F` }}
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
        isSelected
          ? `border-white/15 bg-white/[0.035] ring-1 ${theme.ring} shadow-[0_0_0_1px_rgba(255,255,255,0.02)]`
          : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.06]'
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-start gap-3.5 p-4 pb-3">
        {/* Thumbnail priority: the business's real logo first (its clearest
            identity signal), then its real cover photo, otherwise the
            category-icon tile — no placeholder imagery invented for a
            business that carries neither. object-cover on a fixed square
            box crops to fit without ever stretching the source image. */}
        {salon.logoImageUrl || salon.coverImageUrl ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/5 shadow-md">
            <img src={salon.logoImageUrl || salon.coverImageUrl} alt="" className="h-full w-full object-cover" />
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
            <b className="min-w-0 flex-1 truncate text-[15px] font-bold text-white">
              {salon.name}
            </b>
            {isMember ? (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[9px] font-bold uppercase tracking-wider text-[#3B2A0A] shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.6)]" style={{ background: 'linear-gradient(135deg, #FDE7A8 0%, #E8B84B 32%, #B8842A 62%, #F3D584 100%)' }}>
                <Crown className="h-2.5 w-2.5 fill-[#5C3E0C] text-[#5C3E0C]" />
                Member
              </span>
            ) : isSelected && (
              <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider ${theme.softText}`}>
                Last viewed
              </span>
            )}
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] font-medium text-slate-400">
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-slate-300">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {salon.rating}
            </span>
            <span className="shrink-0 text-slate-600">•</span>
            <span className="min-w-0 truncate">{localityLabel} · {salon.distanceKm} km</span>
          </div>
        </div>
      </div>

      {/* Status section — the primary visual weight of the card, not a chip
          row: live queue/floor numbers on the left, a traffic-light signal
          (icon + text, never color alone) on the right. */}
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-black/20 px-4 py-3">
        {liveFloorMeter ? (
          <LiveFloorMeter data={liveFloorMeter} />
        ) : (
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[13px] font-bold text-white">
              <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: theme.accent }} />
              {liveLine1}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">{liveLine2}</p>
          </div>
        )}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <SignalStatusChip color={signalColor} label={signalLabel} />
          {positionLabel && (
            <span className="text-[9px] font-semibold text-slate-400">{positionLabel}</span>
          )}
        </div>
      </div>
    </button>
  );
};
