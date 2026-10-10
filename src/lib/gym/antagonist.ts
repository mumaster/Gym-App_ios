import { popularityOf } from "./exercisePopularity";
import type { Exercise, Muscle } from "./types";

/**
 * Opposing (push/pull) muscle pairings used by the antagonist superset method.
 * Arms is a single group in the taxonomy, so biceps/triceps are separated by
 * the exercise's movement pattern (push = triceps, pull = biceps).
 */
export const ANTAGONIST_MUSCLES: Record<Muscle, Muscle[]> = {
  Chest: ["Back"],
  Back: ["Chest", "Shoulders"],
  Shoulders: ["Back"],
  Arms: ["Arms"],
  Quads: ["Hamstrings", "Glutes"],
  Hamstrings: ["Quads"],
  Glutes: ["Quads"],
  Core: ["Back"],
  Calves: ["Core"],
};

const isPush = (e: Exercise) => e.movement_pattern === "push";
const isPull = (e: Exercise) => e.movement_pattern === "pull";

/** True when the two exercises train opposing muscle groups. */
export function isAntagonistPair(a: Exercise, b: Exercise): boolean {
  const ma = a.primary_muscle;
  const mb = b.primary_muscle;
  if (ma === "Arms" && mb === "Arms") {
    // biceps (pull) vs triceps (push)
    return (isPush(a) && isPull(b)) || (isPull(a) && isPush(b));
  }
  if (ma === mb) return false;
  // Checked both ways: ANTAGONIST_MUSCLES isn't a symmetric table (e.g. Core
  // lists Back but Back doesn't list Core back), so relying on only a's entry
  // made pairing/swap results depend on which exercise happened to be "a".
  return (
    (ANTAGONIST_MUSCLES[ma]?.includes(mb) ?? false) ||
    (ANTAGONIST_MUSCLES[mb]?.includes(ma) ?? false)
  );
}

/** The muscle to show for an exercise: Arms is split into Biceps (pull) and
 *  Triceps (push), anything else keeps its group. An arm exercise that is
 *  neither (a custom one) stays "Arms". */
export function muscleLabel(e: Exercise): string {
  if (e.primary_muscle !== "Arms") return e.primary_muscle;
  return isPush(e) ? "Triceps" : isPull(e) ? "Biceps" : "Arms";
}

/** Muscles that oppose this exercise, for user-facing copy. */
export function antagonistLabel(a: Exercise, b: Exercise): string {
  return `${muscleLabel(a)} / ${muscleLabel(b)}`.toUpperCase();
}

export const opposingLabel = (a: Exercise): string => {
  if (a.primary_muscle === "Arms") return isPush(a) ? "Biceps" : "Triceps";
  return (ANTAGONIST_MUSCLES[a.primary_muscle] ?? []).join(" / ") || "another muscle group";
};

/** Exercises from the pool that form a valid antagonist pair with `a`. */
/** Partners that pair with `a` as an antagonist superset, most popular first
 *  (exercisePopularity.ts). */
export function antagonistAlternatives(a: Exercise, pool: Exercise[]): Exercise[] {
  return pool
    .filter((e) => e.id !== a.id && isAntagonistPair(a, e))
    .sort((x, y) => popularityOf(y.id) - popularityOf(x.id));
}

/** Swaps for `current` inside an antagonist superset that keep its muscle:
 *  `sameMuscle` (alternativesFor, best match first) minus `current` and the
 *  partner, and minus anything that wouldn't still pair with the partner. */
export function sameMuscleSwaps(
  current: Exercise,
  partner: Exercise,
  sameMuscle: Exercise[],
): Exercise[] {
  return sameMuscle.filter(
    (e) => e.id !== current.id && e.id !== partner.id && isAntagonistPair(partner, e),
  );
}
