import React, { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, ChevronRight, Dumbbell, LoaderCircle } from 'lucide-react';
import { gymCustomerService, GymMembershipView, type GymVisitActivity } from '../services/gymCustomerService';
import { formatGymClock, formatGymTimeWithDay, gymVisitDurationLabel } from '../shared/gymTime';
import { activeAccessHeading } from '../shared/gymLiveFloor';

type MembershipEntry = { gymId: string; gymName: string; membership: GymMembershipView };

const membershipStatusLabel = (status: GymMembershipView['displayStatus']) =>
  status === 'expired' ? 'Expired' : status === 'expires_today' ? 'Expires today' : status === 'expiring_soon' ? 'Expiring soon' : 'Activated';

const membershipStatusClass = (status: GymMembershipView['displayStatus']) =>
  status === 'expired'
    ? 'bg-rose-50 text-rose-700'
    : status === 'expires_today' || status === 'expiring_soon'
    ? 'bg-amber-50 text-amber-800'
    : 'bg-[var(--category-tint-10)] text-[var(--category-primary-dark)]';

/**
 * Dedicated in-app Gym Activity screen — replaces the old Profile dropdown.
 * Lists every gym membership this customer holds as a clean card; tapping
 * one opens that gym's Member Hub. Real GymVisit rows only, same source as
 * the owner's Live Floor — an empty account just says so.
 */
export const GymActivityScreen: React.FC<{
  onBack: () => void;
  onOpenMemberHub: (gymId: string, gymName: string) => void;
  /** Upgrade from an in-progress visit deliberately opens the gym's own
   * page (where the real access/upgrade sheet lives) rather than
   * duplicating that flow inside Profile. */
  onOpenGym?: (gymId: string) => void;
}> = ({ onBack, onOpenMemberHub, onOpenGym }) => {
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<MembershipEntry[]>([]);
  const [active, setActive] = useState<GymVisitActivity[]>([]);
  const [recent, setRecent] = useState<GymVisitActivity[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());

  const load = async () => {
    try {
      const data = await gymCustomerService.getMyGymMemberships();
      setMemberships(data.memberships);
      setActive(data.activeVisits || []);
      setRecent(data.recentVisits || []);
    } catch {
      setMemberships([]);
      setActive([]);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const poll = setInterval(() => { setNowTick(Date.now()); void load(); }, 15000);
    const tick = setInterval(() => setNowTick(Date.now()), 30000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, []);

  const checkOut = async (entry: GymVisitActivity) => {
    if (checkoutBusy) return;
    if (!window.confirm(`Are you leaving ${entry.gymName}?`)) return;
    setCheckoutBusy(entry.visit.id);
    try {
      await gymCustomerService.selfCheckout(entry.gymId, entry.visit.id);
      await load();
    } catch {
      /* the next poll re-reads the real server state */
    } finally {
      setCheckoutBusy('');
    }
  };

  return (
    <div id="gym-activity-screen" className="min-h-full bg-[var(--noq-base)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3 bg-gradient-to-b from-[#DFF1EE] to-[var(--noq-base)] px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <button onClick={onBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/80" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-[-0.03em]">My Memberships & Gym Activity</h1>
          <p className="mt-0.5 text-xs text-[#58706D]">Gym plans and visits linked to your account</p>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-10"><LoaderCircle className="h-5 w-5 animate-spin text-[var(--category-primary-dark)]" /></div>
        ) : (
          <>
            {(active.length > 0 || recent.length > 0) && (
              <div className="space-y-2 rounded-2xl border border-[#E0E7E6] bg-white p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--noq-muted)]">Gym activity</p>
                {active.map((entry) => (
                  <div key={entry.visit.id} className="rounded-xl border border-[var(--category-primary-dark)]/35 bg-[#F2FAF8] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--noq-ink)]">{entry.gymName}</span>
                      <span className="rounded-md bg-[var(--category-primary-dark)] px-2 py-0.5 text-[9px] font-extrabold uppercase text-white">
                        {activeAccessHeading(entry.visit)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--category-primary-dark)]">
                      Currently inside · Since {formatGymClock(entry.visit.checkedInAt)} · {gymVisitDurationLabel(entry.visit, nowTick)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#71807E]">{entry.accessName || 'Gym access'}</p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => checkOut(entry)}
                        disabled={checkoutBusy === entry.visit.id}
                        className="flex-1 rounded-lg bg-[var(--category-primary-dark)] py-2 text-[11px] font-bold text-white disabled:opacity-60"
                      >
                        {checkoutBusy === entry.visit.id ? 'Checking out…' : 'Check Out'}
                      </button>
                      {onOpenGym && (
                        <button
                          onClick={() => onOpenGym(entry.gymId)}
                          className="flex-1 rounded-lg border border-[var(--category-primary-dark)]/40 bg-white py-2 text-[11px] font-bold text-[var(--category-primary-dark)]"
                        >
                          Upgrade
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {recent.slice(0, 5).map((entry) => (
                  <div key={entry.visit.id} className="rounded-xl border border-[#E7EDEC] bg-[#FBFCFC] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#4C5F68]">{entry.gymName}</span>
                      <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#8B9997]">Past visit</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#71807E]">
                      {entry.accessName || 'Gym access'} · {formatGymTimeWithDay(entry.visit.checkedInAt, nowTick)} → {formatGymTimeWithDay(entry.visit.checkedOutAt, nowTick)}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#4C5F68]">Total duration: {gymVisitDurationLabel(entry.visit, nowTick)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-[#E0E7E6] bg-white p-2">
              {memberships.length === 0 ? (
                <p className="p-3 text-xs text-[#71807E]">No gym memberships linked to this account yet.</p>
              ) : (
                memberships.map((entry) => (
                  <button
                    key={entry.gymId}
                    onClick={() => onOpenMemberHub(entry.gymId, entry.gymName)}
                    className="flex w-full items-center gap-3 rounded-xl border-b border-[#EDF1F0] p-3 text-left last:border-0"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--category-tint-10)] text-[var(--category-primary-dark)]">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--category-primary-dark)]" />
                        <span className="truncate text-xs font-bold text-[var(--noq-ink)]">{entry.gymName}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#71807E]">{entry.membership.planName}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${membershipStatusClass(entry.membership.displayStatus)}`}>
                          {membershipStatusLabel(entry.membership.displayStatus)}
                        </span>
                        {entry.membership.displayStatus !== 'expired' && (
                          <span className="text-[10px] font-semibold text-[#71807E]">
                            Valid till {new Date(entry.membership.expiryDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#B9C4C2]" />
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
