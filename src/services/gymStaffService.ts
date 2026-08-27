import type {
  GymState,
  GymEvent,
  GymReportCategory,
} from "../shared/gymBusiness";
const getBaseUrl = () =>
  (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
function authHeaders(): Record<string, string> {
  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("no_wait_salon_staff_token")
      : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed. Please retry.");
  return data;
}
const root = (id: string) => `/api/gym/${encodeURIComponent(id)}`;
const write = (id: string, path: string, body: unknown, method = "POST") =>
  request<{ ok: boolean; state: GymState }>(`${root(id)}/${path}`, {
    method,
    body: JSON.stringify(body),
  });
export type GymReportFilter = {
  from: string;
  to: string;
  category: GymReportCategory;
  campaignId?: string;
};
export type GymEntryQr = {
  businessId: string;
  businessName: string;
  publicToken: string;
  publicUrl: string;
  previewImageUrl: string;
  downloadImageUrl: string;
  status: string;
  version: number;
};
export const gymStaffService = {
  getOverview: (id: string) => request<GymState>(`${root(id)}/overview`),
  checkIn: (id: string, details: { name?: string; memberId?: string } = {}) =>
    write(id, "checkin", details),
  checkOut: (id: string, visitId?: string) =>
    write(id, "checkout", { visitId }),
  trainerAccounts: (id: string) =>
    request<{ id: string; name: string }[]>(`${root(id)}/trainer-accounts`),
  updateTrainerStatus: (id: string, trainerId: string, status: string) =>
    write(id, "trainer-status", { trainerId, status }),
  updateSettings: (id: string, maxCapacity: number) =>
    write(id, "settings", { maxCapacity }),
  updateCoreState: (
    id: string,
    updates: {
      currentOccupancy?: number;
      maxCapacity?: number;
      availableTrainersCount?: number;
    },
  ) => write(id, "core-state", updates, "PUT"),
  operate: (id: string, kind: string, body: Record<string, unknown>) =>
    write(id, `operations/${kind}`, body),
  customerLookup: (id: string, phone: string) =>
    request<{ found: boolean; customerId: string | null; name: string | null }>(
      `${root(id)}/customer-lookup?phone=${encodeURIComponent(phone)}`,
    ),
  saveCampaign: (id: string, body: Record<string, unknown>) =>
    write(id, "campaigns", body),
  campaignIdentity: (id: string, campaignId: string) =>
    request<{ url: string; code: string; qr: string }>(
      `${root(id)}/campaigns/${encodeURIComponent(campaignId)}/identity`,
    ),
  report: (id: string, filters: GymReportFilter) =>
    request<{ events: GymEvent[]; historyStartedAt: number }>(
      `${root(id)}/reports?${new URLSearchParams(filters as unknown as Record<string, string>)}`,
    ),
  // Reads the SAME Admin-provisioned business entry QR/barcode token — this
  // never mints a new one, it only reads whatever ensureBusinessQr() already
  // holds for this gym (server/businessQr.ts is the single source of truth).
  getEntryQr: (id: string) => request<{ qr: GymEntryQr }>(`${root(id)}/entry-qr`),
  exportReport: async (id: string, filters: GymReportFilter) => {
    const res = await fetch(
      `${getBaseUrl()}${root(id)}/reports?${new URLSearchParams({ ...filters, format: "csv" })}`,
      { headers: authHeaders() },
    );
    if (!res.ok) throw new Error((await res.json()).error || "Export failed.");
    return res.blob();
  },
};
