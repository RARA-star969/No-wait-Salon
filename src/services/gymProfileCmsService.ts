import type { GymAmenity, GymQuickAction } from '../types';

const getBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
function authHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('no_wait_salon_staff_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed. Please retry.');
  return data;
}

export interface GalleryMediaRow {
  id: string;
  url: string;
  caption: string;
  featured: number;
  sort_order: number;
}

export interface ReviewView {
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
  businessName?: string;
  originalReviewText?: string | null;
}

/** Owner-facing Manage Profile CMS (Phase 4) and Reviews (Phase 5) client. */
export const gymProfileCmsService = {
  saveProfile: (fields: Record<string, unknown>) =>
    request<{ ok: boolean; pending: boolean }>('/api/staff/business/profile', { method: 'PUT', body: JSON.stringify(fields) }),
  saveAmenities: (amenities: GymAmenity[]) =>
    request<{ ok: boolean; pending: boolean; amenities: GymAmenity[] }>('/api/staff/business/amenities', { method: 'PUT', body: JSON.stringify({ amenities }) }),
  saveQuickActions: (quickActions: GymQuickAction[]) =>
    request<{ ok: boolean; pending: boolean; quickActions: GymQuickAction[] }>('/api/staff/business/quick-actions', { method: 'PUT', body: JSON.stringify({ quickActions }) }),
  moderationStatus: () =>
    request<{ hold: boolean; pendingFields: string[]; submittedAt: number | null }>('/api/staff/business/moderation'),

  gallery: {
    list: () => request<{ gallery: GalleryMediaRow[] }>('/api/staff/business/gallery'),
    add: (url: string, caption?: string) =>
      request<{ ok: boolean; id: string }>('/api/staff/business/gallery', { method: 'POST', body: JSON.stringify({ url, caption }) }),
    remove: (mediaId: string) =>
      request<{ ok: boolean }>(`/api/staff/business/gallery/${encodeURIComponent(mediaId)}`, { method: 'DELETE' }),
    reorder: (orderedIds: string[]) =>
      request<{ ok: boolean }>('/api/staff/business/gallery/order', { method: 'PUT', body: JSON.stringify({ orderedIds }) }),
    setFeatured: (mediaId: string) =>
      request<{ ok: boolean }>(`/api/staff/business/gallery/${encodeURIComponent(mediaId)}/featured`, { method: 'PUT' }),
  },

  reviews: {
    dashboard: (sort: 'newest' | 'highest' | 'lowest' = 'newest') =>
      request<{ overallRating: number; totalReviews: number; distribution: Record<number, number>; reviews: ReviewView[] }>(
        `/api/staff/business/reviews?sort=${sort}`,
      ),
    reply: (reviewId: string, replyText: string) =>
      request<{ ok: boolean }>(`/api/staff/business/reviews/${encodeURIComponent(reviewId)}/reply`, { method: 'PUT', body: JSON.stringify({ replyText }) }),
  },
};
