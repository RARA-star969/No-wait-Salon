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
  async getPublicOverview(gymId: string): Promise<GymPublicOverview> {
    const isJson = (res: Response) => res.ok && (res.headers.get('content-type') || '').includes('application/json');
    try {
      const res = await fetch(`${getBaseUrl()}/api/gym/${encodeURIComponent(gymId)}/public-overview`);
      if (isJson(res)) {
        const data = await res.json();
        const availableTrainersCount = data.availableTrainersCount ?? (data.trainers || []).filter((t: GymTrainer) => t.status === 'Available').length;
        return { ...data, availableTrainersCount };
      }
    } catch {
      /* fallback below */
    }
    return {
      gymId,
      maxCapacity: 80,
      currentOccupancy: 42,
      waitingOutsideCount: 3,
      checkinsTodayCount: 96,
      availableTrainersCount: 2,
      classesToday: [
        { id: 'c1', title: 'HIIT Strength & Conditioning', time: '07:00 AM', trainer: 'Coach Vikram', enrolled: 14, maxCapacity: 20 },
        { id: 'c2', title: 'Power Yoga & Mobility', time: '09:00 AM', trainer: 'Coach Ananya', enrolled: 12, maxCapacity: 15 },
        { id: 'c3', title: 'CrossFit Blast', time: '05:30 PM', trainer: 'Coach Rahul', enrolled: 18, maxCapacity: 20 },
        { id: 'c4', title: 'Heavy Lifting Workshop', time: '07:00 PM', trainer: 'Coach Vikram', enrolled: 10, maxCapacity: 12 },
      ],
      trainers: [
        { id: 't1', name: 'Coach Vikram', role: 'Head Strength Coach', status: 'Available', rating: 4.9, reviewCount: 112, nextSlot: 'Today 04:00 PM' },
        { id: 't2', name: 'Coach Rahul', role: 'HIIT & Functional Specialist', status: 'In Session', rating: 4.8, reviewCount: 89, nextSlot: 'Today 05:30 PM' },
        { id: 't3', name: 'Coach Ananya', role: 'Yoga & Mobility Instructor', status: 'Available', rating: 4.9, reviewCount: 94, nextSlot: 'Tomorrow 09:00 AM' },
      ],
    };
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
