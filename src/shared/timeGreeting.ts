/**
 * Real time-based greeting logic for NOQ customer home header.
 * Computes greeting based on the current local hour:
 * - 04:00 to 11:59: Good Morning
 * - 12:00 to 16:59: Good Afternoon
 * - 17:00 to 03:59: Good Evening
 */

export function getTimeBasedGreeting(date: Date = new Date()): string {
  const hours = date.getHours();
  if (hours >= 4 && hours < 12) {
    return 'Good Morning';
  }
  if (hours >= 12 && hours < 17) {
    return 'Good Afternoon';
  }
  return 'Good Evening';
}

/**
 * Formats greeting with customer name if known.
 * If customer name is missing, empty, or not yet set, returns only the greeting
 * without any dummy names (e.g. never Alex or generic placeholders).
 */
export function formatCustomerGreeting(name?: string | null, date: Date = new Date()): string {
  const greeting = getTimeBasedGreeting(date);
  const cleanName = name?.trim();
  if (!cleanName) {
    return greeting;
  }
  // Use first name if multiple words are present
  const firstName = cleanName.split(/\s+/)[0];
  if (!firstName) {
    return greeting;
  }
  return `${greeting}, ${firstName}`;
}
