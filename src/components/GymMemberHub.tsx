import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, ClipboardList, Flame, LoaderCircle, Target } from 'lucide-react';
import { gymCustomerService, type GymMyMembershipResponse } from '../services/gymCustomerService';
import { formatGymTimeWithDay, gymVisitDurationLabel } from '../shared/gymTime';
import { AttendanceCalendarSheet } from './AttendanceCalendarSheet';
import { WorkoutPlanEditor } from './WorkoutPlanEditor';

/**
 * Per-gym Member Hub — the extensible home for member utilities (Workout
 * Plan, Fitness Goal, Attendance Calendar, membership details, visit
 * history). Reached only via Profile → Gym Activity → this gym, and always
 * scoped to customer + this one gymId; a second gym membership gets its own
 * independent Hub instance with its own data, never a shared one.
 *
 * Workout Plan setup/editing lives HERE (and in the nested editor it opens),
 * never on the public Gym Detail page — that page's member card is a
 * daily read-only view (today's workout, View Workout), not an editor.
 */
export const GymMemberHub: React.FC<{
  gymId: string;
  gymName: string;
  onClose: () => void;
  workoutPlanOpen: boolean;
  onOpenWorkoutPlan: () => void;
  onCloseWorkoutPlan: () => void;
}> = ({ gymId, gymName, onClose, workoutPlanOpen, onOpenWorkoutPlan, onCloseWorkoutPlan }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GymMyMembershipResponse | null>(null);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    gymCustomerService.getMyMembership(gymId).then((res) => { if (!cancelled) setData(res); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gymId]);

  const membership = data?.membership || null;
  const isCheckedIn = Boolean(data?.activeVisit);

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[var(--noq-base)]">
      <header className="flex items-center gap-3 border-b border-[var(--noq-border)] bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={onClose} aria-label="Back to Gym Activity" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--noq-surface-soft)] text-[var(--noq-ink)]">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-[var(--noq-ink)]">{gymName}</h1>
          <p className="truncate text-[11px] text-[#5C6E6B]">
            {membership ? `${membership.planName} · ${membership.displayStatus === 'expired' ? 'Expired' : 'Activated'}` : 'Membership'}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-[#5C6E6B]"><LoaderCircle className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto max-w-md space-y-3">
            {membership && (
              <div className="rounded-2xl border border-[#E0E7E6] bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--noq-ink)]">Membership details</span>
                  <span className={`rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                    membership.displayStatus === 'expired' ? 'bg-rose-50 text-rose-700'
                    : membership.displayStatus === 'expires_today' || membership.displayStatus === 'expiring_soon' ? 'bg-amber-50 text-amber-800'
                    : 'bg-[var(--category-tint-10)] text-[var(--category-primary-dark)]'
                  }`}>
                    {membership.displayStatus === 'expired' ? 'Expired' : 'Activated'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#71807E]">
                  Member since {new Date(membership.joinedDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-[var(--noq-ink)]">
                  {membership.displayStatus === 'expired'
                    ? `Expired on ${new Date(membership.expiryDate).toLocaleDateString()}`
                    : `Valid till ${new Date(membership.expiryDate).toLocaleDateString()} · ${membership.daysRemaining} day${membership.daysRemaining === 1 ? '' : 's'} left`}
                </p>
                {membership.sessionsTotal !== undefined && (
                  <p className="mt-0.5 text-[11px] font-semibold text-[var(--noq-ink)]">
                    {Math.max(membership.sessionsTotal - (membership.sessionsUsed || 0), 0)} of {membership.sessionsTotal} sessions remaining
                  </p>
                )}
                {isCheckedIn && (
                  <p className="mt-2 rounded-lg bg-[var(--category-tint-10)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--category-primary-dark)]">
                    Inside now
                  </p>
                )}
              </div>
            )}

            <button
              onClick={onOpenWorkoutPlan}
              className="flex w-full items-center gap-3 rounded-2xl border border-[#E0E7E6] bg-white p-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--category-tint-10)] text-[var(--category-primary-dark)]"><ClipboardList className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--noq-ink)]">Workout Plan</p>
                <p className="mt-0.5 text-[11px] text-[#71807E]">Set up or edit your weekly plan for {gymName}</p>
              </div>
            </button>

            <button
              onClick={() => setAttendanceOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-[#E0E7E6] bg-white p-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--category-tint-10)] text-[var(--category-primary-dark)]"><CalendarDays className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--noq-ink)]">Attendance Calendar</p>
                <p className="mt-0.5 text-[11px] text-[#71807E]">
                  {data?.attendance ? `${data.attendance.currentStreak} day streak · ${data.attendance.visitsThisMonth} visits this month` : 'Your real check-in history'}
                </p>
              </div>
            </button>

            {data?.attendance && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#E0E7E6] bg-white p-4">
                  <div className="flex items-center gap-1.5 text-[#71807E]"><Flame className="h-3.5 w-3.5" /><span className="text-[10px] font-bold uppercase tracking-wide">Current streak</span></div>
                  <p className="mt-1 text-lg font-extrabold text-[var(--noq-ink)]">{data.attendance.currentStreak} <span className="text-xs font-semibold text-[#71807E]">days</span></p>
                </div>
                <div className="rounded-2xl border border-[#E0E7E6] bg-white p-4">
                  <div className="flex items-center gap-1.5 text-[#71807E]"><Target className="h-3.5 w-3.5" /><span className="text-[10px] font-bold uppercase tracking-wide">Per week (avg)</span></div>
                  <p className="mt-1 text-lg font-extrabold text-[var(--noq-ink)]">{data.attendance.avgVisitsPerWeek}</p>
                </div>
              </div>
            )}

            {(data?.recentVisits?.length ?? 0) > 0 && (
              <div className="rounded-2xl border border-[#E0E7E6] bg-white p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--noq-muted)]">Visit history</p>
                <div className="mt-2 space-y-2">
                  {data!.recentVisits.slice(0, 8).map((visit) => (
                    <div key={visit.id} className="flex items-center justify-between border-b border-[#EDF1F0] pb-2 text-[11px] last:border-0 last:pb-0">
                      <span className="text-[#4C5F68]">{formatGymTimeWithDay(visit.checkedInAt, Date.now())}</span>
                      <span className="font-semibold text-[var(--noq-ink)]">{gymVisitDurationLabel(visit, Date.now())}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!membership && !loading && (
              <p className="rounded-2xl border border-[#E0E7E6] bg-white p-4 text-center text-xs text-[#71807E]">No active membership found for this gym.</p>
            )}
          </div>
        </div>
      )}

      {attendanceOpen && <AttendanceCalendarSheet gymId={gymId} onClose={() => setAttendanceOpen(false)} />}
      {workoutPlanOpen && (
        <WorkoutPlanEditor gymId={gymId} gymName={gymName} onClose={onCloseWorkoutPlan} />
      )}
    </div>
  );
};
