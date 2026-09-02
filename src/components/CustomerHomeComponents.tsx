import React from 'react';
import { Mic, Search, Sparkles, UserRound, WalletCards, Scissors, Dumbbell, ShoppingBag, Car, Dog, Building2, Utensils, Store, X, Volume2, ChevronLeft, SlidersHorizontal } from 'lucide-react';

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
};

export const CATEGORY_THEME_MAP: Record<string, CategoryTheme> = {
  salon: {
    key: 'salon',
    primary: '#0F766E',
    accent: '#2DD4BF',
    gradientFrom: 'from-[#0F766E]',
    gradientTo: 'to-[#115E59]',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-800',
    joinedBg: 'bg-[#F4F9F8]',
    bannerGradient: 'from-[#DFF1EE] via-[#EFF8F6] to-[#F7F2E9]',
  },
  gym: {
    key: 'gym',
    primary: '#D97706',
    accent: '#F59E0B',
    gradientFrom: 'from-[#D97706]',
    gradientTo: 'to-[#B45309]',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    joinedBg: 'bg-[#FFFBEB]',
    bannerGradient: 'from-[#FDE68A] via-[#FEF3C7] to-[#FFFBEB]',
  },
  shop: {
    key: 'shop',
    primary: '#7C3AED',
    accent: '#8B5CF6',
    gradientFrom: 'from-[#7C3AED]',
    gradientTo: 'to-[#6D28D9]',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    joinedBg: 'bg-[#F5F3FF]',
    bannerGradient: 'from-[#DDD6FE] via-[#EDE9FE] to-[#F5F3FF]',
  },
  moto: {
    key: 'moto',
    primary: '#DC2626',
    accent: '#EF4444',
    gradientFrom: 'from-[#DC2626]',
    gradientTo: 'to-[#B91C1C]',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
    joinedBg: 'bg-[#FEF2F2]',
    bannerGradient: 'from-[#FCA5A5] via-[#FEE2E2] to-[#FEF2F2]',
  },
  pets: {
    key: 'pets',
    primary: '#059669',
    accent: '#10B981',
    gradientFrom: 'from-[#059669]',
    gradientTo: 'to-[#047857]',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    joinedBg: 'bg-[#ECFDF5]',
    bannerGradient: 'from-[#A7F3D0] via-[#D1FAE5] to-[#ECFDF5]',
  },
  mall: {
    key: 'mall',
    primary: '#2563EB',
    accent: '#3B82F6',
    gradientFrom: 'from-[#2563EB]',
    gradientTo: 'to-[#1D4ED8]',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    joinedBg: 'bg-[#EFF6FF]',
    bannerGradient: 'from-[#BFDBFE] via-[#DBEAFE] to-[#EFF6FF]',
  },
  food: {
    key: 'food',
    primary: '#EA580C',
    accent: '#F97316',
    gradientFrom: 'from-[#EA580C]',
    gradientTo: 'to-[#C2410C]',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-800',
    joinedBg: 'bg-[#FFF7ED]',
    bannerGradient: 'from-[#FDBA74] via-[#FFEDD5] to-[#FFF7ED]',
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
      <div className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-white px-4 shadow-sm transition-all duration-200 ${
        isListening
          ? 'border-red-500 ring-2 ring-red-100 shadow-md shadow-red-500/10'
          : 'border-slate-200/90 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100'
      }`}>
        <Search className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type="search"
          enterKeyHint="search"
          aria-label="Search businesses"
          placeholder={placeholderText}
          className="h-14 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
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
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {isListening && (
            <span className="absolute inset-0 rounded-xl bg-red-400 opacity-75 animate-ping" />
          )}
          <Mic className={`relative h-4.5 w-4.5 ${isListening ? 'animate-bounce' : ''}`} />
        </button>
      </div>

      {voiceFeedback && (
        <div className={`flex items-center justify-between gap-3 rounded-xl p-3 text-xs font-bold transition-all animate-in fade-in duration-200 ${
          isListening
            ? 'bg-red-50 text-red-700 border border-red-200'
            : voiceFeedback.includes('Heard')
              ? 'bg-teal-50 text-teal-800 border border-teal-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}>
          <div className="flex items-center gap-2">
            {isListening ? (
              <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0 text-teal-700" />
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

export const PromotionalBanner: React.FC<{ category?: CategoryItemConfig; imageSrc?: string }> = ({ category, imageSrc }) => {
  const theme = CATEGORY_THEME_MAP[category?.themeKey || category?.id || 'salon'] || CATEGORY_THEME_MAP.salon;
  const headline = category?.bannerHeadline || 'Better grooming, less waiting.';
  const subheadline = category?.bannerSubheadline || 'Discover trusted businesses and reserve your place before leaving home.';
  const ctaText = category?.bannerCtaText || `Explore ${category?.name || 'Chairs'}`;
  const IconComponent = getCategoryIcon(category?.iconName || 'Scissors');

  return (
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.bannerGradient} p-5 shadow-sm sm:p-6 transition-all duration-300`}>
      {imageSrc ? (
        <img src={imageSrc} alt="Featured offer" className="h-full w-full object-cover" />
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div className="max-w-[72%]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-800 shadow-xs">
              <Sparkles className="h-3 w-3 text-amber-500" /> Featured {category?.name || 'Category'}
            </span>
            <h2 className="mt-3 text-lg font-black leading-tight tracking-[-0.025em] text-slate-900 sm:text-xl">
              {headline}
            </h2>
            <p className="mt-1 text-[11px] leading-4 font-medium text-slate-600">{subheadline}</p>
            <div className="mt-3">
              <span className={`inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-slate-900 shadow-xs`}>
                {ctaText} →
              </span>
            </div>
          </div>
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-lg sm:h-24 sm:w-24`}>
            <IconComponent className="h-10 w-10" />
          </div>
        </div>
      )}
    </section>
  );
};

export type CategoryBannerItem = {
  id: string;
  imageUrl?: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
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
  /** Admin-controlled carousel shown at the top of the category page. Falls back to the single hero banner fields above when empty. */
  banners?: CategoryBannerItem[];
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

export const DEFAULT_MAIN_CATEGORIES: CategoryItemConfig[] = [
  { id: 'salon', name: 'Salon', iconName: 'Scissors', label: 'Salons', description: 'Live Salons & Barbershops', themeKey: 'salon' },
  { id: 'gym', name: 'Gym', iconName: 'Dumbbell', label: 'Gym', description: 'Fitness Centers & Gyms', themeKey: 'gym' },
  { id: 'shop', name: 'Shop', iconName: 'ShoppingBag', label: 'Shop', description: 'Retail Stores & Boutiques', themeKey: 'shop' },
  { id: 'moto', name: 'Moto', iconName: 'Car', label: 'Moto', description: 'Auto Care & Detailing', themeKey: 'moto' },
  { id: 'pets', name: 'Pets', iconName: 'Dog', label: 'Pets', description: 'Pet Grooming & Spa', themeKey: 'pets' },
  { id: 'mall', name: 'Mall', iconName: 'Building2', label: 'Mall', description: 'Shopping Malls & Outlets', themeKey: 'mall' },
  { id: 'food', name: 'Food', iconName: 'Utensils', label: 'Food', description: 'Restaurants & Dining', themeKey: 'food' },
];

/**
 * Admin-controlled promotional carousel shown at the top of every category page.
 * Reads `category.banners`; falls back to the single hero-banner fields so
 * categories without a configured carousel keep showing the existing banner.
 */
export const BannerCarousel: React.FC<{ category?: CategoryItemConfig; autoPlayMs?: number }> = ({ category, autoPlayMs = 5000 }) => {
  const fallbackSlide: CategoryBannerItem = {
    id: 'fallback',
    headline: category?.bannerHeadline || 'Better grooming, less waiting.',
    subheadline: category?.bannerSubheadline || 'Discover trusted businesses and reserve your place before leaving home.',
    ctaText: category?.bannerCtaText || `Explore ${category?.name || 'Chairs'}`,
    imageUrl: category?.bannerImageUrl,
  };
  const slides = category?.banners?.length ? category.banners : [fallbackSlide];
  const theme = CATEGORY_THEME_MAP[category?.themeKey || category?.id || 'salon'] || CATEGORY_THEME_MAP.salon;
  const IconComponent = getCategoryIcon(category?.iconName || 'Scissors');
  const [index, setIndex] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);

  React.useEffect(() => {
    setIndex(0);
  }, [category?.id]);

  React.useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % slides.length), autoPlayMs);
    return () => clearInterval(timer);
  }, [slides.length, autoPlayMs]);

  const goTo = (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length);

  return (
    <section
      className="relative"
      onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        if (delta > 40) goTo(index - 1);
        else if (delta < -40) goTo(index + 1);
        touchStartX.current = null;
      }}
    >
      {slides.map((slide, slideIndex) => (
        <div
          key={slide.id}
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.bannerGradient} p-5 shadow-sm sm:p-6 transition-opacity duration-300 ${
            slideIndex === index ? 'block opacity-100' : 'hidden opacity-0'
          }`}
        >
          {slide.imageUrl ? (
            <img src={slide.imageUrl} alt={slide.headline || 'Featured offer'} className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="max-w-[72%]">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-800 shadow-xs">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Featured {category?.name || 'Category'}
                </span>
                <h2 className="mt-3 text-lg font-black leading-tight tracking-[-0.025em] text-slate-900 sm:text-xl">
                  {slide.headline}
                </h2>
                <p className="mt-1 text-[11px] leading-4 font-medium text-slate-600">{slide.subheadline}</p>
                {slide.ctaText && (
                  <div className="mt-3">
                    <span className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-slate-900 shadow-xs">
                      {slide.ctaText} →
                    </span>
                  </div>
                )}
              </div>
              <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-lg sm:h-24 sm:w-24`}>
                <IconComponent className="h-10 w-10" />
              </div>
            </div>
          )}
        </div>
      ))}

      {slides.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {slides.map((slide, dotIndex) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Show promotion ${dotIndex + 1}`}
              onClick={() => goTo(dotIndex)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                dotIndex === index ? 'w-5 bg-[#0F766E]' : 'w-1.5 bg-slate-300'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

/**
 * Shared header for every category page: back chevron + category title/subtitle.
 * Kept identical across categories so the top structure stays reusable.
 */
export const CategoryPageHeader: React.FC<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
}> = ({ title, subtitle, onBack }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex items-start gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-teal-300 hover:text-teal-700 active:scale-[0.96]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0">
        <h1 className="text-[28px] font-black leading-tight tracking-[-0.02em] text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm font-medium text-slate-500">{subtitle}</p>}
      </div>
    </div>
  </div>
);

export type SalonAudience = 'men' | 'women';

/**
 * Salon-only Men/Women segmented switch. Premium, light, NOQ blue-accented,
 * matching the reference top-of-category design. Drives salon discovery/filtering.
 */
export const SalonAudienceSwitch: React.FC<{
  value: SalonAudience;
  onChange: (value: SalonAudience) => void;
}> = ({ value, onChange }) => {
  const options: Array<{ id: SalonAudience; label: string; sublabel: string; Icon: React.FC<{ className?: string }> }> = [
    { id: 'men', label: 'Men', sublabel: 'Barbershops', Icon: (props) => <UserRound {...props} /> },
    { id: 'women', label: 'Women', sublabel: 'Parlours & Salons', Icon: (props) => <UserRound {...props} /> },
  ];

  return (
    <div className="relative flex w-full items-stretch rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
      {options.map((option, optionIndex) => {
        const isSelected = value === option.id;
        return (
          <React.Fragment key={option.id}>
            <button
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={isSelected}
              className={`relative flex flex-1 items-center justify-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 active:scale-[0.98] ${
                isSelected ? 'bg-blue-50 shadow-[inset_0_0_0_1.5px_rgba(37,99,235,0.35)]' : 'bg-transparent hover:bg-slate-50'
              }`}
            >
              <option.Icon className={`h-6 w-6 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="flex flex-col items-start leading-tight">
                <span className={`text-[15px] font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{option.label}</span>
                <span className={`text-[11px] font-medium ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>{option.sublabel}</span>
              </span>
            </button>
            {optionIndex === 0 && <span className="my-2 w-px shrink-0 bg-slate-200" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/**
 * Search row shown below category-specific controls. Reusable across all
 * categories; the placeholder is passed in so Salon can vary it by audience.
 */
export const CategorySearchRow: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onFilterClick?: () => void;
  isFilterActive?: boolean;
  isListening?: boolean;
  onVoiceSearch?: () => void;
  voiceFeedback?: string | null;
}> = ({ value, onChange, placeholder, onFilterClick, isFilterActive, isListening = false, onVoiceSearch, voiceFeedback }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2.5">
      <div className={`flex h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border bg-white px-4 shadow-sm transition-all duration-200 ${
        isListening
          ? 'border-red-500 ring-2 ring-red-100'
          : 'border-slate-200/90 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100'
      }`}>
        <Search className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type="search"
          enterKeyHint="search"
          aria-label="Search businesses"
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {onVoiceSearch && (
          <button
            type="button"
            onClick={onVoiceSearch}
            aria-label={isListening ? 'Stop listening' : 'Start voice search'}
            className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 active:scale-95 ${
              isListening ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isListening && <span className="absolute inset-0 rounded-lg bg-red-400 opacity-75 animate-ping" />}
            <Mic className={`relative h-4 w-4 ${isListening ? 'animate-bounce' : ''}`} />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onFilterClick}
        aria-label="Filter results"
        aria-pressed={isFilterActive}
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition active:scale-[0.96] ${
          isFilterActive
            ? 'border-blue-300 bg-blue-50 text-blue-600'
            : 'border-slate-200/90 bg-white text-blue-600 hover:border-blue-300'
        }`}
      >
        <SlidersHorizontal className="h-5 w-5" />
      </button>
    </div>

    {voiceFeedback && (
      <div className={`flex items-center justify-between gap-3 rounded-xl p-3 text-xs font-bold transition-all animate-in fade-in duration-200 ${
        isListening
          ? 'bg-red-50 text-red-700 border border-red-200'
          : voiceFeedback.includes('Heard')
            ? 'bg-blue-50 text-blue-800 border border-blue-200'
            : 'bg-amber-50 text-amber-800 border border-amber-200'
      }`}>
        <div className="flex items-center gap-2">
          {isListening ? (
            <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
          ) : (
            <Volume2 className="h-4 w-4 shrink-0 text-blue-700" />
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
        className="relative -mx-4 px-4 py-2 scrollbar-none overflow-x-auto flex items-end gap-2.5 touch-pan-x sm:-mx-5 sm:px-5"
      >
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          const theme = CATEGORY_THEME_MAP[cat.themeKey || cat.id] || CATEGORY_THEME_MAP.salon;
          const IconComponent = getCategoryIcon(cat.iconName);

          return (
            <button
              key={cat.id}
              type="button"
              onClick={(e) => handleSelect(cat.id, e.currentTarget)}
              className={`group relative flex min-w-[88px] sm:min-w-[98px] shrink-0 flex-col items-center justify-between rounded-t-2xl border-t border-x px-3 pb-3 pt-3.5 text-center transition-all duration-300 active:scale-[0.96] ${
                isSelected
                  ? `z-10 border-slate-200 bg-white text-slate-900 shadow-lg shadow-slate-900/10 -mb-[1px] rounded-b-none`
                  : `border-transparent bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 opacity-80 scale-95`
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300 ${
                  isSelected
                    ? `bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} text-white shadow-md scale-110`
                    : 'bg-white text-slate-700 shadow-sm group-hover:scale-105'
                }`}
              >
                <IconComponent className="h-5 w-5" />
              </div>
              <span
                className={`mt-2.5 block text-[12px] font-extrabold tracking-tight transition-colors ${
                  isSelected ? 'text-slate-900 font-black' : 'text-slate-600'
                }`}
              >
                {cat.name}
              </span>
              {cat.businessCount !== undefined && cat.businessCount > 0 && (
                <span
                  className={`absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${
                    isSelected ? `${theme.badgeBg} ${theme.badgeText}` : 'bg-white text-slate-600 shadow-xs'
                  }`}
                >
                  {cat.businessCount}
                </span>
              )}
              {isSelected && (
                <span
                  className="absolute -bottom-1 left-0 right-0 h-1.5 bg-white"
                />
              )}
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
  const IconComponent = getCategoryIcon(category.iconName);
  const [notified, setNotified] = React.useState(false);

  return (
    <section className="mt-4 rounded-3xl border border-teal-100/80 bg-gradient-to-b from-white via-teal-50/20 to-slate-50/40 p-6 text-center shadow-xl shadow-teal-900/5">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-lg shadow-teal-700/30">
        <IconComponent className="h-8 w-8" />
      </div>

      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800">
        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
        <span>EXPANDING TO {category.name.toUpperCase()}</span>
      </div>

      <h3 className="mt-3 text-xl font-black text-slate-900">
        {category.name} Services Coming Soon
      </h3>

      <p className="mt-2 text-xs leading-relaxed text-slate-600 max-w-sm mx-auto">
        {category.description || `We are onboarding premier ${category.name.toLowerCase()} businesses and service providers near Indiranagar, Bengaluru.`}
      </p>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => setNotified(!notified)}
          className={`h-11 rounded-xl px-5 text-xs font-bold transition active:scale-[0.98] ${
            notified
              ? 'bg-emerald-600 text-white'
              : 'bg-teal-700 text-white hover:bg-teal-800 shadow-md shadow-teal-800/20'
          }`}
        >
          {notified ? '✓ You will be notified' : `Notify Me When ${category.name} Launches`}
        </button>

        <button
          type="button"
          onClick={onExploreSalons}
          className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-xs font-bold text-slate-700 hover:border-teal-400 hover:bg-teal-50/50 transition active:scale-[0.98]"
        >
          Explore Live Salons
        </button>
      </div>
    </section>
  );
};
