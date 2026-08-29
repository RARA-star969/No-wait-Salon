import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { workoutPlanService, workoutDayLabel, type WorkoutDay, type WorkoutExercise, type WorkoutPlan } from '../services/workoutPlanService';

const GOALS = ['Weight Loss', 'Weight Gain', 'Strength', 'General Fitness', 'Custom'] as const;

/** Mon…Sun display order — JS's own 0=Sun..6=Sat storage stays untouched;
 *  this only reorders how the week is walked through while editing. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const emptyDay = (dayOfWeek: number): WorkoutDay => ({
  dayOfWeek,
  label: workoutDayLabel(dayOfWeek) === 'Sun' || workoutDayLabel(dayOfWeek) === 'Sat' ? 'Rest' : 'Workout',
  isRest: dayOfWeek === 0 || dayOfWeek === 6,
  exercises: [],
});

const emptyExercise = (): WorkoutExercise => ({
  id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  sets: 3,
  reps: 10,
});

/**
 * Weekly workout plan setup for ONE gym membership — "set up once, that
 * Gym's Member card shows today's plan automatically" per the
 * workoutPlanService contract. Scoped by customerId + gymId: Iron House
 * and any other gym membership each carry their own independent plan, so
 * this always operates on the specific `gymId` it was opened with.
 * Reachable from Customer Profile (per gym membership) and from that
 * gym's Member card empty state.
 */
