export const HOME_CATEGORY_PREFERENCE_KEY = 'noq_customer_home_category_preferences_v1';
export const DEFAULT_HOME_CATEGORY_ORDER = ['salon', 'gym', 'shop', 'clinic', 'spa'];

export function normalizeHomeCategoryPreference(
  preferredIds: unknown,
  availableIds: string[],
): string[] {
  const available = new Set(availableIds.map((id) => id.toLowerCase()));
  const requested = Array.isArray(preferredIds) ? preferredIds : [];
  const result: string[] = [];
  for (const value of requested) {
    if (typeof value !== 'string') continue;
    const id = value.toLowerCase();
    if (available.has(id) && !result.includes(id)) result.push(id);
  }
  for (const id of DEFAULT_HOME_CATEGORY_ORDER) {
    if (available.has(id) && !result.includes(id)) result.push(id);
  }
  for (const id of availableIds.map((value) => value.toLowerCase())) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

export const homeCategoryPreference = {
  read(availableIds: string[]): string[] {
    try {
      const stored = localStorage.getItem(HOME_CATEGORY_PREFERENCE_KEY);
      return normalizeHomeCategoryPreference(stored ? JSON.parse(stored) : [], availableIds);
    } catch {
      return normalizeHomeCategoryPreference([], availableIds);
    }
  },
  save(preferredIds: string[], availableIds: string[]): string[] {
    const normalized = normalizeHomeCategoryPreference(preferredIds, availableIds);
    localStorage.setItem(HOME_CATEGORY_PREFERENCE_KEY, JSON.stringify(normalized));
    return normalized;
  },
};
