import { exerciseById } from "./data";
import { estimateMinutes, generateWorkout, type GenerateArgs } from "./generator";
import { moveBlock, planBlocks } from "./planBlocks";
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
  /** For order, reps and rest: the plan indices behind `issues`, in the
   *  same order, so each can get its own fix (`fixOrder`, `fixedReps`,
   *  `fixedRest`). Empty for the other parts. */
  items: number[];
}
/** "done": the muscle's weekly target was already reached this week
 *  before this workout, so its sets here add little. */
export type MuscleStatus = "low" | "good" | "high" | "done";
export interface MuscleEffect {
  muscle: string;
  sets: number;
  weeklyTarget: number;
  status: MuscleStatus;
  /** Working sets already done this Monday-Sunday week. */
  weekDone: number;
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
  /** The generated workout's estimated length, when one was compared. */
  referenceMinutes: number | null;
  /** How complete the workout is for the time given (0-1): the share of the
   *  generated workout's useful sets times the share of the planned time
   *  filled. Every part is multiplied by it. */
  completeness: number;
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
  /** Working sets per muscle already done this week (volume.ts weeklySets). */
  weekDone?: Readonly<Record<string, number>>;
  /** Estimated session length in minutes; default generator.ts estimateMinutes(plan). */
  minutes?: number;
  /** How long the workout is meant to take; default DEFAULT_PLANNED_MINUTES. */
  targetMinutes?: number;
  /** The generator's workout for the same muscles and length
   *  (`generatedReference`). Volume is scored against it; without one the
   *  plan is its own yardstick. */
  reference?: PlannedExercise[];
  /** The generated workout's estimated length (shown when the muscles
   *  picked can't usefully fill the planned time). */
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
export const TIME_FIT_HIGH = 1.15;
/** At this share over the planned length the time part reaches 0 (the
 *  app's own choice). */
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

/** How much of the planned time the plan fills: full from 85% of it,
 *  proportional below (an hour given with 7 minutes of work is 0.14). */
export function timeFill(minutes: number, targetMinutes: number): number {
  if (targetMinutes <= 0) return 1;
  return Math.max(0, Math.min(1, minutes / (TIME_FIT_LOW * targetMinutes)));
}

/** The time part's own factor: full up to 115% of the planned length,
 *  sliding to 0 at 160% (running long). */
export function overtimeFit(minutes: number, targetMinutes: number): number {
  if (targetMinutes <= 0) return 1;
  const r = minutes / targetMinutes;
  if (r <= TIME_FIT_HIGH) return 1;
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
 * - time (20): the plan fills the planned length (`timeFill`) without
 *   running long (`overtimeFit`). The band is the app's own choice.
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
 * Every part is multiplied by `completeness`: the share of the generated
 * workout's useful sets times the share of the planned time filled. So the
 * score falls with an empty hour whatever is in it (one set of bench press
 * in an hour scores close to 0), and a muscle choice that can't fill the
 * time scores the same for the plan and for the generated workout.
 */
export function scoreWorkout(plan: PlannedExercise[], opts: ScoreOptions = {}): WorkoutScore {
  const targetMinutes = opts.targetMinutes ?? DEFAULT_PLANNED_MINUTES;
  const mainOf = opts.mainSets ?? defaultMainSets;
  const ref = opts.reference;
  const referenceSets = ref && ref.length ? usefulSetsOf(mainOf(ref)) : null;
  const referenceMinutes =
    opts.referenceMinutes !== undefined && ref && ref.length ? opts.referenceMinutes : null;
  const empty = (id: ScorePartId, max: number): ScorePart => ({
    id,
    points: 0,
    max,
    issues: [],
    items: [],
  });
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
      referenceMinutes,
      completeness: 0,
    };
  }
  const nameOf = (p: PlannedExercise) => exerciseById(p.exercise_id)?.name ?? p.exercise_id;

  // volume, against the generated workout
  const setsBy = (opts.muscleSets ?? defaultMuscleSets)(plan);
  const mainBy = mainOf(plan);
  const useful = usefulSetsOf(mainBy);
  const share = referenceSets ? Math.min(1, useful / referenceSets) : 1;
  const minutes = opts.minutes ?? estimateMinutes(plan);
  const c = share * timeFill(minutes, targetMinutes);
  const volume: ScorePart = {
    id: "volume",
    max: 35,
    points: 35 * c,
    issues: [],
    items: [],
  };

  // time
  const time: ScorePart = {
    id: "time",
    max: 20,
    points: 20 * c * overtimeFit(minutes, targetMinutes),
    issues: [],
    items: [],
  };

