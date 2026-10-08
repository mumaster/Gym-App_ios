import type { Exercise } from "./types";

export type Limb = "arm" | "leg" | "side";

/** What "one side" means for a unilateral exercise: arm for upper-body
 *  lifts, leg for lower-body, side for core work. */
export function limbOf(e: Pick<Exercise, "primary_muscle">): Limb {
  switch (e.primary_muscle) {
    case "Chest":
    case "Back":
    case "Shoulders":
    case "Arms":
      return "arm";
    case "Quads":
    case "Hamstrings":
    case "Glutes":
    case "Calves":
      return "leg";
    default:
      return "side";
  }
}
