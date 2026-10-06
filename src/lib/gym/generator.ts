import { isAntagonistPair } from "./antagonist";
import { EXERCISES, TARGET_MUSCLE_GROUP } from "./data";
import { plateStep } from "./plates";
import { isNiche, popularityOf } from "./exercisePopularity";
import { crossEstimate, withKnownLifts, type KnownLift } from "./startWeight";
import { isBodyweightExercise } from "./load";
import { roundToStep, suggestWeight } from "./progression";
import { sharesLoadStation } from "./stations";
import { MAX_SESSION_SETS_PER_MUSCLE, planSets, setContribution, weeklyTarget } from "./volume";
import type {
  EquipmentId,
  EquipmentProfile,
  Exercise,
  Muscle,
  PlannedExercise,
  TargetMuscle,
  Workout,
} from "./types";

export const availableExercises = (equipment: EquipmentId[], avoided: string[] = []): Exercise[] =>
  EXERCISES.filter(
    (e) => e.equipment_required.every((r) => equipment.includes(r)) && !avoided.includes(e.id),
  );

/**
 * Swaps for an exercise: everything available for the same muscle group.
 * Familiar exercises come first (exercisePopularity.ts, asked for: swaps
 * offered exercises the user had never heard of), niche ones after; within
 * each, most similar first — the same main target, then shared targets,
 * then the same movement (hinge vs knee flexion, press vs fly) and the same
 * compound/isolation kind — and then the more popular. The order is the
 * app's own ranking, not a published one.
 */
export const alternativesFor = (
  exercise: Exercise,
  equipment: EquipmentId[],
  avoided: string[] = [],
): Exercise[] => {
  const similarity = (e: Exercise) =>
    (e.muscle_targets[0] === exercise.muscle_targets[0] ? 4 : 0) +
    e.muscle_targets.filter((t) => exercise.muscle_targets.includes(t)).length +
    (e.movement_pattern === exercise.movement_pattern ? 2 : 0) +
    (e.compound === exercise.compound ? 1 : 0);
  return availableExercises(equipment, avoided)
    .filter((e) => e.id !== exercise.id && e.primary_muscle === exercise.primary_muscle)
    .map((e, i) => ({ e, i, niche: isNiche(e.id), score: similarity(e) }))
    .sort(
      (a, b) =>
        Number(a.niche) - Number(b.niche) ||
        b.score - a.score ||
        popularityOf(b.e.id) - popularityOf(a.e.id) ||
        a.i - b.i,
    )
    .map(({ e }) => e);
};

/* ---------------- time model ---------------- */

/** Seconds of actual work in a working set (setup + reps + rack). */
const WORKING_SET_SECONDS = 45;
/** Warm-up sets are lighter and faster, with a short fixed rest. */
const WARMUP_SET_SECONDS = 30;
const WARMUP_REST_SECONDS = 40;
/** Walking to the next station, adjusting the machine, etc. */
const TRANSITION_SECONDS = 45;

/** True when any muscle's fractional sets in `plan` pass the per-session
 *  point of no detectable extra benefit (see volume.ts). */
const overSessionCap = (plan: PlannedExercise[]) =>
  Object.values(planSets(plan)).some((n) => n > MAX_SESSION_SETS_PER_MUSCLE);

/** A one-sided exercise (split squat, one-arm row) does every set once per
 *  side, so its set time counts twice; rest stays once per set. All of
 *  WORKING_SET_SECONDS is doubled, setup included, because the constant
 *  doesn't split setup from reps — the app's own, conservative reading. */
const sidesOf = (p: PlannedExercise) =>
  EXERCISES.find((e) => e.id === p.exercise_id)?.unilateral ? 2 : 1;

export function estimateSeconds(plan: PlannedExercise[]): number {
  let total = 0;
  plan.forEach((p, i) => {
    const next = plan[i + 1];
    const pairedWithNext =
      p.superset_group !== undefined && next?.superset_group === p.superset_group;
    const warm = p.warmup_sets ?? 0;
    const sides = sidesOf(p);
    total += warm * (WARMUP_SET_SECONDS * sides + WARMUP_REST_SECONDS);
    total += p.target_sets * WORKING_SET_SECONDS * sides;
    // rest after every working set except the very last set of the session
    const rests = i === plan.length - 1 ? p.target_sets - 1 : p.target_sets;
    total += Math.max(0, rests) * p.rest_seconds;
    if (i < plan.length - 1) {
      // inside a superset pair you shuttle between two stations every round
      total += pairedWithNext ? 15 * p.target_sets : TRANSITION_SECONDS;
    }
  });
  return total;
}

