import { exerciseById } from "./data";
import { estimateMinutes } from "./generator";
import { planBlocks } from "./planBlocks";
import type { Exercise, Muscle, PlannedExercise } from "./types";
import { MAX_SESSION_SETS_PER_MUSCLE, planSets, weeklyTarget as baseWeeklyTarget } from "./volume";

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

export type ScorePartId = "volume" | "order" | "reps" | "rest" | "length";
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
}
export interface WorkoutScore {
  score: number;
  grade: "excellent" | "good" | "ok" | "weak";
  parts: ScorePart[];
  muscles: MuscleEffect[];
}
export interface ScoreOptions {
  /** Working sets per muscle for the plan; default volume.ts planSets. */
  muscleSets?: (plan: PlannedExercise[]) => Record<string, number>;
  /** Weekly set target for a muscle; default volume.ts weeklyTarget with no focus muscles. */
  weeklyTarget?: (muscle: string) => number;
  /** Estimated session length in minutes; default generator.ts estimateMinutes(plan). */
  minutes?: number;
}

/** Fewest sets of one muscle in a session that still counts as a real
 *  stimulus. The app's own floor, below it the volume factor scales down. */
const MIN_EFFECTIVE_SETS = 3;

const defaultMuscleSets = (plan: PlannedExercise[]): Record<string, number> =>
  planSets(plan) as Record<string, number>;
const defaultWeeklyTarget = (muscle: string): number =>
  baseWeeklyTarget(muscle as Muscle, new Set());

/**
 * A 0-100 score for a hand-built workout, from five parts. Sources:
 *
 * - volume (40): sets per muscle in the session. Up to
 *   MAX_SESSION_SETS_PER_MUSCLE (11) fractional sets still add growth
 *   (Pelland et al., Sports Med 2024), beyond that there is no detectable
 *   extra gain. Under 3 sets (the app's own floor) the muscle is barely
 *   trained, so it scores sets/3 (min 0.3); over the cap it scores 0.6.
 * - order (15): compounds before isolation work for the same muscle
 *   (Simao et al. 2012 review on exercise order): the exercise done first
 *   gets the most effort, and the big lifts need it most.
 * - reps (15): a rep target whose middle is 5-30 (Schoenfeld et al. 2017,
 *   2021: similar growth across roughly 6-30+ reps taken near failure,
 *   heavier for strength). Time-based targets count as in range.
 * - rest (15): compounds 90 s or more, isolation 60 s or more
 *   (Schoenfeld et al. 2016; Singer et al. 2024 meta-analysis: rests over
 *   60 s grew muscle slightly better). In a superset the round rest counts.
 * - length (15): up to 75 min full marks, sliding to 6 points at 120 min.
 *   This band is the app's own choice, not a published number.
 */
export function scoreWorkout(plan: PlannedExercise[], opts: ScoreOptions = {}): WorkoutScore {
  const empty = (id: ScorePartId, max: number): ScorePart => ({ id, points: 0, max, issues: [] });
  if (plan.length === 0) {
    return {
      score: 0,
      grade: "weak",
      parts: [
        empty("volume", 40),
        empty("order", 15),
        empty("reps", 15),
        empty("rest", 15),
        empty("length", 15),
      ],
      muscles: [],
    };
  }
  const nameOf = (p: PlannedExercise) => exerciseById(p.exercise_id)?.name ?? p.exercise_id;

  // volume
  const setsBy = (opts.muscleSets ?? defaultMuscleSets)(plan);
  const target = opts.weeklyTarget ?? defaultWeeklyTarget;
  const muscles: MuscleEffect[] = Object.entries(setsBy)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([muscle, n]) => ({
      muscle,
      sets: Math.round(n * 10) / 10,
      weeklyTarget: target(muscle),
      status: n < MIN_EFFECTIVE_SETS ? "low" : n <= MAX_SESSION_SETS_PER_MUSCLE ? "good" : "high",
    }));
  const factor = (m: MuscleEffect) =>
    m.status === "low" ? Math.max(0.3, m.sets / MIN_EFFECTIVE_SETS) : m.status === "good" ? 1 : 0.6;
  const volume: ScorePart = {
    id: "volume",
    max: 40,
    points: muscles.length ? 40 * (muscles.reduce((s, m) => s + factor(m), 0) / muscles.length) : 0,
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
    max: 15,
    points: 15 * (1 - inverted.length / Math.max(1, isolations)),
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
    max: 15,
    points: 15 * (1 - badReps.length / plan.length),
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
    max: 15,
    points: 15 * (restFactors.reduce((s, f) => s + f, 0) / restFactors.length),
    issues: shortRest,
  };

  // length
  const minutes = opts.minutes ?? estimateMinutes(plan);
  const length: ScorePart = {
    id: "length",
    max: 15,
    points: minutes <= 75 ? 15 : minutes >= 120 ? 6 : 15 - (9 * (minutes - 75)) / 45,
    issues: [],
  };

  const parts = [volume, order, reps, rest, length];
  const score = Math.round(parts.reduce((s, p) => s + p.points, 0));
  return {
    score,
    grade: score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "ok" : "weak",
    parts,
    muscles,
  };
}
