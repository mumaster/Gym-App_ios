import { exerciseById } from "./data";
import { readinessNoteKind, readinessWeightFactor, type ReadinessScore } from "./readiness";
import type { Muscle, Workout } from "./types";

/** Translated copy this module needs but can't import directly (a plain lib
 *  file, no access to useTranslation()) — the caller passes its own
 *  `t.progression` from lib/gym/i18n.ts, defaulting to English so an
 *  un-migrated caller still works. */
export interface ProgressionCopy {
  hitTop: (top: number) => string;
  hitTopOnce: (top: number) => string;
  matching: string;
  noteTrimmedLot: string;
  noteTrimmedLittle: string;
  noteNudgedUp: string;
}

const DEFAULT_COPY: ProgressionCopy = {
  hitTop: (top) =>
    `You hit ${top}+ reps on every set in your last two sessions — time to add weight.`,
  hitTopOnce: (top) =>
    `You hit ${top}+ reps on every set last time — do it once more at this weight, then add weight.`,
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
 * Load-increase rule, from two published sources rather than a round number:
 *
 * - When: the ACSM position stand on progression models in resistance
 *   training (Ratamess et al., Med Sci Sports Exerc 2009) recommends raising
 *   the load once the current one can be done for one to two reps over the
 *   target "on two consecutive training sessions"; the NSCA's "2-for-2 rule"
 *   says the same. Here that means every working set reached the top of the
 *   rep range in each of the last two sessions with this exercise.
 * - How much: ACSM gives 2–10% (lower for small muscle mass, higher for
 *   large); the NSCA splits it as 2.5–5% for upper-body and 5–10% for
 *   lower-body exercises. The conservative end of each NSCA range is used,
 *   never less than one loadable plate step.
 */
const UPPER_BODY_INCREASE = 0.025;
const LOWER_BODY_INCREASE = 0.05;
const LOWER_BODY: ReadonlySet<Muscle> = new Set(["Quads", "Hamstrings", "Glutes", "Calves"]);

const workingSets = (w: Workout, exerciseId: string) =>
  w.completed_sets.filter((s) => s.exercise_id === exerciseId && s.set_type === "working");

/**
 * Progressive-overload suggestion for an exercise, using double progression:
 * once every working set reached the top of the target rep range in the last
 * two sessions that included it, suggest a load increase (see the constants
 * above) and reset the rep target to the bottom of the range; otherwise
 * repeat the same weight and aim for one more rep than the worst set last
 * time (capped at the top of the range). When `readinessScore` is given
 * (today's check-in), the weight is further scaled — see readiness.ts.
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
  const sessions = workouts.filter((w) => workingSets(w, exerciseId).length > 0).slice(0, 2);
  const sets = sessions[0] ? workingSets(sessions[0], exerciseId) : [];
  if (!sets.length) return null;

  const lastWeight = sets[sets.length - 1]!.weight;
  if (lastWeight <= 0) return null;

  const [bottom, top] = repRange(targetReps);
  const hitTop = (w: Workout) => workingSets(w, exerciseId).every((s) => s.reps >= top);
  const hitTopLast = hitTop(sessions[0]!);
  const hitTopTwice = hitTopLast && sessions.length === 2 && hitTop(sessions[1]!);
  const minRepsLastTime = Math.min(...sets.map((s) => s.reps));
  const primary = exerciseById(exerciseId)?.primary_muscle;
  const increase = primary && LOWER_BODY.has(primary) ? LOWER_BODY_INCREASE : UPPER_BODY_INCREASE;

  const base = hitTopTwice
    ? {
        weight: lastWeight + Math.max(roundStep, roundToStep(lastWeight * increase, roundStep)),
        reps: bottom,
        reason: copy.hitTop(top),
      }
    : hitTopLast
      ? { weight: lastWeight, reps: top, reason: copy.hitTopOnce(top) }
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