export const estimateMinutes = (plan: PlannedExercise[]) => Math.round(estimateSeconds(plan) / 60);

/* ---------------- generation ---------------- */

interface Shape {
  maxExercises: number;
  compoundSets: number;
  accessorySets: number;
  compoundRest: number;
  accessoryRest: number;
  compoundWarmups: number;
  compoundShare: number;
  compoundReps: string;
  accessoryReps: string;
}

/**
 * Rest between working sets follows the ACSM resistance-training position
 * stands: 2009 (Ratamess et al.) says at least 2–3 min for heavier core
 * lifts and 1–2 min for assistance exercises; the 2026 update recommends
 * 2–3 min for hypertrophy work, after studies such as Schoenfeld et al.
 * (J Strength Cond Res 2016) found 3-min rests beat 1-min rests for both
 * strength and size. Every working set gets 2 min: the bottom of the
 * 2–3 min range both stands share (the 3–5 min the 2026 stand gives for
 * maximal-strength work is for 1–3RM training, which these rep ranges
 * aren't), and the one value that also fits 2009's 1–2 min for assistance
 * exercises. Using 3 min for longer sessions was tried and made a 60-min
 * session fit fewer exercises than a 45-min one.
 *
 * Sets and reps: 2–4 working sets per exercise, fitted to the time budget,
 * with a muscle's weekly total — not any one session — the number that
 * matters (see volume.ts). Rep ranges sit inside the 6–30 reps Schoenfeld
 * et al.'s repetition-continuum review (Sports 2021) found build muscle
 * similarly when sets are taken close to failure, with compounds kept at
 * the heavier 5–10 end, where strength gains are larger. Warm-up set counts
 * (0–2 on compounds) have no published dose — they're a convention, not
 * evidence. Superset
 * pairs keep their own round rest (pairRestFor) — each muscle already rests
 * for its partner's set plus that round rest, which lands in the same
 * 2–3 min window.
 */
function shapeFor(duration: number): Shape {
  if (duration <= 15)
    return {
      maxExercises: 3,
      compoundSets: 2,
      accessorySets: 2,
      compoundRest: 120,
      accessoryRest: 120,
      compoundWarmups: 0,
      compoundShare: 1,
      compoundReps: "5-8",
      accessoryReps: "10-12",
    };
  if (duration <= 30)
    return {
      maxExercises: 4,
      compoundSets: 3,
      accessorySets: 3,
      compoundRest: 120,
      accessoryRest: 120,
      compoundWarmups: 0,
      compoundShare: 0.8,
      compoundReps: "5-8",
      accessoryReps: "10-12",
    };
  if (duration <= 45)
    return {
      maxExercises: 5,
      compoundSets: 3,
      accessorySets: 3,
      compoundRest: 120,
      accessoryRest: 120,
      compoundWarmups: 1,
      compoundShare: 0.7,
      compoundReps: "6-10",
      accessoryReps: "10-14",
    };
  if (duration <= 60)
    return {
      maxExercises: 6,
      compoundSets: 4,
      accessorySets: 3,
      compoundRest: 120,
      accessoryRest: 120,
      compoundWarmups: 1,
      compoundShare: 0.6,
      compoundReps: "6-10",
      accessoryReps: "10-14",
    };
  if (duration <= 75)
    return {
      maxExercises: 7,
      compoundSets: 4,
      accessorySets: 3,
      compoundRest: 120,
      accessoryRest: 120,
      compoundWarmups: 2,
      compoundShare: 0.55,
      compoundReps: "5-8",
      accessoryReps: "10-15",
    };
  return {
    maxExercises: 8,
    compoundSets: 4,
    accessorySets: 4,
    compoundRest: 120,
    accessoryRest: 120,
    compoundWarmups: 2,
    compoundShare: 0.55,
    compoundReps: "5-8",
    accessoryReps: "10-15",
  };
}

