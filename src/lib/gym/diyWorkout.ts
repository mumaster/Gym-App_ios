import { exerciseById } from "./data";
import { estimateMinutes, generateWorkout, type GenerateArgs } from "./generator";
import { planBlocks } from "./planBlocks";
import type { Exercise, Muscle, PlannedExercise, TargetMuscle } from "./types";
import {
  MAX_SESSION_SETS_PER_MUSCLE,
  mainPlanSets,
  planSets,
  weeklyTarget as baseWeeklyTarget,
  type VolumeMuscle,
} from "./volume";

/* ---------------- building a plan by hand ---------------- */

/** A fresh plan row for `ex` with the defaults the generator uses for its
 *  kind: compounds heavier with longer rest and one warm-up, isolation
 *  lighter with shorter rest and none. */
export function newPlanned(ex: Exercise): PlannedExercise {
  return ex.compound
    ? {
        exercise_id: ex.id,
        target_sets: 3,
        warmup_sets: 1,
        target_reps: "6-10",
        rest_seconds: 120,
      }
    : {
        exercise_id: ex.id,
        target_sets: 3,
        warmup_sets: 0,
        target_reps: "10-15",
        rest_seconds: 75,
      };
}

/** Appends `ex` as a loose (non-superset) exercise. */
export function addExercise(plan: PlannedExercise[], ex: Exercise): PlannedExercise[] {
  return [...plan, newPlanned(ex)];
}

/** Drops the superset fields from a row. */
function loosen(p: PlannedExercise, rest?: number): PlannedExercise {
  const { superset_group: _g, superset_slot: _s, ...rest0 } = p;
  return rest === undefined ? rest0 : { ...rest0, rest_seconds: rest };
}

/** Numbers the supersets 1.. in plan order. */
function renumber(plan: PlannedExercise[]): PlannedExercise[] {
  const map = new Map<number, number>();
  return plan.map((p) => {
    if (p.superset_group === undefined) return p;
    if (!map.has(p.superset_group)) map.set(p.superset_group, map.size + 1);
    return { ...p, superset_group: map.get(p.superset_group)! };
  });
}

/** Removes the exercise at `index`. If it was half of a superset the other
 *  half stays as a loose exercise and takes over the pair's round rest. */
export function removeExercise(plan: PlannedExercise[], index: number): PlannedExercise[] {
  if (index < 0 || index >= plan.length) return plan;
  const block = planBlocks(plan).find((b) => b.includes(index));
  const partner = block && block.length === 2 ? block.find((i) => i !== index) : undefined;
  const roundRest = block && block.length === 2 ? plan[block[1]!]!.rest_seconds : 0;
  const out: PlannedExercise[] = [];
  plan.forEach((p, i) => {
    if (i === index) return;
    out.push(i === partner ? loosen(p, roundRest) : p);
  });
  return renumber(out);
}

/** Pairs the loose block `block` (an index into `planBlocks(plan)`) with the
 *  loose block after it as a superset. Does nothing if either is already a
 *  superset or there is no next block. Rounds are the larger of the two set
 *  counts, the round rest the larger of their rests (at least 60 s). */
export function linkSuperset(plan: PlannedExercise[], block: number): PlannedExercise[] {
  const blocks = planBlocks(plan);
  const a = blocks[block];
  const b = blocks[block + 1];
  if (!a || !b || a.length !== 1 || b.length !== 1) return plan;
  const [ia, ib] = [a[0]!, b[0]!];
  const pa = plan[ia]!;
  const pb = plan[ib]!;
  const rounds = Math.max(pa.target_sets, pb.target_sets);
  const rest = Math.max(pa.rest_seconds, pb.rest_seconds, 60);
  const out = plan.map((p, i) => {
    if (i === ia) {
      return {
        ...p,
        target_sets: rounds,
        rest_seconds: 0,
        superset_group: -1,
        superset_slot: "A" as const,
      };
    }
    if (i === ib) {
      return {
        ...p,
        target_sets: rounds,
        rest_seconds: rest,
        superset_group: -1,
        superset_slot: "B" as const,
      };
    }
    return p;
  });
  // the temporary group id -1 sorts into place by plan order in renumber
  return renumber(out);
}

