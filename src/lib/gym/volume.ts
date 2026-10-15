import { defaultMuscleTargets, exerciseById } from "./data";
import { addDays } from "./date";
import { mondayOf } from "./schedule";
import type { Exercise, Muscle, TargetMuscle, Workout } from "./types";

/**
 * Weekly training volume per specific muscle, counted and targeted from the
 * volume research rather than round numbers:
 *
 * - Muscles: the specific muscles an exercise lists as its targets
 *   (`muscle_targets`: Biceps, Triceps, Side Delts, Lats, Glutes…), not the
 *   nine groups (Arms, Shoulders, Back…) the app used to count. A group hides
 *   that triceps work from presses and biceps work from curls are different
 *   muscles with their own recovery and growth. The three chest heads count
 *   as one muscle, Chest: they are one pec muscle, and the targets below come
 *   from studies of whole muscles, not of heads.
 * - Counting: every working set counts as one whole set for each muscle the
 *   exercise lists (a bench press: Chest, Triceps, Front Delts; a curl:
 *   Biceps, Forearms). There are no half sets. Pelland et al.'s dose-response
 *   meta-regression (Sports Med 2024/2025, 67 studies) found counting the
 *   helping muscles at half predicts growth best; this app counts them whole
 *   at the user's request, which reads a muscle's week a little high, the
 *   more so for muscles that mostly help (front delts, triceps).
 * - Baseline target: 10 sets per muscle per week, the threshold for
 *   near-maximal hypertrophy in Schoenfeld, Ogborn & Krieger's meta-analysis
 *   (J Sports Sci 2017), and the ~10 sets the ACSM 2026 position stand gives.
 * - Focus target: 20 sets, the upper end of the 12–20 weekly sets Baz-Valle
 *   et al.'s systematic review (Int J Environ Res Public Health 2022) found
 *   best for growth in trained lifters. Volume keeps adding muscle with
 *   diminishing returns (Pelland), so a muscle you want to grow gets the
 *   top of that range while the rest stay at the baseline.
 * - Per session: Pelland found no detectable extra growth beyond about 11
 *   sets for one muscle in one session, so the generator won't stack more
 *   than that on a muscle in a single workout. The cap counts the sets that
 *   muscle is the main target of (the first muscle an exercise lists), since
 *   the 11 comes from sets taken at their own weight, not from muscles
 *   helping in a lift.
 */
export const BASE_WEEKLY_SETS = 10;
export const FOCUS_WEEKLY_SETS = 20;
export const MAX_SESSION_SETS_PER_MUSCLE = 11;

/** A muscle as the weekly sets count it: a specific muscle, with the three
 *  chest heads as one. */
export type VolumeMuscle =
  Exclude<TargetMuscle, "Upper Chest" | "Mid Chest" | "Lower Chest"> | "Chest";

/** Every muscle, top to bottom by group (the order of the weekly list). */
export const VOLUME_MUSCLES: VolumeMuscle[] = [
  "Chest",
  "Lats",
  "Traps",
  "Lower Back",
  "Front Delts",
  "Side Delts",
  "Rear Delts",
  "Biceps",
  "Triceps",
  "Forearms",
  "Quads",
  "Adductors",
  "Hamstrings",
  "Glutes",
  "Abductors",
  "Abs",
  "Obliques",
  "Calves",
];

export const volumeMuscleOf = (t: TargetMuscle): VolumeMuscle =>
  t === "Upper Chest" || t === "Mid Chest" || t === "Lower Chest" ? "Chest" : t;

export type FocusGroup = "chest" | "back" | "shoulders" | "arms" | "glutes" | "legs" | "core";

/** The groups the picker shows as shortcuts: tapping one stars (or unstars)
 *  all its muscles. */
export const FOCUS_GROUPS: { id: FocusGroup; muscles: VolumeMuscle[] }[] = [
  { id: "chest", muscles: ["Chest"] },
  { id: "back", muscles: ["Lats", "Traps", "Lower Back"] },
  { id: "shoulders", muscles: ["Front Delts", "Side Delts", "Rear Delts"] },
  { id: "arms", muscles: ["Biceps", "Triceps", "Forearms"] },
  { id: "glutes", muscles: ["Glutes", "Abductors"] },
  { id: "legs", muscles: ["Quads", "Adductors", "Hamstrings", "Calves"] },
  { id: "core", muscles: ["Abs", "Obliques"] },
];

/** Muscle groups (Muscle) that have at least one starred muscle. */
export const focusedGroups = (focus: Iterable<VolumeMuscle>): Set<Muscle> => {
  const on = new Set(focus);
  const groups = new Set<Muscle>();
  for (const m of VOLUME_MUSCLES) {
    if (on.has(m)) groups.add(muscleGroupOf(m));
  }
  return groups;
};

/** The `Muscle` group a muscle belongs to. */
export const muscleGroupOf = (m: VolumeMuscle): Muscle => GROUP_OF[m];

const GROUP_OF: Record<VolumeMuscle, Muscle> = {
  Chest: "Chest",
  Lats: "Back",
  Traps: "Back",
  "Lower Back": "Back",
  "Front Delts": "Shoulders",
  "Side Delts": "Shoulders",
  "Rear Delts": "Shoulders",
  Biceps: "Arms",
  Triceps: "Arms",
  Forearms: "Arms",
  Quads: "Quads",
  Adductors: "Quads",
  Hamstrings: "Hamstrings",
  Glutes: "Glutes",
  Abductors: "Glutes",
  Abs: "Core",
  Obliques: "Core",
  Calves: "Calves",
};

/** The muscles of a `Muscle` group. */
export const musclesOfGroup = (g: Muscle): VolumeMuscle[] =>
  VOLUME_MUSCLES.filter((m) => GROUP_OF[m] === g);

