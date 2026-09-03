import React from 'react';
import { ChevronRight, Play } from 'lucide-react';
import {
  mapBannerToSlideProps,
  selectActiveBanners,
  type CarouselBannerRecord,
  type CarouselSlideRenderProps,
} from '../shared/carouselBanner';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/** Shared fetch-and-render behind both the Home and category-page carousels:
 *  fetch banners from `endpoint`, sort/filter with the one shared selector,
 *  and render nothing while empty/loading/failed so neither surface ever
 *  regresses when there is no admin content configured yet. */
function useCarouselSlides(endpoint: string): CarouselSlideRenderProps[] {
  const [banners, setBanners] = React.useState<CarouselBannerRecord[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setBanners(null);
    fetch(`${API_BASE}${endpoint}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.banners)) setBanners(data.banners);
      })
      .catch(() => { if (!cancelled) setBanners([]); });
    return () => { cancelled = true; };
  }, [endpoint]);

  return React.useMemo<CarouselSlideRenderProps[]>(
    () => selectActiveBanners(banners || []).map(mapBannerToSlideProps),
    [banners],
  );
}

/**
 * Admin-driven Home carousel. Fetches only enabled 'home'-placement banners,
 * in the order the admin set, from the server — no banner content is ever
 * hardcoded in the customer bundle.
 */
export const CustomerHomeCarousel: React.FC = () => {
  const slides = useCarouselSlides('/api/carousel-banners');
  return <CarouselTrack slides={slides} ariaLabel="Featured" />;
};

/**
 * Admin-driven category-page carousel. Reuses the exact same track/slide
 * rendering as Home; only the fetch endpoint (and therefore the placement
 * scope resolved server-side) differs. Shows banners placed on 'category'
 * (every category page) plus any placed on this specific categoryId.
 */
export const CustomerCategoryCarousel: React.FC<{ categoryId: string }> = ({ categoryId }) => {
  const slides = useCarouselSlides(`/api/carousel-banners/category/${encodeURIComponent(categoryId)}`);
  return <CarouselTrack slides={slides} ariaLabel={`Featured on ${categoryId}`} />;
};

/** Milliseconds between auto-advance steps once 2+ banners are active. */
const AUTO_ADVANCE_INTERVAL_MS = 3000;

const CarouselTrack: React.FC<{ slides: CarouselSlideRenderProps[]; ariaLabel: string }> = ({ slides, ariaLabel }) => {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const autoAdvanceTimerRef = React.useRef<number | null>(null);

  const prefersReducedMotion = React.useMemo(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const handleScroll = React.useCallback(() => {
    const el = trackRef.current;
    if (!el || slides.length === 0) return;
    const slideWidth = el.scrollWidth / slides.length;
    if (!slideWidth) return;
    const index = Math.round(el.scrollLeft / slideWidth);
    setActiveIndex(Math.min(slides.length - 1, Math.max(0, index)));
  }, [slides.length]);

  const scrollToIndex = React.useCallback((index: number) => {
    const el = trackRef.current;
    if (!el) return;
    const slideWidth = el.scrollWidth / Math.max(1, slides.length);
    el.scrollTo({ left: slideWidth * index, behavior: 'smooth' });
  }, [slides.length]);

  const clearAutoAdvance = React.useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  // Auto-advance only ever runs with 2+ active banners, pauses the instant a
  // YouTube slide starts playing (never fights active video playback), and
  // is skipped entirely under prefers-reduced-motion. Restarting (rather
  // than merely clearing) whenever slides/playback state change means a
  // manual swipe or dot tap — both of which call this via scrollToIndex —
  // gets a fresh 3s window instead of firing on stale timing.
  const restartAutoAdvance = React.useCallback(() => {
    clearAutoAdvance();
    if (slides.length < 2 || playingId || prefersReducedMotion) return;
    autoAdvanceTimerRef.current = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % slides.length;
        scrollToIndex(next);
        return next;
      });
    }, AUTO_ADVANCE_INTERVAL_MS);
  }, [clearAutoAdvance, slides.length, playingId, prefersReducedMotion, scrollToIndex]);

  React.useEffect(() => {
    restartAutoAdvance();
    return clearAutoAdvance;
  }, [restartAutoAdvance, clearAutoAdvance]);

  const handleManualNavigate = React.useCallback((index: number) => {
    scrollToIndex(index);
    restartAutoAdvance();
  }, [scrollToIndex, restartAutoAdvance]);

  if (!slides.length) return null;

  return (
    <section aria-label={ariaLabel} className="noq-home-carousel">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={restartAutoAdvance}
        className="noq-home-carousel-track flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide) => (
          <CarouselSlide
            key={slide.id}
            slide={slide}
            isPlaying={playingId === slide.id}
            onPlay={() => setPlayingId(slide.id)}
          />
        ))}
      </div>
      {slides.length > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5" role="tablist" aria-label="Featured banners">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Show banner ${index + 1} of ${slides.length}`}
              onClick={() => handleManualNavigate(index)}
              className={`noq-carousel-dot h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex ? 'w-5 bg-[var(--noq-accent)]' : 'w-1.5 bg-[color-mix(in_srgb,var(--noq-ink)_18%,transparent)]'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

/**
 * The two admin-managed promo boxes below the main Home carousel. Each is
 * its own independently-fetched, independently-rotating banner set (never
 * mixed with the main carousel's 'home' placement or with each other), shown
 * side by side on Home so the page reads as one calm row instead of stacked
 * full-width carousels. Deliberately duplicates CarouselTrack's auto-advance
 * logic (via PromoBoxTrack below) rather than adding an interval prop to the
 * already-tested main CarouselTrack, so the existing Home/category carousel
 * behavior stays byte-for-byte the same.
 *
 * Renders the row of one or two promo boxes; skips a box with no active
 *  banners instead of leaving a hollow slot, and never renders an empty row. */
export const CustomerHomePromoBoxRow: React.FC = () => {
  const slides1 = useCarouselSlides('/api/carousel-banners/home-promo-1');
  const slides2 = useCarouselSlides('/api/carousel-banners/home-promo-2');
  if (!slides1.length && !slides2.length) return null;

  const bothPresent = slides1.length > 0 && slides2.length > 0;

  return (
    <div className={bothPresent ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1'}>
      {slides1.length > 0 && <PromoBoxTrack slides={slides1} ariaLabel="Promo" intervalMs={PROMO_BOX_1_INTERVAL_MS} />}
      {slides2.length > 0 && <PromoBoxTrack slides={slides2} ariaLabel="Promo" intervalMs={PROMO_BOX_2_INTERVAL_MS} />}
    </div>
  );
};

/** Milliseconds between auto-advance steps for Promo Box 1. */
const PROMO_BOX_1_INTERVAL_MS = 5000;
/** Milliseconds between auto-advance steps for Promo Box 2. */
const PROMO_BOX_2_INTERVAL_MS = 7000;

/** Same behavior as CarouselTrack (auto-advance while 2+ active slides,
 *  pauses on active video playback, respects prefers-reduced-motion, manual
 *  swipe/dot navigation restarts the timer, cleans up on unmount) but with a
 *  configurable interval so each promo box can rotate on its own cadence. */
const PromoBoxTrack: React.FC<{ slides: CarouselSlideRenderProps[]; ariaLabel: string; intervalMs: number }> = ({ slides, ariaLabel, intervalMs }) => {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const autoAdvanceTimerRef = React.useRef<number | null>(null);

  const prefersReducedMotion = React.useMemo(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const handleScroll = React.useCallback(() => {
    const el = trackRef.current;
    if (!el || slides.length === 0) return;
    const slideWidth = el.scrollWidth / slides.length;
    if (!slideWidth) return;
    const index = Math.round(el.scrollLeft / slideWidth);
    setActiveIndex(Math.min(slides.length - 1, Math.max(0, index)));
  }, [slides.length]);

  const scrollToIndex = React.useCallback((index: number) => {
    const el = trackRef.current;
    if (!el) return;
    const slideWidth = el.scrollWidth / Math.max(1, slides.length);
    el.scrollTo({ left: slideWidth * index, behavior: 'smooth' });
  }, [slides.length]);

  const clearAutoAdvance = React.useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const restartAutoAdvance = React.useCallback(() => {
    clearAutoAdvance();
    if (slides.length < 2 || playingId || prefersReducedMotion) return;
    autoAdvanceTimerRef.current = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % slides.length;
        scrollToIndex(next);
        return next;
      });
    }, intervalMs);
  }, [clearAutoAdvance, slides.length, playingId, prefersReducedMotion, scrollToIndex, intervalMs]);

  React.useEffect(() => {
    restartAutoAdvance();
    return clearAutoAdvance;
  }, [restartAutoAdvance, clearAutoAdvance]);

  const handleManualNavigate = React.useCallback((index: number) => {
    scrollToIndex(index);
    restartAutoAdvance();
  }, [scrollToIndex, restartAutoAdvance]);

  if (!slides.length) return null;

  return (
    <section aria-label={ariaLabel} className="noq-home-promo-box">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={restartAutoAdvance}
        className="noq-home-carousel-track flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide) => (
          <CarouselSlide
            key={slide.id}
            slide={slide}
            isPlaying={playingId === slide.id}
            onPlay={() => setPlayingId(slide.id)}
          />
        ))}
      </div>
      {slides.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5" role="tablist" aria-label={`${ariaLabel} banners`}>
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Show banner ${index + 1} of ${slides.length}`}
              onClick={() => handleManualNavigate(index)}
              className={`noq-carousel-dot h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex ? 'w-5 bg-[var(--noq-accent)]' : 'w-1.5 bg-[color-mix(in_srgb,var(--noq-ink)_18%,transparent)]'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

const CarouselSlide: React.FC<{
  slide: CarouselSlideRenderProps;
  isPlaying: boolean;
  onPlay: () => void;
}> = ({ slide, isPlaying, onPlay }) => {
  const isYoutube = slide.type === 'youtube' && slide.youtubeId;

  const body = (
    <div className="noq-home-carousel-card relative h-[132px] w-full shrink-0 snap-center overflow-hidden rounded-[20px] border">
      {isYoutube && isPlaying ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube.com/embed/${slide.youtubeId}?autoplay=1&playsinline=1`}
          title={slide.title || 'Featured video'}
          allow="accelerate-compute; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <>
          {slide.imageUrl ? (
            <img src={slide.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#eef1ff,#dfe6ff)]" />
          )}
          {/* Netflix-style readability overlay: a contextual dark gradient
              that is strongest right behind the title/subtitle and fades to
              fully transparent toward the top, so bright/colorful thumbnails
              stay visible instead of sitting under a flat black blanket.
              Only painted when there is actual text to protect. */}
          {(slide.title || slide.subtitle) && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.32) 66%, rgba(0,0,0,0.82) 100%)' }}
            />
          )}
          {isYoutube && (
            <button
              type="button"
              onClick={onPlay}
              aria-label={`Play video${slide.title ? `: ${slide.title}` : ''}`}
              className="absolute inset-0 grid place-items-center"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/92 text-[var(--noq-accent)] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)] backdrop-blur transition active:scale-95">
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </span>
            </button>
          )}
          {(slide.title || slide.subtitle) && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3.5">
              {slide.title && <b className="block truncate text-[13px] font-bold leading-tight text-white">{slide.title}</b>}
              {slide.subtitle && <span className="mt-0.5 block truncate text-[10px] font-medium text-white/80">{slide.subtitle}</span>}
            </div>
          )}
          {!isYoutube && slide.ctaLabel && (
            <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[9px] font-black text-[var(--noq-accent)] shadow-sm">
              {slide.ctaLabel} <ChevronRight className="h-2.5 w-2.5" />
            </span>
          )}
        </>
      )}
    </div>
  );

  if (!isYoutube && slide.ctaLink) {
    return (
      <a href={slide.ctaLink} target="_blank" rel="noreferrer" className="block w-full shrink-0 snap-center">
        {body}
      </a>
    );
  }

  return <div className="w-full shrink-0 snap-center">{body}</div>;
};
