import type { Exercise, Muscle, TargetMuscle } from "./types";

/**
 * Which kind of day an exercise belongs to. Shoulders and Arms are one group
 * each in the data but hold both push and pull work (rear delts and face
 * pulls, biceps), so the kind comes from what the exercise mainly trains.
 * A push day got rows and face pulls from swaps (reported).
 */
export type ExerciseKind = "push" | "pull" | "legs" | "core";

/** Heads that are pulling work even though their group also holds pushing. */
const PULL_HEADS: readonly TargetMuscle[] = ["Rear Delts", "Biceps", "Forearms"];

export function exerciseKind(e: Exercise): ExerciseKind | undefined {
  switch (e.primary_muscle) {
    case "Chest":
      return "push";
    case "Back":
      return "pull";
    case "Quads":
    case "Hamstrings":
    case "Glutes":
    case "Calves":
      return "legs";
    case "Core":
      return "core";
    case "Shoulders":
      return e.muscle_targets[0] && PULL_HEADS.includes(e.muscle_targets[0]) ? "pull" : "push";
    case "Arms":
      return e.movement_pattern === "pull"
        ? "pull"
        : e.movement_pattern === "push"
          ? "push"
          : undefined;
    default:
      return undefined;
  }
}

/** A day type that restricts what fits: push, pull, legs (and lower), or upper. */
export type FitDay = "push" | "pull" | "legs" | "upper";

const ALLOWED: Record<FitDay, readonly ExerciseKind[]> = {
  push: ["push", "core"],
  pull: ["pull", "core"],
  legs: ["legs", "core"],
  upper: ["push", "pull", "core"],
};

/** The restricting day for a day id ("push", "lower"…), or undefined when
 *  anything fits (full body, and the one-muscle bro days, which stay on
 *  their own muscle anyway). */
export function fitDayOf(dayId: string | undefined): FitDay | undefined {
  switch (dayId) {
    case "push":
    case "pull":
    case "upper":
      return dayId;
    case "legs":
    case "lower":
      return "legs";
    default:
      return undefined;
  }
}

/** The day type a set of trained muscles amounts to, for workouts that don't
 *  say which day they are (free generator, saved or custom workouts). Only a
 *  clear case counts: one muscle alone, a mix of pushing and pulling muscles
 *  with legs, or anything else unclear has no restriction. */
export function fitDayFromMuscles(muscles: readonly Muscle[]): FitDay | undefined {
  const has = (m: Muscle) => muscles.includes(m);
  const upperish = has("Chest") || has("Back") || has("Shoulders") || has("Arms");
  const lower = has("Quads") || has("Hamstrings") || has("Glutes") || has("Calves");
  if (muscles.length < 2) return undefined;
  if (lower && upperish) return undefined;
  if (lower) return "legs";
  if (has("Back") && (has("Chest") || has("Shoulders"))) return "upper";
  if (has("Back")) return "pull";
  if (has("Chest") || has("Shoulders")) return "push";
  return undefined;
}

/** Whether an exercise fits a day. Exercises with no kind always do. */
export function fitsDay(e: Exercise, day: FitDay | undefined): boolean {
  if (!day) return true;
  const k = exerciseKind(e);
  return !k || ALLOWED[day].includes(k);
}

/** Whether a muscle head fits a day (the generator drops the others). */
export function headFitsDay(head: TargetMuscle, day: FitDay | undefined): boolean {
  if (!day) return true;
  const pull =
    PULL_HEADS.includes(head) || head === "Lats" || head === "Traps" || head === "Lower Back";
  const legs = ["Quads", "Adductors", "Hamstrings", "Glutes", "Abductors", "Calves"].includes(head);
  const core = head === "Abs" || head === "Obliques";
  const kind: ExerciseKind = core ? "core" : legs ? "legs" : pull ? "pull" : "push";
  return ALLOWED[day].includes(kind);
}