/** Splits the superset `block` back into two loose exercises. Both keep the
 *  round count as their sets and take the old round rest. */
export function unlinkSuperset(plan: PlannedExercise[], block: number): PlannedExercise[] {
  const blocks = planBlocks(plan);
  const pair = blocks[block];
  if (!pair || pair.length !== 2) return plan;
  const rest = plan[pair[1]!]!.rest_seconds;
  const rounds = plan[pair[0]!]!.target_sets;
  const out = plan.map((p, i) =>
    pair.includes(i) ? { ...loosen(p, rest), target_sets: rounds } : p,
  );
  return renumber(out);
}

export type PlannedPatch = Partial<
  Pick<PlannedExercise, "target_sets" | "target_reps" | "rest_seconds" | "warmup_sets">
>;

/** Changes one exercise. In a superset the sets (rounds) apply to both halves
 *  and the rest is the round rest, kept on B while A stays at 0. */
export function updateExercise(
  plan: PlannedExercise[],
  index: number,
  patch: PlannedPatch,
): PlannedExercise[] {
  if (index < 0 || index >= plan.length) return plan;
  const block = planBlocks(plan).find((b) => b.includes(index));
  if (!block || block.length === 1) {
    return plan.map((p, i) => (i === index ? { ...p, ...patch } : p));
  }
  const [ia, ib] = block as [number, number];
  const { target_sets, rest_seconds, ...own } = patch;
  return plan.map((p, i) => {
    if (i !== ia && i !== ib) return p;
    let next: PlannedExercise = i === index ? { ...p, ...own } : p;
    if (target_sets !== undefined) next = { ...next, target_sets };
    if (rest_seconds !== undefined && i === ib) next = { ...next, rest_seconds };
    return next;
  });
}

/** Primary muscle groups the plan trains, the one with most working sets
 *  first (ties keep plan order). */
