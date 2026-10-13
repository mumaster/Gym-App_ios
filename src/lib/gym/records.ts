import { exerciseById } from "./data";
import type { LoggedSet, Workout } from "./types";

/**
 * Records per exercise for History's Records tab: the best estimated 1RM,
 * the heaviest set, and every session that set a new record (PR history),
 * plus a simple strength score built from the same numbers.
 *
 * Estimates use Epley (1985), like the rest of the app (progress.ts). A
 * bodyweight exercise (load.ts) is estimated from bodyweight + load when a
 * bodyweight is known; without one there is no meaningful estimate (0 kg for
 * a plain pull-up), so its records compare the external load with reps as
 * the tie-break, the same rule as `latestPr`.
 */

const epley = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));
const round1 = (n: number) => Number(n.toFixed(1));
const EPS = 1e-9;

export type PrKind = "e1rm" | "heaviest";

export interface PrEvent {
  date: string;
  /** The session's best set (by estimate, then reps). */
  weight: number;
  reps: number;
  /** Estimated 1RM of that set; null for a bodyweight exercise without a
   *  known bodyweight. */
  e1rm: number | null;
  /** The heaviest load lifted that session, when it set the heaviest record. */
  heaviest: { weight: number; reps: number } | null;
  /** Which records this session beat. Empty for the first session, which
   *  is the starting point rather than a record (nothing to beat). */
  kinds: PrKind[];
  first: boolean;
}

export interface ExerciseRecords {
  exercise_id: string;
  name: string;
  bodyweight: boolean;
  sessions: number;
  /** Best set by estimate (bodyweight included when known). */
  best: { weight: number; reps: number; e1rm: number | null; date: string };
  /** Heaviest load in a working set (external load for bodyweight work);
   *  null for bodyweight work never done with added load. */
  heaviest: { weight: number; reps: number; date: string } | null;
  /** The first session, then each session that beat a record, newest first. */
  history: PrEvent[];
  /** Date of the newest session that beat a record, if any. */
  lastPr: string | null;
}

const byDate = (workouts: Workout[]) =>
  [...workouts].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

/** Records for every exercise with a working set, most recent record first
 *  (exercises without a record yet after them, most recently done first). */
export function exerciseRecords(
  workouts: Workout[],
  isBodyweight: (exerciseId: string) => boolean,
  bodyKg: number | null = null,
): ExerciseRecords[] {
  type Acc = {
    out: ExerciseRecords;
    bestScore: { score: number; reps: number } | null;
    heaviestKg: number | null;
    lastDone: number;
  };
  const acc = new Map<string, Acc>();

  for (const w of byDate(workouts)) {
    const perExercise = new Map<string, LoggedSet[]>();
    for (const s of w.completed_sets) {
      if (s.set_type !== "working" || s.reps <= 0) continue;
      perExercise.set(s.exercise_id, [...(perExercise.get(s.exercise_id) ?? []), s]);
    }
    for (const [id, sets] of perExercise) {
      const bw = isBodyweight(id);
      const known = !bw || bodyKg != null;
      const lifted = (s: LoggedSet) => (bw ? (bodyKg ?? 0) + s.weight : s.weight);
      const score = (s: LoggedSet) => epley(lifted(s), s.reps);
      const beats = (a: { score: number; reps: number }, b: { score: number; reps: number }) =>
        a.score > b.score + EPS || (Math.abs(a.score - b.score) <= EPS && a.reps > b.reps);

      let top = sets[0]!;
      for (const s of sets.slice(1)) {
        if (beats({ score: score(s), reps: s.reps }, { score: score(top), reps: top.reps }))
          top = s;
      }
      let heavy = sets[0]!;
      for (const s of sets.slice(1)) {
        if (s.weight > heavy.weight || (s.weight === heavy.weight && s.reps > heavy.reps))
          heavy = s;
      }
      const topScore = { score: score(top), reps: top.reps };
      const e1rm = known ? round1(topScore.score) : null;
      // Bodyweight work done without added load has no "heaviest set".
      const hasLoad = !bw || heavy.weight > 0;

      const cur = acc.get(id);
      if (!cur) {
        acc.set(id, {
          out: {
            exercise_id: id,
            name: exerciseById(id)?.name ?? id,
            bodyweight: bw,
            sessions: 1,
            best: { weight: top.weight, reps: top.reps, e1rm, date: w.date },
            heaviest: hasLoad ? { weight: heavy.weight, reps: heavy.reps, date: w.date } : null,
            history: [
              {
                date: w.date,
                weight: top.weight,
                reps: top.reps,
                e1rm,
                heaviest: hasLoad ? { weight: heavy.weight, reps: heavy.reps } : null,
                kinds: [],
                first: true,
              },
            ],
            lastPr: null,
          },
          bestScore: topScore,
          heaviestKg: hasLoad ? heavy.weight : null,
          lastDone: Date.parse(w.date),
        });
        continue;
      }
      cur.out.sessions += 1;
      cur.lastDone = Date.parse(w.date);
      const kinds: PrKind[] = [];
      if (cur.bestScore && beats(topScore, cur.bestScore)) {
        kinds.push("e1rm");
        cur.bestScore = topScore;
        cur.out.best = { weight: top.weight, reps: top.reps, e1rm, date: w.date };
      }
      const heavier =
        hasLoad &&
        (cur.heaviestKg == null ||
          heavy.weight > cur.heaviestKg + EPS ||
          (Math.abs(heavy.weight - cur.heaviestKg) <= EPS &&
            heavy.reps > (cur.out.heaviest?.reps ?? 0)));
      if (heavier) {
        // Same weight for more reps only counts as a heaviest-set record
        // when the weight itself isn't new; both are shown the same way.
        kinds.push("heaviest");
        cur.heaviestKg = heavy.weight;
        cur.out.heaviest = { weight: heavy.weight, reps: heavy.reps, date: w.date };
      }
      if (kinds.length) {
        cur.out.history.unshift({
          date: w.date,
          weight: top.weight,
          reps: top.reps,
          e1rm,
          heaviest: kinds.includes("heaviest") ? { weight: heavy.weight, reps: heavy.reps } : null,
          kinds,
          first: false,
        });
        cur.out.lastPr = w.date;
      }
    }
  }

  return [...acc.values()]
    .sort((a, b) => {
      const pa = a.out.lastPr ? Date.parse(a.out.lastPr) : -Infinity;
      const pb = b.out.lastPr ? Date.parse(b.out.lastPr) : -Infinity;
      return pb - pa || b.lastDone - a.lastDone;
    })
    .map((a) => a.out);
}

