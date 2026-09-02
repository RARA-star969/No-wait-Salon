export type SalonSnapshotCursor = { salonId: string; version: number } | null;

/**
 * Guards the customer Salon live card from cross-business and out-of-order
 * queue snapshots. SSE and the fallback refresh intentionally race; only a
 * snapshot for the currently selected salon that is at least as recent as
 * the last applied version may reach React state.
 */
export function shouldApplySalonSnapshot(
  selectedSalonId: string,
  latest: SalonSnapshotCursor,
  incoming: { salonId: string; version: number },
): boolean {
  if (incoming.salonId !== selectedSalonId) return false;
  return latest?.salonId !== incoming.salonId || incoming.version >= latest.version;
}
