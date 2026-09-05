/** Owner/manager Services & Pricing client — reads and writes the real
 *  salon_service rows for the caller's own business (the same rows Customer
 *  App and Join Queue read). Same auth pattern as staffCustomersService: a
 *  Bearer staff token, businessId always derived server-side from it. */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface OwnerService {
  id: string;
  category: string;
  name: string;
  description: string;
  priceInr: number;
  durationMin: number;
  imageUrl: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface ServiceDraft {
  name: string;
  category: string;
  description: string;
  priceInr: number;
  durationMin: number;
  imageUrl?: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('no_wait_salon_staff_token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchOwnerServices(): Promise<OwnerService[]> {
  const res = await fetch(`${API_BASE_URL}/api/staff/business/services`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not load services.');
  return (data.services || []) as OwnerService[];
}

export async function createOwnerService(draft: ServiceDraft): Promise<OwnerService> {
  const res = await fetch(`${API_BASE_URL}/api/staff/business/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(draft),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not add service.');
  return data.service as OwnerService;
}

export async function updateOwnerService(id: string, draft: ServiceDraft): Promise<OwnerService> {
  const res = await fetch(`${API_BASE_URL}/api/staff/business/services/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(draft),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save service.');
  return data.service as OwnerService;
}

export async function setOwnerServiceVisibility(id: string, active: boolean): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/staff/business/services/${encodeURIComponent(id)}/visibility`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ active }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not update visibility.');
}
