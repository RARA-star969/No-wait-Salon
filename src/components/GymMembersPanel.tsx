import React, { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  CalendarDays,
  ChevronRight,
  IndianRupee,
  Search,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import { gymStaffService } from "../services/gymStaffService";
import type { GymMembership, GymPayment, GymState } from "../shared/gymBusiness";
import {
  attendanceStreaks,
  currentMemberships,
  daysRemaining,
  EXPIRING_SOON_DAYS,
  gymPaymentRecordedAt,
  memberActivityFor,
  membershipDisplayStatus,
  monthlyAttendance,
  visitsInMonth,
  type MemberActivityBucket,
  type MembershipDisplayStatus,
} from "../shared/gymBusiness";
import { GymCustomerAvatar } from "./GymCustomerAvatar";

export type GymMembersFilter =
  | "all"
  | "active"
  | "expiring"
  | "very_active"
  | "regular"
  | "not_visiting"
  | "expired";

type MemberView = {
  membership: GymMembership;
  displayStatus: MembershipDisplayStatus;
  activity: ReturnType<typeof memberActivityFor>;
  daysLeft: number;
  visitsThisMonth: number;
  paidTotal: number;
  payments: GymPayment[];
  photoUrl?: string;
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "short" });
const monthName = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});
const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const localMonthKey = (date: Date) => localDateKey(date).slice(0, 7);
const parseIsoDay = (value: string) => new Date(`${value}T00:00:00`);
const formatDay = (value?: number | string) =>
  value === undefined || value === ""
    ? "No recorded visit"
    : shortDate.format(
        typeof value === "number" ? new Date(value) : parseIsoDay(value),
      );
const activityLabels: Record<MemberActivityBucket, string> = {
  very_active: "Very active",
  regular: "Regular",
  not_visiting: "Not visiting recently",
};
const statusLabel = (status: MembershipDisplayStatus) =>
  status === "expired"
    ? "Expired"
    : status === "expires_today"
      ? "Expires today"
      : status === "expiring_soon"
        ? "Expiring soon"
        : "Active";

const monthlyContinuationValue = (
  offering: GymState["offerings"][number],
) => {
  const months =
    offering.durationUnit === "year"
      ? offering.durationValue * 12
      : offering.durationUnit === "quarter"
        ? offering.durationValue * 3
        : offering.durationUnit === "month"
          ? offering.durationValue
          : offering.durationUnit === "week"
            ? (offering.durationValue * 7) / 30
            : offering.durationUnit === "day"
              ? offering.durationValue / 30
              : 1;
  return months > 0 ? offering.priceInr / months : 0;
};

function recentMonths(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (count - 1 - index),
      1,
    );
    return {
      key: localMonthKey(date),
      date,
      end: new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    };
  });
}

function BarChart({
  values,
  format = String,
  emptyMessage,
}: {
  values: { key: string; label: string; value: number }[];
  format?: (value: number) => string;
  emptyMessage: string;
}) {
  const max = Math.max(...values.map((point) => point.value), 0);
  if (!max)
    return <div className="gym-members-chart-empty">{emptyMessage}</div>;
  return (
    <div
      className="gym-members-bars"
      role="img"
      aria-label={values
        .map((point) => `${point.label}: ${format(point.value)}`)
        .join(", ")}
    >
      {values.map((point) => (
        <div className="gym-members-bar-column" key={point.key}>
          <span>{format(point.value)}</span>
          <div className="gym-members-bar-track">
            <i
              style={{ height: `${Math.max(7, (point.value / max) * 100)}%` }}
            />
          </div>
          <small>{point.label}</small>
        </div>
      ))}
    </div>
  );
}

