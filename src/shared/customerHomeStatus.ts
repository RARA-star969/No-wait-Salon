import type { NearbySalon } from '../types';
import type { SignalColor } from './signalColor';
import { resolveSalonQueueSignal } from './salonQueueLevel';
import { salonListingPositionLabel } from './liveQueueDisplayMetrics';
import { resolveGymCrowdLevel } from './gymCrowdResolver';
import { gymListingSignal } from './gymListingSignal';

export type HomeBusinessStatus = {
  liveLine1: string;
  liveLine2: string;
  signalColor: SignalColor;
  signalLabel: string;
  positionLabel: string | null;
  liveFloorMeter?: { occupancy: number; maxCapacity: number; color: SignalColor };
};

/** One presentation resolver for both the Featured card and listing cards.
 * Every value comes from the live discovery payload; unsupported Shop pickup
 * estimates are deliberately not inferred or invented. */
export function resolveHomeBusinessStatus(business: NearbySalon): HomeBusinessStatus {
  const categoryId = (business.mainCategoryId || 'salon').toLowerCase();
  if (categoryId === 'gym') {
    const occupancy = business.currentOccupancy ?? 0;
    const maxCapacity = business.maxCapacity ?? 0;
    const crowd = resolveGymCrowdLevel(occupancy, maxCapacity);
    const signal = gymListingSignal(crowd.level);
    return {
      liveLine1: `Live floor ${occupancy}/${maxCapacity}`,
      liveLine2: signal.label,
      signalColor: signal.color,
      signalLabel: signal.label,
      positionLabel: null,
      liveFloorMeter: { occupancy, maxCapacity, color: signal.color },
    };
  }
  if (categoryId === 'shop') {
    return {
      liveLine1: business.isOpen ? 'Open now' : 'Closed now',
      liveLine2: business.openingHours || 'Hours unavailable',
      signalColor: business.isOpen ? 'green' : 'red',
      signalLabel: business.isOpen ? 'Open' : 'Closed',
      positionLabel: null,
    };
  }

  const waitingCustomers = business.waitingCustomers;
  const isNoWait = waitingCustomers === 0;
  const signal = resolveSalonQueueSignal(waitingCustomers);
  return {
    liveLine1: isNoWait ? 'No wait' : `${waitingCustomers} ahead`,
    liveLine2: isNoWait ? 'Ready now' : `~${business.liveWaitMinutes} min wait`,
    signalColor: signal.color,
    signalLabel: signal.label,
    positionLabel: salonListingPositionLabel(waitingCustomers, business.readyChairs ?? 0),
  };
}
