/**
 * Traffic-light color used by both the Salon and Gym listing cards' signal
 * chip. One shared union so a "busy" state always means the same color
 * regardless of which category resolved it.
 */
export type SignalColor = 'green' | 'yellow' | 'orange' | 'red';
