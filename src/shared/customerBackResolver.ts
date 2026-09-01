/**
 * The single Android hardware-back / navigation-back resolver for the whole
 * customer app.
 *
 * Previously every overlay and screen answered "what does back do here?" with
 * its own inline branch inside CustomerApp. That is exactly how double-back
 * races, stale overlays and accidental Home resets appear. This module turns
 * the question into one pure function over a declared navigation snapshot, so
 * the ordering rule — deepest sheet/modal first, then child screen, then
 * parent, then Home, and only then exit — is stated once and tested directly.
 */

import type { CustomerScreen } from '../types';

/** Every dismissable overlay the customer surface can have open, deepest last
 *  in the natural reading order below. */
export interface CustomerOverlayState {
  qrScanner: boolean;
  moreCategories: boolean;
  locationSheet: boolean;
  cancelSheet: boolean;
  callModal: boolean;
  loginGate: boolean;
  memberHubWorkoutPlan: boolean;
  memberHub: boolean;
}

export const NO_OVERLAYS: CustomerOverlayState = {
  qrScanner: false,
  moreCategories: false,
  locationSheet: false,
  cancelSheet: false,
  callModal: false,
  loginGate: false,
  memberHubWorkoutPlan: false,
  memberHub: false,
};

export type OnboardingStageName = 'landing' | 'loading' | 'location' | 'notifications' | 'ready';

export interface CustomerNavState {
  stage: OnboardingStageName;
  /** True when a visible/hardware "back to landing" is currently forced. */
  landingOverride: boolean;
  screen: CustomerScreen;
  overlays: CustomerOverlayState;
  /**
   * Which tab the customer entered the Live Ticket from. Entering from the
   * Bookings tab must return to My Bookings; entering from Home (the active
   * queue banner, or a restored ticket) must return to Home. Without this the
   * ticket's back is ambiguous and picks one at random.
   */
  ticketOrigin: 'home' | 'bookings';
}

export type BackAction =
  | { type: 'close-overlay'; overlay: keyof CustomerOverlayState }
  | { type: 'go-screen'; screen: CustomerScreen }
  | { type: 'go-landing' }
  | { type: 'consume' }
  | { type: 'exit-app' };

/**
 * Deepest-first overlay order. Workout Plan sits inside Member Hub, so it
 * must close before the Hub; everything above them is a top-level sheet.
 */
const OVERLAY_ORDER: Array<keyof CustomerOverlayState> = [
  'qrScanner',
  'moreCategories',
  'locationSheet',
  'cancelSheet',
  'callModal',
  'loginGate',
  'memberHubWorkoutPlan',
  'memberHub',
];

/**
 * Parent screen for every child screen. A screen absent from this map is a
 * root-level tab destination and backs out to Home.
 */
const SCREEN_PARENT: Partial<Record<CustomerScreen, CustomerScreen>> = {
  'edit-profile': 'profile',
  slots: 'salon',
  'gym-activity': 'profile',
  'notification-settings': 'notifications',
  'add-address': 'location-select',
  'request-address': 'location-select',
  'location-select': 'home',
  salon: 'home',
  complete: 'home',
  profile: 'home',
  bookings: 'home',
  notifications: 'home',
};

export function resolveBackAction(state: CustomerNavState): BackAction {
  for (const overlay of OVERLAY_ORDER) {
    if (state.overlays[overlay]) return { type: 'close-overlay', overlay };
  }

  // The landing screen is the true root: nothing is behind it, so this is the
  // only place the app is ever allowed to background/exit.
  if (state.stage === 'landing' || state.landingOverride) return { type: 'exit-app' };

  // Permission stages are a linear pre-Home sequence back to landing.
  if (state.stage === 'location' || state.stage === 'notifications') return { type: 'go-landing' };
  // Mid-hydration: swallow the press rather than exiting on a race.
  if (state.stage !== 'ready') return { type: 'consume' };

  if (state.screen === 'tracking') {
    return { type: 'go-screen', screen: state.ticketOrigin === 'bookings' ? 'bookings' : 'home' };
  }

  const parent = SCREEN_PARENT[state.screen];
  if (parent) return { type: 'go-screen', screen: parent };

  // Home itself: the deepest customer screen backs out to landing.
  return { type: 'go-landing' };
}

/**
 * Convenience used by the visible in-screen Back controls so a header arrow
 * and the hardware button can never disagree about where "back" goes.
 */
export function parentScreenOf(screen: CustomerScreen, ticketOrigin: 'home' | 'bookings' = 'home'): CustomerScreen {
  if (screen === 'tracking') return ticketOrigin === 'bookings' ? 'bookings' : 'home';
  return SCREEN_PARENT[screen] || 'home';
}