/**
 * Simple strength score: how strong you are now compared with when you
 * started, as one number where 100 is your start.
 *
 * For each loaded exercise (and bodyweight work when a bodyweight is known)
 * done in at least two sessions, it takes your best estimated 1RM in the
 * recent window and divides it by your best in that exercise's first
 * session. The score is 100 × the geometric mean of those ratios, so a lift
 * that doubled and one that halved cancel out, and no single heavy lift
 * outweighs the rest. Exercises not done in the window are left out, so a
 * lift you dropped neither props up nor drags down the score.
 *
 * There is no published "strength score" to follow: this is arithmetic on
 * the app's sourced 1RM estimate (Epley 1985). The window is a display
 * choice, not a number from a study: `SCORE_WINDOW_DAYS` (8 weeks) is long
 * enough to hold every exercise of a rotating program (Forge's waves are
 * 4–6 weeks, programs.ts) and short enough to follow detraining.
 */
export const SCORE_WINDOW_DAYS = 56;

export interface StrengthScore {
  /** 100 = where you started. */
  score: number;
  /** Exercises that counted. */
  exercises: number;
}

export function strengthScore(
  workouts: Workout[],
  isBodyweight: (exerciseId: string) => boolean,
  bodyKg: number | null = null,
  at: Date = new Date(),
): StrengthScore | null {
  const end = at.getTime();
  const start = end - SCORE_WINDOW_DAYS * 86_400_000;
  // Per exercise: its sessions' best estimates up to `at`, oldest first.
  const series = new Map<string, { t: number; e1rm: number }[]>();
  for (const w of byDate(workouts)) {
    const t = Date.parse(w.date);
    if (t > end) break;
    const best = new Map<string, number>();
    for (const s of w.completed_sets) {
      if (s.set_type !== "working" || s.reps <= 0) continue;
      const bw = isBodyweight(s.exercise_id);
      if (bw && bodyKg == null) continue;
      const lifted = bw ? bodyKg! + s.weight : s.weight;
      if (lifted <= 0) continue;
      const e = epley(lifted, s.reps);
      if (e > (best.get(s.exercise_id) ?? 0)) best.set(s.exercise_id, e);
    }
    for (const [id, e1rm] of best) series.set(id, [...(series.get(id) ?? []), { t, e1rm }]);
  }
  let logSum = 0;
  let n = 0;
  for (const points of series.values()) {
    if (points.length < 2) continue;
    const recent = points.slice(1).filter((p) => p.t >= start);
    // Only the first session in the window: nothing to compare yet.
    if (!recent.length) continue;
    const ratio = Math.max(...recent.map((p) => p.e1rm)) / points[0]!.e1rm;
    logSum += Math.log(ratio);
    n += 1;
  }
  if (!n) return null;
  return { score: Math.round(100 * Math.exp(logSum / n)), exercises: n };
}

/** The score at the end of each of the last `months` calendar months (the
 *  current month up to `now`), oldest first; null where nothing counted. */
export function monthlyStrengthScores(
  workouts: Workout[],
  isBodyweight: (exerciseId: string) => boolean,
  bodyKg: number | null,
  months = 6,
  now: Date = new Date(),
): { month: Date; score: number | null }[] {
  const out: { month: Date; score: number | null }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1, 0, 0, 0, -1);
    const at = i === 0 ? now : endOfMonth;
    out.push({ month, score: strengthScore(workouts, isBodyweight, bodyKg, at)?.score ?? null });
  }
  return out;
}
