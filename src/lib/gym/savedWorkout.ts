import { DAY_TYPES, type SplitDay } from "./splits";
import { CARDIO_DAY_ID } from "./schedule";
import type { PlannedExercise, Workout } from "./types";

/** The day types a done workout can be saved as (everything but cardio). */
export const LIFTING_DAY_TYPES: readonly SplitDay[] = DAY_TYPES.filter(
  (d) => d.id !== CARDIO_DAY_ID,
);

/** The plan of a done workout, as a plan to start again: only the exercises
 *  that really got sets (all of the plan if none were logged). */
export function planFromDone(workout: Workout): PlannedExercise[] {
  const done = new Set(workout.completed_sets.map((s) => s.exercise_id));
  const kept = workout.plan.filter((p) => done.has(p.exercise_id));
  return (kept.length ? kept : workout.plan).map((p) => {
    const { bonus: _bonus, ...rest } = p;
    return rest;
  });
}

/** The day type a workout most looks like, from the muscles it trained: the
 *  one whose muscles it covers best, the narrowest on a tie. Full body when
 *  nothing is known. */
export function guessDayType(workout: Workout): string {
  const trained = new Set<string>(workout.target_muscles);
  if (!trained.size) return "full";
  let best = { id: "full", score: 0, size: Infinity };
  for (const d of LIFTING_DAY_TYPES) {
    if (!d.muscles.length) continue;
    const hit = d.muscles.filter((m) => trained.has(m)).length;
    const extra = trained.size - hit;
    const score = hit / d.muscles.length - extra / Math.max(trained.size, 1);
    if (score > best.score || (score === best.score && d.muscles.length < best.size)) {
      best = { id: d.id, score, size: d.muscles.length };
    }
  }
  return best.score > 0 ? best.id : "full";
}
