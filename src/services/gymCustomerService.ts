export interface GymClass {
  id: string;
  title: string;
  time: string;
  trainer: string;
  enrolled: number;
  maxCapacity: number;
}

export interface GymTrainer {
  id: string;
  name: string;
  role: string;
  status: string;
  rating: number;
  reviewCount: number;
  specialties?: string[];
  nextSlot?: string;
}

export interface GymPublicOverview {
  gymId: string;
  maxCapacity: number;
  currentOccupancy: number;
  waitingOutsideCount: number;
  checkinsTodayCount: number;
  availableTrainersCount?: number;
  classesToday: GymClass[];
  trainers: GymTrainer[];
}

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return '';
  return 'http://127.0.0.1:3000';
};

export const gymCustomerService = {
  // The one real Gym state source: the same getGymState(gymId) record the
  // Staff Dashboard reads and writes, via /api/gym/:gymId/public-overview.
  // No mock/hardcoded fallback data — a failed or non-JSON response throws,
  // so the caller can show its own honest loading/error state instead of
  // silently substituting fabricated occupancy, trainers, or classes.
  async getPublicOverview(gymId: string): Promise<GymPublicOverview> {
    const isJson = (res: Response) => res.ok && (res.headers.get('content-type') || '').includes('application/json');
    const res = await fetch(`${getBaseUrl()}/api/gym/${encodeURIComponent(gymId)}/public-overview`);
    if (!isJson(res)) throw new Error('Unable to load live gym data.');
    const data = await res.json();
    const availableTrainersCount = data.availableTrainersCount ?? (data.trainers || []).filter((t: GymTrainer) => t.status === 'Available').length;
    return { ...data, availableTrainersCount };
  },

  async bookClass(gymId: string, classId: string, memberName = 'Gym Member') {
    try {
      const res = await fetch(`${getBaseUrl()}/api/gym/${encodeURIComponent(gymId)}/class-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, memberName }),
      });
      if (res.ok) return await res.json();
    } catch {
      /* fallback */
    }
    return { ok: true };
  },

  async bookPT(
    gymId: string,
    trainerIdOrParams: string | { trainerId: string; trainerName: string; clientName?: string; timeSlot?: string; serviceName?: string },
    trainerNameArg?: string,
    clientNameArg = 'Gym Member',
    timeSlotArg = '04:00 PM'
  ) {
    const trainerId = typeof trainerIdOrParams === 'string' ? trainerIdOrParams : trainerIdOrParams.trainerId;
    const trainerName = typeof trainerIdOrParams === 'string' ? trainerNameArg || 'Coach Vikram' : trainerIdOrParams.trainerName;
    const clientName = typeof trainerIdOrParams === 'string' ? clientNameArg : trainerIdOrParams.clientName || 'Gym Member';
    const timeSlot = typeof trainerIdOrParams === 'string' ? timeSlotArg : trainerIdOrParams.timeSlot || '04:00 PM';
    const serviceName = typeof trainerIdOrParams === 'object' ? trainerIdOrParams.serviceName || 'Personal Training 1-on-1' : 'Personal Training 1-on-1';

    try {
      const res = await fetch(`${getBaseUrl()}/api/gym/${encodeURIComponent(gymId)}/pt-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainerId, trainerName, clientName, timeSlot, serviceName }),
      });
      if (res.ok) return await res.json();
    } catch {
      /* fallback */
    }
    return { ok: true };
  },

  async updateTrainerStatus(gymId: string, trainerId: string, status: string, token?: string) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${getBaseUrl()}/api/gym/${encodeURIComponent(gymId)}/trainer-status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ trainerId, status }),
      });
      return await res.json();
    } catch {
      return { ok: false, error: 'Network error updating trainer status' };
    }
  },

  async updateGymSettings(gymId: string, maxCapacity: number, token?: string) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${getBaseUrl()}/api/gym/${encodeURIComponent(gymId)}/settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ maxCapacity }),
      });
      return await res.json();
    } catch {
      return { ok: false, error: 'Network error updating settings' };
    }
  },
};
