import { exerciseById } from "./data";
import type { Muscle, Workout } from "./types";

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
}

/** Muscle groups sorted least-recently-trained first (never-trained ranks highest). */
export function recommendedMuscles(
  muscles: Muscle[],
  workouts: Workout[],
  top = 2,
): MuscleRecommendation[] {
  return muscles
    .map((muscle) => ({ muscle, daysSince: daysSinceTrained(muscle, workouts) }))
    .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity))
    .slice(0, top);
}
