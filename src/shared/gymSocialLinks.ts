import type { SocialPlatform, GymSocialLink, GymSocialLinkInput } from '../types';

export type { SocialPlatform, GymSocialLink, GymSocialLinkInput };

export const SOCIAL_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'youtube', 'twitter', 'website'];

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', twitter: 'X / Twitter', website: 'Website',
};

const PLATFORM_DOMAIN: Partial<Record<SocialPlatform, string>> = {
  instagram: 'instagram.com', facebook: 'facebook.com', youtube: 'youtube.com', twitter: 'x.com',
};

/** Kept as local aliases so the rest of this file reads the same as before. */
type SocialLinkInput = GymSocialLinkInput;
type SocialLinkView = GymSocialLink;

const isValidPlatform = (value: unknown): value is SocialPlatform =>
  typeof value === 'string' && (SOCIAL_PLATFORMS as string[]).includes(value);

/** Only http(s) may ever reach a stored/rendered link — rejects javascript:,
 *  data: and any other scheme outright rather than trying to sanitize them. */
function isSafeAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Turns a bare handle ("@ironhousegym") into the platform's real profile
 *  URL; a value already given as a full http(s) URL passes through
 *  unchanged (still validated). Returns null when nothing safe can be
 *  built from the input. */
export function buildSocialUrl(platform: SocialPlatform, rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return isSafeAbsoluteUrl(trimmed) ? trimmed : null;
  }
  const domain = PLATFORM_DOMAIN[platform];
  if (!domain) return null; // 'website' never builds from a handle
  const handle = trimmed.replace(/^@/, '').replace(/[^A-Za-z0-9._-]/g, '');
  if (!handle) return null;
  return `https://${domain}/${handle}`;
}

/** Validates and sanitizes an owner's Social & Links save payload. Website
 *  entries carry no `value` of their own (see module doc) so only their
 *  enabled/order are meaningful here. */
export function sanitizeSocialLinksInput(raw: unknown): SocialLinkInput[] {
  if (!Array.isArray(raw)) throw new Error('Social links must be a list.');
  const seenPlatforms = new Set<SocialPlatform>();
  return raw.map((entry, index) => {
    const candidate = (entry || {}) as Partial<SocialLinkInput>;
    if (!isValidPlatform(candidate.platform)) throw new Error(`Social link #${index + 1} has an unsupported platform.`);
    if (seenPlatforms.has(candidate.platform)) throw new Error(`Only one ${PLATFORM_LABEL[candidate.platform]} link is supported.`);
    seenPlatforms.add(candidate.platform);
    const enabled = candidate.enabled !== false;
    if (candidate.platform === 'website') {
      return { id: `social-website`, platform: 'website' as const, value: '', enabled, order: index };
    }
    const value = typeof candidate.value === 'string' ? candidate.value.trim().slice(0, 300) : '';
    if (value && !buildSocialUrl(candidate.platform, value)) {
      throw new Error(`${PLATFORM_LABEL[candidate.platform]} link isn't a valid handle or URL.`);
    }
    return {
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id.slice(0, 80) : `social-${candidate.platform}-${Date.now()}-${index}`,
      platform: candidate.platform,
      value,
      enabled,
      order: index,
    };
  });
}

/** Combines the stored social_links_json (Instagram/Facebook/YouTube/X)
 *  with the existing salon.website_url column into the final list the
 *  customer page renders — only enabled entries with a real resolvable
 *  URL ever come back, so the caller never has to re-check. Never
 *  duplicates website_url into a second stored value. */
export function normalizeSocialLinks(raw: unknown, websiteUrl: string | undefined | null): SocialLinkView[] {
  const list = Array.isArray(raw) ? raw : [];
  const views: SocialLinkView[] = [];
  let websiteEntry: { enabled: boolean; order: number } | undefined;

  list.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const candidate = entry as Partial<SocialLinkInput>;
    if (!isValidPlatform(candidate.platform)) return;
    const enabled = candidate.enabled !== false;
    const order = typeof candidate.order === 'number' ? candidate.order : index;
    if (candidate.platform === 'website') {
      websiteEntry = { enabled, order };
      return;
    }
    if (!enabled) return;
    const value = typeof candidate.value === 'string' ? candidate.value : '';
    const url = buildSocialUrl(candidate.platform, value);
    if (!url) return;
    views.push({ id: candidate.id || `social-${candidate.platform}`, platform: candidate.platform, label: PLATFORM_LABEL[candidate.platform], url, order });
  });

  const website = (websiteUrl || '').trim();
  if (website && (websiteEntry ? websiteEntry.enabled : true) && isSafeAbsoluteUrl(website)) {
    views.push({ id: 'social-website', platform: 'website', label: PLATFORM_LABEL.website, url: website, order: websiteEntry?.order ?? views.length });
  }

  return views.sort((a, b) => a.order - b.order);
}

/** For the owner's editor: every platform's current configured state
 *  (including disabled/unconfigured ones), so the UI can render a
 *  consistent row per platform rather than only the ones already saved. */
export function socialLinksForEditor(raw: unknown, websiteUrl: string | undefined | null): SocialLinkInput[] {
  const list = Array.isArray(raw) ? raw : [];
  const byPlatform = new Map<SocialPlatform, SocialLinkInput>();
  list.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const candidate = entry as Partial<SocialLinkInput>;
    if (!isValidPlatform(candidate.platform)) return;
    byPlatform.set(candidate.platform, {
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `social-${candidate.platform}`,
      platform: candidate.platform,
      value: candidate.platform === 'website' ? (websiteUrl || '') : (typeof candidate.value === 'string' ? candidate.value : ''),
      enabled: candidate.enabled !== false,
      order: typeof candidate.order === 'number' ? candidate.order : index,
    });
  });
  return SOCIAL_PLATFORMS.map((platform, index) => byPlatform.get(platform) || {
    id: `social-${platform}`,
    platform,
    value: platform === 'website' ? (websiteUrl || '') : '',
    enabled: true,
    order: index,
  }).sort((a, b) => a.order - b.order);
}

export function socialPlatformLabel(platform: SocialPlatform): string {
  return PLATFORM_LABEL[platform];
}
