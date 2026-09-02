export type GymAccessBarState =
  | 'checked_in'
  | 'queued'
  | 'awaiting_payment'
  | 'selected'
  | 'scan'
  | 'renew'
  | 'loading_access'
  | 'unavailable'
  | 'choose_access';

export type GymAccessOffering = {
  name: string;
  type: 'visitor_pass' | 'membership' | 'pt' | 'class_package' | 'custom';
  priceInr: number;
};

export type GymAccessMembership = {
  planName: string;
  expiryDate: string;
};

export type GymAccessBarCopy = {
  eyebrow: string;
  main: string;
  action: string;
};

const inr = (value: number) => `₹${value.toLocaleString('en-IN')}`;

export function gymMembershipValidTill(expiryDate: string): string {
  const parsed = new Date(`${expiryDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return expiryDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parsed.getUTCDate()} ${months[parsed.getUTCMonth()]}`;
}

export function resolveGymAccessBarCopy(input: {
  state: GymAccessBarState;
  selectedOffering?: GymAccessOffering | null;
  membership?: GymAccessMembership | null;
  paidPassName?: string;
  activeHeading?: string;
  activeMain?: string;
  pendingName?: string;
}): GymAccessBarCopy {
  const { state, selectedOffering, membership } = input;
  if (state === 'selected' && selectedOffering) {
    return {
      eyebrow: selectedOffering.type === 'membership' ? 'SELECTED PLAN' : 'SELECTED ACCESS',
      main: `${selectedOffering.name} · ${inr(selectedOffering.priceInr)}`,
      action: 'Continue',
    };
  }
  if (state === 'scan' && membership) {
    return {
      eyebrow: 'MEMBERSHIP ACTIVE',
      main: `Valid till ${gymMembershipValidTill(membership.expiryDate)}`,
      // This is the existing, truthful member-pass action: it opens the QR
      // scanner instead of presenting a decorative pass that cannot check in.
      action: 'Scan to Check In',
    };
  }
  if (state === 'scan') {
    return {
      eyebrow: 'ACCESS READY',
      main: input.paidPassName || 'Pass ready to use',
      action: 'Scan to Check In',
    };
  }
  if (state === 'checked_in') {
    return {
      eyebrow: input.activeHeading || 'ACTIVE VISIT',
      main: input.activeMain || 'Inside now',
      action: 'Check Out',
    };
  }
  if (state === 'queued') return { eyebrow: 'ENTRY QUEUE', main: 'Waiting for a space', action: 'In Entry Queue…' };
  if (state === 'awaiting_payment') {
    return {
      eyebrow: 'PAYMENT PENDING',
      main: input.pendingName ? `${input.pendingName} · Waiting for confirmation` : 'Waiting for the gym to confirm',
      action: 'Waiting for gym',
    };
  }
  if (state === 'renew') {
    return {
      eyebrow: 'MEMBERSHIP EXPIRED',
      main: membership?.planName || 'Choose a renewal plan',
      action: 'Renew',
    };
  }
  if (state === 'loading_access') return { eyebrow: 'GYM ACCESS', main: 'Loading available passes…', action: 'Loading…' };
  if (state === 'unavailable') return { eyebrow: 'GYM ACCESS', main: 'No passes available yet', action: 'Unavailable' };
  return { eyebrow: 'GYM ACCESS', main: 'Choose a plan and get started', action: 'Book Your Pass' };
}
