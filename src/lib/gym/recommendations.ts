import { exerciseById } from "./data";
import type { Muscle, Workout } from "./types";
import { musclesOfGroup, weeklySets, weeklyTarget, type VolumeMuscle } from "./volume";

function daysAgo(iso: string): number {
  const then = new Date(iso);
  const now = new Date();
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((startNow - startThen) / 86_400_000);
}

/** Days since a muscle group last saw a logged working set, or null if never trained. */
export function daysSinceTrained(muscle: Muscle, workouts: Workout[]): number | null {
  let min: number | null = null;
  for (const w of workouts) {
    const hit = w.completed_sets.some((s) => {
      if (s.set_type === "warmup") return false;
      return exerciseById(s.exercise_id)?.primary_muscle === muscle;
    });
    if (!hit) continue;
    const days = daysAgo(w.date);
    if (min === null || days < min) min = days;
  }
  return min;
}

export interface MuscleRecommendation {
  muscle: Muscle;
  daysSince: number | null;
  /** Sets done this week and the weekly target across the group's muscles
   *  (see volume.ts); a muscle past its own target adds nothing to the group. */
  done: number;
  target: number;
}

/** Muscle groups furthest below their weekly set targets first (starred
 *  muscles have a higher target, so their group comes up more often); ties go to
 *  whichever was trained least recently. */
export function recommendedMuscles(
  muscles: Muscle[],
  workouts: Workout[],
  top = 2,
  focus: VolumeMuscle[] = [],
): MuscleRecommendation[] {
  const done = weeklySets(workouts, null);
  const focusSet = new Set(focus);
  return muscles
    .map((muscle) => {
      const parts = musclesOfGroup(muscle);
      return {
        muscle,
        daysSince: daysSinceTrained(muscle, workouts),
        done: parts.reduce((n, m) => n + Math.min(done[m] ?? 0, weeklyTarget(m, focusSet)), 0),
        target: parts.reduce((n, m) => n + weeklyTarget(m, focusSet), 0),
      };
    })
    .sort(
      (a, b) =>
        a.done / a.target - b.done / b.target ||
        (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity),
    )
    .slice(0, top);
}
