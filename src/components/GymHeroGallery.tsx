import React, { useRef, useState } from 'react';
import type { SalonGalleryItem } from '../types';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop';

/**
 * Real gallery hero for Gym Detail — horizontally swipeable on mobile,
 * featured image first (server already sorts it), a page indicator only
 * once there is more than one image, and a safe single-image/no-image
 * fallback. Owner reorder (Manage Profile) changes `gallery`'s order,
 * which is exactly the order rendered here — one source of truth.
 */
export const GymHeroGallery: React.FC<{ gallery?: SalonGalleryItem[]; coverImageUrl?: string; name: string }> = ({ gallery, coverImageUrl, name }) => {
  const images = gallery && gallery.length ? gallery : [{ id: 'fallback', imageUrl: coverImageUrl || FALLBACK_COVER, label: name }];
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive(Math.max(0, Math.min(images.length - 1, index)));
  };

  return (
    <div className="relative h-48 w-full overflow-hidden bg-[#133330]">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((image) => (
          <img
            key={image.id}
            src={image.imageUrl}
            alt={image.label || name}
            className="h-full w-full shrink-0 snap-center object-cover opacity-60"
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D2422] via-transparent to-black/40" />
      {images.length > 1 && (
        <div className="pointer-events-none absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {images.map((image, index) => (
            <span
              key={image.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${index === active ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
