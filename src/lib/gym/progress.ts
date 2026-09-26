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

/** A working set that beat every earlier session's best for its exercise. */
export interface LatestPr {
  exercise_id: string;
  name: string;
  weight: number;
  reps: number;
  date: string;
  bodyweight: boolean;
  /** Epley estimate of what was lifted in total; null for a bodyweight
   *  exercise without a known bodyweight (nothing meaningful to estimate). */
  e1rm: number | null;
}

/**
 * The most recent personal record: the newest session whose best working set
 * for an exercise beat every earlier session's best for it. A first-ever
 * session of an exercise is never a record — there's nothing to beat — which
 * matches the recap image. Sets are compared by the Epley estimate (Epley
 * 1985) of what was actually lifted, so a heavier single and a lighter set of
 * eight compare fairly; equal estimates go to more reps.
 *
 * For bodyweight exercises (see load.ts) the logged weight is external load,
 * so the estimate uses bodyweight + load when `bodyKg` is known. Without it
 * only the external load is compared, with reps breaking ties — enough to
 * spot more pull-ups at the same load, never a guessed bodyweight.
 */
export function latestPr(
  workouts: Workout[],
  isBodyweight: (exerciseId: string) => boolean,
  bodyKg: number | null = null,
): LatestPr | null {
  const score = (s: Pick<LoggedSet, "weight" | "reps">, bw: boolean) => {
    const lifted = bw ? (bodyKg ?? 0) + s.weight : s.weight;
    return s.reps <= 1 ? lifted : lifted * (1 + s.reps / 30);
  };
  const beats = (a: { score: number; reps: number }, b: { score: number; reps: number }) =>
    a.score > b.score + 1e-9 || (Math.abs(a.score - b.score) <= 1e-9 && a.reps > b.reps);

  const ordered = [...workouts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const best = new Map<string, { score: number; reps: number }>();
  let latest: (LatestPr & { gain: number }) | null = null;

  for (const w of ordered) {
    const perExercise = new Map<string, LoggedSet>();
    for (const s of w.completed_sets) {
      if (s.set_type !== "working" || s.reps <= 0) continue;
      const bw = isBodyweight(s.exercise_id);
      const current = perExercise.get(s.exercise_id);
      const cand = { score: score(s, bw), reps: s.reps };
      if (!current || beats(cand, { score: score(current, bw), reps: current.reps })) {
        perExercise.set(s.exercise_id, s);
      }
    }
    let sessionBest: (LatestPr & { gain: number }) | null = null;
    for (const [id, s] of perExercise) {
      const bw = isBodyweight(id);
      const cand = { score: score(s, bw), reps: s.reps };
      const before = best.get(id);
      if (before && beats(cand, before)) {
        // Several records in one session: show the biggest relative jump.
        const gain = before.score > 0 ? cand.score / before.score : cand.reps / before.reps;
        if (!sessionBest || gain > sessionBest.gain) {
          const known = !bw || bodyKg != null;
          sessionBest = {
            exercise_id: id,
            name: exerciseById(id)?.name ?? id,
            weight: s.weight,
            reps: s.reps,
            date: w.date,
            bodyweight: bw,
            e1rm: known ? Number(cand.score.toFixed(1)) : null,
            gain,
          };
        }
      }
      if (!before || beats(cand, before)) best.set(id, cand);
    }
    if (sessionBest) latest = sessionBest;
  }
  if (!latest) return null;
  const { gain: _gain, ...pr } = latest;
  return pr;
}
