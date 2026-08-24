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
        return await res.json();
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

  async bookClass(gymId: string, classId: string, memberName?: string) {
    const res = await fetch(`${getBaseUrl()}/api/gym/${encodeURIComponent(gymId)}/class-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, memberName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Class booking failed' }));
      throw new Error(data.error || 'Class booking failed');
    }
    return res.json();
  },

  async bookPT(gymId: string, payload: { trainerId: string; trainerName: string; clientName?: string; timeSlot?: string; serviceName?: string }) {
    const res = await fetch(`${getBaseUrl()}/api/gym/${encodeURIComponent(gymId)}/pt-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'PT booking failed' }));
      throw new Error(data.error || 'PT booking failed');
    }
    return res.json();
  },
};
