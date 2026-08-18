// Persists only non-sensitive location UX state so returning customers land on
// the home screen instead of the location onboarding screen. Precise GPS
// coordinates are never stored; only the chosen mode and its display label.

const LOCATION_STORAGE_KEY = 'no_wait_salon_customer_location_v1';

export type LocationMode = 'gps' | 'manual';

export type StoredLocationPreference = {
  mode: LocationMode;
  label: string;
  /** Present only for manual mode, so discovery can be replayed without GPS. */
  area?: string;
};

export type OsPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

const isPreference = (value: unknown): value is StoredLocationPreference => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredLocationPreference>;
  if (candidate.mode !== 'gps' && candidate.mode !== 'manual') return false;
  if (typeof candidate.label !== 'string' || !candidate.label) return false;
  if (candidate.area !== undefined && typeof candidate.area !== 'string') return false;
  return candidate.mode !== 'manual' || Boolean(candidate.area);
};

export const locationPreference = {
  read(): StoredLocationPreference | null {
    try {
      const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isPreference(parsed) ? parsed : null;
    } catch {
      // Unavailable or corrupt storage simply means "not configured yet".
      return null;
    }
  },

  save(preference: StoredLocationPreference): void {
    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(preference));
    } catch {
      // Keep the in-memory selection when storage is unavailable.
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    } catch {
      // Nothing to do when storage is unavailable.
    }
  },
};

/**
 * Reads the real OS/browser geolocation permission. Stored preferences are a UX
 * hint only and are never treated as the source of truth for OS permission.
 * Returns 'unknown' when the Permissions API cannot answer, so callers can fall
 * back to an explicit user-triggered request instead of assuming access.
 */
export async function readGeolocationPermission(): Promise<OsPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'denied';
  if (!navigator.permissions?.query) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
