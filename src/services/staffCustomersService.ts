/** Owner/manager Customers directory client — reads the real,
 *  server-aggregated `customer_booking` history for the caller's own
 *  business. Same auth pattern as businessOpenStatusService: a Bearer
 *  staff token, nothing test-mode-specific. */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface CustomerVisit {
  date: number;
  service: string;
  staff: string | null;
  amountInr: number | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
}

export interface CustomerDirectoryEntry {
  customerId: string;
  name: string;
  phone: string;
  totalVisits: number;
  firstVisitAt: number;
  lastVisitAt: number;
  lastService: string;
  mostUsedService: string | null;
  usualStaff: string | null;
  totalSpendInr: number | null;
  lastPaymentMethod: string | null;
  tag: 'new' | 'repeat';
  visits: CustomerVisit[];
}

export interface CustomerDirectorySummary {
  totalCustomers: number;
  visitedToday: number;
  repeatCustomers: number;
  newCustomers: number;
}

export interface CustomerDirectoryResponse {
  summary: CustomerDirectorySummary;
  customers: CustomerDirectoryEntry[];
}

export async function fetchCustomerDirectory(): Promise<CustomerDirectoryResponse> {
  const token = localStorage.getItem('no_wait_salon_staff_token') || '';
  const res = await fetch(`${API_BASE_URL}/api/staff/business/customers`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not load customers.');
  return data as CustomerDirectoryResponse;
}
