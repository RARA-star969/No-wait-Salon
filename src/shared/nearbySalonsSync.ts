import type { NearbySalon } from '../types';

/**
 * Merges freshly-polled live fields (queue/wait/occupancy) from
 * `/api/salons/nearby` into the currently-rendered `nearbySalons` list,
 * keeping the existing array's order and membership untouched — a
 * background refresh must never reorder cards or drop one the customer is
 * currently looking at (e.g. a QR-scanned business not present in the
 * fresh nearby response). A business missing from the fresh response
 * keeps its last known values rather than being reset or removed.
 */
export function mergeLiveOperationalFields(current: NearbySalon[], fresh: NearbySalon[]): NearbySalon[] {
  const freshById = new Map(fresh.map((salon) => [salon.id, salon]));
  return current.map((salon) => {
    const next = freshById.get(salon.id);
    if (!next) return salon;
    return {
      ...salon,
      liveWaitMinutes: next.liveWaitMinutes,
      waitingCustomers: next.waitingCustomers,
      readyChairs: next.readyChairs,
      currentOccupancy: next.currentOccupancy,
      maxCapacity: next.maxCapacity,
    };
  });
}
