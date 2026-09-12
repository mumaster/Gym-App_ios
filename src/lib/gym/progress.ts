import { exerciseById } from "./data";
import type { LoggedSet, Workout } from "./types";

/** Epley formula — comparable strength estimate across different rep ranges. */
export function estimated1RM(set: Pick<LoggedSet, "weight" | "reps">): number {
  if (set.reps <= 1) return set.weight;
  return Number((set.weight * (1 + set.reps / 30)).toFixed(1));
}

export interface PersonalRecord {
  exercise_id: string;
  name: string;
  e1rm: number;
  weight: number;
  reps: number;
  date: string;
}

/** Best estimated-1RM working set ever logged, per exercise, across finished workouts. */
export function personalRecords(workouts: Workout[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const w of workouts) {
    for (const s of w.completed_sets) {
      if (s.set_type === "warmup") continue;
      const e1rm = estimated1RM(s);
      const current = best.get(s.exercise_id);
      if (!current || e1rm > current.e1rm) {
        best.set(s.exercise_id, {
          exercise_id: s.exercise_id,
          name: exerciseById(s.exercise_id)?.name ?? s.exercise_id,
          e1rm,
          weight: s.weight,
          reps: s.reps,
          date: w.date,
        });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.e1rm - a.e1rm);
}

/** Chronological best-e1RM-per-session trend for one exercise, oldest first. */
export function e1rmTrend(
  exerciseId: string,
  workouts: Workout[],
): { date: string; e1rm: number }[] {
  const points: { date: string; e1rm: number }[] = [];
  for (const w of workouts) {
    const sets = w.completed_sets.filter(
      (s) => s.exercise_id === exerciseId && s.set_type === "working",
    );
    if (!sets.length) continue;
    const best = Math.max(...sets.map((s) => estimated1RM(s)));
    points.push({ date: w.date, e1rm: best });
  }
  return points.reverse();
}
