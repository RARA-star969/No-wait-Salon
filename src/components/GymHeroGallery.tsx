import React, { useRef, useState } from 'react';
import type { SalonGalleryItem } from '../types';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop';

/**
 * Real gallery hero for Gym Detail — horizontally swipeable on mobile,
 * mouse-draggable on desktop, featured image first (server already sorts
 * it), a page indicator only once there is more than one image (tappable
 * to jump straight to that image), and a safe single-image/no-image
 * fallback. Owner reorder (Manage Profile) changes `gallery`'s order,
 * which is exactly the order rendered here — one source of truth.
 */
export const GymHeroGallery: React.FC<{ gallery?: SalonGalleryItem[]; coverImageUrl?: string; name: string }> = ({ gallery, coverImageUrl, name }) => {
  const images = gallery && gallery.length ? gallery : [{ id: 'fallback', imageUrl: coverImageUrl || FALLBACK_COVER, label: name }];
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startScroll: number; dragging: boolean; moved: boolean } | null>(null);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive(Math.max(0, Math.min(images.length - 1, index)));
  };

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    setActive(index);
  };

  // Native touch swipe already works via scroll-snap; this adds mouse-drag
  // so the same carousel is draggable on desktop/owner preview too.
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse' || images.length < 2) return;
    const track = trackRef.current;
    if (!track) return;
    drag.current = { startX: event.clientX, startScroll: track.scrollLeft, dragging: true, moved: false };
    track.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    const track = trackRef.current;
    if (!state?.dragging || !track) return;
    const delta = event.clientX - state.startX;
    if (Math.abs(delta) > 3) state.moved = true;
    track.scrollLeft = state.startScroll - delta;
  };

  const endDrag = () => {
    const state = drag.current;
    const track = trackRef.current;
    if (state?.dragging && track && track.clientWidth > 0) {
      const index = Math.round(track.scrollLeft / track.clientWidth);
      goTo(Math.max(0, Math.min(images.length - 1, index)));
    }
    drag.current = null;
  };

  return (
    <div className="relative h-60 w-full overflow-hidden bg-[var(--noq-base)]">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className={`flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${images.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {images.map((image) => (
          <img
            key={image.id}
            src={image.imageUrl}
            alt={image.label || name}
            draggable={false}
            className="h-full w-full shrink-0 snap-center select-none object-cover"
          />
        ))}
      </div>
      {/* Light scrims only where needed for legibility — the header icons up
          top and the indicator dots at the bottom — never a flat dark wash
          over the whole photo. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[var(--noq-base)]/55 to-transparent" />
      {images.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Show photo ${index + 1} of ${images.length}`}
              onClick={() => goTo(index)}
              className="p-1"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${index === active ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
