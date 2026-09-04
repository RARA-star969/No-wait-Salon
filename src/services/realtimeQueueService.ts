import type { Barber, QueueItem } from '../types';
import { authHeaders } from './customerAccountService';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export interface SalonSnapshot {
  salonId: string;
  version: number;
  queue: QueueItem[];
  barbers: Barber[];
  completedList: QueueItem[];
  updatedAt: number;
  platformStatus?: string;
  /** Owner-controlled live Open Now / Closed Now status — separate from
   *  platformStatus (the Admin active/inactive/suspended listing control). */
  isOpen?: boolean;
}

export type QueueCommand =
  | { type: 'reset' }
  | { type: 'toggle_barber'; barberId: string }
  | { type: 'join'; item: QueueItem }
  | { type: 'add_walkin'; item: QueueItem; startImmediately?: boolean; preferredBarberId?: string }
  | { type: 'queue_action'; itemId: string; action: 'Call' | 'Acknowledge' | 'Start' | 'Complete' | 'No-show' | 'Remove' | 'Cancel-chair' | 'Pay-online' | 'Pay-cash' | 'Confirm-cash-payment' | 'Submit-rating'; barberId?: string; reasonCode?: string; reasonText?: string; rating?: number; feedbackTags?: string[]; feedbackComment?: string; paymentMethod?: 'cash' | 'online' }
  | { type: 'cancel_customer'; sessionId: string; reasonCode?: string; reasonText?: string }
  | { type: 'save_staff'; staff: unknown[] }
  | { type: 'save_offers'; offers: unknown[] };

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'The salon service is temporarily unavailable.');
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('The request timed out. Please try again.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

export const realtimeQueueService = {
  getState: (salonId: string) => request<SalonSnapshot>(apiUrl(`/api/salons/${encodeURIComponent(salonId)}/state`)),

  command: (salonId: string, command: QueueCommand) =>
    request<SalonSnapshot>(apiUrl(`/api/salons/${encodeURIComponent(salonId)}/commands`), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(command),
    }),

  subscribe(salonId: string, onState: (snapshot: SalonSnapshot) => void, onConnectionChange: (connected: boolean) => void) {
    const source = new EventSource(apiUrl(`/api/salons/${encodeURIComponent(salonId)}/events`));
    source.addEventListener('state', (event) => {
      onConnectionChange(true);
      onState(JSON.parse((event as MessageEvent).data) as SalonSnapshot);
    });
    source.onerror = () => onConnectionChange(false);
    return () => source.close();
  },

  requestOtp: (phone: string) =>
    request<{ challengeId: string; demoCode: string; expiresInSeconds: number }>(apiUrl('/api/otp/request'), {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  verifyOtp: (challengeId: string, code: string) =>
    request<{ verified: true; phone: string; token: string; customerId: string }>(apiUrl('/api/otp/verify'), {
      method: 'POST',
      body: JSON.stringify({ challengeId, code }),
    }),
};
