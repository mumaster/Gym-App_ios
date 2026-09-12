import type { Workout } from "./types";

export function topOfRepRange(targetReps: string): number {
  const nums = (targetReps.match(/\d+/g) ?? []).map(Number);
  return nums.length ? Math.max(...nums) : 8;
}

export interface ProgressionSuggestion {
  weight: number;
  /** True when this suggestion bumps weight above what was last used. */
  bumped: boolean;
  reason: string;
}

/**
 * Progressive-overload suggestion for an exercise: if every working set in the
 * most recent session that included it reached the top of the target rep
 * range, suggest a small weight bump (~2.5%, rounded to the nearest 0.5kg);
 * otherwise suggest repeating the same weight.
 */
export function suggestWeight(
  exerciseId: string,
  workouts: Workout[],
  targetReps: string,
): ProgressionSuggestion | null {
  const lastWorkout = workouts.find((w) =>
    w.completed_sets.some((s) => s.exercise_id === exerciseId && s.set_type === "working"),
  );
  if (!lastWorkout) return null;

  const sets = lastWorkout.completed_sets.filter(
    (s) => s.exercise_id === exerciseId && s.set_type === "working",
  );
  if (!sets.length) return null;

  const lastWeight = sets[sets.length - 1]!.weight;
  if (lastWeight <= 0) return null;

  const top = topOfRepRange(targetReps);
  const allHitTop = sets.every((s) => s.reps >= top);
  if (!allHitTop) {
    return { weight: lastWeight, bumped: false, reason: "Matching your last session's weight." };
  }

  const bump = Math.max(0.5, Math.round((lastWeight * 0.025) / 0.5) * 0.5);
  return {
    weight: Number((lastWeight + bump).toFixed(2)),
    bumped: true,
    reason: `You hit ${top}+ reps on every set last time — try adding a little weight.`,
  };
}
