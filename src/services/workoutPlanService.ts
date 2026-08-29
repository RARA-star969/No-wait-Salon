import { authHeaders } from './customerAccountService';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  targetWeight?: string;
  note?: string;
}

export interface WorkoutDay {
  /** 0 = Sunday … 6 = Saturday, matching JS Date#getDay(). */
  dayOfWeek: number;
  label: string;
  isRest: boolean;
  exercises: WorkoutExercise[];
}

export interface WorkoutPlan {
  goal: string;
  days: WorkoutDay[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed. Please retry.');
  return body as T;
}

/**
 * Customer-owned weekly workout plan, scoped by customerId + gymId — a
 * membership at Iron House Gym has its own split, a membership at another
 * gym has its own, and "today's workout" on a given GymDetailPage only
 * ever reads that business's row. Not owner-managed: the customer sets it
 * up, never the gym staff. See server/index.ts's
 * /api/gym/:gymId/my-workout-plan for the sanitization/persistence side
 * (customer_workout_plan table, primary key customer_id+business_id).
 */
export const workoutPlanService = {
  get: (gymId: string) => request<{ plan: WorkoutPlan | null }>(`/api/gym/${encodeURIComponent(gymId)}/my-workout-plan`),
  save: (gymId: string, plan: WorkoutPlan) => request<{ ok: boolean; plan: WorkoutPlan }>(`/api/gym/${encodeURIComponent(gymId)}/my-workout-plan`, { method: 'PUT', body: JSON.stringify(plan) }),
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const workoutDayLabel = (dayOfWeek: number) => DAY_LABELS[dayOfWeek] || '';

/** Resolves "today's" plan entry from the customer's local date — never the
 *  server's clock/timezone, since the plan is a personal daily reference. */
export function todaysWorkoutDay(plan: WorkoutPlan | null, now = new Date()): WorkoutDay | null {
  if (!plan) return null;
  return plan.days.find((day) => day.dayOfWeek === now.getDay()) || null;
}

/** Next non-rest day after `now`, wrapping the week — used for the "Next: Pull Day · Tomorrow" hint on a rest day. */
export function nextWorkoutDay(plan: WorkoutPlan | null, now = new Date()): { day: WorkoutDay; inDays: number } | null {
  if (!plan) return null;
  const todayDow = now.getDay();
  for (let offset = 1; offset <= 7; offset++) {
    const dow = (todayDow + offset) % 7;
    const day = plan.days.find((entry) => entry.dayOfWeek === dow && !entry.isRest);
    if (day) return { day, inDays: offset };
  }
  return null;
}
