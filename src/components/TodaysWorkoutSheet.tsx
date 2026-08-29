import React from 'react';
import { X, Dumbbell } from 'lucide-react';
import { workoutDayLabel, type WorkoutDay } from '../services/workoutPlanService';

/**
 * Read-only reference view of one day's exercise plan — fast to scan while
 * the customer is physically at the gym. Deliberately not a set-by-set
 * tracker; this pass is planning/reference only.
 */
export const TodaysWorkoutSheet: React.FC<{ day: WorkoutDay; onClose: () => void }> = ({ day, onClose }) => (
  <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={day.label} className="w-full max-h-[80vh] overflow-y-auto rounded-t-3xl bg-[#170F24] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-white sm:max-w-sm sm:rounded-3xl sm:pb-6">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2B1B45] text-[#C89CFA]"><Dumbbell className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#C89CFA]">{workoutDayLabel(day.dayOfWeek)}</p>
            <h2 className="truncate text-lg font-bold text-white">{day.label}</h2>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"><X className="h-4 w-4" /></button>
      </div>

      <div className="mt-4 space-y-2">
        {day.exercises.map((exercise) => (
          <div key={exercise.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{exercise.name}</p>
              {exercise.note && <p className="mt-0.5 text-[10px] text-white/50">{exercise.note}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-extrabold text-[#C89CFA]">{exercise.sets} × {exercise.reps}</p>
              {exercise.targetWeight && <p className="text-[10px] text-white/50">{exercise.targetWeight}</p>}
            </div>
          </div>
        ))}
        {day.exercises.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center text-xs text-white/50">No exercises added for this day yet.</p>
        )}
      </div>
    </section>
  </div>
);