interface GenerateArgs {
  duration: number;
  equipment: EquipmentId[];
  /** Specific muscle heads to build the session around (e.g. "Triceps", "Side Delts"). */
  targets: TargetMuscle[];
  /** Bump to get a different pick of exercises for the same inputs (shuffle). */
  variation?: number;
  /** Pair exercises into back-to-back supersets. */
  supersets?: boolean;
  /** Plan warm-up sets before compound exercises (default on). Off, their
   *  time goes to working sets when the plan is fitted to the duration. */
  warmups?: boolean;
  /** Exercise ids the user "loved" — forced into the plan regardless of targets. */
  loved?: string[];
  /** Exercise ids the user is avoiding (injury, pain, dislike) — never selected. */
  avoided?: string[];
  /** Finished workout history — used to attach progressive-overload weight suggestions. */
  history?: Workout[];
  /** Lifts entered in Settings → Your current lifts: starting weights for
   *  exercises not logged in the app yet (startWeight.ts). */
  knownLifts?: KnownLift[];
  /** Active equipment profile — enables plate/dumbbell-realistic rounding of
   *  suggested weights (see lib/gym/plates.ts's `plateStep`). Falls back to a
   *  plain 0.5kg round when omitted. */
  profile?: EquipmentProfile;
  /** Latest bodyweight, for bodyweight exercises' progression (their
   *  logged weight is external load — see load.ts). */
  bodyKg?: number | null;
  /** Scales progressive-overload suggested weights on top of the per-exercise
   *  history-based suggestion — a Program's deload week. Defaults to 1 (no
   *  change); see lib/gym/programs.ts. */
  intensityMultiplier?: number;
  /** Scales working sets per exercise after the plan is fitted to the time
   *  budget (so fitting can't add the sets back) — a Program's deload week,
   *  which is meant to be a shorter, lighter session. Defaults to 1. */
  volumeMultiplier?: number;
  /** Muscles the user wants to grow (see volume.ts): their weekly target is
   *  20 sets instead of 10, so they get a bigger share of the session. */
  focusMuscles?: Muscle[];
  /** Fractional working sets already done this Monday–Sunday week
   *  (volume.ts's `weeklySets`). A session is split by what's still missing
   *  from each muscle's weekly target, so a muscle that's behind gets more
   *  and one that's done gets least. Empty = a fresh week. */
  weekDone?: Partial<Record<Muscle, number>>;
}

/* ---------------- superset pairing ---------------- */

/** How well two exercises go together as a superset, or null when they
 *  can't: two exercises on the same load station (stations.ts) would mean
 *  changing the weight every round, so they're never paired. */
function pairScore(a: Exercise, b: Exercise): number | null {
  if (sharesLoadStation(a, b)) return null;
  // 1. strict antagonist (push vs pull / opposing groups) always wins
  if (isAntagonistPair(a, b)) return 300;
  // 2. fallback: non-competing muscle groups (different muscles, no overlap)
  if (
    a.primary_muscle !== b.primary_muscle &&
    !a.secondary_muscles.includes(b.primary_muscle) &&
    !b.secondary_muscles.includes(a.primary_muscle)
  )
    return 120;
  // 3. last resort: same muscle, compound + isolation
  if (a.primary_muscle === b.primary_muscle && a.compound !== b.compound) return 60;
  return 10;
}

/** Heavy systemic lifts: loaded compounds on a bar / sled. */
const HEAVY_EQUIPMENT: EquipmentId[] = ["barbell", "smith", "leg_press"];

type Intensity = "heavy" | "moderate" | "low";

function intensityOf(ex: Exercise): Intensity {
  if (!ex.compound) return "low";
  if (ex.equipment_required.some((e) => HEAVY_EQUIPMENT.includes(e))) return "heavy";
  return "moderate";
}

/** PT rounds: heavy/moderate compounds 3, pure isolation pairs 4. */
function roundsFor(a: Exercise, b: Exercise): number {
  const ia = intensityOf(a);
  const ib = intensityOf(b);
  if (ia === "heavy" || ib === "heavy") return 3;
  if (ia === "low" && ib === "low") return 4;
  return 3;
}

/** Rest after the pair, scaled to the heavier of the two exercises. */
function pairRestFor(a: Exercise, b: Exercise): number {
  const worst: Intensity[] = [intensityOf(a), intensityOf(b)];
  if (worst.includes("heavy")) return 120;
  if (worst.includes("moderate")) return 90;
  return 60;
}

function makePair(
  a: PlannedExercise,
  b: PlannedExercise,
  exA: Exercise,
  exB: Exercise,
  group: number,
): PlannedExercise[] {
  const rounds = roundsFor(exA, exB);
  return [
    { ...a, target_sets: rounds, rest_seconds: 0, superset_group: group, superset_slot: "A" },
    {
      ...b,
      target_sets: rounds,
      rest_seconds: pairRestFor(exA, exB),
      superset_group: group,
      superset_slot: "B",
    },
  ];
}

