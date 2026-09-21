export type EquipmentId =
  | "bodyweight"
  | "barbell"
  | "dumbbell"
  | "cable"
  | "cable_high"
  | "smith"
  | "bands"
  | "kettlebell"
  | "pullup_bar"
  | "dip_bars"
  | "leg_press"
  | "leg_developer"
  | "bench"
  | "machine";

export type Muscle =
  "Chest" | "Back" | "Shoulders" | "Arms" | "Quads" | "Hamstrings" | "Glutes" | "Core" | "Calves";

export type MovementPattern = "push" | "pull" | "hinge" | "squat" | "carry" | "core";

/**
 * Specific muscle head an exercise emphasises — finer-grained than the `Muscle`
 * group. Every value maps back to a `Muscle` via `TARGET_MUSCLE_GROUP`.
 */
export type TargetMuscle =
  | "Upper Chest"
  | "Mid Chest"
  | "Lower Chest"
  | "Lats"
  | "Traps"
  | "Lower Back"
  | "Front Delts"
  | "Side Delts"
  | "Rear Delts"
  | "Biceps"
  | "Triceps"
  | "Forearms"
  | "Quads"
  | "Adductors"
  | "Hamstrings"
  | "Glutes"
  | "Abductors"
  | "Abs"
  | "Obliques"
  | "Calves";

export interface Exercise {
  id: string;
  name: string;
  primary_muscle: Muscle;
  secondary_muscles: Muscle[];
  /** Specific muscle heads worked, most-emphasised first. */
  muscle_targets: TargetMuscle[];
  equipment_required: EquipmentId[];
  movement_pattern: MovementPattern;
  compound: boolean;
  instructions: string;
  cues: string[];
}

export type SetType = "warmup" | "working";

export interface LoggedSet {
  exercise_id: string;
  set_number: number;
  set_type: SetType;
  weight: number;
  reps: number;
  completed_at: string;
  /** Superset round this set belonged to (1-based). */
  round?: number;
  /** Perceived effort, 6-10 (RPE scale), logged optionally per working set. */
  rpe?: number;
}

export interface PlannedExercise {
  exercise_id: string;
  target_sets: number;
  warmup_sets: number;
  target_reps: string;
  rest_seconds: number;
  /** Added on the fly at the end of a session to extend the training. */
  bonus?: boolean;
  /** Pinned by the user ("loved") — forced into every generated plan. */
  loved?: boolean;
  /** Exercises sharing a group id are performed back-to-back as a superset. */
  superset_group?: number;
  superset_slot?: "A" | "B";
  /** Progressive-overload suggestion from history, in kg — see lib/gym/progression.ts. */
  suggested_weight?: number;
  /** Reps to aim for on working sets, paired with `suggested_weight` — see lib/gym/progression.ts. */
  suggested_reps?: number;
}

export interface Workout {
  id: string;
  date: string;
  duration_minutes: number;
  target_muscles: Muscle[];
  plan: PlannedExercise[];
  completed_sets: LoggedSet[];
  finished: boolean;
  unit: Unit;
  /** Rounds per superset pair when the session was generated with supersets. */
  superset_rounds?: number;
  /** True when started via "Start {day} day" for the active weekly scheme's
   * next slot — only sessions like this advance the split's cyclePosition. */
  fromScheduledDay?: boolean;
  /** True when started from an active multi-week Program's next scheduled
   * day — only sessions like this advance the program's cursor. Mutually
   * exclusive with `fromScheduledDay` in practice (a session is started from
   * at most one scheduling source), but not enforced at the type level since
   * nothing reads both at once. */
  fromProgramDay?: boolean;
}

/** A named, reusable plan the user can start exactly as saved, as an
 *  alternative to the on-the-fly generator — same precedent as
 *  `MealTemplate` in lib/gym/nutrition.ts. */
export interface WorkoutTemplate {
  id: string;
  name: string;
  plan: PlannedExercise[];
  duration_minutes: number;
  target_muscles: Muscle[];
}

export interface EquipmentProfile {
  id: string;
  name: string;
  active_equipment_ids: EquipmentId[];
  /** Number of PAIRS owned per plate size, keyed by kg as a string. */
  plates: Record<string, number>;
  /** Empty barbell weight in kg. */
  bar_weight: number;
  /** Empty dumbbell handle weight in kg (loadable dumbbells). */
  dumbbell_bar_weight: number;
}

export type AccentId = "green" | "blue" | "orange" | "purple" | "pink" | "yellow" | "custom";

/** "system" follows the device's own light/dark setting and updates live if
 *  it changes while the app is open; "light"/"dark" pin it regardless. */
export type ColorScheme = "system" | "light" | "dark";

/** Kilograms are the only supported unit. */
export type Unit = "kg";
