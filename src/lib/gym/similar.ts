/**
 * Near-identical exercises: the same movement on different gear or as a
 * small variant (bodyweight vs dumbbell calf raise, barbell vs Smith squat).
 * Reported: a plan held both a bodyweight and a dumbbell calf raise. One
 * workout takes at most one per group (generator.ts), and swapping or adding
 * one warns first (SwapSheet, AddToWorkoutSheet). Exercises not listed here
 * (including ones added to the live catalog later) count as their own group.
 */
const GROUPS: readonly (readonly string[])[] = [
  // calves
  [
    "standing-calf",
    "db-calf",
    "bw-calf-raise",
    "single-leg-calf-raise",
    "single-leg-db-calf-raise",
    "smith-calf-raise",
    "leg-press-calf-raise",
    "band-calf-raise",
  ],
  [
    "seated-db-calf-raise",
    "seated-calf-machine",
    "smith-seated-calf-raise",
    "bent-knee-calf-raise",
  ],
  // chest
  [
    "bb-bench",
    "db-bench",
    "single-arm-db-bench",
    "smith-flat-press",
    "machine-chest-press",
    "cable-chest-press",
    "band-chest-press",
    "bb-floor-press",
    "db-floor-press",
    "kb-floor-press",
    "db-squeeze-press",
  ],
  ["incline-db-press", "bb-incline-bench", "smith-incline-press"],
  ["decline-bench", "db-decline-press"],
  [
    "db-fly",
    "incline-db-flye",
    "band-fly",
    "cable-crossover",
    "low-to-high-cable-fly",
    "single-arm-high-cable-fly",
    "pec-deck",
  ],
  [
    "pushup",
    "decline-pushup",
    "incline-pushup",
    "archer-pushup",
    "band-pushup",
    "deficit-pushup",
    "pseudo-planche-pushup",
  ],
  ["diamond-pushup", "close-grip-pushup", "sphinx-pushup", "close-grip-bench"],
  ["dips", "chest-dip", "bench-dip"],
  // back
  ["pullup", "chinup", "pullup-negative"],
  ["lat-pulldown", "close-grip-lat-pulldown", "single-arm-lat-pulldown", "band-lat-pulldown"],
  ["cable-straight-arm-pulldown", "band-straight-arm-pulldown"],
  [
    "bb-row",
    "pendlay-row",
    "smith-row",
    "db-bent-over-row",
    "db-row",
    "incline-db-row",
    "kb-row",
    "meadows-row",
    "renegade-row",
  ],
  ["machine-row", "t-bar-row-machine", "landmine-t-bar-row"],
  ["seated-cable-row", "single-arm-cable-row", "band-row"],
  ["inverted-row", "smith-inverted-row"],
  ["bb-shrug", "db-shrug", "smith-shrug"],
  // shoulders
  [
    "ohp",
    "db-shoulder-press",
    "smith-shoulder-press",
    "machine-shoulder-press",
    "band-overhead-press",
    "kb-overhead-press",
    "db-arnold-press",
    "bb-z-press",
    "db-push-press",
    "landmine-press",
  ],
  ["pike-pushup", "feet-elevated-pike-pushup"],
  ["wall-handstand-pushup", "wall-handstand-hold"],
  ["lateral-raise", "cable-lateral", "band-lateral-raise", "machine-lateral-raise"],
  [
    "db-rear-delt-flye",
    "reverse-pec-deck",
    "cable-rear-delt-fly",
    "seated-rear-lateral-raise",
    "chest-supported-rear-delt-row",
  ],
  ["face-pull", "band-face-pull", "band-pull-apart"],
  ["db-upright-row", "cable-upright-row"],
  // arms
  [
    "bb-curl",
    "db-curl",
    "cable-curl",
    "band-curl",
    "kb-curl",
    "under-bar-curl",
    "drag-curl",
    "bayesian-curl",
    "high-cable-curl",
    "incline-db-curl",
    "spider-curl",
    "zottman-curl",
  ],
  ["db-preacher-curl", "machine-preacher-curl", "concentration-curl"],
  ["cable-pushdown", "rope-pushdown", "band-pushdown"],
  [
    "skullcrusher",
    "bb-lying-triceps-extension",
    "bar-triceps-extension",
    "smith-bodyweight-triceps-extension",
  ],
  [
    "db-overhead-triceps-ext",
    "overhead-cable-extension",
    "band-overhead-triceps-extension",
    "machine-triceps-extension",
  ],
  ["db-wrist-curl", "db-reverse-wrist-curl"],
  // legs
  ["bb-squat", "smith-squat", "belt-squat", "hack-squat", "pendulum-squat"],
  ["front-squat", "db-front-squat"],
  [
    "goblet-squat",
    "kb-goblet-squat",
    "heel-elevated-goblet-squat",
    "bodyweight-squat",
    "band-squat",
  ],
  ["db-sumo-squat", "kb-goblet-sumo-squat"],
  ["leg-extension", "leg-developer-extension", "band-leg-extension"],
  ["leg-curl", "seated-leg-curl", "lying-leg-curl", "db-lying-leg-curl", "band-leg-curl"],
  ["sliding-leg-curl", "single-leg-sliding-leg-curl"],
  ["rdl", "db-rdl", "smith-rdl", "kb-rdl", "b-stance-rdl"],
  ["single-leg-rdl", "db-single-leg-rdl", "kb-single-leg-rdl"],
  ["good-morning", "smith-good-morning", "band-good-morning"],
  [
    "hip-thrust",
    "smith-hip-thrust",
    "machine-hip-thrust",
    "bw-hip-thrust",
    "db-hip-thrust",
    "single-leg-hip-thrust",
    "glute-bridge",
    "single-leg-glute-bridge",
    "frog-pump",
  ],
  [
    "reverse-lunge",
    "db-reverse-lunge",
    "bb-reverse-lunge",
    "smith-reverse-lunge",
    "deficit-reverse-lunge",
    "db-walking-lunge",
    "curtsy-lunge",
  ],
  ["split-squat", "smith-split-squat", "bulgarian-split", "smith-front-foot-elevated-split-squat"],
  ["db-step-up", "bw-step-up"],
  ["bb-deadlift", "bb-sumo-deadlift"],
  ["db-sumo-deadlift", "kb-deadlift"],
  ["machine-abduction", "cable-hip-abduction", "side-lying-hip-abduction"],
  ["band-glute-kickback", "cable-kickback"],
  // core
  ["hanging-leg-raise", "hanging-knee-raise", "toes-to-bar", "lying-leg-raise"],
  ["crunch", "ab-crunch-machine", "cable-crunch", "decline-situp"],
  ["plank", "hollow-hold"],
  ["band-pallof-press", "cable-pallof-press"],
  ["farmer-carry", "suitcase-carry"],
];

const GROUP_OF = new Map<string, number>(
  GROUPS.flatMap((ids, i) => ids.map((id) => [id, i] as const)),
);

/** Two different exercises that are more or less the same movement. */
export const isNearDuplicate = (a: string, b: string): boolean => {
  if (a === b) return false;
  const g = GROUP_OF.get(a);
  return g !== undefined && g === GROUP_OF.get(b);
};

/** The first of `workoutIds` that nearly duplicates `candidate`, ignoring
 *  `replacingId` (the exercise a swap is about to remove). */
export const nearDuplicateIn = (
  candidate: string,
  workoutIds: readonly string[],
  replacingId?: string | null,
): string | undefined =>
  workoutIds.find((id) => id !== replacingId && isNearDuplicate(candidate, id));