/** Most items the pairing search runs on; a plan never has more than 8
 *  exercises (shapeFor), so this is only a guard. */
const MAX_PAIRING_ITEMS = 16;

/**
 * Which exercises to pair: as many pairs as possible, then the best total
 * pairScore. An exhaustive search over the plan (at most 8 exercises, so a
 * few hundred matchings) rather than greedy, because with the station rule a
 * greedy first pick can strand two exercises that could each have paired
 * with something else. Returns, per index, its partner's index or -1.
 */
export function bestPairing(exercises: Exercise[]): number[] {
  const n = Math.min(exercises.length, MAX_PAIRING_ITEMS);
  const score = exercises.map((a, i) => exercises.map((b, j) => (i < j ? pairScore(a, b) : null)));
  const memo = new Map<number, { value: number; pairs: [number, number][] }>();
  // value = pairs × 10,000 + total score, so one more pair always wins
  const solve = (mask: number): { value: number; pairs: [number, number][] } => {
    let i = 0;
    while (i < n && mask & (1 << i)) i++;
    if (i >= n) return { value: 0, pairs: [] };
    const hit = memo.get(mask);
    if (hit) return hit;
    let best = solve(mask | (1 << i)); // i stays a straight set
    for (let j = i + 1; j < n; j++) {
      if (mask & (1 << j)) continue;
      const s = score[i]![j];
      if (s === null || s === undefined) continue;
      const rest = solve(mask | (1 << i) | (1 << j));
      const value = rest.value + 10_000 + s;
      if (value > best.value) best = { value, pairs: [[i, j], ...rest.pairs] };
    }
    memo.set(mask, best);
    return best;
  };
  const partner = exercises.map(() => -1);
  for (const [i, j] of solve(0).pairs) {
    partner[i] = j;
    partner[j] = i;
  }
  return partner;
}

/** Groups the plan into antagonist / compound-isolation pairs, rounds-based.
 *  A pair takes the place of its first exercise; an exercise nothing can
 *  pair with stays a straight set. */
function applySupersets(plan: PlannedExercise[], startGroup = 0): PlannedExercise[] {
  const open = plan
    .map((p) => ({ p, ex: EXERCISES.find((e) => e.id === p.exercise_id)! }))
    .filter((i) => i.ex);
  const partner = bestPairing(open.map((i) => i.ex));
  const result: PlannedExercise[] = [];
  let group = startGroup;
  open.forEach((item, i) => {
    const j = partner[i]!;
    if (j === -1) result.push(item.p);
    else if (j > i) {
      group += 1;
      result.push(...makePair(item.p, open[j]!.p, item.ex, open[j]!.ex, group));
    }
  });
  return result;
}

/**
 * Builds a plan against a real time budget:
 *   (working sets x 45s) + (warm-ups) + (rest intervals) + (transitions)
 * so the estimate lands within ~±8% of the requested duration.
 */
