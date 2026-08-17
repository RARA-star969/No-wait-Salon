import type { CustomerAuthSession, CustomerProfile } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const CUSTOMER_AUTH_STORAGE_KEY = 'no_wait_salon_customer_auth_v1';

export type CustomerBooking = {
  id: string;
  salonId: string;
  service: string;
  status: string;
  reservedFor?: string;
  createdAt: number;
  updatedAt: number;
};

export function loadCustomerAuth(): CustomerAuthSession | null {
  try {
    const value = localStorage.getItem(CUSTOMER_AUTH_STORAGE_KEY);
    return value ? JSON.parse(value) as CustomerAuthSession : null;
  } catch {
    return null;
  }
}

export function saveCustomerAuth(auth: CustomerAuthSession | null) {
  if (auth) localStorage.setItem(CUSTOMER_AUTH_STORAGE_KEY, JSON.stringify(auth));
  else localStorage.removeItem(CUSTOMER_AUTH_STORAGE_KEY);
}

export function authHeaders() {
  const token = loadCustomerAuth()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init?.headers },
  });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || 'Unable to load your account.');
  return body as T;
}

export const customerAccountService = {
  getProfile: () => request<CustomerProfile>('/api/me/profile'),
  updateProfile: (profile: Pick<CustomerProfile, 'name' | 'email' | 'dateOfBirth' | 'gender' | 'anniversary' | 'city'>) =>
    request<CustomerProfile>('/api/me/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  uploadPhoto: (dataUrl: string) => request<CustomerProfile>('/api/me/profile/photo', { method: 'POST', body: JSON.stringify({ dataUrl }) }),
  getBookings: () => request<{ bookings: CustomerBooking[] }>('/api/me/bookings'),
  logout: () => request<void>('/api/me/logout', { method: 'POST' }),
  getPhotoObjectUrl: async () => {
    const response = await fetch(`${API_BASE_URL}/api/me/profile/photo`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Unable to load profile photo.');
    return URL.createObjectURL(await response.blob());
  },
};
