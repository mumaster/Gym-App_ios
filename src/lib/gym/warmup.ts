import { roundToStep } from "./progression";

/**
 * Specific warm-up loads, from Ribeiro et al. (Percept Mot Skills 2014,
 * "Effect of different warm-up procedures on the performance of resistance
 * training exercises"), repeated with trained lifters by Ribeiro et al.
 * (J Hum Kinet 2020, "The Role of Specific Warm-up during Bench Press and
 * Squat Exercises: A Novel Approach"): two sets of 6 reps at 40% and then
 * 80% of the *training* load improved performance of the working sets, and
 * a single set of 6 at 80% did for the squat. So a planned single warm-up
 * set is 6 × 80% and two are 6 × 40%, 6 × 80%. (The 2020 study also found
 * the 80% set mattered more than the 40% one.) More than two isn't
 * something the studies tested; the generator never plans more than two,
 * and any extra set is spread evenly between 40% and 80%.
 *
 * Confirmed through web search summaries of these papers — the journal
 * sites themselves are blocked in this environment.
 */
export const WARMUP_REPS = 6;
const LOW = 0.4;
const HIGH = 0.8;

export function warmupFractions(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [HIGH];
  return Array.from({ length: count }, (_, i) => LOW + ((HIGH - LOW) * i) / (count - 1));
}

/**
 * Load for warm-up set `index` (0-based) of `count`, rounded to a loadable
 * step and never below `minLoad` (an empty barbell can't get lighter).
 * Null when there's no working weight to base it on.
 */
export function warmupLoad(
  workingKg: number | null | undefined,
  index: number,
  count: number,
  step: number,
  minLoad = 0,
): { weight: number; reps: number; fraction: number } | null {
  if (!workingKg || workingKg <= 0) return null;
  const fraction = warmupFractions(count)[index];
  if (fraction === undefined) return null;
  const weight = Math.max(minLoad, Number(roundToStep(workingKg * fraction, step).toFixed(2)));
  return { weight: Math.min(weight, workingKg), reps: WARMUP_REPS, fraction };
}
