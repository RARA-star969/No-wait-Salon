// Alerting for a web customer whose turn has arrived.
//
// Scope is deliberately explicit:
//   * In-page alerting (popup + vibration + chime) works right now and is
//     driven by the existing SSE stream while the tab is open.
//   * A browser Notification is best-effort and only fires when the page is
//     backgrounded and permission was granted.
//   * True background push (closed tab) is NOT implemented here. That needs a
//     service worker plus Web Push/VAPID and is a separate piece of work.

import { playNotificationChime } from './notificationService';

/** Browsers can only start audio from a real user gesture, so prime it then. */
let primedAudio: AudioContext | null = null;

export function primeTurnAlert(): void {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    primedAudio = primedAudio || new AudioContextClass();
    void primedAudio.resume?.();
  } catch {
    primedAudio = null;
  }
}

export const notificationsSupported = (): boolean => typeof window !== 'undefined' && 'Notification' in window;

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported';

/**
 * Opt-in only, and never required. iOS Safari exposes Notification only for a
 * PWA installed to the Home Screen, so this can legitimately be unavailable.
 */
export async function requestTurnNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Fires every channel that is actually available. The caller must not depend on
 * any single one succeeding; the in-page popup is the guaranteed surface.
 */
export function fireTurnAlert(salonName: string, service: string): void {
  // Vibration: Android Chrome supports it, iOS Safari does not.
  try {
    navigator.vibrate?.([220, 120, 220]);
  } catch {
    // Unsupported or blocked; the popup still shows.
  }

  try {
    playNotificationChime();
  } catch {
    // Autoplay policy may block it; the popup still shows.
  }

  // Only useful when the tab is not the active one.
  try {
    if (notificationsSupported() && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification("It's your turn", {
        body: `${salonName} · ${service}. Please proceed to the counter.`,
        tag: 'no-wait-salon-turn',
      });
    }
  } catch {
    // Some browsers throw when constructing Notification outside a worker.
  }
}
