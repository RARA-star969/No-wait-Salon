/** Public reviews client — shared by both Gym and Salon Detail pages so
 *  there is exactly one review-submission/read path for every category,
 *  never a per-category duplicate. */

export interface PublicReviewView {
  id: string;
  businessId: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  feedbackTags: string[];
  verifiedVisit: boolean;
  status: string;
  ownerReplyText: string | null;
  ownerReplyAt: number | null;
  editedByAdmin: boolean;
  editedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface PublicReviewsResponse {
  reviews: PublicReviewView[];
  overallRating: number;
  totalReviews: number;
}

// Same architecture every other API client in this app uses (see
// salonDiscoveryService, gymCustomerService, etc.) — resolved once at build
// time from the configured API host, never derived from a window presence
// check. This module used to branch on whether the global window object
// existed to decide the API base — that check is true inside the Android
// WebView too, so review requests silently hit the WebView's own local
// origin instead of the configured backend, got the app's own index.html
// back as a 200 response (SPA-style fallback), and produced an
// empty/undefined-shaped "review" object with no fetch-level error to catch.
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

function authHeaders(): Record<string, string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('no_wait_salon_customer_auth_v1') : null;
    const token = raw ? JSON.parse(raw)?.token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** A finite number, or `fallback` for anything else (undefined, null, NaN,
 *  a string, Infinity) — the one place "is this safe to call .toFixed() on"
 *  gets decided, so no component has to re-derive it. */
function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Never lets a malformed, empty, or wrong-shaped response (a non-JSON body
 *  parsed to `{}`, a proxy/error page, a future API change) reach the UI as
 *  if it were a valid PublicReviewsResponse. Every field is defensively
 *  normalized here, once, rather than trusted by every caller. */
export function normalizePublicReviewsResponse(body: unknown): PublicReviewsResponse {
  const raw = (body && typeof body === 'object' ? body : {}) as Partial<PublicReviewsResponse>;
  return {
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
    overallRating: finiteNumberOr(raw.overallRating, 0),
    totalReviews: Math.max(0, Math.trunc(finiteNumberOr(raw.totalReviews, 0))),
  };
}

/** The one place RatingSummaryBadge and PublicReviewsSection both decide
 *  whether a rating is safe to display — never called with a non-finite
 *  overallRating, never for a zero-review business (which has nothing real
 *  to average). Returns null when there is nothing displayable, so a caller
 *  never has to call .toFixed() itself. */
export function formatOverallRating(overallRating: unknown, totalReviews: unknown): string | null {
  const rating = typeof overallRating === 'number' ? overallRating : NaN;
  const count = typeof totalReviews === 'number' ? totalReviews : NaN;
  if (!Number.isFinite(rating) || !Number.isFinite(count) || count <= 0) return null;
  return rating.toFixed(1);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed. Please retry.');
  return data;
}

export const businessReviewService = {
  list: async (businessId: string): Promise<PublicReviewsResponse> => {
    const body = await request<unknown>(`/api/business/${encodeURIComponent(businessId)}/reviews`);
    return normalizePublicReviewsResponse(body);
  },
  submit: (businessId: string, rating: number, reviewText: string) =>
    request<{ ok: boolean; review: PublicReviewView }>(`/api/business/${encodeURIComponent(businessId)}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, reviewText }),
    }),
};
