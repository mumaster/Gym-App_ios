import {
  BicepsFlexed,
  Dumbbell,
  Footprints,
  Gem,
  Mountain,
  PersonStanding,
  Shield,
  Target,
  Triangle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Muscle } from "./types";

/** One icon per muscle group, shared by the Exercises cards and the workout
 *  screen so a group looks the same everywhere. */
const MUSCLE_ICONS: Record<Muscle, LucideIcon> = {
  Chest: Shield,
  Back: Mountain,
  Shoulders: Triangle,
  Arms: BicepsFlexed,
  Quads: Zap,
  Hamstrings: PersonStanding,
  Glutes: Gem,
  Core: Target,
  Calves: Footprints,
};

/** The group's icon; the barbell for a custom exercise with an unknown muscle. */
export function muscleIcon(muscle: string): LucideIcon {
  return MUSCLE_ICONS[muscle as Muscle] ?? Dumbbell;
}
