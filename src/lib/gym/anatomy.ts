import type { Muscle, TargetMuscle } from "./types";

/** Fine-grained anatomy regions shown on the muscle map. */
export type RegionId =
  | "chest"
  | "shoulders"
  | "biceps"
  | "forearms"
  | "core"
  | "quads"
  | "hips"
  | "lats"
  | "lower_back"
  | "triceps"
  | "glutes"
  | "hamstrings"
  | "calves";

export interface Region {
  id: RegionId;
  label: string;
  /** Trainable muscle group this region maps onto for generation. */
  muscle: Muscle;
  view: "front" | "back";
}

export const REGIONS: Region[] = [
  { id: "chest", label: "Chest", muscle: "Chest", view: "front" },
  { id: "shoulders", label: "Shoulders", muscle: "Shoulders", view: "front" },
  { id: "biceps", label: "Biceps", muscle: "Arms", view: "front" },
  { id: "forearms", label: "Forearms", muscle: "Arms", view: "front" },
  { id: "core", label: "Abs / Core", muscle: "Core", view: "front" },
  { id: "quads", label: "Quads", muscle: "Quads", view: "front" },
  { id: "hips", label: "Hips / Adductors", muscle: "Glutes", view: "front" },
  { id: "lats", label: "Upper Back / Lats", muscle: "Back", view: "back" },
  { id: "lower_back", label: "Lower Back", muscle: "Back", view: "back" },
  { id: "triceps", label: "Triceps", muscle: "Arms", view: "back" },
  { id: "glutes", label: "Glutes", muscle: "Glutes", view: "back" },
  { id: "hamstrings", label: "Hamstrings", muscle: "Hamstrings", view: "back" },
  { id: "calves", label: "Calves", muscle: "Calves", view: "back" },
];

export const regionById = (id: RegionId) => REGIONS.find((r) => r.id === id)!;

/** Default region used when a muscle group is picked from the text list. */
export const DEFAULT_REGION: Record<Muscle, RegionId> = {
  Chest: "chest",
  Back: "lats",
  Shoulders: "shoulders",
  Arms: "biceps",
  Quads: "quads",
  Hamstrings: "hamstrings",
  Glutes: "glutes",
  Core: "core",
  Calves: "calves",
};

export function musclesFromRegions(regions: RegionId[]): Muscle[] {
  const out: Muscle[] = [];
  for (const id of regions) {
    const m = regionById(id).muscle;
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

/**
 * Specific muscle heads each map region covers. Regions the map already splits
 * (biceps vs triceps, lats vs lower back, …) resolve to a single target; the
 * broad regions expand to every head so generation can still be narrowed later.
 */
export const REGION_TARGETS: Record<RegionId, TargetMuscle[]> = {
  chest: ["Upper Chest", "Mid Chest", "Lower Chest"],
  shoulders: ["Front Delts", "Side Delts", "Rear Delts"],
  biceps: ["Biceps"],
  forearms: ["Forearms"],
  core: ["Abs", "Obliques"],
  quads: ["Quads"],
  hips: ["Adductors", "Abductors"],
  lats: ["Lats", "Traps"],
  lower_back: ["Lower Back"],
  triceps: ["Triceps"],
  glutes: ["Glutes"],
  hamstrings: ["Hamstrings"],
  calves: ["Calves"],
};

/** Flatten selected regions to the distinct specific muscles they cover. */
export function targetsFromRegions(regions: RegionId[]): TargetMuscle[] {
  const out: TargetMuscle[] = [];
  for (const id of regions) {
    for (const t of REGION_TARGETS[id]) if (!out.includes(t)) out.push(t);
  }
  return out;
}

export interface Pairing {
  /** Region proposed as the complementary pick. */
  with: RegionId;
  /** Secondary alternative mentioned in the copy, if any. */
  alternative?: RegionId;
  relation: string;
  reason: string;
}

/** Personal-trainer pairing proposals, keyed by the first selected region. */
export const PAIRINGS: Partial<Record<RegionId, Pairing>> = {
  chest: {
    with: "triceps",
    relation: "Synergist · Push day",
    reason: "Chest movements heavily utilize Triceps. Finish them together.",
  },
  lats: {
    with: "biceps",
    relation: "Synergist · Pull day",
    reason: "Pulling movements isolate the Back and heavily utilize Biceps.",
  },
  quads: {
    with: "hamstrings",
    relation: "Antagonist · Leg day",
    reason: "Train the whole leg for balance. Pair Quads with Hamstrings.",
  },
  shoulders: {
    with: "triceps",
    alternative: "chest",
    relation: "Synergist · Push day",
    reason:
      "Shoulder pressing heavily uses Triceps. It also pairs well with Chest for a full push day.",
  },
  biceps: {
    with: "triceps",
    relation: "Antagonist · Arm day",
    reason: "Optimal for Arm Day. Training Biceps and Triceps provides a full-arm pump.",
  },
  triceps: {
    with: "biceps",
    relation: "Antagonist · Arm day",
    reason: "Optimal for Arm Day. Training Triceps and Biceps provides a full-arm pump.",
  },
  hamstrings: {
    with: "glutes",
    relation: "Synergist · Hinge day",
    reason: "Hinge movements like Deadlifts utilize Hamstrings and Glutes together.",
  },
  core: {
    with: "lower_back",
    relation: "Antagonist · Stability",
    reason: "Strengthen the entire core. Always balance Ab work with Lower Back.",
  },
  glutes: {
    with: "hamstrings",
    relation: "Synergist · Hinge day",
    reason: "Glute work and Hamstrings share the hip hinge. Train them in the same session.",
  },
  lower_back: {
    with: "core",
    relation: "Antagonist · Stability",
    reason: "Balance spinal extension work with direct Ab training.",
  },
  calves: {
    with: "quads",
    relation: "Lower body finisher",
    reason: "Calves are a small group — attach them to a Quad-focused leg session.",
  },
  forearms: {
    with: "biceps",
    relation: "Synergist · Arm day",
    reason: "Grip work complements curling. Pair Forearms with Biceps.",
  },
  hips: {
    with: "quads",
    relation: "Synergist · Lower body",
    reason: "Hip and adductor work supports squatting. Pair it with Quads.",
  },
};
