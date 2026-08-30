/**
 * Business/staff-side client for customer-directed notifications.
 *
 * Authorization is entirely server-side: this client only names a target and
 * a message. The server proves the staff session owns the business, proves
 * the customer is genuinely linked to it, and (for review requests) proves
 * the visit really completed and has not already been asked or reviewed.
 */

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

function staffAuthHeaders(): Record<string, string> {
  try {
    // Same key StaffAppShell writes on login — one staff session, one token.
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('no_wait_salon_staff_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...staffAuthHeaders(), ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error((body as { error?: string }).error || 'Request failed. Please retry.');
    (error as Error & { code?: string }).code = (body as { code?: string }).code;
    throw error;
  }
  return body as T;
}

export const businessNotificationService = {
  /**
   * Asks one customer to rate a specific completed visit. The wording is
   * authored server-side and is rating-neutral — a business cannot phrase the
   * ask to favour positive reviews, and cannot fire it twice for one visit.
   */
  requestReview: (queueEntryId: string) =>
    request<{ ok: boolean }>('/api/staff/business/review-requests', {
      method: 'POST',
      body: JSON.stringify({ queueEntryId }),
    }),

  /** A permitted business-to-customer message (schedule, closure, offer …). */
  notifyCustomer: (input: { customerId: string; type: string; title: string; body: string }) =>
    request<{ ok: boolean; delivered: boolean }>('/api/staff/business/notifications', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
