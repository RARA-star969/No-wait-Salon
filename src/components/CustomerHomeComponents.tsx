import React from 'react';
import { Mic, Search, Sparkles, UserRound, WalletCards, Scissors, Dumbbell, ShoppingBag, Car, Dog, Building2, Utensils, Store, X, Volume2, Star, ChevronRight, Clock } from 'lucide-react';
import type { NearbySalon } from '../types';
import type { SignalColor } from '../shared/signalColor';

export const WalletButton: React.FC<{ balance?: string; onClick?: () => void }> = ({ balance = '₹0', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Wallet balance ${balance}`}
    className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-slate-100 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.1] active:scale-[0.98]"
  >
    <WalletCards className="h-4 w-4 text-cyan-300" />
    <span className="text-xs font-bold">{balance}</span>
  </button>
);

export const ProfileButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Open customer profile"
    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-cyan-300 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.1] active:scale-[0.98]"
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
      <div className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-white/[0.06] px-4 backdrop-blur-md transition-all duration-200 ${
        isListening
          ? 'border-red-400/60 ring-2 ring-red-400/20 shadow-[0_0_24px_-6px_rgba(248,113,113,0.5)]'
          : 'border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus-within:border-cyan-400/50 focus-within:ring-2 focus-within:ring-cyan-400/15'
      }`}>
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
        <div className={`flex items-center justify-between gap-3 rounded-xl p-3 text-xs font-bold backdrop-blur-md transition-all animate-in fade-in duration-200 ${
          isListening
            ? 'bg-red-500/10 text-red-200 border border-red-400/30'
            : voiceFeedback.includes('Heard')
              ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-400/30'
              : 'bg-amber-500/10 text-amber-200 border border-amber-400/30'
        }`}>
          <div className="flex items-center gap-2">
            {isListening ? (
              <span className="flex h-2 w-2 rounded-full bg-red-400 animate-pulse" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0 text-cyan-300" />
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

/**
 * Premium floating category deck. The active category renders as a large,
 * focused glossy card; the rest render as a smaller stacked deck beside it —
 * still tappable, so category switching keeps working exactly as before.
 */
export const TopCategoryTabs: React.FC<{
  categories?: CategoryItemConfig[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
}> = ({ categories = DEFAULT_MAIN_CATEGORIES, selectedCategoryId, onSelectCategory }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleSelect = (catId: string, element: HTMLButtonElement) => {
    try {
      if (typeof window !== 'undefined' && window.navigator?.vibrate) {
        window.navigator.vibrate(14);
      }
    } catch (_) {}

    element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    onSelectCategory(catId);
  };

  return (
    <div className="relative pt-1">
      <nav
        ref={containerRef}
        aria-label="Main Business Categories"
        className="relative -mx-4 px-4 py-2 scrollbar-none overflow-x-auto flex items-stretch gap-3 touch-pan-x sm:-mx-5 sm:px-5"
      >
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          const theme = CATEGORY_THEME_MAP[cat.themeKey || cat.id] || CATEGORY_THEME_MAP.salon;
          const IconComponent = getCategoryIcon(cat.iconName);
          const count = cat.businessCount;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={(e) => handleSelect(cat.id, e.currentTarget)}
              aria-pressed={isSelected}
              className={`group relative flex shrink-0 flex-col justify-between overflow-hidden rounded-3xl border text-left transition-all duration-300 ease-out active:scale-[0.97] ${
                isSelected
                  ? `z-10 min-w-[172px] h-[128px] border-white/15 bg-gradient-to-br ${theme.cardBg} px-4 py-3.5 ring-1 ${theme.ring} ${theme.glow}`
                  : `min-w-[88px] h-[112px] translate-y-2 border-white/5 bg-white/[0.04] px-3 py-3 opacity-70 hover:opacity-95 hover:translate-y-0 hover:border-white/10`
              }`}
            >
              {isSelected && (
                <>
                  <div className="pointer-events-none absolute -left-6 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                </>
              )}

              {count !== undefined && count > 0 && (
                <span
                  className={`absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${theme.chip} shadow-sm`}
                >
                  {count}
                </span>
              )}

              <div
                className={`relative flex items-center justify-center rounded-2xl transition-all duration-300 ${
                  isSelected
                    ? `h-10 w-10 bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-md`
                    : 'h-9 w-9 bg-white/[0.06] text-slate-300 group-hover:scale-105'
                }`}
              >
                <IconComponent className={isSelected ? 'h-5 w-5' : 'h-4.5 w-4.5'} />
              </div>

              <div className="relative">
                <span
                  className={`block font-extrabold tracking-tight transition-colors ${
                    isSelected ? 'text-[15px] text-white' : 'text-[11px] text-slate-300'
                  }`}
                >
                  {cat.name}
                </span>
                {isSelected && (
                  <span className={`mt-0.5 block text-[10px] font-medium ${theme.softText}`}>
                    {cat.tagline || CATEGORY_TAGLINES[cat.themeKey || cat.id] || 'Live now'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

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

const SIGNAL_STYLES: Record<SignalColor, { bar: string; text: string; bg: string }> = {
  green: { bar: '#34D399', text: 'text-emerald-300', bg: 'bg-emerald-400/15' },
  yellow: { bar: '#FBBF24', text: 'text-amber-300', bg: 'bg-amber-400/15' },
  orange: { bar: '#FB923C', text: 'text-orange-300', bg: 'bg-orange-400/15' },
  red: { bar: '#F87171', text: 'text-red-300', bg: 'bg-red-400/15' },
};

/** How many of the three bars light up per signal color — a busier state
 *  lights more bars, on top of the color change, so the signal never relies
 *  on color alone. */
const SIGNAL_ACTIVE_BARS: Record<SignalColor, number> = { green: 1, yellow: 2, orange: 3, red: 3 };
const SIGNAL_BAR_HEIGHTS = [5, 8, 11];

const SignalBars: React.FC<{ color: SignalColor }> = ({ color }) => {
  const active = SIGNAL_ACTIVE_BARS[color];
  const barColor = SIGNAL_STYLES[color].bar;
  return (
    <span className="flex items-end gap-[2px]" aria-hidden="true">
      {SIGNAL_BAR_HEIGHTS.map((height, index) => (
        <span
          key={height}
          className="w-[3px] rounded-sm"
          style={{ height: `${height}px`, backgroundColor: index < active ? barColor : 'rgba(255,255,255,0.18)' }}
        />
      ))}
    </span>
  );
};

/** Traffic-light live-status chip shared by Salon and Gym listing cards —
 *  always icon + text together, never color alone. */
export const SignalStatusChip: React.FC<{ color: SignalColor; label: string }> = ({ color, label }) => {
  const style = SIGNAL_STYLES[color];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${style.bg} ${style.text}`}>
      <SignalBars color={color} />
      {label}
    </span>
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
  /** Compact "Haircut · Beard · Grooming +2 more" summary. Salon only. */
  serviceSummary?: string;
  /** Primary live-data line, e.g. "Live queue: 2 people" or "Live Floor: 42 / 80". */
  liveLine1: string;
  /** Secondary live-data line, e.g. "Est. wait: 15 min" or "38 spaces available". */
  liveLine2: string;
  signalColor: SignalColor;
  signalLabel: string;
  /** "You'd be #3" — salon only, and only while there's an actual wait. */
  positionLabel?: string | null;
  onClick: () => void;
}> = ({ salon, theme, icon: IconComponent, isSelected, serviceSummary, liveLine1, liveLine2, signalColor, signalLabel, positionLabel, onClick }) => {
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
      <div className="flex items-start gap-3.5 p-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-md`}
        >
          <IconComponent className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <b className="min-w-0 flex-1 truncate text-[15px] font-bold text-white">
              {salon.name}
            </b>
            {isSelected && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${theme.badgeBg} ${theme.badgeText}`}>
                Last viewed
              </span>
            )}
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {salon.rating}
            </span>
            <span className="text-slate-600">•</span>
            <span>{salon.distanceKm} km</span>
            <span className="text-slate-600">•</span>
            <span className="truncate">{salon.area || salon.address}</span>
          </div>
          {serviceSummary && (
            <p className="mt-1.5 truncate text-[11px] text-slate-500">
              {serviceSummary}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-black/20 px-4 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[11px] font-bold text-white">
            <Clock className="h-3 w-3 shrink-0" style={{ color: theme.accent }} />
            {liveLine1}
          </p>
          <p className="truncate text-[10px] font-medium text-slate-400">{liveLine2}</p>
        </div>
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
