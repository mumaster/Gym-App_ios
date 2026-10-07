import type { EquipmentId, EquipmentProfile, Exercise } from "./types";

export const PLATE_SIZES = [20, 10, 5, 2.5, 1.25, 0.5] as const;

export type PlateInventory = Record<string, number>;

export const DEFAULT_PLATES: PlateInventory = {
  "20": 4,
  "10": 4,
  "5": 4,
  "2.5": 4,
  "1.25": 2,
  "0.5": 2,
};

export interface PlateSolution {
  /** Plates on ONE side, heaviest first. */
  perSide: number[];
  /** Total achievable weight including the bar. */
  total: number;
  exact: boolean;
}

/**
 * Greedy plate solver. `pairs` is how many PAIRS of each size are owned,
 * so a pair contributes one plate per side.
 */
export function solvePlates(
  target: number,
  bar: number,
  pairs: PlateInventory,
): PlateSolution | null {
  if (!Number.isFinite(target) || target < 0) return null;

  let remainingPerSide = Math.max(0, (target - bar) / 2);
  const perSide: number[] = [];

  for (const size of PLATE_SIZES) {
    const available = Math.max(0, Math.floor(pairs[String(size)] ?? 0));
    let used = 0;
    while (used < available && remainingPerSide + 1e-6 >= size) {
      remainingPerSide = Number((remainingPerSide - size).toFixed(3));
      perSide.push(size);
      used++;
    }
  }

  const total = Number((bar + perSide.reduce((a, b) => a + b, 0) * 2).toFixed(2));
  return { perSide, total, exact: Math.abs(total - target) < 0.01 };
}

/** The rack jump for fixed dumbbells (a profile without loadable ones): the
 *  common 2 kg step of a commercial dumbbell rack. An equipment default,
 *  not a training number. */
export const FIXED_DUMBBELL_STEP = 2;

/** Smallest plate this profile owns, or null with none. */
export function smallestPlate(profile: EquipmentProfile): number | null {
  const owned = PLATE_SIZES.filter((s) => (profile.plates[String(s)] ?? 0) > 0);
  return owned.length ? Math.min(...owned) : null;
}

/**
 * Smallest sensible weight change: what the +/- steppers on the set-logging
 * row move by, and what suggestions round to. It comes from the smallest
 * plate the profile owns (asked for: the 0.5 and 1.25 kg plates should count
 * for every loaded exercise, not only the barbell):
 *
 * - Loaded on both sides (barbell, Smith bar, a plate-loaded leg press):
 *   one of the smallest plate per side, so twice it.
 * - Loadable dumbbells: the smallest plate itself (asked for: + should add
 *   0.5 kg with 0.5 kg plates, not a whole kilo; dumbbells are logged per
 *   dumbbell, and a 12.5 kg one had been lifted that a 1 kg grid skipped).
 * - One loading pin (a cable or machine stack, the leg developer): one small
 *   plate on the pin, never more than the 2.5 kg a stack usually moves by.
 * - Fixed dumbbells (a rack, `loadable_dumbbells` off): FIXED_DUMBBELL_STEP.
 * - Anything else (kettlebells, bands): 2.5.
 */
const ONE_PIN: EquipmentId[] = ["cable", "cable_high", "machine", "leg_developer"];

export function plateStep(exercise: Exercise, profile: EquipmentProfile): number {
  const gear = exercise.equipment_required;
  const smallest = smallestPlate(profile);
  const bothSides = (fallback: number) =>
    smallest == null ? fallback : Number((smallest * 2).toFixed(2));
  if (gear.includes("barbell") || gear.includes("smith")) return bothSides(2.5);
  if (gear.includes("dumbbell"))
    return profile.loadable_dumbbells === false ? FIXED_DUMBBELL_STEP : (smallest ?? 2);
  if (gear.includes("leg_press")) return bothSides(2.5);
  if (ONE_PIN.some((g) => gear.includes(g)))
    return smallest == null ? 2.5 : Math.min(2.5, smallest);
  return 2.5;
}

export function formatPlates(perSide: number[]): string {
  if (perSide.length === 0) return "empty bar";
  const counts = new Map<number, number>();
  for (const p of perSide) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts.entries()].map(([size, n]) => (n > 1 ? `${n}×${size}` : `${size}`)).join(" + ");
}
