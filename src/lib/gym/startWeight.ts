import { exerciseById } from "./data";
import { isBodyweightExercise } from "./load";
import { repRange, TARGET_RPE, type ProgressionSuggestion } from "./progression";
import type { EquipmentId, Exercise, LoggedSet, Workout } from "./types";

/**
 * Weights for exercises without their own suggestion, and a "you could go
 * heavier" note for ones with it — both from what you've logged on other
 * exercises and from your RPE. `progression.ts`'s double progression stays
 * the suggestion for an exercise you've done; this only fills the gaps.
 *
 * Effort: the app logs the RIR-based RPE scale, where RPE 10 = no reps left
 * and RPE 8 = 2 (Zourdos et al., J Strength Cond Res 2016; Helms et al.,
 * Strength Cond J 2016). A set's estimated 1RM is Epley's formula — the one
 * the app already uses (progress.ts) — over the reps done *plus* the reps
 * left: weight × (1 + (reps + RIR) / 30). A set without an RPE counts as
 * taken to failure (RIR 0), which underestimates: the safe side. A load is
 * proposed at RIR 2, the middle of TARGET_RPE (7–9).
 *
 * All confirmed through web search results (journal sites are blocked
 * here); listed on Settings → Sources ("startWeights").
 */

/** Reps in reserve at the target effort: the middle of RPE 7–9. */
export const TARGET_RIR = 10 - (TARGET_RPE[0] + TARGET_RPE[1]) / 2;

/** Estimated 1RM of a set, counting the reps it had left (see above). */
export function setE1rm(set: Pick<LoggedSet, "weight" | "reps" | "rpe">): number {
  const rir = set.rpe != null ? Math.max(0, 10 - set.rpe) : 0;
  return set.weight * (1 + (set.reps + rir) / 30);
}

/** The load for `reps` reps with `rir` left, rounded *down* to a loadable
 *  weight (a start that's a little light is corrected by the RPE
 *  adjustment after the first set; one that's too heavy is a failed set). */
export function loadFor(e1rm: number, reps: number, step: number, rir = TARGET_RIR): number {
  const raw = e1rm / (1 + (reps + rir) / 30);
  const down = step > 0 ? Math.floor(raw / step) * step : raw;
  return Number(down.toFixed(2));
}

const working = (w: Workout, id: string) =>
  w.completed_sets.filter((s) => s.exercise_id === id && s.set_type === "working" && s.weight > 0);

/** Sessions with logged working sets for an exercise, newest first. */
const sessionsWith = (id: string, workouts: Workout[]) =>
  workouts.filter((w) => working(w, id).length > 0);

/** The best set of a session by estimated 1RM. */
function bestSet(w: Workout, id: string): { e1rm: number; set: LoggedSet } | null {
  let best: { e1rm: number; set: LoggedSet } | null = null;
  for (const s of working(w, id)) {
    const e1rm = setE1rm(s);
    if (!best || e1rm > best.e1rm) best = { e1rm, set: s };
  }
  return best;
}

/**
 * Published 1RM relationships between exercises, as y = a·x + b in kg with
 * x the "from" exercise's 1RM. Dumbbell exercises are logged per dumbbell,
 * so a published total for two dumbbells is halved.
 * - Barbell → dumbbell bench press: the dumbbell 1RM (both dumbbells) was
 *   17% lower, 83.2 vs 100.3 kg (Saeterbakken et al., J Strength Cond Res
 *   2011) → 0.83 / 2 per dumbbell.
 * - Flat → 30° incline barbell bench: incline = 0.827·flat − 6.648 kg
 *   (regression, Korean J Appl Biomech 2006, "The relationship of one
 *   repetition maximum between flat bench press and incline bench press").
 * - Free-weight → Smith machine bench: Smith = 0.95·free − 6.76 kg
 *   (Cotterman et al., J Strength Cond Res 2005). Their squat equation was
 *   for women only, so the squat isn't converted.
 * - Standing barbell → seated dumbbell shoulder press: standing dumbbell
 *   1RM ~7% below standing barbell and ~10% below seated dumbbell
 *   (Saeterbakken & Fimland, J Strength Cond Res 2013) → seated dumbbell ≈
 *   0.93 / 0.90 = 1.033 × barbell for both, / 2 per dumbbell.
 * The reverse direction uses the inverse.
 */
interface Ratio {
  from: string;
  to: string;
  a: number;
  b: number;
}
const PUBLISHED: Ratio[] = [
  { from: "bb-bench", to: "db-bench", a: 0.83 / 2, b: 0 },
  { from: "bb-bench", to: "bb-incline-bench", a: 0.827, b: -6.648 },
  { from: "bb-bench", to: "smith-flat-press", a: 0.95, b: -6.76 },
  { from: "ohp", to: "db-shoulder-press", a: 0.93 / 0.9 / 2, b: 0 },
];
const RATIOS: Ratio[] = [
  ...PUBLISHED,
  ...PUBLISHED.map((r) => ({ from: r.to, to: r.from, a: 1 / r.a, b: -r.b / r.a })),
];

