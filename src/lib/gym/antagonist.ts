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
  return ANTAGONIST_MUSCLES[ma]?.includes(mb) ?? false;
}

/** Muscles that oppose this exercise, for user-facing copy. */
export function antagonistLabel(a: Exercise, b: Exercise): string {
  const arm = (e: Exercise) =>
    e.primary_muscle === "Arms" ? (isPush(e) ? "Triceps" : "Biceps") : e.primary_muscle;
  return `${arm(a)} / ${arm(b)}`.toUpperCase();
}

export const opposingLabel = (a: Exercise): string => {
  if (a.primary_muscle === "Arms") return isPush(a) ? "Biceps" : "Triceps";
  return (ANTAGONIST_MUSCLES[a.primary_muscle] ?? []).join(" / ") || "another muscle group";
};

/** Exercises from the pool that form a valid antagonist pair with `a`. */
export function antagonistAlternatives(a: Exercise, pool: Exercise[]): Exercise[] {
  return pool.filter((e) => e.id !== a.id && isAntagonistPair(a, e));
}