  // sets per muscle
  const refSets = ref && ref.length ? (opts.muscleSets ?? defaultMuscleSets)(ref) : null;
  const focus = new Set(opts.focus ?? []);
  const target =
    opts.weeklyTarget ?? ((muscle: string) => baseWeeklyTarget(muscle as VolumeMuscle, focus));
  const week = opts.weekDone ?? {};
  const muscles: MuscleEffect[] = Object.entries(setsBy)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([muscle, n]) => {
      const weekly = target(muscle);
      const weekDone = Math.round((week[muscle] ?? 0) * 10) / 10;
      // Too much when the sets it is the main target of pass the cap (the
      // cap's own counting, volume.ts); helping in other lifts doesn't.
      // Done when this week already reached the weekly target: more sets
      // there add little (Schoenfeld et al. 2017's ~10 a week is near
      // the top of the benefit; the 20 for starred muscles, Baz-Valle
      // et al. 2022, see volume.ts).
      const status: MuscleStatus =
        (mainBy[muscle] ?? 0) > MAX_SESSION_SETS_PER_MUSCLE
          ? "high"
          : weekly > 0 && weekDone >= weekly
            ? "done"
            : n < MIN_EFFECTIVE_SETS
              ? "low"
              : "good";
      return {
        muscle,
        sets: Math.round(n * 10) / 10,
        weeklyTarget: weekly,
        status,
        weekDone,
        ...(refSets ? { referenceSets: Math.round((refSets[muscle] ?? 0) * 10) / 10 } : {}),
      };
    });
  /** "done" scores half: the app's own weighting, between "low" and full. */
  const factor = (m: MuscleEffect) =>
    m.status === "low"
      ? Math.max(0.3, m.sets / MIN_EFFECTIVE_SETS)
      : m.status === "good"
        ? 1
        : m.status === "done"
          ? 0.5
          : 0.6;
  const musclePart: ScorePart = {
    id: "muscles",
    max: 15,
    points: muscles.length
      ? 15 * c * (muscles.reduce((s, m) => s + factor(m), 0) / muscles.length)
      : 0,
    issues: muscles.filter((m) => m.status !== "good").map((m) => m.muscle),
    items: [],
  };

  // order
  const exs = plan.map((p) => exerciseById(p.exercise_id));
  const inverted: string[] = [];
  const invertedAt: number[] = [];
  let isolations = 0;
  exs.forEach((ex, i) => {
    if (!ex || ex.compound) return;
    isolations++;
    if (exs.slice(i + 1).some((o) => o && o.compound && o.primary_muscle === ex.primary_muscle)) {
      inverted.push(ex.name);
      invertedAt.push(i);
    }
  });
  const order: ScorePart = {
    id: "order",
    max: 10,
    points: 10 * c * (1 - inverted.length / Math.max(1, isolations)),
    issues: inverted,
    items: invertedAt,
  };

  // reps
  const badRepsAt = plan
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => {
      const r = parseReps(p.target_reps);
      if (!r) return false;
      const mid = (r.min + r.max) / 2;
      return mid < 5 || mid > 30;
    })
    .map(({ i }) => i);
  const badReps = badRepsAt.map((i) => plan[i]!);
  const reps: ScorePart = {
    id: "reps",
    max: 10,
    points: 10 * c * (1 - badReps.length / plan.length),
    issues: badReps.map(nameOf),
    items: badRepsAt,
  };

  // rest: a superset's round rest is stored on B and counts for both halves
  const restFactors: number[] = [];
  const shortRest: string[] = [];
  const shortRestAt: number[] = [];
  for (const block of planBlocks(plan)) {
    const roundRest = block.length === 2 ? plan[block[1]!]!.rest_seconds : undefined;
    for (const i of block) {
      const p = plan[i]!;
      const rest = roundRest ?? p.rest_seconds;
      const compound = exs[i]?.compound ?? false;
      const f = compound ? (rest >= 90 ? 1 : rest >= 60 ? 0.6 : 0.2) : rest >= 60 ? 1 : 0.5;
      restFactors.push(f);
      if (f < 1) {
        shortRest.push(nameOf(p));
        shortRestAt.push(i);
      }
    }
  }
  const rest: ScorePart = {
    id: "rest",
    max: 10,
    points: 10 * c * (restFactors.reduce((s, f) => s + f, 0) / restFactors.length),
    issues: shortRest,
    items: shortRestAt,
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
    referenceMinutes,
    completeness: c,
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
 *  exercises (they'd add muscles). Pass `weekDone` so it shares the
 *  session the way the generator would this week. */
export function generatedReference(
  plan: PlannedExercise[],
  duration: number,
  args: Omit<GenerateArgs, "duration" | "targets" | "supersets" | "loved" | "variation">,
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

/* ---------------- one-tap fixes for the score's findings ---------------- */

/** Moves the block holding `index` (an isolation exercise) to just after
 *  the last block with a compound lift for the same muscle, so the big lift
 *  comes first. Supersets move as a pair; nothing else changes order. */
export function fixOrder(plan: PlannedExercise[], index: number): PlannedExercise[] {
  const ex = exerciseById(plan[index]?.exercise_id ?? "");
  if (!ex) return plan;
  const blocks = planBlocks(plan);
  const from = blocks.findIndex((b) => b.includes(index));
  let to = -1;
  blocks.forEach((b, k) => {
    if (
      b.some((i) => {
        const o = exerciseById(plan[i]!.exercise_id);
        return o?.compound && o.primary_muscle === ex.primary_muscle;
      })
    ) {
      to = k;
    }
  });
  let out = plan;
  for (let k = from; k < to; k++) out = moveBlock(out, k, 1);
  return out;
}

/** The rest that earns full rest points: the new-exercise default for its
 *  kind (compound 120 s, isolation 75 s; see `newPlanned`). In a superset
 *  the round rest has to suit both halves, so the longer of the two. */
export function fixedRest(plan: PlannedExercise[], index: number): number {
  const block = planBlocks(plan).find((b) => b.includes(index)) ?? [index];
  return Math.max(
    ...block.map((i) => {
      const ex = exerciseById(plan[i]!.exercise_id);
      return ex ? newPlanned(ex).rest_seconds : 75;
    }),
  );
}

/** A rep range inside the scored 5-30: the new-exercise default for its
 *  kind (compound "6-10", isolation "10-15"). */
export function fixedReps(plan: PlannedExercise[], index: number): string {
  const ex = exerciseById(plan[index]?.exercise_id ?? "");
  return ex ? newPlanned(ex).target_reps : "8-12";
}
