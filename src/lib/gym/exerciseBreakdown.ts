import { estimated1RM } from "./progress";
import type { LoggedSet, Workout } from "./types";

/** One exercise's slice of a finished session. */
export interface ExerciseBreakdown {
  id: string;
  /** Every logged set of the exercise, warm-ups included, in logged order. */
  rows: LoggedSet[];
  /** The best working set by estimated 1RM; null when only warm-ups were logged. */
  bestSet: LoggedSet | null;
  bestE1rm: number;
  /** Whether `bestE1rm` beats the exercise's best across all other sessions. */
  isPR: boolean;
}

/**
 * The per-exercise breakdown of `workout`, in the order each exercise was
 * first logged. A PR is judged against the best estimated-1RM per exercise
 * across all *other* sessions (warm-ups excluded) — the same definition
 * progress.ts and the History tab use, so a set badged "PR" in the session
 * summary or History detail always agrees with the PR list there.
 */
export function exerciseBreakdown(workout: Workout, workouts: Workout[]): ExerciseBreakdown[] {
  const priorBestE1rm = new Map<string, number>();
  for (const w of workouts) {
    if (w.id === workout.id) continue;
    for (const s of w.completed_sets) {
      if (s.set_type === "warmup") continue;
      const e1rm = estimated1RM(s);
      priorBestE1rm.set(s.exercise_id, Math.max(priorBestE1rm.get(s.exercise_id) ?? 0, e1rm));
    }
  }

  const sets = workout.completed_sets;
  return [...new Set(sets.map((s) => s.exercise_id))].map((id) => {
    const rows = sets.filter((s) => s.exercise_id === id);
    const bestSet = rows
      .filter((s) => s.set_type === "working")
      .reduce<LoggedSet | null>(
        (best, s) => (!best || estimated1RM(s) > estimated1RM(best) ? s : best),
        null,
      );
    const bestE1rm = bestSet ? estimated1RM(bestSet) : 0;
    return {
      id,
      rows,
      bestSet,
      bestE1rm,
      isPR: bestE1rm > 0 && bestE1rm > (priorBestE1rm.get(id) ?? 0),
    };
  });
}
