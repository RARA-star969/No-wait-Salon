/** Owner/manager Staff Members performance client — reads the real,
 *  server-aggregated `customer_booking` history for the caller's own
 *  business. Same auth pattern as staffCustomersService: a Bearer staff
 *  token, business scope derived server-side from that session, never a
 *  client-supplied salon/business id. */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type StaffPerformanceRange = 'today' | '7d' | '30d' | 'all';

export interface StaffPerformanceRow {
  staffId: string;
  name: string;
  role: string;
  status: string;
  active: boolean;
  photoUrl: string;
  experienceYears: number | null;
  specialties: string[];
  serviceIds: string[];
  completedBookings: number;
  paidCompletedBookings: number;
  revenueInr: number | null;
  averageTicketInr: number | null;
  topServices: Array<{ name: string; count: number }>;
  cancelledCount: number;
  noShowCount: number;
  verifiedRating: number | null;
  verifiedReviewCount: number | null;
}

export interface StaffPerformanceResponse {
  range: StaffPerformanceRange;
  staff: StaffPerformanceRow[];
}

export async function fetchStaffPerformance(range: StaffPerformanceRange): Promise<StaffPerformanceResponse> {
  const token = localStorage.getItem('no_wait_salon_staff_token') || '';
  const res = await fetch(`${API_BASE_URL}/api/staff/business/staff-performance?range=${encodeURIComponent(range)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not load staff performance.');
  return data as StaffPerformanceResponse;
}
