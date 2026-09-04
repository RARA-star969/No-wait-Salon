/** Owner/manager live Open Now / Closed Now control, shared by every
 *  category's Business Dashboard (Salon, Gym). Separate from the Admin
 *  platform active/inactive/suspended control — this only ever flips
 *  `salon.isOpen`. The server republishes the same SSE snapshot every other
 *  queue mutation already uses, so the caller never needs to poll: the
 *  existing realtimeQueueService subscription on the caller's own business
 *  picks the change up on its own.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function setBusinessOpenStatus(isOpen: boolean): Promise<{ ok: boolean; isOpen: boolean }> {
  const token = localStorage.getItem('no_wait_salon_staff_token') || '';
  const res = await fetch(`${API_BASE_URL}/api/staff/business/open-status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ isOpen }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not update business status.');
  return data;
}
