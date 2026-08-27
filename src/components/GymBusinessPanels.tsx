import React, { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Plus, QrCode, X, Megaphone } from "lucide-react";
import {
  gymStaffService,
  type GymReportFilter,
} from "../services/gymStaffService";
import {
  campaignAnalytics,
  campaignIsLive,
  type GymCampaign,
  type GymEvent,
  type GymState,
} from "../shared/gymBusiness";
import { formatGymDateTime } from "../shared/gymTime";

// Routed through the one shared Gym formatter so no Gym surface can drift
// into a 24-hour clock on a locale that defaults to one.
export const dateTime = (value: number | string) =>
  value ? formatGymDateTime(value) : "Not scheduled";
export const localInput = (value: number | string = Date.now()) => {
  const d = new Date(value);
  if (!Number.isFinite(+d)) return "";
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export const localDay = (value = new Date()) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
export const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="gym-empty">
    <span className="gym-empty-dot" />
    {children}
  </div>
);
export const Badge = ({ children }: { children: React.ReactNode }) => (
  <span
    className={`gym-badge ${["Available", "Active", "Completed", "Live"].includes(String(children)) ? "good" : ""}`}
  >
    {children}
  </span>
);
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`gym-panel ${className}`}>
      <div className="gym-panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  optional?: boolean;
  help?: string;
};
export type FormSpec = {
  title: string;
  description?: string;
  fields: Field[];
  submit: (values: Record<string, unknown>) => Promise<void>;
};
export function FormDialog({
  spec,
  close,
}: {
  spec: FormSpec;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const raw = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    for (const f of spec.fields) {
      const v = String(raw.get(f.name) || "");
      values[f.name] =
        f.type === "number"
          ? Number(v)
          : f.type === "datetime-local" && v
            ? new Date(v).toISOString()
            : v;
    }
    try {
      await spec.submit(values);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={ref}
      className="gym-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <form onSubmit={submit}>
        <div className="gym-panel-heading">
          <h2>{spec.title}</h2>
          <button
            type="button"
            aria-label="Close form"
            disabled={busy}
            className="gym-icon-button"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {spec.description && <p className="gym-muted">{spec.description}</p>}
        <div className="gym-form-fields">
          {spec.fields.map((f) => (
            <label key={f.name}>
              {f.label}
              {f.options ? (
                <select
                  name={f.name}
                  defaultValue={f.value ?? ""}
                  required={!f.optional}
                >
                  {f.optional && <option value="">None</option>}
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.name}
                  defaultValue={f.value}
                  required={!f.optional}
                  maxLength={2000}
                  rows={4}
                />
              ) : (
                <input
                  name={f.name}
                  type={f.type || "text"}
                  defaultValue={f.value}
                  required={!f.optional}
                  min={f.min}
                  max={f.max}
                  maxLength={f.name === "phone" ? 40 : 120}
                  step={f.type === "number" ? 1 : undefined}
                />
              )}
              {f.help && <small>{f.help}</small>}
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="gym-error">
            {error}
          </p>
        )}
        <div className="gym-form-actions">
          <button
            type="button"
            className="gym-button secondary"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="gym-button" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function CampaignMetrics({
  campaigns,
  events,
}: {
  campaigns: GymCampaign[];
  events: GymEvent[];
}) {
  const a = campaignAnalytics(campaigns, events);
  return (
    <div className="gym-mini-metrics">
      {[
        ["Active now", a.active],
        ["Link / QR visits", a.scans],
        ["Actions", a.actions],
        ["Browser reach", a.reach],
        ["Conversion", `${a.conversion}%`],
      ].map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
export function ReportsPanel({
  gymId,
  owner,
  campaigns,
  campaignOnly = false,
}: {
  gymId: string;
  owner: boolean;
  campaigns: GymCampaign[];
  campaignOnly?: boolean;
}) {
  const [from, setFrom] = useState(
    localDay(new Date(Date.now() - 6 * 86400000)),
  );
  const [to, setTo] = useState(localDay());
  const [category, setCategory] = useState(campaignOnly ? "campaigns" : "all");
  const [campaignId, setCampaignId] = useState("");
  const [result, setResult] = useState<{
    events: GymEvent[];
    historyStartedAt: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const valid = Boolean(from && to && from <= to);
  const filters: GymReportFilter = {
    from: valid ? new Date(from + "T00:00:00").toISOString() : "",
    to: valid ? new Date(to + "T23:59:59.999").toISOString() : "",
    category: category as GymReportFilter["category"],
    campaignId,
  };
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    if (!valid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    gymStaffService
      .report(gymId, JSON.parse(filterKey))
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gymId, filterKey, refresh, valid]);
  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(
        await gymStaffService.exportReport(gymId, filters),
        `noq-${category}-${from}-to-${to}.csv`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };
  const events = result?.events || [];
  const categories = [
    "all",
    "occupancy",
    "checkins",
    "pt",
    "trainers",
    "classes",
    ...(owner ? ["campaigns"] : []),
    "members",
    "queue",
  ];
  return (
    <Panel
      title={campaignOnly ? "Campaign analytics" : "Operations reports"}
      action={
        <button
          className="gym-button secondary"
          disabled={!valid || loading || exporting || !result}
          onClick={exportCsv}
        >
          <ArrowDownToLine size={16} />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      }
    >
      <p className="gym-muted">
        Recorded operations, filtered by event time. Dates use your device’s
        time zone; CSV timestamps use UTC.
      </p>
      <div className="gym-filters">
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Through
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {!campaignOnly && (
          <label>
            Report
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setCampaignId("");
              }}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {
                    {
                      all: "All operations",
                      occupancy: "Occupancy / capacity",
                      checkins: "Check-ins / out",
                      pt: "PT activity",
                      trainers: "Trainer availability",
                      classes: "Classes",
                      campaigns: "Campaign performance",
                      members: "Members",
                      queue: "Entry queue",
                    }[c]
                  }
                </option>
              ))}
            </select>
          </label>
        )}
        {category === "campaigns" && (
          <label>
            Campaign
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">All campaigns</option>
              {campaigns.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="gym-button secondary"
          onClick={() => setRefresh((n) => n + 1)}
          disabled={loading || !valid}
        >
          Refresh
        </button>
      </div>
      {!valid && (
        <p role="alert" className="gym-error">
          Choose a valid date range.
        </p>
      )}
      {error && (
        <p role="alert" className="gym-error">
          {error}
        </p>
      )}
      {result && (
        <>
          <p className="gym-footnote">
            History begins {dateTime(result.historyStartedAt)}. Earlier activity
            is not reconstructed.
          </p>
          {category === "campaigns" ? (
            <>
              <CampaignMetrics
                campaigns={campaigns.filter(
                  (c) => !campaignId || c.id === campaignId,
                )}
                events={events}
              />
              <p className="gym-footnote">
                Active now is current status. Visits count link opens (repeat
                opens within 30 minutes excluded); reach counts browser cookies.
                Conversion is reached browsers that also recorded interest in
                this range. Actions are not payments or verified redemptions.
              </p>
            </>
          ) : (
            <div className="gym-mini-metrics">
              <div>
                <span>Recorded events</span>
                <strong>{events.length}</strong>
              </div>
              <div>
                <span>Check-ins</span>
                <strong>
                  {events.filter((e) => e.action === "checkin").length}
                </strong>
              </div>
              <div>
                <span>Peak recorded occupancy</span>
                <strong>
                  {events.length
                    ? Math.max(...events.map((e) => e.occupancy))
                    : "—"}
                </strong>
              </div>
              <div>
                <span>PT sessions completed</span>
                <strong>
                  {
                    events.filter(
                      (e) => e.category === "pt" && e.action === "Completed",
                    ).length
                  }
                </strong>
              </div>
            </div>
          )}
        </>
      )}
      {loading ? (
        <Empty>Loading report…</Empty>
      ) : result && !events.length ? (
        <Empty>
          No recorded events in this range. Operations will appear here as your
          team uses the dashboard.
        </Empty>
      ) : (
        result && (
          <>
            <div className="gym-event-list">
              {events
                .slice()
                .reverse()
                .slice(0, 100)
                .map((e) => (
                  <div className="gym-event-row" key={e.id}>
                    <span className="gym-event-marker" />
                    <div>
                      <strong>{e.subject}</strong>
                      <small>
                        {e.category} · {e.action} · {e.actor}
                      </small>
                    </div>
                    <time>{dateTime(e.at)}</time>
                    <Badge>
                      {e.occupancy} / {e.capacity}
                    </Badge>
                  </div>
                ))}
            </div>
            <p className="gym-footnote">
              Showing {Math.min(100, events.length)} of {events.length} events.
              CSV includes the entire filtered dataset.
            </p>
          </>
        )
      )}
    </Panel>
  );
}
export function CampaignsPanel({
  gymId,
  state,
  save,
  openForm,
}: {
  gymId: string;
  state: GymState;
  save: (body: Record<string, unknown>) => Promise<void>;
  openForm: (form: FormSpec) => void;
}) {
  const [status, setStatus] = useState("All");
  const [query, setQuery] = useState("");
  const [identity, setIdentity] = useState<{
    url: string;
    code: string;
    qr: string;
    title: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const edit = (c?: GymCampaign) =>
    openForm({
      title: c ? "Edit campaign" : "Create campaign",
      description:
        "Publish a scannable campaign. Paused, draft, archived or out-of-date campaigns cannot collect visits or actions.",
      fields: [
        { name: "title", label: "Campaign title", value: c?.title },
        {
          name: "type",
          label: "Type",
          value: c?.type || "Offer",
          options: [
            "Offer",
            "Alert",
            "Announcement",
            "Membership promotion",
          ].map((value) => ({ value, label: value })),
        },
        {
          name: "message",
          label: "Message / offer and terms",
          type: "textarea",
          value: c?.message,
        },
        {
          name: "startsAt",
          label: "Starts",
          type: "datetime-local",
          value: localInput(c?.startsAt || Date.now()),
        },
        {
          name: "endsAt",
          label: "Ends",
          type: "datetime-local",
          value: localInput(c?.endsAt || Date.now() + 7 * 86400000),
        },
        {
          name: "status",
          label: "Status",
          value: c?.status || "Draft",
          options: ["Draft", "Active", "Paused", "Archived"].map((value) => ({
            value,
            label: value,
          })),
        },
      ],
      submit: (values) => save({ ...values, id: c?.id }),
    });
  const showIdentity = async (c: GymCampaign) => {
    setLoadingId(c.id);
    setError("");
    try {
      setIdentity({
        ...(await gymStaffService.campaignIdentity(gymId, c.id)),
        title: c.title,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR unavailable.");
    } finally {
      setLoadingId("");
    }
  };
  const campaigns = state.campaigns.filter(
    (c) =>
      (status === "All" || c.status === status) &&
      (c.title + c.message).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <Panel
        title="Your campaigns"
        action={
          <button className="gym-button" onClick={() => edit()}>
            <Plus size={17} />
            Create campaign
          </button>
        }
      >
        <div className="gym-filters">
          <label>
            Search
            <input
              placeholder="Find a campaign"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {["All", "Draft", "Active", "Paused", "Archived"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="gym-error">
            {error}
          </p>
        )}
        {!campaigns.length ? (
          <Empty>
            <Megaphone size={25} />
            {state.campaigns.length
              ? "No matching campaigns."
              : "Create your first offer, announcement or membership promotion."}
          </Empty>
        ) : (
          <div className="gym-campaign-grid">
            {campaigns.map((c) => (
              <article key={c.id} className="gym-campaign-card">
                <div className="gym-panel-heading">
                  <span className="gym-eyebrow">{c.type}</span>
                  <Badge>
                    {campaignIsLive(c)
                      ? "Live"
                      : c.status === "Active"
                        ? Date.parse(c.startsAt) > Date.now()
                          ? "Scheduled"
                          : "Ended"
                        : c.status}
                  </Badge>
                </div>
                <h3>{c.title}</h3>
                <p>{c.message}</p>
                <small>
                  {dateTime(c.startsAt)} → {dateTime(c.endsAt)}
                </small>
                <div className="gym-inline-actions">
                  <button
                    className="gym-button secondary"
                    onClick={() => edit(c)}
                  >
                    Edit / manage
                  </button>
                  <button
                    className="gym-button secondary"
                    onClick={() => showIdentity(c)}
                    disabled={loadingId === c.id}
                  >
                    <QrCode size={16} />
                    {loadingId === c.id ? "Loading…" : "QR & identity"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {identity && (
          <div className="gym-identity">
            <img
              src={identity.qr}
              alt={`Scannable campaign QR for ${identity.title}`}
            />
            <div>
              <h3>{identity.title}</h3>
              <p className="gym-muted">
                Scan to open this campaign. Analytics are collected only when
                active.
              </p>
              <p className="gym-code">{identity.code}</p>
              <a
                href={identity.url}
                target="_blank"
                rel="noreferrer"
                className="gym-link"
              >
                Open campaign ↗
              </a>
              <div className="gym-inline-actions">
                <button
                  className="gym-button secondary"
                  onClick={() =>
                    downloadBlob(
                      new Blob(
                        [decodeURIComponent(identity.qr.split(",")[1])],
                        { type: "image/svg+xml" },
                      ),
                      "noq-campaign-qr.svg",
                    )
                  }
                >
                  Download QR
                </button>
                <button
                  className="gym-button secondary"
                  onClick={() => setIdentity(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Panel>
      <ReportsPanel
        gymId={gymId}
        owner
        campaigns={state.campaigns}
        campaignOnly
      />
    </>
  );
}
