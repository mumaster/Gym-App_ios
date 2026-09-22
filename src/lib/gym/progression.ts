import { readinessNoteKind, readinessWeightFactor, type ReadinessScore } from "./readiness";
import type { Workout } from "./types";

/** Translated copy this module needs but can't import directly (a plain lib
 *  file, no access to useTranslation()) — the caller passes its own
 *  `t.progression` from lib/gym/i18n.ts, defaulting to English so an
 *  un-migrated caller still works. */
export interface ProgressionCopy {
  hitTop: (top: number) => string;
  matching: string;
  noteTrimmedLot: string;
  noteTrimmedLittle: string;
  noteNudgedUp: string;
}

const DEFAULT_COPY: ProgressionCopy = {
  hitTop: (top) => `You hit ${top}+ reps on every set last time — try adding a little weight.`,
  matching: "Matching your last session's weight — aim for one more rep.",
  noteTrimmedLot: "Trimmed a good bit — you checked in wiped out today.",
  noteTrimmedLittle: "Trimmed a little for today's readiness.",
  noteNudgedUp: "Nudged up — you're feeling great today.",
};

/** [low, high] parsed from a target_reps string like "8-12" or a single number like "5". */
export function repRange(targetReps: string): [number, number] {
  const nums = (targetReps.match(/\d+/g) ?? []).map(Number);
  if (!nums.length) return [8, 8];
  return [Math.min(...nums), Math.max(...nums)];
}

export function topOfRepRange(targetReps: string): number {
  return repRange(targetReps)[1];
}

export interface ProgressionSuggestion {
  weight: number;
  /** Reps to aim for on working sets this time — part of the same
   *  double-progression suggestion as `weight`, not an independent value. */
  reps: number;
  /** True when this suggestion bumps weight above what was last used. */
  bumped: boolean;
  /** Direction of `weight` relative to what was last used — drives which icon/copy to show. */
  direction: "up" | "down" | "same";
  reason: string;
}

export const roundToStep = (n: number, step: number) =>
  step > 0 ? Math.round(n / step) * step : n;

/**
 * Progressive-overload suggestion for an exercise, using double progression:
 * if every working set in the most recent session that included it reached
 * the top of the target rep range, suggest a small weight bump (~2.5%) and
 * reset the rep target back to the bottom of the range; otherwise suggest
 * repeating the same weight and aiming for one more rep than the worst set
 * last time (capped at the top of the range). When `readinessScore` is given
 * (today's how-are-you-feeling check-in), the weight is further scaled —
 * trimmed on a rough day, nudged up on a great one — so the check-in
 * actually changes what gets suggested, not just logged.
 *
 * `roundStep` rounds the suggested weight to a realistically loadable
 * increment (see lib/gym/plates.ts's `plateStep` — the smallest jump
 * actually achievable with the exercise's equipment and the user's owned
 * plates/dumbbells). Defaults to a plain 0.5kg round for callers that don't
 * have an `Exercise`/`EquipmentProfile` in scope to compute a real step.
 */
export function suggestWeight(
  exerciseId: string,
  workouts: Workout[],
  targetReps: string,
  readinessScore?: ReadinessScore,
  roundStep = 0.5,
  copy: ProgressionCopy = DEFAULT_COPY,
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

  const [bottom, top] = repRange(targetReps);
  const allHitTop = sets.every((s) => s.reps >= top);
  const minRepsLastTime = Math.min(...sets.map((s) => s.reps));

  const base = allHitTop
    ? {
        weight: lastWeight + Math.max(roundStep, roundToStep(lastWeight * 0.025, roundStep)),
        reps: bottom,
        reason: copy.hitTop(top),
      }
    : {
        weight: lastWeight,
        reps: Math.min(top, minRepsLastTime + 1),
        reason: copy.matching,
      };

  const factor = readinessWeightFactor(readinessScore);
  const weight = Number(roundToStep(base.weight * factor, roundStep).toFixed(2));
  const noteKind = readinessNoteKind(readinessScore);
  const note =
    noteKind === "trimmedLot"
      ? copy.noteTrimmedLot
      : noteKind === "trimmedLittle"
        ? copy.noteTrimmedLittle
        : noteKind === "nudgedUp"
          ? copy.noteNudgedUp
          : null;
  const reason = note ? `${base.reason} ${note}` : base.reason;
  const direction = weight > lastWeight ? "up" : weight < lastWeight ? "down" : "same";

  return { weight, reps: base.reps, bumped: direction === "up", direction, reason };
}