export const WorkoutPlanEditor: React.FC<{ gymId: string; gymName: string; onClose: () => void; onSaved?: (plan: WorkoutPlan) => void }> = ({ gymId, gymName, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [goal, setGoal] = useState<string>('General Fitness');
  const [customGoal, setCustomGoal] = useState('');
  const [days, setDays] = useState<WorkoutDay[]>(DISPLAY_ORDER.map((dow) => emptyDay(dow)));
  const [expandedDow, setExpandedDow] = useState<number | null>(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setGoal('General Fitness');
    setCustomGoal('');
    setDays(DISPLAY_ORDER.map((dow) => emptyDay(dow)));
    workoutPlanService.get(gymId).then(({ plan }) => {
      if (cancelled) return;
      if (plan) {
        const known = GOALS.includes(plan.goal as any);
        setGoal(known ? plan.goal : 'Custom');
        if (!known) setCustomGoal(plan.goal);
        const byDow = new Map(plan.days.map((d) => [d.dayOfWeek, d]));
        setDays(DISPLAY_ORDER.map((dow) => byDow.get(dow) || emptyDay(dow)));
      }
    }).catch(() => setError('Could not load your workout plan.')).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gymId]);

  const updateDay = (dayOfWeek: number, patch: Partial<WorkoutDay>) => {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
  };

  const addExercise = (dayOfWeek: number) => {
    updateDay(dayOfWeek, { exercises: [...(days.find((d) => d.dayOfWeek === dayOfWeek)?.exercises || []), emptyExercise()] });
  };

  const updateExercise = (dayOfWeek: number, exerciseId: string, patch: Partial<WorkoutExercise>) => {
    const day = days.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return;
    updateDay(dayOfWeek, { exercises: day.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, ...patch } : ex)) });
  };

  const removeExercise = (dayOfWeek: number, exerciseId: string) => {
    const day = days.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return;
    updateDay(dayOfWeek, { exercises: day.exercises.filter((ex) => ex.id !== exerciseId) });
  };

  const moveExercise = (dayOfWeek: number, index: number, direction: -1 | 1) => {
    const day = days.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return;
    const target = index + direction;
    if (target < 0 || target >= day.exercises.length) return;
    const next = [...day.exercises];
    [next[index], next[target]] = [next[target], next[index]];
    updateDay(dayOfWeek, { exercises: next });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const plan: WorkoutPlan = { goal: goal === 'Custom' ? (customGoal.trim() || 'Custom') : goal, days };
      const result = await workoutPlanService.save(gymId, plan);
      onSaved?.(result.plan);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your workout plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#F8FAFA]">
      <header className="flex items-center gap-3 border-b border-[#E1E7E6] bg-white px-4 py-3">
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0F5F4] text-[#17201F]"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-[#17201F]">Workout Plan · {gymName}</h1>
          <p className="truncate text-[11px] text-[#5C6E6B]">Set it up once — this gym's profile shows today's plan automatically</p>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-[#5C6E6B]"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#5C6E6B]">Fitness goal</p>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGoal(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${goal === option ? 'border-[#6B21A8] bg-[#6B21A8] text-white' : 'border-[#DDE5E3] bg-white text-[#5C6E6B]'}`}
                >
                  {option}
                </button>
              ))}
            </div>
            {goal === 'Custom' && (
              <input
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="e.g. Marathon training"
                className="mt-2 w-full rounded-xl border border-[#DDE5E3] bg-white px-3 py-2 text-sm text-[#17201F]"
              />
            )}
          </section>

          <section className="mt-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#5C6E6B]">Weekly split</p>
            <div className="space-y-2">
              {days.map((day) => {
                const expanded = expandedDow === day.dayOfWeek;
                return (
                  <div key={day.dayOfWeek} className="overflow-hidden rounded-xl border border-[#DDE5E3] bg-white">
                    <button
                      type="button"
                      onClick={() => setExpandedDow(expanded ? null : day.dayOfWeek)}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                    >
                      <span className="w-9 shrink-0 text-[11px] font-extrabold uppercase text-[#5C6E6B]">{workoutDayLabel(day.dayOfWeek)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-[#17201F]">{day.label || (day.isRest ? 'Rest' : 'Workout')}</span>
                        {!day.isRest && <span className="block text-[10px] text-[#8A9997]">{day.exercises.length} exercise{day.exercises.length === 1 ? '' : 's'}</span>}
                      </span>
                      {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-[#8A9997]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[#8A9997]" />}
                    </button>

                    {expanded && (
                      <div className="space-y-3 border-t border-[#EEF2F1] px-3.5 py-3.5">
                        <div className="flex items-center gap-2">
                          <input
                            value={day.label}
                            onChange={(e) => updateDay(day.dayOfWeek, { label: e.target.value })}
                            placeholder="e.g. Push Day"
                            className="min-w-0 flex-1 rounded-lg border border-[#DDE5E3] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#17201F]"
                          />
                          <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[#5C6E6B]">
                            <input
                              type="checkbox"
                              checked={day.isRest}
                              onChange={(e) => updateDay(day.dayOfWeek, { isRest: e.target.checked, exercises: e.target.checked ? [] : day.exercises })}
                            />
                            Rest day
                          </label>
                        </div>

                        {!day.isRest && (
                          <div className="space-y-2">
                            {day.exercises.map((exercise, index) => (
                              <div key={exercise.id} className="rounded-lg border border-[#EEF2F1] bg-[#F8FAFA] p-2.5">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    value={exercise.name}
                                    onChange={(e) => updateExercise(day.dayOfWeek, exercise.id, { name: e.target.value })}
                                    placeholder="Exercise name"
                                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-white px-2 py-1.5 text-xs font-semibold text-[#17201F] focus:border-[#DDE5E3]"
                                  />
                                  <button onClick={() => index > 0 && moveExercise(day.dayOfWeek, index, -1)} disabled={index === 0} aria-label="Move up" className="rounded-full p-1 text-[#5C6E6B] disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => index < day.exercises.length - 1 && moveExercise(day.dayOfWeek, index, 1)} disabled={index === day.exercises.length - 1} aria-label="Move down" className="rounded-full p-1 text-[#5C6E6B] disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => removeExercise(day.dayOfWeek, exercise.id)} aria-label="Remove exercise" className="rounded-full p-1 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                                  <label className="col-span-1">
                                    <span className="block text-[9px] font-bold uppercase text-[#8A9997]">Sets</span>
                                    <input type="number" min={0} max={20} value={exercise.sets} onChange={(e) => updateExercise(day.dayOfWeek, exercise.id, { sets: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} className="w-full rounded-lg border border-[#DDE5E3] bg-white px-2 py-1 text-xs text-[#17201F]" />
                                  </label>
                                  <label className="col-span-1">
                                    <span className="block text-[9px] font-bold uppercase text-[#8A9997]">Reps</span>
                                    <input type="number" min={0} max={200} value={exercise.reps} onChange={(e) => updateExercise(day.dayOfWeek, exercise.id, { reps: Math.max(0, Math.min(200, Number(e.target.value) || 0)) })} className="w-full rounded-lg border border-[#DDE5E3] bg-white px-2 py-1 text-xs text-[#17201F]" />
                                  </label>
                                  <label className="col-span-2">
                                    <span className="block text-[9px] font-bold uppercase text-[#8A9997]">Weight (optional)</span>
                                    <input value={exercise.targetWeight || ''} onChange={(e) => updateExercise(day.dayOfWeek, exercise.id, { targetWeight: e.target.value })} placeholder="e.g. 40kg" className="w-full rounded-lg border border-[#DDE5E3] bg-white px-2 py-1 text-xs text-[#17201F]" />
                                  </label>
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addExercise(day.dayOfWeek)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#C9D2D0] py-2 text-xs font-bold text-[#5C6E6B]"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add exercise
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
        </div>
      )}

      <div className="border-t border-[#E1E7E6] bg-white px-4 py-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6B21A8] py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save workout plan
        </button>
      </div>
    </div>
  );
};