export function GymMembersPanel({
  gymId,
  state,
  canDownload,
  initialFilter,
  onError,
  onNotice,
}: {
  gymId: string;
  state: GymState;
  canDownload: boolean;
  initialFilter: GymMembersFilter;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const now = Date.now();
  const nowDate = new Date(now);
  const currentMonth = localMonthKey(nowDate);
  const months = useMemo(() => recentMonths(), []);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GymMembersFilter>(initialFilter);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [from, setFrom] = useState(
    localDateKey(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)),
  );
  const [to, setTo] = useState(localDateKey(nowDate));
  const [downloading, setDownloading] = useState(false);

  const membershipOfferingIds = useMemo(
    () =>
      new Set(
        state.offerings
          .filter((offering) => offering.type === "membership")
          .map((offering) => offering.id),
      ),
    [state.offerings],
  );
  const membershipPayments = useMemo(
    () =>
      state.payments.filter(
        (payment) =>
          Boolean(payment.membershipId) ||
          membershipOfferingIds.has(payment.offeringId),
      ),
    [membershipOfferingIds, state.payments],
  );
  const memberViews = useMemo<MemberView[]>(() => {
    return currentMemberships(state.memberships)
      .map((membership) => {
        const membershipIds = new Set(
          state.memberships
            .filter((row) => row.customerId === membership.customerId)
            .map((row) => row.id),
        );
        const payments = membershipPayments
          .filter(
            (payment) =>
              payment.customerId === membership.customerId ||
              (payment.membershipId &&
                membershipIds.has(payment.membershipId)),
          )
          .sort((a, b) => gymPaymentRecordedAt(b) - gymPaymentRecordedAt(a));
        return {
          membership,
          displayStatus: membershipDisplayStatus(membership, now),
          activity: memberActivityFor(
            state.visits,
            membership.customerId,
            now,
          ),
          daysLeft: daysRemaining(membership.expiryDate, now),
          visitsThisMonth: visitsInMonth(
            state.visits,
            membership.customerId,
            currentMonth,
          ),
          paidTotal: payments
            .filter((payment) => payment.status === "paid")
            .reduce((sum, payment) => sum + payment.amountInr, 0),
          payments,
          photoUrl:
            membership.customerPhotoUrl ||
            state.visits.find(
              (visit) =>
                visit.customerId === membership.customerId &&
                visit.customerPhotoUrl,
            )?.customerPhotoUrl,
        };
      })
      .sort((a, b) =>
        a.membership.customerName.localeCompare(b.membership.customerName),
      );
  }, [currentMonth, membershipPayments, now, state.memberships, state.visits]);

  const activeMembers = memberViews.filter(
    (member) => member.displayStatus !== "expired",
  );
  const expiringMembers = activeMembers.filter(
    (member) =>
      member.displayStatus === "expiring_soon" ||
      member.displayStatus === "expires_today",
  );
  const notVisiting = activeMembers.filter(
    (member) => member.activity.bucket === "not_visiting",
  );
  const revenueThisMonth = membershipPayments
    .filter(
      (payment) =>
        payment.status === "paid" &&
        localMonthKey(new Date(gymPaymentRecordedAt(payment))) === currentMonth,
    )
    .reduce((sum, payment) => sum + payment.amountInr, 0);
  const expectedMembers = activeMembers.filter((member) =>
    state.offerings.some(
      (offering) =>
        offering.id === member.membership.offeringId &&
        offering.type === "membership",
    ),
  );
  const expectedNextMonth = expectedMembers.reduce((sum, member) => {
    const offering = state.offerings.find(
      (item) => item.id === member.membership.offeringId,
    );
    return sum + (offering ? monthlyContinuationValue(offering) : 0);
  }, 0);
  const activePayingCount = activeMembers.filter((member) =>
    member.payments.some((payment) => payment.status === "paid"),
  ).length;

  const memberTrend = months.map(({ key, date, end }) => ({
    key,
    label: monthLabel.format(date),
    value: new Set(
      state.memberships
        .filter(
          (membership) =>
            membership.status !== "cancelled" &&
            parseIsoDay(membership.joinedDate).getTime() <= end.getTime() &&
            new Date(`${membership.expiryDate}T23:59:59.999`).getTime() >=
              end.getTime(),
        )
        .map((membership) => membership.customerId),
    ).size,
  }));
  const revenueTrend = months.map(({ key, date }) => ({
    key,
    label: monthLabel.format(date),
    value: membershipPayments
      .filter(
        (payment) =>
          payment.status === "paid" &&
          localMonthKey(new Date(gymPaymentRecordedAt(payment))) === key,
      )
      .reduce((sum, payment) => sum + payment.amountInr, 0),
  }));
  const attendanceTrend = months.map(({ key, date }) => ({
    key,
    label: monthLabel.format(date),
    value: state.visits.filter(
      (visit) =>
        visit.customerId &&
        localMonthKey(new Date(visit.checkedInAt)) === key,
    ).length,
  }));
  const activitySplit = [
    {
      key: "very_active",
      label: "Very active",
      value: activeMembers.filter(
        (member) => member.activity.bucket === "very_active",
      ).length,
    },
    {
      key: "regular",
      label: "Regular",
      value: activeMembers.filter(
        (member) => member.activity.bucket === "regular",
      ).length,
    },
    {
      key: "not_visiting",
      label: "Not visiting recently",
      value: notVisiting.length,
    },
    {
      key: "expiring",
      label: "Expiring soon",
      value: expiringMembers.length,
    },
  ];
  const activityMax = Math.max(
    ...activitySplit.map((item) => item.value),
    1,
  );

  const filtered = memberViews.filter((member) => {
    const text = `${member.membership.customerName} ${member.membership.customerMobile}`.toLowerCase();
    if (!text.includes(query.trim().toLowerCase())) return false;
    if (filter === "all") return true;
    if (filter === "active") return member.displayStatus !== "expired";
    if (filter === "expired") return member.displayStatus === "expired";
    if (filter === "expiring")
      return (
        member.displayStatus === "expiring_soon" ||
        member.displayStatus === "expires_today"
      );
    return (
      member.displayStatus !== "expired" && member.activity.bucket === filter
    );
  });
  const selected = memberViews.find(
    (member) => member.membership.customerId === selectedCustomerId,
  );

  const download = async () => {
    if (!from || !to || from > to) {
      onError("Choose a valid report start and end date.");
      return;
    }
    setDownloading(true);
    try {
      const blob = await gymStaffService.exportMembersReport(gymId, {
        from,
        to,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `gym-members-${from}-to-${to}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onNotice("Member report downloaded");
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Member report download failed.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="gym-members-module">
      <div className="gym-members-kpis">
        {[
          {
            label: "Active members",
            value: activeMembers.length,
            note: `${activePayingCount} with recorded paid membership`,
            icon: UserRoundCheck,
            tone: "teal",
          },
          {
            label: "Expiring soon",
            value: expiringMembers.length,
            note: `Next ${EXPIRING_SOON_DAYS} days`,
            icon: CalendarDays,
            tone: "amber",
          },
          {
            label: "Not visiting recently",
            value: notVisiting.length,
            note: "Low or no recent attendance",
            icon: UsersRound,
            tone: "rose",
          },
          {
            label: "Revenue this month",
            value: money.format(revenueThisMonth),
            note: "Paid membership revenue only",
            icon: IndianRupee,
            tone: "navy",
          },
          {
            label: "Expected next month",
            value: money.format(expectedNextMonth),
            note: `${expectedMembers.length} active priced plans · estimate`,
            icon: TrendingUp,
            tone: "teal",
          },
        ].map((item) => (
          <article className={`gym-members-kpi ${item.tone}`} key={item.label}>
            <div>
              <span>{item.label}</span>
              <item.icon size={18} />
            </div>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </div>

      <div className="gym-members-revenue-note">
        <Sparkles size={18} />
        <div>
          <strong>
            Expected next month is an estimate, not guaranteed income.
          </strong>
          <p>
            It converts each active priced plan to a one-month continuation
            value. Claim/manual memberships without a known price are excluded.
          </p>
        </div>
        <span>
          {activeMembers.length
            ? money.format(Math.round(revenueThisMonth / activeMembers.length))
            : money.format(0)}
          <small>revenue per active member this month</small>
        </span>
      </div>

      <div className="gym-members-analytics">
        <article className="gym-members-chart-card">
          <header>
            <div>
              <span>MEMBER TREND</span>
              <h2>Active members by month</h2>
            </div>
            <UsersRound size={19} />
          </header>
          <BarChart
            values={memberTrend}
            emptyMessage="Membership dates will build this trend as members join."
          />
          <p>Members whose recorded access was active at each month end.</p>
        </article>
        <article className="gym-members-chart-card revenue">
          <header>
            <div>
              <span>REVENUE TREND</span>
              <h2>Membership revenue</h2>
            </div>
            <IndianRupee size={19} />
          </header>
          <BarChart
            values={revenueTrend}
            format={(value) =>
              value >= 1000
                ? `₹${Math.round(value / 100) / 10}k`
                : `₹${value}`
            }
            emptyMessage="Paid membership transactions will appear here."
          />
          <p>
            Paid membership transactions only; passes and services are excluded.
          </p>
        </article>
        <article className="gym-members-chart-card attendance">
          <header>
            <div>
              <span>ATTENDANCE TREND</span>
              <h2>Recorded member visits</h2>
            </div>
            <TrendingUp size={19} />
          </header>
          <BarChart
            values={attendanceTrend}
            emptyMessage="Member check-ins will build the attendance trend."
          />
          <p>Real visit records linked to a customer account.</p>
        </article>
        <article className="gym-members-chart-card activity-split">
          <header>
            <div>
              <span>ACTIVITY SPLIT</span>
              <h2>Who may need attention</h2>
            </div>
            <UserRoundCheck size={19} />
          </header>
          {activeMembers.length ? (
            <div className="gym-members-activity-list">
              {activitySplit.map((item) => (
                <div key={item.key}>
                  <span>
                    {item.label}
                    <b>{item.value}</b>
                  </span>
                  <i>
                    <em
                      style={{ width: `${(item.value / activityMax) * 100}%` }}
                    />
                  </i>
                </div>
              ))}
            </div>
          ) : (
            <div className="gym-members-chart-empty">
              Active member activity will appear here.
            </div>
          )}
          <p>Expiring soon can overlap with an attendance group.</p>
        </article>
      </div>

      {canDownload && (
        <article className="gym-members-report">
          <div className="gym-members-report-copy">
            <span>
              <ArrowDownToLine size={18} />
            </span>
            <div>
              <h2>Download member report</h2>
              <p>
                Choose a date range for membership, attendance, payment and
                renewal-ready details.
              </p>
            </div>
          </div>
          <div className="gym-members-report-fields">
            <label>
              Start date
              <input
                type="date"
                value={from}
                max={to}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={to}
                min={from}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            <button
              className="gym-button"
              disabled={downloading}
              onClick={() => void download()}
            >
              <ArrowDownToLine size={16} />
              {downloading ? "Preparing…" : "Download CSV"}
            </button>
          </div>
        </article>
      )}

      <article className="gym-members-list-panel">
        <header className="gym-members-list-heading">
          <div>
            <span>MEMBER DIRECTORY</span>
            <h2>Memberships & attendance</h2>
            <p>
              {filtered.length} of {memberViews.length} members shown
            </p>
          </div>
          <label className="gym-members-search">
            <Search size={16} />
            <input
              aria-label="Search members"
              placeholder="Search by name or mobile"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </header>
        <div className="gym-members-filter-row">
          {(
            [
              ["all", "All"],
              ["active", "Active"],
              ["expiring", "Expiring soon"],
              ["very_active", "Very active"],
              ["regular", "Regular"],
              ["not_visiting", "Not visiting recently"],
              ["expired", "Expired"],
            ] as [GymMembersFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {!memberViews.length ? (
          <div className="gym-members-empty">
            <UsersRound size={28} />
            <strong>No memberships yet</strong>
            <p>
              Approved customer claims and paid membership plans will appear
              here automatically.
            </p>
          </div>
        ) : !filtered.length ? (
          <div className="gym-members-empty">
            <Search size={25} />
            <strong>No matching members</strong>
            <p>Try another name or filter.</p>
          </div>
        ) : (
          <div className="gym-members-list">
            {filtered.map((member) => (
              <button
                className="gym-member-row"
                key={member.membership.customerId}
                onClick={() =>
                  setSelectedCustomerId(member.membership.customerId)
                }
              >
                <GymCustomerAvatar
                  name={member.membership.customerName}
                  photoUrl={member.photoUrl}
                />
                <span className="gym-member-person">
                  <strong>{member.membership.customerName}</strong>
                  <small>
                    {member.membership.customerMobile || "No mobile recorded"}
                  </small>
                </span>
                <span className="gym-member-plan">
                  <strong>{member.membership.planName}</strong>
                  <small>{formatDay(member.membership.expiryDate)} expiry</small>
                </span>
                <span className="gym-member-stat">
                  <strong>{member.visitsThisMonth}</strong>
                  <small>visits this month</small>
                </span>
                <span className="gym-member-stat last-visit">
                  <strong>
                    {member.activity.lastVisit
                      ? formatDay(member.activity.lastVisit)
                      : "No visits yet"}
                  </strong>
                  <small>last visit</small>
                </span>
                <span className={`gym-member-pill ${member.activity.bucket}`}>
                  {activityLabels[member.activity.bucket]}
                </span>
                <span
                  className={`gym-member-pill status ${member.displayStatus}`}
                >
                  {member.displayStatus === "expired"
                    ? "Expired"
                    : member.daysLeft === 0
                      ? "Expires today"
                      : `${member.daysLeft} days left`}
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        )}
      </article>

      {selected && (
        <dialog
          className="gym-member-detail"
          open
          aria-modal="true"
          aria-labelledby="gym-member-detail-title"
        >
          <button
            className="gym-member-detail-close"
            aria-label="Close member details"
            onClick={() => setSelectedCustomerId(null)}
          >
            <X size={19} />
          </button>
          <header>
            <GymCustomerAvatar
              name={selected.membership.customerName}
              photoUrl={selected.photoUrl}
              large
            />
            <div>
              <span>MEMBER PROFILE</span>
              <h2 id="gym-member-detail-title">
                {selected.membership.customerName}
              </h2>
              <p>
                {selected.membership.customerMobile ||
                  "No mobile number recorded"}
              </p>
            </div>
            <span
              className={`gym-member-pill status ${selected.displayStatus}`}
            >
              {statusLabel(selected.displayStatus)}
            </span>
          </header>
          <div className="gym-member-detail-hero">
            <div>
              <span>Current membership</span>
              <strong>{selected.membership.planName}</strong>
              <small>
                {selected.daysLeft < 0
                  ? `Expired ${Math.abs(selected.daysLeft)} days ago`
                  : selected.daysLeft === 0
                    ? "Expires today"
                    : `${selected.daysLeft} days remaining`}
              </small>
            </div>
            <div>
              <span>Attendance</span>
              <strong>{activityLabels[selected.activity.bucket]}</strong>
              <small>
                {selected.activity.visitsLast30Days} visits in the last 30 days
              </small>
            </div>
            <div>
              <span>Recorded membership revenue</span>
              <strong>{money.format(selected.paidTotal)}</strong>
              <small>Paid transactions across membership history</small>
            </div>
          </div>
          <div className="gym-member-detail-grid">
            <section>
              <h3>Membership details</h3>
              <dl>
                <div>
                  <dt>Join date</dt>
                  <dd>{formatDay(selected.membership.joinedDate)}</dd>
                </div>
                <div>
                  <dt>Expiry date</dt>
                  <dd>{formatDay(selected.membership.expiryDate)}</dd>
                </div>
                <div>
                  <dt>Last visit</dt>
                  <dd>
                    {selected.activity.lastVisit
                      ? formatDay(selected.activity.lastVisit)
                      : "No recorded visit"}
                  </dd>
                </div>
                <div>
                  <dt>Visits this month</dt>
                  <dd>{selected.visitsThisMonth}</dd>
                </div>
                <div>
                  <dt>Current streak</dt>
                  <dd>
                    {
                      attendanceStreaks(
                        state.visits,
                        selected.membership.customerId,
                      ).current
                    }{" "}
                    days
                  </dd>
                </div>
                <div>
                  <dt>Created through</dt>
                  <dd>
                    {selected.membership.source === "claim"
                      ? "Customer membership claim"
                      : selected.membership.source === "purchase"
                        ? "Membership purchase"
                        : "Manual setup"}
                  </dd>
                </div>
              </dl>
            </section>
            <section>
              <h3>Month-by-month visits</h3>
              {monthlyAttendance(
                state.visits,
                selected.membership.customerId,
              ).length ? (
                <div className="gym-member-history">
                  {monthlyAttendance(
                    state.visits,
                    selected.membership.customerId,
                  )
                    .slice(-8)
                    .reverse()
                    .map((item) => (
                      <div key={item.month}>
                        <span>
                          {monthName.format(parseIsoDay(`${item.month}-01`))}
                        </span>
                        <strong>{item.visits} visits</strong>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="gym-member-detail-empty">
                  No visit history recorded yet.
                </p>
              )}
            </section>
            <section className="payments">
              <h3>Membership payment history</h3>
              {selected.payments.length ? (
                <div className="gym-member-history">
                  {selected.payments.map((payment) => (
                    <div key={payment.id}>
                      <span>
                        {payment.offeringName}
                        <small>
                          {shortDate.format(
                            new Date(gymPaymentRecordedAt(payment)),
                          )}{" "}
                          · {payment.method === "cash" ? "Cash" : "Online"}
                        </small>
                      </span>
                      <strong>
                        {money.format(payment.amountInr)}
                        <small className={`payment-${payment.status}`}>
                          {payment.status}
                        </small>
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="gym-member-detail-empty">
                  No linked membership payment is recorded. Claimed/manual
                  memberships can be valid without a payment row.
                </p>
              )}
            </section>
          </div>
        </dialog>
      )}
    </section>
  );
}
