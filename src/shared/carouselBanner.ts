/**
 * Pure, DB-agnostic helpers for the admin-driven Home carousel. The server
 * and the customer UI both import these so "what counts as an enabled
 * banner", "how is it ordered" and "how do we parse a YouTube URL" are
 * defined exactly once and are trivially unit-testable without a database.
 */

export type CarouselBannerType = 'image' | 'youtube';

/** Shape returned by the public/admin API for one banner row. */
export interface CarouselBannerRecord {
  id: string;
  type: CarouselBannerType;
  enabled: boolean;
  order: number;
  title?: string | null;
  subtitle?: string | null;
  /** `image` banners: the image to render. */
  imageUrl?: string | null;
  ctaLabel?: string | null;
  /** Destination for the CTA (image banners) or the banner tap itself. */
  ctaLink?: string | null;
  /** `youtube` banners: the raw admin-entered URL or bare video id. */
  youtubeUrl?: string | null;
  /** Where this banner is allowed to appear: 'home', 'category' (every
   *  category page), or one specific main_category_id. The public API
   *  already filters by this server-side — the client never has to. */
  placement?: string | null;
}

/** Fully resolved props a `<CustomerHomeCarousel>` slide can render directly. */
export interface CarouselSlideRenderProps {
  id: string;
  type: CarouselBannerType;
  title: string;
  subtitle: string;
  /** Image to paint: the admin image URL, or the YouTube thumbnail. */
  imageUrl: string;
  ctaLabel: string;
  ctaLink: string;
  /** Only set (and only meaningful) for `type: 'youtube'`. */
  youtubeId: string | null;
}

/** A bare 11-char YouTube video id (the id alone is a valid admin input). */
const BARE_YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts a YouTube video id from any of the common URL shapes admins might
 * paste in, or accepts a bare 11-character id directly. Returns null for
 * anything unrecognized rather than guessing.
 */
export function parseYouTubeId(input: string | null | undefined): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (BARE_YOUTUBE_ID_RE.test(raw)) return raw;

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && BARE_YOUTUBE_ID_RE.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host.endsWith('.youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && BARE_YOUTUBE_ID_RE.test(v)) return v;
      const segments = url.pathname.split('/').filter(Boolean);
      // /embed/<id>, /shorts/<id>, /live/<id>
      if (segments.length >= 2 && ['embed', 'shorts', 'live'].includes(segments[0])) {
        const id = segments[1];
        return BARE_YOUTUBE_ID_RE.test(id) ? id : null;
      }
    }
  } catch {
    // Not a well-formed URL — fall through to "unrecognized".
  }
  return null;
}

/** The thumbnail NOQ shows in place of an eagerly-mounted iframe player. */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Maps one raw banner record (as returned by the API, camelCase) into the
 * render-ready props a carousel slide needs — resolving the YouTube id and
 * thumbnail once here so the component never re-derives it per render.
 */
export function mapBannerToSlideProps(banner: CarouselBannerRecord): CarouselSlideRenderProps {
  const isYoutube = banner.type === 'youtube';
  const youtubeId = isYoutube ? parseYouTubeId(banner.youtubeUrl) : null;
  const imageUrl = isYoutube
    ? (youtubeId ? youtubeThumbnailUrl(youtubeId) : '')
    : String(banner.imageUrl || '');

  return {
    id: banner.id,
    type: banner.type,
    title: String(banner.title || ''),
    subtitle: String(banner.subtitle || ''),
    imageUrl,
    ctaLabel: String(banner.ctaLabel || ''),
    ctaLink: String(banner.ctaLink || ''),
    youtubeId,
  };
}

/**
 * The one place that decides which banners the customer app is allowed to
 * show, and in what order: enabled-only, sorted by admin-defined `order`
 * ascending, with `id` as a stable tiebreaker so equal orders don't jitter
 * between renders/fetches.
 */
export function selectActiveBanners<T extends { enabled: boolean; order: number; id: string }>(banners: T[]): T[] {
  return banners
    .filter((banner) => banner.enabled)
    .slice()
    .sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));
}
