/**
 * Single source of truth for "which category does this business belong to"
 * — every place that decides between Gym and Salon UI (customer detail
 * routing, the public QR page, category filtering) reads through this
 * instead of re-deriving its own `(x.mainCategoryId || 'salon').toLowerCase()`
 * check, so a business's category can never silently drift out of sync
 * between call sites.
 */
export function normalizeMainCategoryId(mainCategoryId?: string | null): string {
  return (mainCategoryId || 'salon').trim().toLowerCase();
}

export function isGymCategory(mainCategoryId?: string | null): boolean {
  return normalizeMainCategoryId(mainCategoryId) === 'gym';
}