export function planMuscles(plan: PlannedExercise[]): Muscle[] {
  const sets = new Map<Muscle, number>();
  for (const p of plan) {
    const ex = exerciseById(p.exercise_id);
    if (!ex) continue;
    sets.set(ex.primary_muscle, (sets.get(ex.primary_muscle) ?? 0) + p.target_sets);
  }
  return [...sets.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

/** Reads a rep target: "8-12" (also with an en dash) or "10". Time-based
 *  targets like "30s" return null. */
export function parseReps(targetReps: string): { min: number; max: number } | null {
  const t = targetReps.trim();
  const range = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(t);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const one = /^(\d+)$/.exec(t);
  if (one) return { min: Number(one[1]), max: Number(one[1]) };
  return null;
}

/* ---------------- scoring ---------------- */

export type ScorePartId = "volume" | "time" | "muscles" | "order" | "reps" | "rest";
export interface ScorePart {
  id: ScorePartId;
  points: number;
  max: number;
  /** names of the exercises or muscles behind a lost point */
  issues: string[];
}
export type MuscleStatus = "low" | "good" | "high";
export interface MuscleEffect {
  muscle: string;
  sets: number;
  weeklyTarget: number;
  status: MuscleStatus;
  /** Sets the generated workout of the same length gives this muscle. */
  referenceSets?: number;
}
export interface WorkoutScore {
  score: number;
  grade: "excellent" | "good" | "ok" | "weak";
  parts: ScorePart[];
  muscles: MuscleEffect[];
  /** Working sets that count toward growth (each muscle's main sets, up to
   *  the per-session cap). */
  usefulSets: number;
  /** The same for the generated workout, when one was compared. */
  referenceSets: number | null;
  /** Estimated length of the plan and the length it was planned for. */
  minutes: number;
  targetMinutes: number;
  /** The length the plan is scored for filling: the planned length, or
   *  the generated workout's when that is shorter. */
  expectedMinutes: number;
}
export interface ScoreOptions {
  /** Working sets per muscle for the plan; default volume.ts planSets. */
  muscleSets?: (plan: PlannedExercise[]) => Record<string, number>;
  /** Sets per muscle that it is the main target of (what the per-session
   *  cap looks at); default volume.ts mainPlanSets. */
  mainSets?: (plan: PlannedExercise[]) => Record<string, number>;
  /** Weekly set target for a muscle; default volume.ts weeklyTarget with
   *  `focus` as the starred muscles. */
  weeklyTarget?: (muscle: string) => number;
  /** Starred muscles (growthFocus), for the default weekly target. */
  focus?: readonly VolumeMuscle[];
  /** Estimated session length in minutes; default generator.ts estimateMinutes(plan). */
  minutes?: number;
  /** How long the workout is meant to take; default DEFAULT_PLANNED_MINUTES. */
  targetMinutes?: number;
  /** The generator's workout for the same muscles and length
   *  (`generatedReference`). Volume is scored against it; without one the
   *  plan is its own yardstick. */
  reference?: PlannedExercise[];
  /** The generated workout's estimated length. When it's shorter than the
   *  planned length (the muscles picked don't need more), that's the
   *  length the plan should fill. */
  referenceMinutes?: number;
}

/** Length a new hand-built workout is planned for: the generator's default. */
export const DEFAULT_PLANNED_MINUTES = 45;

/** Fewest sets of one muscle in a session that still counts as a real
 *  stimulus. The app's own floor, below it the volume factor scales down. */
const MIN_EFFECTIVE_SETS = 3;

/** The plan's estimate may be this far under or over the planned length and
 *  still count as filling it (the app's own band: estimates are rough). */
export const TIME_FIT_LOW = 0.85;
const TIME_FIT_HIGH = 1.15;
/** At or under this share of the planned length the time part is 0, and
 *  at this share over it too (the app's own choice). */
const TIME_FIT_FLOOR = 0.3;
const TIME_FIT_CEILING = 1.6;

const defaultMuscleSets = (plan: PlannedExercise[]): Record<string, number> =>
  planSets(plan) as Record<string, number>;
const defaultMainSets = (plan: PlannedExercise[]): Record<string, number> =>
  mainPlanSets(plan) as Record<string, number>;

/** Working sets that count: each muscle's main sets, capped at
 *  MAX_SESSION_SETS_PER_MUSCLE (more in one session adds nothing). */
function usefulSetsOf(main: Record<string, number>): number {
  return Object.values(main).reduce((s, n) => s + Math.min(n, MAX_SESSION_SETS_PER_MUSCLE), 0);
}

/** Share of the time part: full when the estimate is within 85-115% of the
 *  planned length, sliding to 0 at 30% and at 160%. */
export function timeFit(minutes: number, targetMinutes: number): number {
  if (targetMinutes <= 0) return 1;
  const r = minutes / targetMinutes;
  if (r >= TIME_FIT_LOW && r <= TIME_FIT_HIGH) return 1;
  if (r < TIME_FIT_LOW) return Math.max(0, (r - TIME_FIT_FLOOR) / (TIME_FIT_LOW - TIME_FIT_FLOOR));
  return Math.max(0, (TIME_FIT_CEILING - r) / (TIME_FIT_CEILING - TIME_FIT_HIGH));
}

/**
 * A 0-100 score for a hand-built workout, measured against what the app's
 * generator would build for the same muscles in the planned time. Parts:
 *
 * - volume (35): working sets that count (each muscle's main sets, capped at
 *   MAX_SESSION_SETS_PER_MUSCLE, 11: Pelland et al., Sports Med 2024, no
 *   detectable extra growth beyond it in one session) as a share of the
 *   generated workout's. Matching or beating it is full marks.
 * - time (20): does the plan fill the planned length (`timeFit`), or the
 *   generated workout's length when the muscles picked don't need the whole
 *   time. The band is the app's own choice.
 * - muscles (15): each trained muscle gets 3 to 11 sets. Under 3 sets (the
 *   app's own floor) it scores sets/3 (min 0.3); over the cap 0.6.
 * - order (10): compounds before isolation work for the same muscle
 *   (Simao et al. 2012 review on exercise order).
 * - reps (10): a rep target whose middle is 5-30 (Schoenfeld et al. 2017,
 *   2021: similar growth across roughly 6-30+ reps taken near failure).
 *   Time-based targets count as in range.
 * - rest (10): compounds 90 s or more, isolation 60 s or more
 *   (Schoenfeld et al. 2016; Singer et al. 2024 meta-analysis: rests over
 *   60 s grew muscle slightly better). In a superset the round rest counts.
 *
 * Muscles, order, reps and rest only count in full once the workout holds
 * as many useful sets as the generated one: they are multiplied by the
 * volume share, so one well-built exercise can't score high on its own.
 */
export function scoreWorkout(plan: PlannedExercise[], opts: ScoreOptions = {}): WorkoutScore {
  const targetMinutes = opts.targetMinutes ?? DEFAULT_PLANNED_MINUTES;
  const mainOf = opts.mainSets ?? defaultMainSets;
  const ref = opts.reference;
  const referenceSets = ref && ref.length ? usefulSetsOf(mainOf(ref)) : null;
  // The generator stops a muscle at the per-session cap, so a few muscles
  // can't usefully fill a long session: then its length is the yardstick.
  const expectedMinutes =
    opts.referenceMinutes !== undefined && opts.referenceMinutes > 0
      ? Math.min(targetMinutes, opts.referenceMinutes)
      : targetMinutes;
  const empty = (id: ScorePartId, max: number): ScorePart => ({ id, points: 0, max, issues: [] });
  if (plan.length === 0) {
    return {
      score: 0,
      grade: "weak",
      parts: [
        empty("volume", 35),
        empty("time", 20),
        empty("muscles", 15),
        empty("order", 10),
        empty("reps", 10),
        empty("rest", 10),
      ],
      muscles: [],
      usefulSets: 0,
      referenceSets,
      minutes: 0,
      targetMinutes,
      expectedMinutes,
    };
  }
  const nameOf = (p: PlannedExercise) => exerciseById(p.exercise_id)?.name ?? p.exercise_id;

  // volume, against the generated workout
  const setsBy = (opts.muscleSets ?? defaultMuscleSets)(plan);
  const mainBy = mainOf(plan);
  const useful = usefulSetsOf(mainBy);
  const share = referenceSets ? Math.min(1, useful / referenceSets) : 1;
  const volume: ScorePart = {
    id: "volume",
    max: 35,
    points: 35 * share,
    issues: [],
  };

  // time
  const minutes = opts.minutes ?? estimateMinutes(plan);
  const time: ScorePart = {
    id: "time",
    max: 20,
    points: 20 * timeFit(minutes, expectedMinutes),
    issues: [],
  };

  // sets per muscle
  const refSets = ref && ref.length ? (opts.muscleSets ?? defaultMuscleSets)(ref) : null;
  const focus = new Set(opts.focus ?? []);
  const target =
    opts.weeklyTarget ?? ((muscle: string) => baseWeeklyTarget(muscle as VolumeMuscle, focus));
  const muscles: MuscleEffect[] = Object.entries(setsBy)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([muscle, n]) => ({
      muscle,
      sets: Math.round(n * 10) / 10,
      weeklyTarget: target(muscle),
      // Too much when the sets it is the main target of pass the cap (the
      // cap's own counting, volume.ts); helping in other lifts doesn't.
      status:
        n < MIN_EFFECTIVE_SETS
          ? "low"
          : (mainBy[muscle] ?? 0) <= MAX_SESSION_SETS_PER_MUSCLE
            ? "good"
            : "high",
      ...(refSets ? { referenceSets: Math.round((refSets[muscle] ?? 0) * 10) / 10 } : {}),
    }));
  const factor = (m: MuscleEffect) =>
    m.status === "low" ? Math.max(0.3, m.sets / MIN_EFFECTIVE_SETS) : m.status === "good" ? 1 : 0.6;
  const musclePart: ScorePart = {
    id: "muscles",
    max: 15,
    points: muscles.length
      ? 15 * share * (muscles.reduce((s, m) => s + factor(m), 0) / muscles.length)
      : 0,
    issues: muscles.filter((m) => m.status !== "good").map((m) => m.muscle),
  };

  // order
  const exs = plan.map((p) => exerciseById(p.exercise_id));
  const inverted: string[] = [];
  let isolations = 0;
  exs.forEach((ex, i) => {
    if (!ex || ex.compound) return;
    isolations++;
    if (exs.slice(i + 1).some((o) => o && o.compound && o.primary_muscle === ex.primary_muscle)) {
      inverted.push(ex.name);
    }
  });
  const order: ScorePart = {
    id: "order",
    max: 10,
    points: 10 * share * (1 - inverted.length / Math.max(1, isolations)),
    issues: inverted,
  };

  // reps
  const badReps = plan.filter((p) => {
    const r = parseReps(p.target_reps);
    if (!r) return false;
    const mid = (r.min + r.max) / 2;
    return mid < 5 || mid > 30;
  });
  const reps: ScorePart = {
    id: "reps",
    max: 10,
    points: 10 * share * (1 - badReps.length / plan.length),
    issues: badReps.map(nameOf),
  };

  // rest: a superset's round rest is stored on B and counts for both halves
  const restFactors: number[] = [];
  const shortRest: string[] = [];
  for (const block of planBlocks(plan)) {
    const roundRest = block.length === 2 ? plan[block[1]!]!.rest_seconds : undefined;
    for (const i of block) {
      const p = plan[i]!;
      const rest = roundRest ?? p.rest_seconds;
      const compound = exs[i]?.compound ?? false;
      const f = compound ? (rest >= 90 ? 1 : rest >= 60 ? 0.6 : 0.2) : rest >= 60 ? 1 : 0.5;
      restFactors.push(f);
      if (f < 1) shortRest.push(nameOf(p));
    }
  }
  const rest: ScorePart = {
    id: "rest",
    max: 10,
    points: 10 * share * (restFactors.reduce((s, f) => s + f, 0) / restFactors.length),
    issues: shortRest,
  };

  const parts = [volume, time, musclePart, order, reps, rest];
  const score = Math.round(parts.reduce((s, p) => s + p.points, 0));
  return {
    score,
    grade: score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "ok" : "weak",
    parts,
    muscles,
    usefulSets: useful,
    referenceSets,
    minutes,
    targetMinutes,
    expectedMinutes,
  };
}

/** The muscle heads a hand-built plan is built around: each exercise's main
 *  target, in plan order. What the generated comparison is asked for. */
export function planTargets(plan: PlannedExercise[]): TargetMuscle[] {
  const out: TargetMuscle[] = [];
  for (const p of plan) {
    const t = exerciseById(p.exercise_id)?.muscle_targets[0];
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** What the app's generator builds for the same muscles in `duration`
 *  minutes: the yardstick `scoreWorkout` measures a hand-built plan
 *  against. Supersets only when the plan has them, so a plan of straight
 *  sets isn't compared with one that fits more work by pairing. No loved
 *  exercises (they'd add muscles) and a fresh week (so the comparison
 *  doesn't move with what was trained the last few days). */
export function generatedReference(
  plan: PlannedExercise[],
  duration: number,
  args: Omit<
    GenerateArgs,
    "duration" | "targets" | "supersets" | "loved" | "weekDone" | "variation"
  >,
): PlannedExercise[] {
  const targets = planTargets(plan);
  if (!targets.length) return [];
  return generateWorkout({
    ...args,
    duration,
    targets,
    supersets: plan.some((p) => p.superset_group !== undefined),
  });
}
