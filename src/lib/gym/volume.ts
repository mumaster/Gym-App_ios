import { exerciseById } from "./data";
import { addDays } from "./date";
import { mondayOf } from "./schedule";
import type { Muscle, Workout } from "./types";

/**
 * Weekly training volume per muscle, counted and targeted from the
 * volume research rather than round numbers:
 *
 * - Counting: Pelland et al.'s dose-response meta-regression (Sports Med
 *   2024/2025, 67 studies) found "fractional" counting predicts growth best —
 *   a working set counts 1 for the muscle the exercise mainly trains and 0.5
 *   for each muscle it trains secondarily.
 * - Baseline target: 10 sets per muscle per week, the threshold for
 *   near-maximal hypertrophy in Schoenfeld, Ogborn & Krieger's meta-analysis
 *   (J Sports Sci 2017), and the ~10 sets the ACSM 2026 position stand gives.
 * - Focus target: 20 sets, the upper end of the 12–20 weekly sets Baz-Valle
 *   et al.'s systematic review (Int J Environ Res Public Health 2022) found
 *   best for growth in trained lifters. Volume keeps adding muscle with
 *   diminishing returns (Pelland), so a muscle you want to grow gets the
 *   top of that range while the rest stay at the baseline.
 * - Per session: Pelland found no detectable extra growth beyond about 11
 *   fractional sets for one muscle in one session, so the generator won't
 *   stack more than that on a muscle in a single workout.
 */
export const BASE_WEEKLY_SETS = 10;
export const FOCUS_WEEKLY_SETS = 20;
export const MAX_SESSION_SETS_PER_MUSCLE = 11;
const SECONDARY_SET_WEIGHT = 0.5;

export type FocusGroup = "chest" | "back" | "shoulders" | "arms" | "legs" | "core";

export const FOCUS_GROUPS: { id: FocusGroup; muscles: Muscle[] }[] = [
  { id: "chest", muscles: ["Chest"] },
  { id: "back", muscles: ["Back"] },
  { id: "shoulders", muscles: ["Shoulders"] },
  { id: "arms", muscles: ["Arms"] },
  { id: "legs", muscles: ["Quads", "Hamstrings", "Glutes", "Calves"] },
  { id: "core", muscles: ["Core"] },
];

export const focusMuscles = (focus: FocusGroup[]): Set<Muscle> =>
  new Set(FOCUS_GROUPS.filter((g) => focus.includes(g.id)).flatMap((g) => g.muscles));

export function weeklyTarget(muscle: Muscle, focus: Set<Muscle>): number {
  return focus.has(muscle) ? FOCUS_WEEKLY_SETS : BASE_WEEKLY_SETS;
}

/** Fractional sets one working set of `exerciseId` adds to each muscle. */
export function setContribution(exerciseId: string): Partial<Record<Muscle, number>> {
  const ex = exerciseById(exerciseId);
  if (!ex) return {};
  const out: Partial<Record<Muscle, number>> = { [ex.primary_muscle]: 1 };
  for (const m of new Set(ex.secondary_muscles)) {
    if (m !== ex.primary_muscle) out[m] = (out[m] ?? 0) + SECONDARY_SET_WEIGHT;
  }
  return out;
}

function addSets(total: Partial<Record<Muscle, number>>, exerciseId: string, sets: number): void {
  for (const [m, w] of Object.entries(setContribution(exerciseId)) as [Muscle, number][]) {
    total[m] = (total[m] ?? 0) + w * sets;
  }
}

/** Fractional working sets per muscle in the Monday–Sunday week of `day`,
 *  including an in-progress session. */
export function weeklySets(
  workouts: Workout[],
  activeWorkout: Workout | null,
  day = new Date(),
): Partial<Record<Muscle, number>> {
  const start = mondayOf(day).getTime();
  const end = addDays(mondayOf(day), 7).getTime();
  const total: Partial<Record<Muscle, number>> = {};
  for (const w of activeWorkout ? [...workouts, activeWorkout] : workouts) {
    const t = new Date(w.date).getTime();
    if (t < start || t >= end) continue;
    for (const s of w.completed_sets) {
      if (s.set_type === "working") addSets(total, s.exercise_id, 1);
    }
  }
  return total;
}

/** Planned fractional sets per muscle for one session's plan. */
export function planSets(
  plan: { exercise_id: string; target_sets: number }[],
): Partial<Record<Muscle, number>> {
  const total: Partial<Record<Muscle, number>> = {};
  for (const p of plan) addSets(total, p.exercise_id, p.target_sets);
  return total;
}

export interface MuscleVolume {
  muscle: Muscle;
  done: number;
  target: number;
  focus: boolean;
}

/** Every muscle's week so far against its target, furthest behind first
 *  (by share of target still missing). */
export function weeklyVolume(
  muscles: Muscle[],
  done: Partial<Record<Muscle, number>>,
  focus: Set<Muscle>,
): MuscleVolume[] {
  return muscles
    .map((muscle) => ({
      muscle,
      done: Math.round((done[muscle] ?? 0) * 10) / 10,
      target: weeklyTarget(muscle, focus),
      focus: focus.has(muscle),
    }))
    .sort((a, b) => a.done / a.target - b.done / b.target || Number(b.focus) - Number(a.focus));
}
