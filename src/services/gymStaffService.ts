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
// Add Visitor's server-side existing-member match — returned instead of a
// normal { ok, state } result when this phone already has an active
// membership at this gym, so the owner can confirm "Check in as Member"
// instead of a duplicate visitor/membership silently being created.
export type GymExistingMemberMatch = {
  membershipId: string;
  customerId: string;
  name: string;
  planName: string;
  expiryDate: string;
  daysRemaining: number;
  sessionsTotal?: number;
  sessionsRemaining?: number;
};
export type GymAddVisitorResult =
  | { ok: true; state: GymState }
  | {
      ok: true;
      requiresConfirmation: true;
      alreadyCheckedIn: boolean;
      existingMember: GymExistingMemberMatch;
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
  // Distinct from operate("add_visitor", ...) because its response can be
  // an existing-member confirmation prompt instead of { ok, state } — the
  // generic `write` return type would otherwise hide that shape from callers.
  addVisitor: (id: string, body: Record<string, unknown>) =>
    request<GymAddVisitorResult>(`${root(id)}/operations/add_visitor`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
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
  // Live Floor profile photos. The URL comes from the server (already scoped
  // to this gym and this customer) and is fetched with the staff session
  // token — an <img src> could not carry that header. Returns an object URL
  // the caller is responsible for revoking.
  customerPhotoObjectUrl: async (photoUrl: string) => {
    const res = await fetch(`${getBaseUrl()}${photoUrl}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Unable to load profile photo.");
    return URL.createObjectURL(await res.blob());
  },
  exportReport: async (id: string, filters: GymReportFilter) => {
    const res = await fetch(
      `${getBaseUrl()}${root(id)}/reports?${new URLSearchParams({ ...filters, format: "csv" })}`,
      { headers: authHeaders() },
    );
    if (!res.ok) throw new Error((await res.json()).error || "Export failed.");
    return res.blob();
  },
  exportMembersReport: async (
    id: string,
    range: { from: string; to: string },
  ) => {
    const res = await fetch(
      `${getBaseUrl()}${root(id)}/members-report?${new URLSearchParams({ ...range, format: "csv" })}`,
      { headers: authHeaders() },
    );
    if (!res.ok)
      throw new Error(
        (await res.json().catch(() => ({}))).error ||
          "Member report download failed.",
      );
    return res.blob();
  },
};
