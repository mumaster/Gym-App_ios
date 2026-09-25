import { isAntagonistPair } from "./antagonist";
import { EXERCISES, TARGET_MUSCLE_GROUP } from "./data";
import { plateStep } from "./plates";
import { roundToStep, suggestWeight } from "./progression";
import { MAX_SESSION_SETS_PER_MUSCLE, planSets } from "./volume";
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

export const alternativesFor = (
  exercise: Exercise,
  equipment: EquipmentId[],
  avoided: string[] = [],
): Exercise[] =>
  availableExercises(equipment, avoided).filter(
    (e) => e.id !== exercise.id && e.primary_muscle === exercise.primary_muscle,
  );

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

export function estimateSeconds(plan: PlannedExercise[]): number {
  let total = 0;
  plan.forEach((p, i) => {
    const next = plan[i + 1];
    const pairedWithNext =
      p.superset_group !== undefined && next?.superset_group === p.superset_group;
    const warm = p.warmup_sets ?? 0;
    total += warm * (WARMUP_SET_SECONDS + WARMUP_REST_SECONDS);
    total += p.target_sets * WORKING_SET_SECONDS;
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
  /** Exercise ids the user "loved" — forced into the plan regardless of targets. */
  loved?: string[];
  /** Exercise ids the user is avoiding (injury, pain, dislike) — never selected. */
  avoided?: string[];
  /** Finished workout history — used to attach progressive-overload weight suggestions. */
  history?: Workout[];
  /** Active equipment profile — enables plate/dumbbell-realistic rounding of
   *  suggested weights (see lib/gym/plates.ts's `plateStep`). Falls back to a
   *  plain 0.5kg round when omitted. */
  profile?: EquipmentProfile;
  /** Scales progressive-overload suggested weights on top of the per-exercise
   *  history-based suggestion — a Program's deload week. Defaults to 1 (no
   *  change); see lib/gym/programs.ts. */
  intensityMultiplier?: number;
  /** Scales working sets per exercise after the plan is fitted to the time
   *  budget (so fitting can't add the sets back) — a Program's deload week,
   *  which is meant to be a shorter, lighter session. Defaults to 1. */
  volumeMultiplier?: number;
  /** Muscles the user wants to grow (see volume.ts): their targets are
   *  picked twice as often — matching the 20-vs-10 weekly set targets — and
   *  get spare time for extra sets first. */
  focusMuscles?: Muscle[];
}

/* ---------------- superset pairing ---------------- */

/** Equipment where re-loading plates or re-setting the pin costs real time. */
const LOADED: EquipmentId[] = ["barbell", "dumbbell", "cable", "cable_high", "smith", "machine"];

function pairScore(a: Exercise, b: Exercise): number {
  let score = 0;
  // 1. strict antagonist (push vs pull / opposing groups) always wins
  if (isAntagonistPair(a, b)) score += 300;
  // 2. fallback: non-competing muscle groups (different muscles, no overlap)
  else if (
    a.primary_muscle !== b.primary_muscle &&
    !a.secondary_muscles.includes(b.primary_muscle) &&
    !b.secondary_muscles.includes(a.primary_muscle)
  )
    score += 120;
  // 3. last resort: same muscle, compound + isolation
  else if (a.primary_muscle === b.primary_muscle && a.compound !== b.compound) score += 60;
  else score += 10;

  // prefer pairs on different stations so no weight has to be changed between them
  const sharedLoaded = a.equipment_required.filter(
    (e) => LOADED.includes(e) && b.equipment_required.includes(e),
  );
  if (sharedLoaded.length) score -= 45 * sharedLoaded.length;
  else score += 25;
  return score;
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

/** Groups the plan into antagonist / compound-isolation pairs, rounds-based. */
function applySupersets(plan: PlannedExercise[], startGroup = 0): PlannedExercise[] {
  const items = plan.map((p) => ({ p, ex: EXERCISES.find((e) => e.id === p.exercise_id)! }));
  const open = items.filter((i) => i.ex);
  const result: PlannedExercise[] = [];
  const taken = new Set<number>();
  let group = startGroup;

  open.forEach((item, i) => {
    if (taken.has(i)) return;
    let bestIdx = -1;
    let best = -Infinity;
    open.forEach((other, j) => {
      if (j <= i || taken.has(j)) return;
      const score = pairScore(item.ex, other.ex);
      if (score > best) {
        best = score;
        bestIdx = j;
      }
    });
    if (bestIdx === -1) {
      taken.add(i);
      result.push(item.p);
      return;
    }
    const partner = open[bestIdx]!;
    taken.add(i);
    taken.add(bestIdx);
    group += 1;
    result.push(...makePair(item.p, partner.p, item.ex, partner.ex, group));
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
  loved = [],
  avoided = [],
  history = [],
  profile,
  intensityMultiplier = 1,
  volumeMultiplier = 1,
  focusMuscles = [],
}: GenerateArgs): PlannedExercise[] {
  const focus = new Set(focusMuscles);
  const isFocusTarget = (t: TargetMuscle) => focus.has(TARGET_MUSCLE_GROUP[t]);
  const isFocusEntry = (p: PlannedExercise) => {
    const m = EXERCISES.find((e) => e.id === p.exercise_id)?.primary_muscle;
    return m ? focus.has(m) : false;
  };
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
    const suggestion = history.length ? suggestWeight(choice.id, history, target_reps, step) : null;
    const suggestedWeight =
      suggestion && intensityMultiplier !== 1
        ? Number(roundToStep(suggestion.weight * intensityMultiplier, step).toFixed(2))
        : suggestion?.weight;
    return {
      exercise_id: choice.id,
      target_sets: compound ? shape.compoundSets : shape.accessorySets,
      warmup_sets: compound ? shape.compoundWarmups : 0,
      target_reps,
      rest_seconds: compound ? shape.compoundRest : shape.accessoryRest,
      ...(suggestedWeight !== undefined ? { suggested_weight: suggestedWeight } : {}),
      ...(suggestion ? { suggested_reps: suggestion.reps } : {}),
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
  const nextChoice = (target: TargetMuscle, compound: boolean): Exercise | undefined => {
    const free = pool.filter((e) => !used.has(e.id));
    const hitsTarget = free.filter((e) => e.muscle_targets.includes(target));
    const forMuscle = hitsTarget.length
      ? hitsTarget
      : free.filter((e) => e.primary_muscle === TARGET_MUSCLE_GROUP[target]);
    if (!forMuscle.length) return undefined;
    const ranked = [...forMuscle].sort(
      (a, b) =>
        (a.muscle_targets[0] === target ? 0 : 1) - (b.muscle_targets[0] === target ? 0 : 1) ||
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
    return candidates[(variation + plan.length) % candidates.length];
  };

  // balanced volume: always serve the target muscle with the fewest planned exercises
  const hits = new Map<TargetMuscle, number>(targets.map((m) => [m, 0]));
  for (const ex of lovedExercises) {
    const t = ex.muscle_targets.find((m) => hits.has(m));
    if (t) hits.set(t, hits.get(t)! + 1);
  }
  const dry = new Set<TargetMuscle>(); // targets with no remaining candidates
  // A focus target's exercises count half, so it's served twice as often.
  const load = (m: TargetMuscle) => hits.get(m)! * (isFocusTarget(m) ? 0.5 : 1);
  const pickTarget = (): TargetMuscle | undefined => {
    let best: TargetMuscle | undefined;
    for (const m of targets) {
      if (dry.has(m)) continue;
      if (
        best === undefined ||
        load(m) < load(best) ||
        (load(m) === load(best) && isFocusTarget(m) && !isFocusTarget(best))
      ) {
        best = m;
      }
    }
    return best;
  };

  const seeded = plan.length; // loved exercises already in the plan
  for (let i = 0; i < shape.maxExercises - seeded; i++) {
    const target = pickTarget();
    if (!target) break;
    const wantCompound = plan.length < compoundQuota;
    const choice = nextChoice(target, wantCompound) ?? nextChoice(target, !wantCompound);
    if (!choice) {
      dry.add(target);
      i--; // retry with the next-least-served target
      continue;
    }
    const entry = makeEntry(choice, choice.compound);
    // Past ~11 fractional sets for one muscle in a session Pelland et al.
    // found no detectable extra benefit (volume.ts) — stop serving it.
    if (overSessionCap([...plan, entry])) {
      dry.add(target);
      i--;
      continue;
    }
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
  // Focus exercises get spare time first; no muscle goes past the per-session
  // point Pelland et al. found no detectable extra benefit (volume.ts).
  const order = [
    ...plan.map((p, i) => ({ p, i })).filter(({ p }) => isFocusEntry(p)),
    ...plan.map((p, i) => ({ p, i })).filter(({ p }) => !isFocusEntry(p)),
  ].map(({ i }) => i);
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

  if (!supersets) return withVolume(plan);

  const exOf = (p: PlannedExercise) => EXERCISES.find((e) => e.id === p.exercise_id);
  let paired = applySupersets(plan);

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
    for (let k = 0; k < 2; k++) {
      let choice: Exercise | undefined;
      for (let t = 0; t < targets.length; t++) {
        const m = pickTarget();
        if (!m) break;
        choice = nextChoice(m, false) ?? nextChoice(m, true);
        if (choice) {
          hits.set(m, hits.get(m)! + 1);
          break;
        }
        dry.add(m);
      }
      if (!choice) break;
      used.add(choice.id);
      picks.push({ entry: makeEntry(choice, choice.compound), ex: choice });
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
    if (estimateSeconds(bumped) > budget * 1.06) break;
    paired = bumped;
  }

  // A straight-set exercise (the odd one out, or a solo finisher) must never sit
  // wedged between supersets — move every non-superset exercise to the very end
  // so the workout always closes on it. Superset pairs keep their order.
  const grouped = paired.filter((p) => p.superset_group !== undefined);
  const straight = paired.filter((p) => p.superset_group === undefined);
  paired = [...grouped, ...straight];

  return withVolume(paired);
}
