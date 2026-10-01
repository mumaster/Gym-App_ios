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
  /** One side at a time (a split squat, a one-arm row): every set is done
   *  for each side, which the time model counts (estimateSeconds). */
  unilateral?: boolean;
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
  /** Set when `suggested_weight` is a starting weight worked out from
   *  another exercise (lib/gym/startWeight.ts) rather than this one's own
   *  history: from a published ratio, or a rough estimate. */
  suggested_basis?: "published" | "rough";
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
  /** When the session was finished — with `date` (its start) this gives the
   *  real length. Missing on sessions saved before it was recorded. */
  finished_at?: string;
  /** Session RPE, 0–10 on Foster's CR-10 scale — see trainingLoad.ts. */
  session_rpe?: number;
  /** What a sports watch recorded for this session, read from screenshots of
   *  its app (see watch.ts / watchScan.ts). */
  watch?: WatchData;
}

/** A sports watch's own summary of one session, read from screenshots of
 *  its companion app (Huawei Health and the like). Only numbers the
 *  screenshots print as text — nothing is read off a chart's curve — and
 *  null wherever a value wasn't shown. Labels are kept as the app wrote
 *  them (e.g. Dutch zone names), since each brand names these differently. */
export interface WatchData {
  /** "Huawei Health" */
  source: string | null;
  /** "HUAWEI WATCH GT 5 Pro" */
  device: string | null;
  /** The watch's activity name, e.g. "Kracht" (strength). */
  activity: string | null;
  /** Local start, "YYYY-MM-DDTHH:mm". */
  start: string | null;
  durationSeconds: number | null;
  totalKcal: number | null;
  activeKcal: number | null;
  avgHr: number | null;
  maxHr: number | null;
  minHr: number | null;
  /** Minutes per heart-rate zone, in the app's own order and names. */
  hrZones: { name: string; minutes: number }[];
  /** Training-effect style scores, e.g. aerobic training stress 1.7 "Recovery". */
  trainingEffects: { label: string; value: number; rating: string | null }[];
  recoveryHours: number | null;
  /** Heart-rate recovery after the session: fell `drop` bpm from `startBpm`
   *  to `endBpm` over `minutes`. */
  hrRecovery: {
    drop: number | null;
    startBpm: number | null;
    endBpm: number | null;
    minutes: number | null;
  } | null;
  /** Anything else the screenshots printed (running dynamics, sweat loss…),
   *  with the app's own verdict ("Normaal") when it gives one. */
  otherMetrics: { label: string; value: string; unit: string | null; rating?: string | null }[];
  importedAt: string;
  // Cardio fields, added with standalone cardio sessions (CardioSession).
  // Optional because watch data saved before then doesn't have them.
  /** What kind of session the screenshots show, as the reader judged it. */
  kind?: "strength" | "cardio" | "other" | null;
  distanceKm?: number | null;
  /** Pace in seconds per km: the average, and the fastest the app prints. */
  avgPaceSeconds?: number | null;
  bestPaceSeconds?: number | null;
  avgSpeedKmh?: number | null;
  maxSpeedKmh?: number | null;
  /** Steps (or strokes/revolutions) per minute. */
  avgCadence?: number | null;
  maxCadence?: number | null;
  avgStrideCm?: number | null;
  steps?: number | null;
  ascentM?: number | null;
  descentM?: number | null;
  minElevationM?: number | null;
  maxElevationM?: number | null;
  vo2max?: number | null;
  spo2Min?: number | null;
  spo2Max?: number | null;
  /** Minutes per pace zone, in the app's own order and names. */
  paceZones?: { name: string; minutes: number }[];
  /** Per-km (or per-lap) splits as printed; a short last one keeps its label. */
  splits?: WatchSplit[];
  /** Any other table the screenshots print, cell text as written. */
  tables?: WatchTable[];
}

export interface WatchSplit {
  /** "1", "2"… or the app's label for a partial last split. */
  label: string;
  /** Pace for the split, seconds per km. */
  paceSeconds: number | null;
  avgHr: number | null;
  cadence: number | null;
}

export interface WatchTable {
  title: string;
  columns: string[];
  rows: string[][];
}

/** Cardio activities with their own Compendium entries — see cardio.ts. */
export type CardioActivity = "run" | "cycle" | "walk" | "swim" | "row" | "elliptical" | "intervals";

/** How hard a cardio session was, in the Compendium's own terms. */
export type CardioEffort = "easy" | "moderate" | "hard";

/** One planned cardio session a week: on weekday `dow` (Date#getDay). */
export interface CardioPlanDay {
  id: string;
  dow: number;
  activity: CardioActivity;
  minutes: number;
  effort: CardioEffort;
}

/** A cardio session recorded only on a watch (a run, a walk, a ride), with
 *  no Forge strength session to attach it to. Kept apart from `workouts` on
 *  purpose: everything that reads workouts (streak, sets per muscle,
 *  records, training-day nutrition) is about strength training. */
export interface CardioSession {
  id: string;
  /** Start, ISO. */
  date: string;
  watch: WatchData;
  /** Which activity and how hard, as the user picked them — what the energy
   *  and WHO-minute estimates in cardio.ts are based on. Missing on watch
   *  imports from before they were asked; those count for neither until
   *  the user sets them. */
  activity?: CardioActivity;
  effort?: CardioEffort;
  /** Logged by hand rather than imported from watch screenshots; its
   *  `watch` then holds only what was typed in. */
  manual?: boolean;
  /** Session RPE, 0–10 on Foster's CR-10 scale — counts toward training load. */
  session_rpe?: number;
  /** A route map was saved for it (in IndexedDB, on this device — see
   *  routeMapStore.ts). */
  hasRouteMap?: boolean;
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

/** UI display language — see lib/gym/i18n.ts for the actual dictionaries. */
export type Language = "en" | "nl";
