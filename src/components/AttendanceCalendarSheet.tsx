import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, Loader2, TrendingUp, X } from 'lucide-react';
import { gymCustomerService } from '../services/gymCustomerService';

const MONTH_LABEL = (ym: string) => {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const shiftMonth = (ym: string, delta: number) => {
  const [year, month] = ym.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

/**
 * Real membership + attendance history — Joined/Valid till/remaining days
 * plus a monthly calendar of actual check-in days (never fabricated), fed
 * entirely by gymCustomerService.getMyAttendance (the same GymVisit rows
 * and streak definition Live Floor and the Member card summary use).
 */
export const AttendanceCalendarSheet: React.FC<{ gymId: string; onClose: () => void }> = ({ gymId, onClose }) => {
  const [month, setMonth] = useState(currentMonthKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof gymCustomerService.getMyAttendance>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    gymCustomerService.getMyAttendance(gymId, month)
      .then((res) => { if (!cancelled) { setData(res); setError(''); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load attendance.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gymId, month]);

  const attendedSet = useMemo(() => new Set(data?.attendedDays || []), [data]);

  const gridDays = useMemo(() => {
    const [year, mon] = month.split('-').map(Number);
    const firstOfMonth = new Date(year, mon - 1, 1);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const leadingBlanks = firstOfMonth.getDay();
    const cells: (string | null)[] = Array.from({ length: leadingBlanks }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(`${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
    return cells;
  }, [month]);

  const membership = data?.membership;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Attendance calendar" className="max-h-[86vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--noq-surface-soft)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-white sm:max-w-sm sm:rounded-3xl sm:pb-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Membership & attendance</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"><X className="h-4 w-4" /></button>
        </div>

        {loading && !data ? (
          <div className="flex h-40 items-center justify-center text-white/50"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            {membership && (
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-white/45">Joined</p>
                  <p className="mt-0.5 text-xs font-bold text-white">{new Date(membership.joinedDate).toLocaleDateString()}</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-white/45">Valid till</p>
                  <p className="mt-0.5 text-xs font-bold text-white">{new Date(membership.expiryDate).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2 rounded-xl bg-white/[0.04] p-3 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-white/45">{membership.displayStatus === 'expired' ? 'Expired' : 'Days remaining'}</p>
                  <p className="mt-0.5 text-sm font-extrabold text-[var(--noq-accent)]">{membership.displayStatus === 'expired' ? 'Renew to continue' : `${membership.daysRemaining} day${membership.daysRemaining === 1 ? '' : 's'} left`}</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white"><ChevronLeft className="h-4 w-4" /></button>
              <p className="text-sm font-bold text-white">{MONTH_LABEL(month)}</p>
              <button onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month" disabled={month >= currentMonthKey()} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i} className="text-[9px] font-bold uppercase text-white/35">{d}</span>
              ))}
              {gridDays.map((dayKey, index) => (
                <span
                  key={dayKey || `blank-${index}`}
                  className={`flex h-7 items-center justify-center rounded-lg text-[10px] font-semibold ${
                    !dayKey ? '' : attendedSet.has(dayKey) ? 'bg-[var(--noq-accent-deep)] text-white' : 'text-white/40'
                  }`}
                >
                  {dayKey ? Number(dayKey.slice(-2)) : ''}
                </span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/[0.04] p-2.5">
                <div className="text-sm font-extrabold text-white">{data?.visitsThisMonth ?? 0}</div>
                <div className="text-[9px] font-semibold text-white/45">Visits</div>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-2.5">
                <div className="flex items-center justify-center gap-1 text-sm font-extrabold text-[var(--noq-accent)]"><Flame className="h-3.5 w-3.5" />{data?.currentStreak ?? 0}</div>
                <div className="text-[9px] font-semibold text-white/45">Streak</div>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-2.5">
                <div className="flex items-center justify-center gap-1 text-sm font-extrabold text-white"><TrendingUp className="h-3.5 w-3.5 text-[var(--noq-accent)]" />{data?.bestStreak ?? 0}</div>
                <div className="text-[9px] font-semibold text-white/45">Best</div>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-white/35">Streak = consecutive days checked in, ending today or yesterday. Best = your longest streak ever recorded here.</p>

            {error && <p className="mt-3 text-xs font-semibold text-rose-300">{error}</p>}
          </>
        )}
      </section>
    </div>
  );
};