/**
 * Rough estimates — NOT from a published source (the user chose to have
 * them for pairs no study compares, clearly marked as rough in the app):
 * the most recently done exercise for the same muscle group, of the same
 * kind (compound/isolation) and movement pattern — one with the same main
 * target first — converted by equipment and
 * then cut by ROUGH_DISCOUNT so the start errs light. The equipment
 * factors reuse the published bench ratios above for other exercises
 * (barbell → dumbbell 0.415 per dumbbell, free → Smith 0.95). Cables and
 * machines aren't converted at all (factor 1): a cable crossover loads each
 * side on its own stack while a pulldown uses one, so no single factor
 * fits; the discount alone keeps them on the light side.
 * Never across compound and isolation (squat → leg extension) and never
 * for bodyweight exercises, whose logged weight is extra load.
 */
export const ROUGH_DISCOUNT = 0.8;
type Family = "barbell" | "dumbbell" | "smith" | "other";
const family = (gear: EquipmentId[]): Family =>
  gear.includes("barbell")
    ? "barbell"
    : gear.includes("dumbbell") || gear.includes("kettlebell")
      ? "dumbbell"
      : gear.includes("smith")
        ? "smith"
        : "other";
/** A family's 1RM as a fraction of the barbell version's. */
const VS_BARBELL: Record<Exclude<Family, "other">, number> = {
  barbell: 1,
  dumbbell: 0.415,
  smith: 0.95,
};

/** "entered": the exercise's own lift entered in Settings → Your current
 *  lifts, before it's been logged in the app. */
export type EstimateBasis = "published" | "personal" | "rough" | "entered";

export interface WeightEstimate {
  weight: number;
  reps: number;
  basis: EstimateBasis;
  /** The exercise it's worked out from, and its set used. */
  fromId: string;
  fromSet: { weight: number; reps: number; rpe?: number };
}

const usable = (e: Exercise | undefined): e is Exercise => !!e && !isBodyweightExercise(e);

/**
 * A starting weight for an exercise you haven't logged, from one you have:
 * a published ratio when there is one, else a rough estimate (see above).
 * Reps are the top of the target range, like the first-time prefill.
 */
/** History plus the workout in progress (newest first), so an exercise
 *  logged earlier today can stand in for a related one later in the same
 *  session — which is what makes a new user's first workout get estimates.
 *  Those sets were done fresher or more tired than usual, but a set's e1RM
 *  is what it is; the estimate errs light either way. */
export function withRunning(workouts: Workout[], running: Workout | null | undefined): Workout[] {
  return running?.completed_sets.length ? [running, ...workouts] : workouts;
}

/** A recent set entered in Settings → Your current lifts, for someone who
 *  already trains: it gives the first plan starting weights. It only ever
 *  feeds the estimates below — never History, records, volume or the
 *  streak — and stops counting for an exercise once it's logged in the app. */
export interface KnownLift {
  exercise_id: string;
  weight: number;
  reps: number;
  rpe?: number;
  /** When it was entered (ISO). */
  date: string;
}

export const KNOWN_LIFTS_ID = "known-lifts";

/** History plus the entered lifts as one pseudo-session placed after it
 *  (oldest), so anything logged in the app is preferred as a reference. */
export function withKnownLifts(workouts: Workout[], lifts: KnownLift[] | undefined): Workout[] {
  if (!lifts?.length) return workouts;
  const date = lifts.reduce((a, l) => (l.date < a ? l.date : a), lifts[0]!.date);
  return [
    ...workouts,
    {
      id: KNOWN_LIFTS_ID,
      date,
      duration_minutes: 0,
      target_muscles: [],
      unit: "kg",
      finished: true,
      plan: [],
      completed_sets: lifts.map((l, i) => ({
        exercise_id: l.exercise_id,
        set_number: i + 1,
        set_type: "working",
        weight: l.weight,
        reps: l.reps,
        ...(l.rpe != null ? { rpe: l.rpe } : {}),
        completed_at: l.date,
      })),
    },
  ];
}

