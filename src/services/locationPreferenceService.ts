// Persists only non-sensitive location UX state so returning customers land on
// the home screen instead of the first-time location setup screen.
//
// Storage uses Capacitor Preferences on device (native SharedPreferences, which
// survives a full app restart and WebView data eviction) and falls back to
// localStorage on the web build.

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const LOCATION_STORAGE_KEY = 'no_wait_salon_customer_location_v1';

export type LocationMode = 'gps' | 'manual';

export type StoredLocationPreference = {
  /** Proof that first-time location setup finished at least once. */
  setupCompleted: true;
  mode: LocationMode;
  label: string;
  /** Present for manual mode so discovery can be replayed without GPS. */
  area?: string;
  /** Coarse last-known point, used to keep Home useful if GPS is unavailable. */
  latitude?: number;
  longitude?: number;
};

export type OsPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const parsePreference = (raw: string | null | undefined): StoredLocationPreference | null => {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<StoredLocationPreference>;
    if (candidate.setupCompleted !== true) return null;
    if (candidate.mode !== 'gps' && candidate.mode !== 'manual') return null;
    if (typeof candidate.label !== 'string' || !candidate.label) return null;
    if (candidate.mode === 'manual' && !candidate.area) return null;
    return {
      setupCompleted: true,
      mode: candidate.mode,
      label: candidate.label,
      ...(candidate.area ? { area: candidate.area } : {}),
      ...(isFiniteNumber(candidate.latitude) ? { latitude: candidate.latitude } : {}),
      ...(isFiniteNumber(candidate.longitude) ? { longitude: candidate.longitude } : {}),
    };
  } catch {
    return null;
  }
};

const readLocalStorage = (): string | null => {
  try {
    return localStorage.getItem(LOCATION_STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeLocalStorage = (value: string): void => {
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, value);
  } catch {
    // Keep the in-memory selection when storage is unavailable.
  }
};

export const locationPreference = {
  async read(): Promise<StoredLocationPreference | null> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { value } = await Preferences.get({ key: LOCATION_STORAGE_KEY });
        const native = parsePreference(value);
        if (native) return native;
        // Migrate a value written by the earlier localStorage-only build.
        const migrated = parsePreference(readLocalStorage());
        if (migrated) {
          await Preferences.set({ key: LOCATION_STORAGE_KEY, value: JSON.stringify(migrated) });
          return migrated;
        }
        return null;
      } catch {
        return parsePreference(readLocalStorage());
      }
    }
    return parsePreference(readLocalStorage());
  },

  async save(preference: StoredLocationPreference): Promise<void> {
    const value = JSON.stringify(preference);
    // Always mirror to localStorage so a web build and a native build agree.
    writeLocalStorage(value);
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Preferences.set({ key: LOCATION_STORAGE_KEY, value });
    } catch {
      // The localStorage mirror above remains as a best-effort fallback.
    }
  },

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    } catch {
      // Nothing to do when storage is unavailable.
    }
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Preferences.remove({ key: LOCATION_STORAGE_KEY });
    } catch {
      // Ignore: the next successful save overwrites the stale value.
    }
  },
};

/**
 * Reads the real OS/browser geolocation permission WITHOUT triggering a prompt.
 * Android WebViews frequently do not implement the Permissions API for
 * geolocation, so an inconclusive answer is reported as 'unknown' and must
 * never be treated as a denial.
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

export type StartupPlan = {
  /** First-time setup screen. Shown only when setup has never completed. */
  showOnboarding: boolean;
  /** How Home should refresh discovery, without blocking render. */
  refresh: 'gps' | 'area' | 'last-known' | 'none';
  /** True only when stored state is genuinely unusable and must be discarded. */
  clearStoredPreference: boolean;
};

/**
 * Pure startup decision. Kept free of React and browser APIs so the exact
 * behaviour that regressed can be unit tested.
 *
 * Rules:
 * - Onboarding depends ONLY on whether setup previously completed.
 * - An inconclusive ('unknown') or 'prompt' permission never discards state and
 *   never forces a prompt; Home still opens using last-known/manual data.
 * - Even an explicit 'denied' keeps the customer on Home.
 */
export function resolveStartupPlan(
  stored: StoredLocationPreference | null,
  permission: OsPermissionState,
): StartupPlan {
  if (!stored?.setupCompleted) {
    return { showOnboarding: true, refresh: 'none', clearStoredPreference: false };
  }

  if (stored.mode === 'manual' && stored.area) {
    return { showOnboarding: false, refresh: 'area', clearStoredPreference: false };
  }

  if (permission === 'granted') {
    return { showOnboarding: false, refresh: 'gps', clearStoredPreference: false };
  }

  // Permission is denied, pending, or simply unreportable by this WebView.
  // Stay on Home and reuse whatever coarse location we already have.
  return {
    showOnboarding: false,
    refresh: stored.latitude !== undefined && stored.longitude !== undefined ? 'last-known' : 'none',
    clearStoredPreference: false,
  };
}
