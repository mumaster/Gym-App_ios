import { REGION_TARGETS, regionsForMuscles, type RegionId } from "./anatomy";
import { exerciseById } from "./data";
import { sessionMinutes } from "./trainingLoad";
import { MAX_SESSION_SETS_PER_MUSCLE } from "./volume";
import type { TargetMuscle, Workout } from "./types";

/**
 * How recovered each muscle-map region is, from recent sets and their RPE,
 * for the recovery shading on the muscle map.
 *
 * - How long: the ACSM position stand on progression models (Med Sci Sports
 *   Exerc 2009) recommends 48–72 h before training the same muscle group
 *   hard again. A region's recovery runs from the end of the session over
 *   48 h for easy, low-volume work up to 72 h for the hardest.
 * - Effort: Morán-Navarro et al. (Eur J Appl Physiol 2017) found sets taken
 *   to failure needed 24–48 h longer to recover than the same work stopped
 *   short of it, so effort moves a region toward the 72 h end: logged RPE 7
 *   (3 reps left, the bottom of the app's target, progression.ts) adds
 *   nothing and RPE 10 (failure) the full 24 h, in proportion. A set with no
 *   RPE counts as RPE 8, the middle of the target the app asks for.
 * - Volume: more sets for one muscle need longer too. The scale runs up to
 *   `MAX_SESSION_SETS_PER_MUSCLE` (about 11 fractional sets, past which
 *   Pelland et al. 2024 found no extra growth in one session, volume.ts),
 *   which adds the full 24 h. Whichever of effort and volume is higher sets
 *   the time; the two aren't added, so the 72 h end is never passed.
 * - Counting: a set counts 1 for the regions of the exercise's main target
 *   muscle and 0.5 for the rest of its targets (Pelland's fractional
 *   counting, volume.ts). Regions with under one fractional set (a muscle
 *   only helping in a single set) aren't shaded. The proportional steps in
 *   between 48 and 72 h are the app's own reading, not a published curve.
 */
export const RECOVERY_HOURS: [number, number] = [48, 72];
const RPE_EASY = 7;
const RPE_FAILURE = 10;
const RPE_UNRATED = 8;
const SECONDARY_WEIGHT = 0.5;
const MIN_SETS = 1;

const REGION_OF_TARGET = new Map<TargetMuscle, RegionId>();
for (const [region, targets] of Object.entries(REGION_TARGETS) as [RegionId, TargetMuscle[]][]) {
  for (const t of targets) if (!REGION_OF_TARGET.has(t)) REGION_OF_TARGET.set(t, region);
}

/** Fractional sets one working set of `exerciseId` adds to each region. */
export function regionContribution(exerciseId: string): Partial<Record<RegionId, number>> {
  const ex = exerciseById(exerciseId);
  if (!ex) return {};
  const out: Partial<Record<RegionId, number>> = {};
  const add = (r: RegionId | undefined, w: number) => {
    if (r) out[r] = Math.max(out[r] ?? 0, w);
  };
  if (ex.muscle_targets.length) {
    ex.muscle_targets.forEach((t, i) =>
      add(REGION_OF_TARGET.get(t), i === 0 ? 1 : SECONDARY_WEIGHT),
    );
  } else {
    for (const r of regionsForMuscles([ex.primary_muscle])) add(r, 1);
    for (const r of regionsForMuscles(ex.secondary_muscles)) add(r, SECONDARY_WEIGHT);
  }
  return out;
}

export interface RegionRecovery {
  /** 0 = just trained, 1 = recovered. */
  recovered: number;
  /** Hours until recovered (0 once it is). */
  hoursLeft: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Recovery hours one session's work on a region needs. */
export function recoveryHours(sets: number, avgRpe: number): number {
  const effort = clamp01((avgRpe - RPE_EASY) / (RPE_FAILURE - RPE_EASY));
  const volume = clamp01(sets / MAX_SESSION_SETS_PER_MUSCLE);
  const [lo, hi] = RECOVERY_HOURS;
  return lo + (hi - lo) * Math.max(effort, volume);
}

/** Regions still recovering at `now`, from finished workouts in the last
 *  72 h. A region trained in several sessions takes the slowest one. */
export function regionRecovery(
  workouts: Workout[],
  now: Date = new Date(),
): Partial<Record<RegionId, RegionRecovery>> {
  const out: Partial<Record<RegionId, RegionRecovery>> = {};
  const nowMs = now.getTime();
  const horizon = nowMs - RECOVERY_HOURS[1] * 3_600_000;
  for (const w of workouts) {
    const end = w.finished_at
      ? Date.parse(w.finished_at)
      : Date.parse(w.date) + sessionMinutes(w) * 60_000;
    if (!Number.isFinite(end) || end < horizon || end > nowMs) continue;
    const sets: Partial<Record<RegionId, number>> = {};
    const rpeSum: Partial<Record<RegionId, number>> = {};
    for (const s of w.completed_sets) {
      if (s.set_type !== "working") continue;
      for (const [r, weight] of Object.entries(regionContribution(s.exercise_id)) as [
        RegionId,
        number,
      ][]) {
        sets[r] = (sets[r] ?? 0) + weight;
        rpeSum[r] = (rpeSum[r] ?? 0) + weight * (s.rpe ?? RPE_UNRATED);
      }
    }
    for (const [r, n] of Object.entries(sets) as [RegionId, number][]) {
      if (n < MIN_SETS) continue;
      const hours = recoveryHours(n, rpeSum[r]! / n);
      const elapsed = (nowMs - end) / 3_600_000;
      const recovered = clamp01(elapsed / hours);
      if (recovered >= 1) continue;
      const hoursLeft = Math.max(0, Math.ceil(hours - elapsed));
      const cur = out[r];
      if (!cur || hoursLeft > cur.hoursLeft) out[r] = { recovered, hoursLeft };
    }
  }
  return out;
}

/** Shading step for a region: "low" under half recovered, "mid" after. */
export const recoveryLevel = (r: RegionRecovery | undefined): "low" | "mid" | null =>
  !r ? null : r.recovered < 0.5 ? "low" : "mid";
