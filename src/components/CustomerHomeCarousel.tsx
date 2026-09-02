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

const CarouselTrack: React.FC<{ slides: CarouselSlideRenderProps[]; ariaLabel: string }> = ({ slides, ariaLabel }) => {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

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

  if (!slides.length) return null;

  return (
    <section aria-label={ariaLabel} className="noq-home-carousel">
      <div
        ref={trackRef}
        onScroll={handleScroll}
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
              onClick={() => scrollToIndex(index)}
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
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
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