/** All the muscles of some focus groups (a group's shortcut in the picker). */
export const musclesInGroups = (ids: FocusGroup[]): VolumeMuscle[] =>
  FOCUS_GROUPS.filter((g) => ids.includes(g.id)).flatMap((g) => g.muscles);

/** A short list of what's starred: a group's name when all its muscles are
 *  starred, else the muscles one by one. */
export function focusSummary(
  focus: VolumeMuscle[],
  groupName: (g: FocusGroup) => string,
): string[] {
  const out: string[] = [];
  for (const g of FOCUS_GROUPS) {
    const on = g.muscles.filter((m) => focus.includes(m));
    if (on.length === g.muscles.length) out.push(groupName(g.id));
    else out.push(...on);
  }
  return out;
}

/** Saves from before muscles were counted one by one stored groups. */
export function migrateFocus(raw: unknown): VolumeMuscle[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<VolumeMuscle>();
  for (const v of raw) {
    const group = FOCUS_GROUPS.find((g) => g.id === v);
    if (group) group.muscles.forEach((m) => out.add(m));
    else if (VOLUME_MUSCLES.includes(v as VolumeMuscle)) out.add(v as VolumeMuscle);
  }
  return VOLUME_MUSCLES.filter((m) => out.has(m));
}

export function weeklyTarget(muscle: VolumeMuscle, focus: Set<VolumeMuscle>): number {
  return focus.has(muscle) ? FOCUS_WEEKLY_SETS : BASE_WEEKLY_SETS;
}

const targetsOf = (ex: Exercise): TargetMuscle[] =>
  ex.muscle_targets.length ? ex.muscle_targets : defaultMuscleTargets(ex.primary_muscle);

/** The muscle an exercise is mainly for (the first it lists). */
export function mainMuscleOf(ex: Exercise): VolumeMuscle {
  return volumeMuscleOf(targetsOf(ex)[0]!);
}

/** The muscles one working set of `exerciseId` counts for, one set each. */
export function setContribution(exerciseId: string): Partial<Record<VolumeMuscle, number>> {
  const ex = exerciseById(exerciseId);
  if (!ex) return {};
  const out: Partial<Record<VolumeMuscle, number>> = {};
  for (const t of targetsOf(ex)) out[volumeMuscleOf(t)] = 1;
  return out;
}

function addSets(
  total: Partial<Record<VolumeMuscle, number>>,
  exerciseId: string,
  sets: number,
): void {
  for (const m of Object.keys(setContribution(exerciseId)) as VolumeMuscle[]) {
    total[m] = (total[m] ?? 0) + sets;
  }
}

/** Working sets per muscle in the Monday–Sunday week of `day`, including an
 *  in-progress session. */
export function weeklySets(
  workouts: Workout[],
  activeWorkout: Workout | null,
  day = new Date(),
): Partial<Record<VolumeMuscle, number>> {
  const start = mondayOf(day).getTime();
  const end = addDays(mondayOf(day), 7).getTime();
  const total: Partial<Record<VolumeMuscle, number>> = {};
  for (const w of activeWorkout ? [...workouts, activeWorkout] : workouts) {
    const t = new Date(w.date).getTime();
    if (t < start || t >= end) continue;
    for (const s of w.completed_sets) {
      if (s.set_type === "working") addSets(total, s.exercise_id, 1);
    }
  }
  return total;
}

/** Planned sets per muscle for one session's plan. */
export function planSets(
  plan: { exercise_id: string; target_sets: number }[],
): Partial<Record<VolumeMuscle, number>> {
  const total: Partial<Record<VolumeMuscle, number>> = {};
  for (const p of plan) addSets(total, p.exercise_id, p.target_sets);
  return total;
}

/** Planned sets per muscle counting only the sets it is the main target of:
 *  what the per-session cap looks at. */
export function mainPlanSets(
  plan: { exercise_id: string; target_sets: number }[],
): Partial<Record<VolumeMuscle, number>> {
  const total: Partial<Record<VolumeMuscle, number>> = {};
  for (const p of plan) {
    const ex = exerciseById(p.exercise_id);
    if (!ex) continue;
    const m = mainMuscleOf(ex);
    total[m] = (total[m] ?? 0) + p.target_sets;
  }
  return total;
}

export interface MuscleVolume {
  muscle: VolumeMuscle;
  done: number;
  target: number;
  focus: boolean;
}

/** Every muscle's week so far against its target, furthest behind first
 *  (by share of target still missing). */
export function weeklyVolume(
  muscles: VolumeMuscle[],
  done: Partial<Record<VolumeMuscle, number>>,
  focus: Set<VolumeMuscle>,
): MuscleVolume[] {
  return muscles
    .map((muscle) => ({
      muscle,
      done: done[muscle] ?? 0,
      target: weeklyTarget(muscle, focus),
      focus: focus.has(muscle),
    }))
    .sort((a, b) => a.done / a.target - b.done / b.target || Number(b.focus) - Number(a.focus));
}

/** Muscles a plan has filled up to (or within one accessory set of) the
 *  per-session cap, so the generator had no room left for them. The cap is
 *  the app's own reading of Pelland et al. 2024 (see above); "within 2 sets"
 *  is a display choice, not a published number. */
export function muscularCapReached(
  plan: { exercise_id: string; target_sets: number }[],
): VolumeMuscle[] {
  const sets = mainPlanSets(plan);
  return (Object.keys(sets) as VolumeMuscle[]).filter(
    (m) => (sets[m] ?? 0) >= MAX_SESSION_SETS_PER_MUSCLE - 2,
  );
}
