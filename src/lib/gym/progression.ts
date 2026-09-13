import { readinessNote, readinessWeightFactor, type ReadinessScore } from "./readiness";
import type { Workout } from "./types";

export function topOfRepRange(targetReps: string): number {
  const nums = (targetReps.match(/\d+/g) ?? []).map(Number);
  return nums.length ? Math.max(...nums) : 8;
}

export interface ProgressionSuggestion {
  weight: number;
  /** True when this suggestion bumps weight above what was last used. */
  bumped: boolean;
  /** Direction of `weight` relative to what was last used — drives which icon/copy to show. */
  direction: "up" | "down" | "same";
  reason: string;
}

const roundToHalf = (n: number) => Math.round(n / 0.5) * 0.5;

/**
 * Progressive-overload suggestion for an exercise: if every working set in the
 * most recent session that included it reached the top of the target rep
 * range, suggest a small weight bump (~2.5%, rounded to the nearest 0.5kg);
 * otherwise suggest repeating the same weight. When `readinessScore` is
 * given (today's how-are-you-feeling check-in), the result is further
 * scaled — trimmed on a rough day, nudged up on a great one — so the
 * check-in actually changes what gets suggested, not just logged.
 */
export function suggestWeight(
  exerciseId: string,
  workouts: Workout[],
  targetReps: string,
  readinessScore?: ReadinessScore,
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
  const base = allHitTop
    ? {
        weight: lastWeight + Math.max(0.5, roundToHalf(lastWeight * 0.025)),
        reason: `You hit ${top}+ reps on every set last time — try adding a little weight.`,
      }
    : { weight: lastWeight, reason: "Matching your last session's weight." };

  const factor = readinessWeightFactor(readinessScore);
  const weight = Number(roundToHalf(base.weight * factor).toFixed(2));
  const note = readinessNote(readinessScore);
  const reason = note ? `${base.reason} ${note}` : base.reason;
  const direction = weight > lastWeight ? "up" : weight < lastWeight ? "down" : "same";

  return { weight, bumped: direction === "up", direction, reason };
}
