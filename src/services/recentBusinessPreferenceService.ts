// Persists which business the customer last opened, per category, purely so
// a returning customer sees a subtle "last viewed" marker on the listing
// card they previously tapped. This is UI memory only — it never creates a
// booking, queue entry, or payment, and it is never read as a source of
// truth for any operational state.
//
// Mirrors locationPreferenceService's storage pattern: Capacitor Preferences
// on device, falling back to localStorage on the web build.

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const LAST_VIEWED_STORAGE_KEY = 'no_wait_salon_customer_last_viewed_v1';

/** categoryId (lowercase) -> businessId. At most one entry per category. */
export type LastViewedByCategory = Record<string, string>;

const parseLastViewed = (raw: string | null | undefined): LastViewedByCategory => {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return {};
    const result: LastViewedByCategory = {};
    for (const [categoryId, businessId] of Object.entries(value as Record<string, unknown>)) {
      if (typeof businessId === 'string' && businessId) result[categoryId] = businessId;
    }
    return result;
  } catch {
    return {};
  }
};

const readLocalStorage = (): string | null => {
  try {
    return localStorage.getItem(LAST_VIEWED_STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeLocalStorage = (value: string): void => {
  try {
    localStorage.setItem(LAST_VIEWED_STORAGE_KEY, value);
  } catch {
    // Keep the in-memory selection when storage is unavailable.
  }
};

export const lastViewedBusinessPreference = {
  async read(): Promise<LastViewedByCategory> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { value } = await Preferences.get({ key: LAST_VIEWED_STORAGE_KEY });
        return parseLastViewed(value);
      } catch {
        return parseLastViewed(readLocalStorage());
      }
    }
    return parseLastViewed(readLocalStorage());
  },

  async save(byCategory: LastViewedByCategory): Promise<void> {
    const value = JSON.stringify(byCategory);
    writeLocalStorage(value);
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Preferences.set({ key: LAST_VIEWED_STORAGE_KEY, value });
    } catch {
      // The localStorage mirror above remains as a best-effort fallback.
    }
  },
};
