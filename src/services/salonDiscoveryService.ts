import type { NearbySalon } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

type NearbyResponse = { salons: NearbySalon[]; source: 'gps' | 'manual' };

async function fetchNearby(query: string): Promise<NearbyResponse> {
  const response = await fetch(`${API_BASE_URL}/api/salons/nearby?${query}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to find salons near you.');
  return body as NearbyResponse;
}

export type SalonDirectoryEntry = { id: string; name: string; address: string };

export const salonDiscoveryService = {
  directory: async (): Promise<SalonDirectoryEntry[]> => {
    const response = await fetch(`${API_BASE_URL}/api/salons/directory`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    const body = await response.json().catch(() => ({ salons: [] }));
    return (body.salons || []) as SalonDirectoryEntry[];
  },
  byCoordinates: (latitude: number, longitude: number) =>
    fetchNearby(new URLSearchParams({ lat: String(latitude), lng: String(longitude) }).toString()),
  byArea: (area: string) => fetchNearby(new URLSearchParams({ area }).toString()),
};