export function generateWorkout({
  duration,
  equipment,
  targets: requestedTargets,
  variation = 0,
  supersets = false,
  warmups = true,
  loved = [],
  avoided = [],
  history = [],
  knownLifts = [],
  profile,
  bodyKg = null,
  intensityMultiplier = 1,
  volumeMultiplier = 1,
  focusMuscles = [],
  weekDone = {},
}: GenerateArgs): PlannedExercise[] {
  const focus = new Set(focusMuscles);
  /** Sets still missing from a muscle's weekly target (10, or 20 for a
   *  muscle you want to grow: volume.ts), at least 1 so a muscle you picked
   *  that already reached it still gets a little. The floor is the app's
   *  own choice, not a published number. */
  const need = (m: Muscle) => Math.max(1, weeklyTarget(m, focus) - (weekDone[m] ?? 0));
  const exOf = (p: PlannedExercise) => EXERCISES.find((e) => e.id === p.exercise_id);
  const primaryOf = (p: PlannedExercise) => exOf(p)?.primary_muscle;
  const withVolume = (list: PlannedExercise[]) =>
    volumeMultiplier === 1
      ? list
      : list.map((p) => ({
          ...p,
          target_sets: Math.max(1, Math.round(p.target_sets * volumeMultiplier)),
        }));
  const pool = availableExercises(equipment, avoided);
  const shape = shapeFor(duration);
  const budget = duration * 60;

  const plan: PlannedExercise[] = [];
  const used = new Set<string>();
  const compoundQuota = Math.max(1, Math.round(shape.maxExercises * shape.compoundShare));

  const makeEntry = (choice: Exercise, compound: boolean): PlannedExercise => {
    const target_reps = compound ? shape.compoundReps : shape.accessoryReps;
    const step = profile ? plateStep(choice, profile) : 0.5;
    const bw = isBodyweightExercise(choice);
    const own = history.length
      ? suggestWeight(choice.id, history, target_reps, step, undefined, bw ? bodyKg : null)
      : null;
    // Never done: a starting weight from a related exercise (startWeight.ts).
    // Lifts entered in Settings count too, after anything logged in the app.
    const estimate =
      !own && (history.length || knownLifts.length)
        ? crossEstimate(choice, withKnownLifts(history, knownLifts), target_reps, step)
        : null;
    const suggestion = own ?? estimate;
    // A deload's intensity applies to what's actually lifted — for a
    // bodyweight exercise that's bodyweight plus the external load, so
    // without a known bodyweight it's left as is.
    const scaled = (w: number) =>
      !bw
        ? w * intensityMultiplier
        : bodyKg == null
          ? w
          : (bodyKg + w) * intensityMultiplier - bodyKg;
    const suggestedWeight =
      suggestion && intensityMultiplier !== 1
        ? Number(roundToStep(scaled(suggestion.weight), step).toFixed(2))
        : suggestion?.weight;
    return {
      exercise_id: choice.id,
      target_sets: compound ? shape.compoundSets : shape.accessorySets,
      warmup_sets: compound && warmups ? shape.compoundWarmups : 0,
      target_reps,
      rest_seconds: compound ? shape.compoundRest : shape.accessoryRest,
      ...(suggestedWeight !== undefined ? { suggested_weight: suggestedWeight } : {}),
      ...(suggestion ? { suggested_reps: suggestion.reps } : {}),
      ...(estimate && estimate.basis !== "personal" ? { suggested_basis: estimate.basis } : {}),
    };
  };

  // Loved exercises are pinned into the plan first (equipment permitting) and are
  // never dropped by the budget trims below.
  const lovedExercises = loved
    .map((id) => pool.find((e) => e.id === id))
    .filter((e): e is Exercise => !!e)
    .slice(0, shape.maxExercises);
  for (const ex of lovedExercises) {
    used.add(ex.id);
    plan.push({ ...makeEntry(ex, ex.compound), loved: true });
  }

  // no targets picked but exercises are loved → build the session purely from them
  const targets: TargetMuscle[] = requestedTargets.length
    ? [...new Set(requestedTargets)]
    : lovedExercises.length
      ? []
      : ["Mid Chest", "Lats", "Quads", "Abs"];

  // Prefer exercises that make this muscle head their MAIN focus, then ones that
  // hit it as a secondary emphasis, then — only if nothing specific is left —
  // any exercise from the owning muscle group.
  const nextChoice = (
    target: TargetMuscle,
    compound: boolean,
    accept: (e: Exercise) => boolean = () => true,
  ): Exercise | undefined => {
    const free = pool.filter((e) => !used.has(e.id) && accept(e));
    const group = TARGET_MUSCLE_GROUP[target];
    // An exercise that trains this head as part of another muscle group
    // (a row for the biceps, a bench press for the front delts) only counts
    // half a set towards it (volume.ts), so the group's own exercises come
    // first; the others only when it has none.
    const hitsTarget = free.filter((e) => e.muscle_targets.includes(target));
    const ownGroup = hitsTarget.filter((e) => e.primary_muscle === group);
    const forMuscle = ownGroup.length
      ? ownGroup
      : hitsTarget.length
        ? hitsTarget
        : free.filter((e) => e.primary_muscle === group);
    if (!forMuscle.length) return undefined;
    // Main focus first, then the most popular (exercisePopularity.ts): it
    // used to be alphabetical, so the first plan opened with names like
    // "45° Incline Rear Delt Row" and "Archer Push-up" (reported). Niche
    // exercises only come in when no familiar one fits.
    const familiar = forMuscle.filter((e) => !isNiche(e.id));
    const ranked = [...(familiar.length ? familiar : forMuscle)].sort(
      (a, b) =>
        (a.muscle_targets[0] === target ? 0 : 1) - (b.muscle_targets[0] === target ? 0 : 1) ||
        popularityOf(b.id) - popularityOf(a.id) ||
        a.name.localeCompare(b.name),
    );
    const preferred = ranked.filter((e) => e.compound === compound);
    // when only one exercise of the wanted kind exists, let regenerate rotate
    // through the muscle's other movements too so the pick actually changes
    const candidates =
      preferred.length > 1
        ? preferred
        : [...preferred, ...ranked.filter((e) => e.compound !== compound)];
    if (!candidates.length) return undefined;
    // The most popular first; each Shuffle moves one down the list. (It was
    // offset by the plan's length too, so the fifth pick skipped the four
    // most popular options even on the first plan; picks already in the
    // plan are excluded anyway.)
    return candidates[variation % candidates.length];
  };

  // Each muscle group gets a share of the session in proportion to what's
  // still missing from its weekly target (`need`): planned fractional sets
  // over that need, lowest first. Within a group, its least-served head.
  const hits = new Map<TargetMuscle, number>(targets.map((m) => [m, 0]));
  for (const ex of lovedExercises) {
    const t = ex.muscle_targets.find((m) => hits.has(m));
    if (t) hits.set(t, hits.get(t)! + 1);
  }
  const dry = new Set<TargetMuscle>(); // targets with no remaining candidates
  const groupLoad = (g: Muscle, list: PlannedExercise[]) => (planSets(list)[g] ?? 0) / need(g);
  const load = (m: TargetMuscle, list: PlannedExercise[]) =>
    groupLoad(TARGET_MUSCLE_GROUP[m], list);
  /** Targets from the one to serve next: the group furthest behind its
   *  share first (ties to the bigger need, then the order picked), then
   *  that group's least-served head. */
  const byPriority = (list: PlannedExercise[]) =>
    targets
      .filter((m) => !dry.has(m))
      .map((m, order) => ({ m, order, g: TARGET_MUSCLE_GROUP[m] }))
      .sort(
        (a, b) =>
          load(a.m, list) - load(b.m, list) ||
          need(b.g) - need(a.g) ||
          hits.get(a.m)! - hits.get(b.m)! ||
          a.order - b.order,
      )
      .map((x) => x.m);
  const pickTarget = (list: PlannedExercise[]) => byPriority(list)[0];
  /** Whether adding `e` keeps every muscle under the per-session cap. */
  const fitsCap = (list: PlannedExercise[]) => (e: Exercise) =>
    !overSessionCap([
      ...list,
      {
        exercise_id: e.id,
        target_sets: e.compound ? shape.compoundSets : shape.accessorySets,
        warmup_sets: 0,
        target_reps: "",
        rest_seconds: 0,
      },
    ]);

  const seeded = plan.length; // loved exercises already in the plan
  for (let i = 0; i < shape.maxExercises - seeded; i++) {
    const target = pickTarget(plan);
    if (!target) break;
    const wantCompound = plan.length < compoundQuota;
    // Past ~11 fractional sets for one muscle in a session Pelland et al.
    // found no detectable extra benefit (volume.ts): only exercises that stay
    // under it. (A pick that went over used to end the target, so a pull day
    // whose rows had used up the back ended after two exercises.)
    const fits = fitsCap(plan);
    const choice =
      nextChoice(target, wantCompound, fits) ?? nextChoice(target, !wantCompound, fits);
    if (!choice) {
      dry.add(target);
      i--; // retry with the next-least-served target
      continue;
    }
    const entry = makeEntry(choice, choice.compound);
    hits.set(target, hits.get(target)! + 1);

    const candidatePlan = [...plan, entry];
    const projected = estimateSeconds(candidatePlan);
    // always keep a minimum of 2 exercises, otherwise respect the budget
    if (plan.length >= 2 && projected > budget * 1.04) break;
    used.add(choice.id);
    plan.push(entry);
    if (estimateSeconds(plan) >= budget * 0.93) break;
  }

  // top up with extra sets if we finished well under the budget
  let guard = 0;
  // short sessions stay lean: at most 3 exercises, capped at 3 working sets
  const setCap = duration <= 15 ? 3 : 6;
  // Big lifts open the session: picking by need can serve a small muscle
  // first, so compounds move to the front (in the order they were picked).
  plan.sort((a, b) => Number(!!exOf(b)?.compound) - Number(!!exOf(a)?.compound));
  // Spare time goes first to the muscles with the most still missing this
  // week; no muscle goes past the per-session point Pelland et al. found no
  // detectable extra benefit (volume.ts).
  const needOf = (p: PlannedExercise) => {
    const m = primaryOf(p);
    return m ? need(m) : 0;
  };
  const order = plan
    .map((p, i) => ({ i, n: needOf(p) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map(({ i }) => i);
  while (estimateSeconds(plan) < budget * 0.9 && plan.length && guard < 24) {
    guard++;
    const idx = order[guard % order.length]!;
    const entry = plan[idx]!;
    if (entry.target_sets >= setCap) continue;
    const bumped = { ...entry, target_sets: entry.target_sets + 1 };
    const next = plan.map((p, i) => (i === idx ? bumped : p));
    if (overSessionCap(next)) continue;
    if (estimateSeconds(next) > budget * 1.04) break;
    plan[idx] = bumped;
  }

  // trim if we overshot badly (e.g. very short sessions) — never touch loved picks
  while (plan.length > 2 && estimateSeconds(plan) > budget * 1.08) {
    let idx = -1;
    for (let i = plan.length - 1; i >= 0; i--) {
      if (!plan[i]!.loved) {
        idx = i;
        break;
      }
    }
    if (idx === -1) break;
    const entry = plan[idx]!;
    if (entry.target_sets > 2) entry.target_sets -= 1;
    else plan.splice(idx, 1);
  }

  if (!supersets) return withVolume(trimToCap(plan));

  /**
   * Exercises left unpaired by applySupersets all clash with each other —
   * usually because they share a station (two dumbbell exercises in a
   * dumbbells-only gym). Swap one of two leftovers for the most similar
   * alternative (alternativesFor: same muscle, same main target first) that
   * can pair with the other, so the pair doesn't cost a weight change.
   * Loved exercises are never swapped out.
   */
  const pairLeftovers = (list: PlannedExercise[]): PlannedExercise[] => {
    let out = list;
    let group = out.reduce((m, p) => Math.max(m, p.superset_group ?? 0), 0);
    const leftovers = () =>
      out.flatMap((p, i) => (p.superset_group === undefined && exOf(p) ? [i] : []));
    for (let guard = 0; guard < 8; guard++) {
      const idx = leftovers();
      let done = false;
      for (let a = 0; a < idx.length && !done; a++) {
        for (let b = a + 1; b < idx.length && !done; b++) {
          // replace the later one first, so the session keeps its opening lift
          for (const [keep, swap] of [
            [idx[a]!, idx[b]!],
            [idx[b]!, idx[a]!],
          ] as const) {
            const kept = out[keep]!;
            const old = out[swap]!;
            if (old.loved) continue;
            const keptEx = exOf(kept)!;
            const oldEx = exOf(old)!;
            const alt = alternativesFor(oldEx, equipment, avoided).find(
              (e) => !used.has(e.id) && pairScore(keptEx, e) !== null,
            );
            if (!alt) continue;
            const entry = makeEntry(alt, alt.compound);
            const without = out.filter((_, i) => i !== swap);
            if (overSessionCap([...without, entry])) continue;
            used.add(alt.id);
            group += 1;
            const first = Math.min(keep, swap);
            const [pa, pb, ea, eb] =
              keep < swap ? [kept, entry, keptEx, alt] : [entry, kept, alt, keptEx];
            const pair = makePair(pa, pb, ea, eb, group);
            out = out.flatMap((p, i) => (i === first ? pair : i === keep || i === swap ? [] : [p]));
            done = true;
            break;
          }
        }
      }
      if (!done) break;
    }
    return out;
  };

  let paired = pairLeftovers(applySupersets(plan));

  // pairs run intensity-based rounds, so rebalance the block count to the budget —
  // drop the last block that contains no loved exercise
  const dropLastFreeBlock = (list: PlannedExercise[]): boolean => {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]!;
      const isPairB =
        p.superset_group !== undefined && list[i - 1]?.superset_group === p.superset_group;
      const start = isPairB ? i - 1 : i;
      const span = isPairB ? 2 : 1;
      if (list.slice(start, start + span).some((m) => m.loved)) {
        i = start;
        continue;
      }
      list.splice(start, span);
      return true;
    }
    return false;
  };
  while (paired.length > 2 && estimateSeconds(paired) > budget * 1.06) {
    if (!dropLastFreeBlock(paired)) break;
  }

  // keep adding complementary pairs / finishers until we actually fill the time
  let group = paired.reduce((m, p) => Math.max(m, p.superset_group ?? 0), 0);
  let fillGuard = 0;
  while (estimateSeconds(paired) < budget * 0.92 && fillGuard < 12) {
    fillGuard++;

    const picks: { entry: PlannedExercise; ex: Exercise }[] = [];
    for (let t = 0; t < targets.length; t++) {
      const m = pickTarget(paired);
      if (!m) break;
      const fits = fitsCap(paired);
      const choice = nextChoice(m, false, fits) ?? nextChoice(m, true, fits);
      if (choice) {
        hits.set(m, hits.get(m)! + 1);
        used.add(choice.id);
        picks.push({ entry: makeEntry(choice, choice.compound), ex: choice });
        break;
      }
      dry.add(m);
    }
    // The partner has to pair with the first pick (no shared station). Try
    // the targets from least served; one with nothing compatible isn't dry,
    // it just can't partner this pick.
    if (picks.length === 1) {
      const first = picks[0]!.ex;
      const withFirst = [...paired, picks[0]!.entry];
      const fits = fitsCap(withFirst);
      const ok = (e: Exercise) => pairScore(first, e) !== null && fits(e);
      for (const m of byPriority(withFirst)) {
        const choice = nextChoice(m, false, ok) ?? nextChoice(m, true, ok);
        if (!choice) continue;
        hits.set(m, hits.get(m)! + 1);
        used.add(choice.id);
        picks.push({ entry: makeEntry(choice, choice.compound), ex: choice });
        break;
      }
    }

    if (picks.length === 2) {
      group += 1;
      const next = [
        ...paired,
        ...makePair(picks[0]!.entry, picks[1]!.entry, picks[0]!.ex, picks[1]!.ex, group),
      ];
      if (estimateSeconds(next) > budget * 1.06) break;
      paired = next;
      continue;
    }
    // a lone pick can't form a superset — don't tail the session with a straight set
    if (picks.length === 1) break;

    // nothing left in the pool: give isolation pairs an extra metabolic round
    const idx = paired.findIndex(
      (p, i) =>
        p.superset_slot === "A" &&
        p.target_sets < 4 &&
        !exOf(p)?.compound &&
        !exOf(paired[i + 1]!)?.compound,
    );
    if (idx === -1) break;
    const bumped = paired.map((p, i) =>
      i === idx || i === idx + 1 ? { ...p, target_sets: p.target_sets + 1 } : p,
    );
    if (estimateSeconds(bumped) > budget * 1.06 || overSessionCap(bumped)) break;
    paired = bumped;
  }

  // A straight-set exercise (the odd one out, or a solo finisher) must never sit
  // wedged between supersets — move every non-superset exercise to the very end
  // so the workout always closes on it. Superset pairs keep their order.
  const grouped = paired.filter((p) => p.superset_group !== undefined);
  const straight = paired.filter((p) => p.superset_group === undefined);
  paired = [...grouped, ...straight];

  // Number the supersets in the order they're done: a pair formed by
  // pairLeftovers takes the place of its first exercise but got the next
  // free number, so a session could open with "Superset 2".
  const renumber = new Map<number, number>();
  for (const p of paired)
    if (p.superset_group !== undefined && !renumber.has(p.superset_group))
      renumber.set(p.superset_group, renumber.size + 1);
  paired = paired.map((p) =>
    p.superset_group === undefined ? p : { ...p, superset_group: renumber.get(p.superset_group)! },
  );

  return withVolume(trimToCap(paired));
}

/** Takes sets off, from the end of the plan, until no muscle is over the
 *  per-session cap (volume.ts). Pairing sets a superset's rounds for both
 *  halves (`roundsFor`), which could push a muscle past it (one push day
 *  planned 22.5 shoulder sets). A superset loses a round from both halves,
 *  so they stay equal; nothing goes under 2 sets. */
function trimToCap(plan: PlannedExercise[]): PlannedExercise[] {
  const out = plan.map((p) => ({ ...p }));
  for (let guard = 0; guard < 40 && overSessionCap(out); guard++) {
    const sets = planSets(out);
    const over = new Set(
      (Object.keys(sets) as Muscle[]).filter((m) => sets[m]! > MAX_SESSION_SETS_PER_MUSCLE),
    );
    let i = out.length - 1;
    for (; i >= 0; i--) {
      const p = out[i]!;
      const hitsOver = Object.keys(setContribution(p.exercise_id)).some((m) =>
        over.has(m as Muscle),
      );
      if (hitsOver && p.target_sets > 2) break;
    }
    if (i < 0) break;
    const p = out[i]!;
    const partner =
      p.superset_group === undefined
        ? -1
        : out.findIndex((q, j) => j !== i && q.superset_group === p.superset_group);
    for (const j of partner >= 0 ? [i, partner] : [i]) out[j]!.target_sets -= 1;
  }
  return out;
}
