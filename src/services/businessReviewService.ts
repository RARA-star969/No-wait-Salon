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

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return '';
  return 'http://127.0.0.1:3000';
};

function authHeaders(): Record<string, string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('no_wait_salon_customer_auth_v1') : null;
    const token = raw ? JSON.parse(raw)?.token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed. Please retry.');
  return data;
}

export const businessReviewService = {
  list: (businessId: string) =>
    request<PublicReviewsResponse>(`/api/business/${encodeURIComponent(businessId)}/reviews`),
  submit: (businessId: string, rating: number, reviewText: string) =>
    request<{ ok: boolean; review: PublicReviewView }>(`/api/business/${encodeURIComponent(businessId)}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, reviewText }),
    }),
};
