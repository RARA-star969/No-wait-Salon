export type CustomerGreeting = {
  period: 'morning' | 'afternoon' | 'evening';
  text: string;
  icon: 'sun' | 'moon';
};

function firstName(name?: string | null): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/** Uses the device-local hour from the supplied Date, keeping the logic pure
 * and deterministic for tests while the caller supplies the live clock. */
export function customerLocalGreeting(now: Date, customerName?: string | null): CustomerGreeting {
  const hour = now.getHours();
  const period: CustomerGreeting['period'] = hour >= 5 && hour < 12
    ? 'morning'
    : hour >= 12 && hour < 17
      ? 'afternoon'
      : 'evening';
  const salutation = period === 'morning'
    ? 'Good Morning'
    : period === 'afternoon'
      ? 'Good Afternoon'
      : 'Good Evening';
  const name = firstName(customerName);
  return {
    period,
    text: name ? `${salutation}, ${name}` : salutation,
    icon: period === 'evening' ? 'moon' : 'sun',
  };
}