export function crossEstimate(
  target: Exercise,
  workouts: Workout[],
  targetReps: string,
  step: number,
): WeightEstimate | null {
  if (!usable(target)) return null;
  const reps = repRange(targetReps)[1];
  const own = sessionsWith(target.id, workouts);
  if (own.some((w) => w.id !== KNOWN_LIFTS_ID)) return null;
  // Entered in Settings and not logged yet: its own lift at RIR 2.
  const entered = own[0] && bestSet(own[0], target.id);
  if (entered) {
    const weight = loadFor(entered.e1rm, reps, step);
    if (weight > 0)
      return { weight, reps, basis: "entered", fromId: target.id, fromSet: entered.set };
  }

  for (const r of RATIOS.filter((x) => x.to === target.id)) {
    const s = sessionsWith(r.from, workouts)[0];
    const best = s && bestSet(s, r.from);
    if (!best) continue;
    const weight = loadFor(r.a * best.e1rm + r.b, reps, step);
    if (weight > 0) return { weight, reps, basis: "published", fromId: r.from, fromSet: best.set };
  }

  // Rough: an exercise with the same main target (flat → flat press) if
  // there is one, else any for the same muscle group (flat → incline).
  // Within each, the most recent; one with the same kind of equipment
  // first, since it needs no equipment conversion.
  const to = family(target.equipment_required);
  for (const sameTarget of [true, false]) {
    const candidates: { ref: Exercise; w: Workout }[] = [];
    for (const w of workouts) {
      for (const id of new Set(w.completed_sets.map((x) => x.exercise_id))) {
        const ref = exerciseById(id);
        if (
          id === target.id ||
          !usable(ref) ||
          candidates.some((c) => c.ref.id === id) ||
          ref.primary_muscle !== target.primary_muscle ||
          (sameTarget && ref.muscle_targets[0] !== target.muscle_targets[0]) ||
          ref.compound !== target.compound ||
          ref.movement_pattern !== target.movement_pattern
        )
          continue;
        candidates.push({ ref, w });
      }
    }
    candidates.sort(
      (a, b) =>
        Number(family(a.ref.equipment_required) !== to) -
        Number(family(b.ref.equipment_required) !== to),
    );
    for (const { ref, w } of candidates) {
      const best = bestSet(w, ref.id);
      if (!best) continue;
      const from = family(ref.equipment_required);
      const factor = from === "other" || to === "other" ? 1 : VS_BARBELL[to] / VS_BARBELL[from];
      const weight = loadFor(best.e1rm * factor * ROUGH_DISCOUNT, reps, step);
      if (weight > 0) return { weight, reps, basis: "rough", fromId: ref.id, fromSet: best.set };
    }
  }
  return null;
}

export interface HeavierHint {
  weight: number;
  reps: number;
  why: "rpe" | "personal" | "published";
  /** For "rpe": the effort of the set it's based on. */
  rpe?: number;
  /** For "personal"/"published": the exercise it's based on. */
  fromId?: string;
}

/**
 * For an exercise you've done: a heavier weight than the double-progression
 * suggestion, when your own numbers say you can handle it. In order:
 * - rpe: last session's sets logged below RPE 7–9 had reps to spare; the
 *   load for the suggested reps at RIR 2 from their estimated 1RM.
 * - personal: an exercise you did around the same time as this one, done
 *   again since and stronger now; this one scaled by the same change.
 * - published: a published ratio from an exercise you've done since.
 * Only when it's at least one loadable step above the suggestion; rough
 * estimates never count. Not for bodyweight exercises.
 */
export function heavierHint(
  exercise: Exercise,
  workouts: Workout[],
  suggestion: Pick<ProgressionSuggestion, "weight" | "reps">,
  step: number,
): HeavierHint | null {
  if (!usable(exercise)) return null;
  const mine = sessionsWith(exercise.id, workouts);
  const last = mine[0];
  if (!last) return null;
  const enough = (w: number) => w >= suggestion.weight + step - 1e-9;
  const { reps } = suggestion;

  // 1. Reps to spare at the logged RPE.
  const rated = working(last, exercise.id).filter((s) => s.rpe != null);
  if (rated.length) {
    let best = rated[0]!;
    for (const s of rated) if (setE1rm(s) > setE1rm(best)) best = s;
    const weight = loadFor(setE1rm(best), reps, step);
    if (enough(weight) && best.rpe! < TARGET_RPE[0])
      return { weight, reps, why: "rpe", rpe: best.rpe! };
  }

  const myBest = bestSet(last, exercise.id)!;
  const lastDate = Date.parse(last.date);

  // 2. Personal: same muscle and kind, done on or before this exercise's
  //    last session and again after it.
  for (const w of workouts) {
    if (Date.parse(w.date) <= lastDate) break;
    for (const id of new Set(w.completed_sets.map((s) => s.exercise_id))) {
      const ref = exerciseById(id);
      if (
        id === exercise.id ||
        !usable(ref) ||
        ref.primary_muscle !== exercise.primary_muscle ||
        ref.compound !== exercise.compound
      )
        continue;
      const before = sessionsWith(id, workouts).find((x) => Date.parse(x.date) <= lastDate);
      const now = bestSet(w, id);
      const then = before && bestSet(before, id);
      if (!now || !then || now.e1rm <= then.e1rm) continue;
      const weight = loadFor((myBest.e1rm * now.e1rm) / then.e1rm, reps, step);
      if (enough(weight)) return { weight, reps, why: "personal", fromId: id };
    }
  }

  // 3. Published: from an exercise done after this one's last session.
  for (const r of RATIOS.filter((x) => x.to === exercise.id)) {
    const s = sessionsWith(r.from, workouts)[0];
    if (!s || Date.parse(s.date) <= lastDate) continue;
    const best = bestSet(s, r.from);
    if (!best) continue;
    const weight = loadFor(r.a * best.e1rm + r.b, reps, step);
    if (enough(weight)) return { weight, reps, why: "published", fromId: r.from };
  }
  return null;
}

/** For tests and display: whether a pair has a published ratio. */
export const hasPublishedRatio = (from: string, to: string) =>
  RATIOS.some((r) => r.from === from && r.to === to);
