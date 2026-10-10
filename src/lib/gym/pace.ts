import { EXERCISES } from "./data";
import type { LoggedSet, PlannedExercise, Workout } from "./types";

/**
 * The user's own pace, learned from their finished workouts. The time model
 * in generator.ts assumes 45 s of work per set and 45 s between exercises
 * for everyone; real lifters differ a lot (a heavy barbell set with a plate
 * change is not a cable fly). Nothing is stored for this: every LoggedSet
 * already carries `completed_at`, and the history is per account and synced,
 * so the pace is derived from it each time and follows the user to a new
 * device.
 */
export interface Pace {
  /** Median seconds of work per side for a working set, per exercise id (the
   *  gap between consecutive working sets minus that exercise's planned rest,
   *  divided by sides). Only exercises with at least MIN_EXERCISE_SAMPLES. */
  workPerSide: Record<string, number>;
  /** The user's overall median of the same, used for exercises without their
   *  own data. null if fewer than MIN_DEFAULT_SAMPLES samples. */
  defaultWorkPerSide: number | null;
  /** Median seconds between exercises beyond the rest and the next exercise's
   *  first set. null if fewer than MIN_TRANSITION_SAMPLES samples. */
  transitionSeconds: number | null;
}

const MIN_EXERCISE_SAMPLES = 3;
const MIN_DEFAULT_SAMPLES = 5;
const MIN_TRANSITION_SAMPLES = 3;
/** Only the most recent samples count, so the pace follows the user as they
 *  get faster or slower (the app's own windows, not a published number). */
const MAX_EXERCISE_SAMPLES = 30;
const MAX_POOLED_SAMPLES = 60;
/** Between two sets of one exercise: shorter than this was logged after the
 *  fact (both sets ticked at once), longer is a pause (phone, chat, water). */
const MIN_SET_GAP_SECONDS = 10;
const MAX_SET_GAP_SECONDS = 900;
/** Between two exercises — walking, setting up a machine — allows longer. */
const MAX_TRANSITION_GAP_SECONDS = 1200;
const MAX_TRANSITION_SECONDS = 300;
/** Same constants as the time model's warm-up and working-set fallbacks. */
const WARMUP_SET_SECONDS = 30;
const FALLBACK_WORK_SECONDS = 45;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const sidesOfId = (exerciseId: string) =>
  EXERCISES.find((e) => e.id === exerciseId)?.unilateral ? 2 : 1;

interface TransitionRaw {
  gap: number;
  restFrom: number;
  to: LoggedSet;
}

/**
 * Learns the pace from `history` (any order). Returns null when nothing could
 * be learned, so callers fall back to the fixed constants.
 *
 * The first exercise of every workout is ignored — the sets in it and the
 * move out of it — because users are probably still setting things up
 * (reported). Superset rounds interleave two exercises, so their sets are
 * ignored too.
 */
export function learnPace(history: Workout[]): Pace | null {
  const ordered = [...history].sort((a, b) => a.date.localeCompare(b.date));
  // oldest first, so slicing from the end keeps the most recent samples
  const setSamples: { exerciseId: string; value: number }[] = [];
  const transitionRaws: TransitionRaw[] = [];

  for (const workout of ordered) {
    const timed = workout.completed_sets
      .map((s) => ({ s, t: Date.parse(s.completed_at) }))
      .filter((x) => Number.isFinite(x.t))
      .sort((a, b) => a.t - b.t);
    if (timed.length < 2) continue;

    const firstExercise = timed[0]!.s.exercise_id;
    const planOf = (id: string): PlannedExercise | undefined =>
      workout.plan.find((p) => p.exercise_id === id);
    /** A set that can be timed on its own: not in the first exercise, not a
     *  superset round, and its plan entry exists and isn't in a superset. */
    const usable = (s: LoggedSet) => {
      if (s.exercise_id === firstExercise || s.round !== undefined) return false;
      const plan = planOf(s.exercise_id);
      return plan !== undefined && plan.superset_group === undefined;
    };

    for (let i = 1; i < timed.length; i++) {
      const a = timed[i - 1]!;
      const b = timed[i]!;
      if (!usable(a.s) || !usable(b.s)) continue;
      const gap = (b.t - a.t) / 1000;
      const restFrom = planOf(a.s.exercise_id)!.rest_seconds;
      if (a.s.exercise_id === b.s.exercise_id) {
        if (a.s.set_type !== "working" || b.s.set_type !== "working") continue;
        if (gap < MIN_SET_GAP_SECONDS || gap > MAX_SET_GAP_SECONDS) continue;
        setSamples.push({
          exerciseId: a.s.exercise_id,
          value: (gap - restFrom) / sidesOfId(a.s.exercise_id),
        });
      } else {
        if (a.s.set_type !== "working") continue;
        if (gap < MIN_SET_GAP_SECONDS || gap > MAX_TRANSITION_GAP_SECONDS) continue;
        transitionRaws.push({ gap, restFrom, to: b.s });
      }
    }
  }

  const byExercise = new Map<string, number[]>();
  for (const { exerciseId, value } of setSamples) {
    const list = byExercise.get(exerciseId);
    if (list) list.push(value);
    else byExercise.set(exerciseId, [value]);
  }
  const workPerSide: Record<string, number> = {};
  for (const [id, values] of byExercise) {
    if (values.length >= MIN_EXERCISE_SAMPLES)
      workPerSide[id] = median(values.slice(-MAX_EXERCISE_SAMPLES));
  }

  const pooled = setSamples.slice(-MAX_POOLED_SAMPLES).map((x) => x.value);
  const defaultWorkPerSide = pooled.length >= MIN_DEFAULT_SAMPLES ? median(pooled) : null;

  // What the user does in the first set of the next exercise is subtracted,
  // so what's left is the walking and setting up between exercises.
  const transitions = transitionRaws.slice(-MAX_POOLED_SAMPLES).map(({ gap, restFrom, to }) => {
    const sides = sidesOfId(to.exercise_id);
    const firstSetWork =
      to.set_type === "warmup"
        ? WARMUP_SET_SECONDS * sides
        : (workPerSide[to.exercise_id] ?? defaultWorkPerSide ?? FALLBACK_WORK_SECONDS) * sides;
    return gap - restFrom - firstSetWork;
  });
  const transitionSeconds =
    transitions.length >= MIN_TRANSITION_SAMPLES
      ? Math.min(MAX_TRANSITION_SECONDS, Math.max(0, median(transitions)))
      : null;

  if (
    Object.keys(workPerSide).length === 0 &&
    defaultWorkPerSide === null &&
    transitionSeconds === null
  )
    return null;
  return { workPerSide, defaultWorkPerSide, transitionSeconds };
}
