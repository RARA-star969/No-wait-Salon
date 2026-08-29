import { gymCustomerService } from './gymCustomerService';

/**
 * Category-agnostic "does this customer have an active membership at this
 * business" concept, used everywhere the golden crown Member state is
 * shown (Home listing badge, business profile Member quick action).
 *
 * The only membership records that exist in this build live in the Gym
 * membership tables (`/api/me/gym-memberships`), so this wraps that same
 * endpoint today. The UI-facing contract is deliberately businessId +
 * authenticated customer + active status — never a Gym plan id or an
 * `isGym` check — so if a future category (including Salon) grows its own
 * membership product on top of the same "active membership for this
 * business" shape, the crown lights up automatically with no UI change.
 * Nothing here fabricates a Salon membership product; the set below is
 * simply empty for businesses that don't have a real active membership
 * record.
 */
export const businessMembershipService = {
  /** Active-membership business ids for the current customer, across every category. */
  getMyActiveMembershipBusinessIds: async (): Promise<Set<string>> => {
    const data = await gymCustomerService.getMyGymMemberships();
    const activeIds = data.memberships
      .filter((entry) => entry.membership.status === 'active')
      .map((entry) => entry.gymId);
    return new Set(activeIds);
  },
};
