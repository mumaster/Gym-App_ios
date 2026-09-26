import type { WeightEntry } from "./bodyweight";
import type { NutritionProfile } from "./nutrition";
import type { EquipmentId, Exercise } from "./types";

/** Gear that only supports your own body (a bar to hang from, bars to dip
 *  on, a bench to push off) — an exercise needing nothing else is a
 *  bodyweight exercise, whose logged "weight" is extra load on top of you. */
const BODYWEIGHT_GEAR: ReadonlySet<EquipmentId> = new Set([
  "bodyweight",
  "pullup_bar",
  "dip_bars",
  "bench",
]);

/**
 * True for exercises where you move your own body (pull-ups, dips, push-ups).
 * Their logged weight is *external* load: 0 = bodyweight only, positive =
 * added (belt, vest, dumbbell between the feet), negative = assistance (a
 * band or an assisted machine taking that much off).
 */
export function isBodyweightExercise(exercise: Exercise | undefined): boolean {
  if (!exercise) return false;
  const gear = exercise.equipment_required;
  // A bench alone isn't a load; anything else outside this set (bands,
  // machines, free weights) means the logged weight is the real load.
  return gear.some((g) => g !== "bench") && gear.every((g) => BODYWEIGHT_GEAR.has(g));
}

/** Latest known bodyweight: the newest weigh-in, else the questionnaire's
 *  answer, else null (never a guessed default). */
export function latestBodyKg(
  weightLog: WeightEntry[],
  profile: NutritionProfile | null | undefined,
): number | null {
  return weightLog.at(-1)?.kg ?? profile?.weightKg ?? null;
}

/** "80 kg" for a normal lift; "BW", "BW +10 kg" or "BW −15 kg" for a
 *  bodyweight exercise, `bw` being the translated short label. */
export function formatLoad(kg: number, bodyweight: boolean, bw: string): string {
  const n = Number(Math.abs(kg).toFixed(2));
  if (!bodyweight) return `${Number(kg.toFixed(2))} kg`;
  if (kg === 0) return bw;
  return `${bw} ${kg > 0 ? "+" : "−"}${n} kg`;
}
