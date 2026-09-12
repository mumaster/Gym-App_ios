import type { EquipmentProfile, Exercise } from "./types";

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

/**
 * Smallest sensible weight change for the +/- steppers on the set-logging row.
 * Barbell/smith: one of the smallest plate you own, per side. Dumbbell: a rack
 * jump. Everything else (machines, cables, bands): 2.5.
 */
export function plateStep(exercise: Exercise, profile: EquipmentProfile): number {
  const gear = exercise.equipment_required;
  if (gear.includes("barbell") || gear.includes("smith")) {
    const owned = PLATE_SIZES.filter((s) => (profile.plates[String(s)] ?? 0) > 0);
    const smallest = owned.length ? Math.min(...owned) : 1.25;
    return Number((smallest * 2).toFixed(2));
  }
  if (gear.includes("dumbbell")) return 2;
  return 2.5;
}

export function formatPlates(perSide: number[]): string {
  if (perSide.length === 0) return "empty bar";
  const counts = new Map<number, number>();
  for (const p of perSide) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts.entries()].map(([size, n]) => (n > 1 ? `${n}×${size}` : `${size}`)).join(" + ");
}
