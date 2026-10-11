import type { LoggedSet, PlannedExercise, Workout } from "./types";

/**
 * Settings → Move logged data: sets logged under the wrong exercise move to
 * the right one. Every field of a set (weight, reps, RPE, times, round) is
 * kept; only its exercise changes, and the source ends up with nothing from
 * the moved sessions. Pure, so it is tested without the app around it.
 */

export interface MoveState {
  workouts: Workout[];
  exerciseNotes: Record<string, string>;
}

export interface MovableSession {
  workoutId: string;
  date: string;
  /** Sets of the source exercise in this session, warm-ups included. */
  sets: number;
}

/** Finished sessions that hold sets of `exerciseId`, newest first. */
export function sessionsOf(workouts: Workout[], exerciseId: string): MovableSession[] {
  return workouts
    .map((w) => ({
      workoutId: w.id,
      date: w.date,
      sets: w.completed_sets.filter((s) => s.exercise_id === exerciseId).length,
    }))
    .filter((s) => s.sets > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Re-derive `set_number` per exercise, warm-ups and working sets apart. */
function renumber(sets: LoggedSet[]): LoggedSet[] {
  const working = new Map<string, number>();
  const warmup = new Map<string, number>();
  return sets.map((s) => {
    const counter = s.set_type === "warmup" ? warmup : working;
    const n = (counter.get(s.exercise_id) ?? 0) + 1;
    counter.set(s.exercise_id, n);
    return s.set_number === n ? s : { ...s, set_number: n };
  });
}

/** The plan entry follows the sets. If the session also planned the target,
 *  the source's entry is dropped rather than duplicated. */
function movePlan(plan: PlannedExercise[], from: string, to: string): PlannedExercise[] {
  const hasTarget = plan.some((p) => p.exercise_id === to);
  return plan.flatMap((p) => {
    if (p.exercise_id !== from) return [p];
    if (hasTarget) return [];
    const { suggested_weight: _w, suggested_reps: _r, suggested_basis: _b, ...rest } = p;
    return [{ ...rest, exercise_id: to }];
  });
}

/**
 * Moves the source's sets in `workoutIds` to `to`. The source's note goes
 * with them only when nothing of the source stays behind and the target has
 * no note of its own.
 */
export function moveExerciseData<S extends MoveState>(
  state: S,
  from: string,
  to: string,
  workoutIds: ReadonlySet<string>,
): S {
  if (from === to || workoutIds.size === 0) return state;
  const workouts = state.workouts.map((w) => {
    if (!workoutIds.has(w.id) || !w.completed_sets.some((s) => s.exercise_id === from)) return w;
    const moved = w.completed_sets.map((s) =>
      s.exercise_id === from ? { ...s, exercise_id: to } : s,
    );
    return {
      ...w,
      completed_sets: renumber(moved),
      plan: movePlan(w.plan, from, to),
    };
  });
  const leftBehind = workouts.some((w) => w.completed_sets.some((s) => s.exercise_id === from));
  let exerciseNotes = state.exerciseNotes;
  if (!leftBehind && exerciseNotes[from] && !exerciseNotes[to]) {
    const { [from]: note, ...rest } = exerciseNotes;
    exerciseNotes = { ...rest, [to]: note! };
  }
  return { ...state, workouts, exerciseNotes };
}

/** Whether the source's note would move too, for the confirmation step. */
export function noteMoves(
  state: MoveState,
  from: string,
  to: string,
  workoutIds: ReadonlySet<string>,
): boolean {
  return moveExerciseData(state, from, to, workoutIds).exerciseNotes !== state.exerciseNotes;
}
