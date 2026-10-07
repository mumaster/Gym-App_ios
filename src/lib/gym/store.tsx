import type { KnownLift } from "./startWeight";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_AVATAR_ID, type AvatarId } from "./avatars";
import { DEFAULT_PROFILES, EXERCISES, defaultLoadableDumbbells } from "./data";
import { isBodyweightExercise, latestBodyKg } from "./load";
import { DEFAULT_PLATES } from "./plates";
import {
  mealForTime,
  nevoCodes,
  recipePerServing,
  type FoodEntry,
  type MealIngredient,
  type MealTemplate,
  type MealType,
  type NutritionGoals,
  type NutritionProfile,
  type Recipe,
  type WaterEntry,
  WATER_QUICK_ADD,
  sanitizeWaterShortcuts,
  mergeWaterTap,
  type WaterTap,
  type CoffeeEntry,
  type CoffeeKind,
} from "./nutrition";
import { estimated1RM } from "./progress";
import type { ReadinessCheckIn, ReadinessScore } from "./readiness";
import { dayKey } from "./date";
import { DELOAD_WEEK, advanceProgram, type Program } from "./programs";
import type { FocusGroup } from "./volume";
import type { WeightEntry } from "./bodyweight";
import { withWeighIn, type ScaleWeighIn } from "./scale";
import { canVibrate, markHaptic, pulseTappedControl, switchTick } from "./tapFeedback";
import {
  advanceRotation,
  anchorFor,
  daysBetween,
  plannedDate,
  moveSession,
  parseDayKey,
  resortRotation,
  backfillDoneOn,
  shiftRemaining,
  skipRestOfCycle,
  weekIndex,
  type Rotation,
} from "./schedule";
import {
  initialCyclePosition,
  rotationCardioPlan,
  type ScheduleSlot,
  type SplitTemplateId,
  type WeeklyScheme,
} from "./splits";
import type {
  AccentId,
  CardioActivity,
  CardioFinisher,
  CardioEffort,
  CardioPlanDay,
  CardioSession,
  ColorScheme,
  EquipmentProfile,
  Language,
  LoggedSet,
  Muscle,
  PlannedExercise,
  Unit,
  WatchData,
  Workout,
  WorkoutTemplate,
} from "./types";
import {
  onAuthStateChange,
  pullCloudState,
  pushCloudState,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  type Session,
} from "./auth";
import { deleteRouteMap } from "./routeMapStore";
import { readableAccentText, readableInk, visibleAccentFill } from "./accentInk";
import { backfillMyFoods, removeMyFood, upsertMyFood, type MyFood } from "./myFoods";
import { cardioStartIso, roundWatchNumbers } from "./watch";
import {
  keepRunningWorkout,
  loadSyncedMark,
  reconcile,
  saveSyncedMark,
  stateHash,
} from "./syncState";
import { manualCardioWatch, sortCardioPlan } from "./cardio";
import { loadNevoFoods, localizeNevoNames } from "./nevoFoods";

interface GymState {
  profiles: EquipmentProfile[];
  activeProfileId: string;
  workouts: Workout[];
  activeWorkout: Workout | null;
  unit: Unit;
  restSeconds: number;
  accent: AccentId;
  /** Hex color used when accent === "custom". */
  customAccent: string;
  /** Light/dark mode. Defaults to "dark" — see the `initialState` assignment
   *  below for why "system" isn't the default despite being an option. */
  colorScheme: ColorScheme;
  /** UI display language. Defaults to "en" for the same reason colorScheme
   *  defaults to "dark" — the app only ever shipped in English until now,
   *  so a silent switch for anyone whose device happens to be set to Dutch
   *  would be a bigger surprise than just adding the option. */
  language: Language;
  /** Which character represents the user in the profile/settings icon. */
  avatarId: AvatarId;
  /** The welcome tour has been seen (or skipped). Settings can reset it. */
  welcomeSeen: boolean;
  supersetsEnabled: boolean;
  /** Warm-up sets before compound exercises. Off: none are planned, and a
   *  running workout starts every exercise on a working set. */
  warmupsEnabled: boolean;
  /** Settings → "Track alcohol". Off hides the Alcohol card on Nutrition →
   *  Drinks everywhere; drinks already logged stay in the food log. */
  alcoholEnabled: boolean;
  /** Settings → "Also on weekdays". On: the Alcohol card shows every day, not
   *  only Saturday and Sunday. Only matters while `alcoholEnabled`. */
  alcoholWeekdays: boolean;
  /** Muscle groups the user wants to grow — they get the higher weekly set
   *  target (see lib/gym/volume.ts). Empty = every muscle at the baseline. */
  growthFocus: FocusGroup[];
  supersetRounds: number;
  /** Exercise ids the user "loved" — always forced into a generated plan. */
  lovedExerciseIds: string[];
  /** Exercise ids the user is avoiding (injury, pain, dislike) — never generated or offered. */
  avoidedExerciseIds: string[];
  /** How-are-you-feeling check-ins, one per day, used to scale suggested weight. */
  readinessLog: ReadinessCheckIn[];
  /** Rest-end audio cue during a session. */
  soundEnabled: boolean;
  /** When set, overrides every exercise's suggested rest for the active session. */
  restOverride: number | null;
  /** Fire a system Notification when rest ends and the tab isn't focused. */
  notifyEnabled: boolean;
  /** The user's chosen weekly split, if they've set one up. */
  weeklyScheme: WeeklyScheme | null;
  /** The user's active multi-week program, if they've set one up — a
   *  bounded, progressing alternative to the indefinitely-repeating
   *  weeklyScheme, see lib/gym/programs.ts. Independent of weeklyScheme in
   *  state (both can exist), but the UI shows program info preferentially
   *  when both are present. */
  program: Program | null;
  /** Logged food, newest first. */
  foodEntries: FoodEntry[];
  /** Daily nutrition limits the user set for themselves — see NutritionGoalsSheet. */
  nutritionGoals: NutritionGoals;
  /** When on, `nutritionGoals` are the training-day limits and rest days use
   *  `restDayGoals()` (derived, plus `restDayGoalOverrides`) instead — see
   *  lib/gym/dayNutrition.ts. Off by default so existing single limits keep
   *  behaving exactly as before. */
  nutritionByDayType: boolean;
  /** Rest-day limits the user set by hand; any nutrient missing here is
   *  auto-derived from the training-day limit. */
  restDayGoalOverrides: NutritionGoals;
  /** Last questionnaire answers used to suggest nutritionGoals, so reopening
   *  the questionnaire prefills instead of starting blank. Not itself used
   *  for anything besides that — editing nutritionGoals directly doesn't
   *  touch this. */
  nutritionProfile: NutritionProfile | null;
  /** Saved ingredient combos (e.g. "Banana oatmeal") the user can log in one tap. */
  mealTemplates: MealTemplate[];
  /** Starred foods for one-tap logging (name, usual portion, per-100g). */
  favoriteFoods: MealIngredient[];
  /** Foods you scanned or entered yourself, kept for search — myFoods.ts. */
  myFoods: MyFood[];
  /** A note per exercise id ("seat on 4", "narrow grip"), shown every time
   *  that exercise comes up in a workout. */
  exerciseNotes: Record<string, string>;
  /** Recent sets entered in Settings → Your current lifts, for someone who
   *  already trains; only feeds starting-weight estimates (startWeight.ts). */
  knownLifts: KnownLift[];
  /** Named, reusable workout plans the user can start exactly as saved. */
  workoutTemplates: WorkoutTemplate[];
  /** Saved recipes (ingredients + serving count) — see lib/gym/nutrition.ts's Recipe. */
  recipes: Recipe[];
  /** Logged water, newest first. */
  waterEntries: WaterEntry[];
  /** Bodyweight weigh-ins, oldest first (see lib/gym/bodyweight.ts). */
  weightLog: WeightEntry[];
  /** Daily water target in ml, or null if the user hasn't set one. */
  waterGoalMl: number | null;
  /** The four water quick-add amounts in ml, editable on /nutrition and
   *  shared with Home's Water tile (see nutrition.ts's WATER_QUICK_ADD). */
  waterQuickAdd: number[];
  /** Logged coffees, newest first (see nutrition.ts's CoffeeEntry). */
  coffeeEntries: CoffeeEntry[];
  /** Watch-recorded cardio (runs, walks, rides), newest first — see types.ts. */
  cardioSessions: CardioSession[];
  /** Planned cardio, one entry per session a week (see cardio.ts). Fixed
   *  weekdays, unlike the strength rotation: nothing moves when a day is
   *  missed, the week just shows what's left. */
  cardioPlan: CardioPlanDay[];
}

const initialState: GymState = {
  profiles: DEFAULT_PROFILES,
  activeProfileId: DEFAULT_PROFILES[0]!.id,
  workouts: [],
  activeWorkout: null,
  unit: "kg",
  restSeconds: 90,
  accent: "green",
  customAccent: "#34d399",
  // Defaults to the app's existing look rather than "system" — the app has
  // been dark-only until now, so a silent flip to light for anyone whose
  // device happens to be in light mode would be a bigger surprise than
  // just adding the option and leaving current behavior as the default.
  colorScheme: "dark",
  language: "en",
  avatarId: DEFAULT_AVATAR_ID,
  welcomeSeen: false,
  supersetsEnabled: false,
  warmupsEnabled: true,
  alcoholEnabled: true,
  alcoholWeekdays: false,
  growthFocus: [],
  supersetRounds: 3,
  lovedExerciseIds: [],
  avoidedExerciseIds: [],
  readinessLog: [],
  soundEnabled: true,
  restOverride: null,
  notifyEnabled: false,
  weeklyScheme: null,
  program: null,
  foodEntries: [],
  nutritionGoals: {},
  nutritionByDayType: false,
  restDayGoalOverrides: {},
  nutritionProfile: null,
  mealTemplates: [],
  favoriteFoods: [],
  myFoods: [],
  exerciseNotes: {},
  knownLifts: [],
  workoutTemplates: [],
  recipes: [],
  waterEntries: [],
  weightLog: [],
  waterGoalMl: null,
  waterQuickAdd: [...WATER_QUICK_ADD],
  coffeeEntries: [],
  cardioSessions: [],
  cardioPlan: [],
};

const KEY = "forge.gym.state.v2";
const LEGACY_KEY = "forge.gym.state.v1";

// Circuit breaker for the color-scheme effect's auto-reload-on-switch below
// (see that effect's own comment for the mechanism, and hasHydratedBaselineRef's
// comment for the infinite-reload-loop bug this specifically guards against
// a *recurrence* of). sessionStorage survives the reload it's guarding
// against — same property the RootShell stale-shell-recovery script
// elsewhere in this app already relies on for its own reload budget — so a
// genuine loop can be counted across reloads instead of resetting every time.
const COLOR_SCHEME_RELOAD_GUARD_KEY = "forge.color-scheme-reload-count";
const MAX_COLOR_SCHEME_AUTO_RELOADS = 2;

/** Re-derive `set_number` per exercise (warm-ups and working sets counted apart). */
function renumber(sets: LoggedSet[]): LoggedSet[] {
  const working = new Map<string, number>();
  const warmup = new Map<string, number>();
  return sets.map((s) => {
    const counter = s.set_type === "warmup" ? warmup : working;
    const n = (counter.get(s.exercise_id) ?? 0) + 1;
    counter.set(s.exercise_id, n);
    return s.set_number === n ? s : { ...s, set_number: n };
  });
}

export type RotationKind = "program" | "weeklyScheme";

/** Moves a session only when the day changes, so picking the day it's
 *  already planned on leaves no override behind. */
const moveIfChanged = <R extends Rotation>(r: R, index: number, date: Date): R =>
  daysBetween(plannedDate(r, index), date) === 0 ? r : moveSession(r, index, date);

function updateRotation(
  s: GymState,
  kind: RotationKind,
  fn: <R extends Rotation>(r: R) => R,
): GymState {
  if (kind === "program") return s.program ? { ...s, program: fn(s.program) } : s;
  return s.weeklyScheme ? { ...s, weeklyScheme: fn(s.weeklyScheme) } : s;
}

/** Older saves may lack warmup_sets or carry a non-kg unit. */
function migrate(raw: Partial<GymState>): GymState {
  const fixPlan = (plan: PlannedExercise[] = []) =>
    plan.map((p) => ({ ...p, warmup_sets: p.warmup_sets ?? 0 }));
  const fixWorkout = <T extends Workout | null>(w: T): T =>
    w
      ? ({
          ...w,
          unit: "kg",
          plan: fixPlan(w.plan),
          ...(w.watch ? { watch: roundWatchNumbers(w.watch) } : {}),
        } as T)
      : w;

  const fixProfile = (p: EquipmentProfile): EquipmentProfile => ({
    ...p,
    plates: p.plates ?? { ...DEFAULT_PLATES },
    bar_weight: p.bar_weight ?? 20,
    dumbbell_bar_weight: p.dumbbell_bar_weight ?? 2,
    loadable_dumbbells: p.loadable_dumbbells ?? defaultLoadableDumbbells(p.id),
  });

  // Older rotations were sorted Sunday-first and had no calendar anchor:
  // re-sort Monday-first (cursor stays on the same session) and anchor so
  // the next session is never already overdue right after upgrading.
  // Rotations saved before done days were recorded get them from the
  // scheduled workouts, so a finished session shows the day it was done.
  const fixRotation = <R extends Rotation>(
    r: R | null | undefined,
    fromRotation: (w: Workout) => boolean,
  ): R | null => {
    if (!r) return null;
    const current = r.schedule[r.cyclePosition];
    const schedule = [...r.schedule].sort((a, b) => weekIndex(a.dow) - weekIndex(b.dow));
    const cyclePosition = Math.max(0, current ? schedule.indexOf(current) : 0);
    const fixed = {
      ...r,
      schedule,
      cyclePosition,
      anchor: r.anchor ?? anchorFor(schedule, cyclePosition),
    };
    return fixed.doneOn || !cyclePosition
      ? fixed
      : { ...fixed, doneOn: backfillDoneOn(fixed, raw.workouts ?? [], fromRotation) };
  };

  // Program weeks used unsourced build multipliers (up to 1.16) and a 60%
  // load deload; rewrite them to the sourced values in programs.ts.
  const fixProgramWeeks = (p: Program | null): Program | null =>
    p
      ? {
          ...p,
          weeks: p.weeks.map((w) =>
            w.type === "deload" ? DELOAD_WEEK : { type: "build", intensity: 1, volume: 1 },
          ),
        }
      : null;

  const profiles = (raw.profiles?.length ? raw.profiles : DEFAULT_PROFILES).map(fixProfile);
  const state: GymState = {
    ...initialState,
    ...raw,
    unit: "kg",
    accent: raw.accent ?? "green",
    customAccent: raw.customAccent ?? "#34d399",
    colorScheme: raw.colorScheme ?? "dark",
    language: raw.language ?? "en",
    avatarId: raw.avatarId ?? DEFAULT_AVATAR_ID,
    // Saves from before the tour: someone who already logged something
    // knows the app, so only an empty save gets the tour.
    welcomeSeen:
      raw.welcomeSeen ??
      Boolean(
        raw.workouts?.length ||
        raw.foodEntries?.length ||
        raw.weightLog?.length ||
        raw.program ||
        raw.weeklyScheme,
      ),
    supersetsEnabled: raw.supersetsEnabled ?? false,
    warmupsEnabled: raw.warmupsEnabled ?? true,
    alcoholEnabled: raw.alcoholEnabled ?? true,
    alcoholWeekdays: raw.alcoholWeekdays ?? false,
    growthFocus: raw.growthFocus ?? [],
    supersetRounds: raw.supersetRounds ?? 3,
    lovedExerciseIds: raw.lovedExerciseIds ?? [],
    avoidedExerciseIds: raw.avoidedExerciseIds ?? [],
    readinessLog: raw.readinessLog ?? [],
    soundEnabled: raw.soundEnabled ?? true,
    restOverride: raw.restOverride ?? null,
    notifyEnabled: raw.notifyEnabled ?? false,
    weeklyScheme: fixRotation(raw.weeklyScheme, (w) => Boolean(w.fromScheduledDay)),
    program: fixProgramWeeks(fixRotation(raw.program, (w) => Boolean(w.fromProgramDay))),
    nutritionGoals: raw.nutritionGoals ?? {},
    nutritionByDayType: raw.nutritionByDayType ?? false,
    restDayGoalOverrides: raw.restDayGoalOverrides ?? {},
    nutritionProfile: raw.nutritionProfile ?? null,
    mealTemplates: raw.mealTemplates ?? [],
    favoriteFoods: raw.favoriteFoods ?? [],
    exerciseNotes: raw.exerciseNotes ?? {},
    knownLifts: Array.isArray(raw.knownLifts) ? raw.knownLifts : [],
    workoutTemplates: raw.workoutTemplates ?? [],
    recipes: raw.recipes ?? [],
    waterEntries: raw.waterEntries ?? [],
    weightLog: raw.weightLog ?? [],
    waterGoalMl: raw.waterGoalMl ?? null,
    waterQuickAdd: sanitizeWaterShortcuts(raw.waterQuickAdd),
    coffeeEntries: raw.coffeeEntries ?? [],
    // Imports from before watch numbers were rounded (a 10 s zone saved
    // as 0.1666… min) get the same 2-decimal rounding new imports get.
    cardioSessions: (raw.cardioSessions ?? []).map((c) => ({
      ...c,
      watch: roundWatchNumbers(c.watch),
    })),
    cardioPlan: raw.cardioPlan ?? [],
    foodEntries: (raw.foodEntries ?? []).map((e) => ({
      ...e,
      meal: e.meal ?? mealForTime(e.logged_at),
      per100: {
        ...e.per100,
        fiber: e.per100.fiber ?? 0,
        salt: e.per100.salt ?? 0,
      },
    })),
    profiles,
    activeProfileId:
      profiles.find((p) => p.id === raw.activeProfileId)?.id ?? profiles[0]?.id ?? "full-gym",
    workouts: (raw.workouts ?? []).map((w) => fixWorkout(w)!),
    activeWorkout: fixWorkout(raw.activeWorkout ?? null),
  };
  // "Your foods" arrived after the food log: start it from what's already
  // been logged, so older foods are searchable straight away.
  return {
    ...state,
    myFoods: raw.myFoods ?? backfillMyFoods(state.foodEntries, state.mealTemplates, state.recipes),
  };
}

export type SyncStatus = "offline" | "syncing" | "synced" | "error";

interface Ctx extends GymState {
  hydrated: boolean;
  /** Signed-in Supabase session, or null when using the app purely offline/local. */
  session: Session | null;
  syncStatus: SyncStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  update: (patch: Partial<GymState>) => void;
  startWorkout: (
    input: Pick<
      Workout,
      | "plan"
      | "duration_minutes"
      | "target_muscles"
      | "fromScheduledDay"
      | "fromProgramDay"
      | "cardio"
    >,
  ) => void;
  /** Changes the running workout's cardio finisher (minutes, done). */
  updateActiveCardio: (patch: Partial<CardioFinisher & { done: boolean }>) => void;
  logSet: (set: LoggedSet) => void;
  /** `rpe: null` clears a set's RPE. */
  updateSet: (
    index: number,
    patch: Partial<Pick<LoggedSet, "weight" | "reps" | "set_type">> & { rpe?: number | null },
  ) => void;
  removeSetAt: (index: number) => void;
  finishWorkout: () => void;
  cancelWorkout: () => void;
  reorderActivePlan: (from: number, to: number) => void;
  /** Moves these plan entries (one exercise, or both halves of a superset)
   *  to the end of the running workout, keeping their order. */
  moveActiveToEnd: (indices: number[]) => void;
  /** Drops these plan entries from the running workout. */
  removeActivePlanEntries: (indices: number[]) => void;
  /** Sets (or, with null, clears) a finished workout's session RPE. */
  rateWorkout: (workoutId: string, rpe: number | null) => void;
  /** Attach (or with null, remove) a watch's own record of a session. */
  setWorkoutWatch: (workoutId: string, watch: WatchData | null) => void;
  /** Saves (or, for an existing id, replaces) a watch-only cardio session;
   *  the caller picks the id with watch.ts's cardioTargetId. */
  saveCardioSession: (
    id: string,
    watch: WatchData,
    hasRouteMap: boolean,
    kind?: { activity: CardioActivity; effort: CardioEffort },
  ) => void;
  /** Logs a cardio session by hand (no watch). */
  logCardio: (input: {
    activity: CardioActivity;
    effort: CardioEffort;
    minutes: number;
    distanceKm: number | null;
    /** Local start, "YYYY-MM-DDTHH:mm". */
    start: string;
    label: string;
    rpe: number | null;
  }) => void;
  /** Sets a cardio session's activity and effort (e.g. on an older import). */
  setCardioKind: (id: string, activity: CardioActivity, effort: CardioEffort) => void;
  setCardioPlan: (plan: CardioPlanDay[]) => void;
  /** The cardio plan plus the active strength plan's own cardio (hybrid
   *  days), Monday-first: what planned cardio minutes and a day's calories
   *  read. Only `cardioPlan` is edited directly. */
  plannedCardio: CardioPlanDay[];
  rateCardio: (id: string, rpe: number | null) => void;
  deleteCardioSession: (id: string) => void;
  swapActiveExercise: (index: number, nextExerciseId: string) => void;
  appendBonusExercise: (exerciseId: string) => void;
  toggleLovedExercise: (exerciseId: string) => void;
  toggleAvoidedExercise: (exerciseId: string) => void;
  setTodayReadiness: (score: ReadinessScore) => void;
  lastPerformance: (exerciseId: string) => LoggedSet | undefined;
  bestSet: (exerciseId: string) => LoggedSet | undefined;
  setWeeklyScheme: (scheme: WeeklyScheme) => void;
  updateScheduleSlotDow: (index: number, dow: number) => void;
  clearWeeklyScheme: () => void;
  setProgram: (program: Program) => void;
  updateProgramSlotDow: (index: number, dow: number) => void;
  clearProgram: () => void;
  /** Replaces the program's split/days while keeping its wave progress. */
  updateProgramSchedule: (
    templateId: SplitTemplateId,
    schedule: ScheduleSlot[],
    cardio?: Record<string, CardioFinisher>,
  ) => void;
  /** This-cycle-only calendar adjustments for whichever rotation `kind`
   *  names — see lib/gym/schedule.ts. Skipping advances the rotation (and a
   *  program's week, on wrap) exactly like finishing the session would. */
  skipScheduledSession: (kind: RotationKind) => void;
  shiftScheduledSessions: (kind: RotationKind, delta: number) => void;
  moveScheduledSession: (kind: RotationKind, index: number, dateKey: string) => void;
  /** Skips what's left of this week and moves next week's session `index`
   *  to `dateKey` (Adjust this week's "Next week" list). */
  moveNextWeekSession: (kind: RotationKind, index: number, dateKey: string) => void;
  resetScheduledWeek: (kind: RotationKind) => void;
  saveWorkoutTemplate: (
    name: string,
    plan: PlannedExercise[],
    duration_minutes: number,
    target_muscles: Muscle[],
  ) => void;
  deleteWorkoutTemplate: (id: string) => void;
  addFoodEntry: (entry: FoodEntry) => void;
  updateFoodEntry: (
    id: string,
    /** `nevo: null` drops the NEVO mark (the values were changed). */
    patch: Partial<Pick<FoodEntry, "name" | "meal" | "grams" | "per100">> & {
      nevo?: number[] | null;
    },
  ) => void;
  removeFoodEntry: (id: string) => void;
  setNutritionGoals: (goals: NutritionGoals) => void;
  saveMealTemplate: (name: string, ingredients: MealIngredient[]) => void;
  /** Stars or un-stars a food, matched by name (case-insensitive). */
  toggleFavoriteFood: (food: MealIngredient) => void;
  /** Adds a scanned or typed-in food to "your foods", or updates it. */
  rememberFood: (food: MealIngredient, barcode?: string) => void;
  /** Removes a food from "your foods" by myFoodKey; the log is untouched. */
  forgetFood: (key: string) => void;
  /** Sets an exercise's note; blank removes it. */
  setExerciseNote: (exerciseId: string, note: string) => void;
  deleteMealTemplate: (id: string) => void;
  /** Logs every ingredient of a saved meal as its own food entry, all at once. */
  logMealTemplate: (id: string, meal: MealType) => void;
  saveRecipe: (name: string, servings: number, ingredients: MealIngredient[]) => void;
  deleteRecipe: (id: string) => void;
  /** Logs one food entry for `servings` servings of a saved recipe, scaled from its per-serving macros. */
  logRecipe: (id: string, servings: number, meal: MealType) => void;
  /** `tap`: a quick-add button, merged with a tap just before it
   *  (mergeWaterTap); a typed amount is always its own entry. */
  logWater: (ml: number, opts?: { tap?: boolean }) => void;
  removeWaterEntry: (id: string) => void;
  logCoffee: (kind: CoffeeKind) => void;
  removeCoffeeEntry: (id: string) => void;
  /** Logs a weigh-in; a second one on the same day replaces the first. */
  logWeight: (kg: number) => void;
  /** A weigh-in read from a scale's screenshot, on the day it was
   *  measured (scale.ts); replaces that day's weigh-in. */
  logWeighIn: (entry: ScaleWeighIn) => void;
  removeWeightEntry: (id: string) => void;
}

const GymContext = createContext<Ctx | null>(null);

export function GymProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GymState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressPush = useRef(false);
  const lastWaterTap = useRef<WaterTap | null>(null);
  /** The latest state, for pushes fired from event listeners and timers. */
  const stateRef = useRef(state);
  stateRef.current = state;
  /** The user whose device/cloud reconciliation has finished this launch;
   *  local edits aren't pushed before that, so a push can't race the
   *  launch's own pull (see syncState.ts). */
  const [reconciledFor, setReconciledFor] = useState<string | null>(null);
  // Tracks the last color-scheme resolution the effect below actually
  // applied, so it can tell a genuine switch (worth nudging the service
  // worker's cached shell and reloading — see that effect's own comment)
  // apart from a resolution that isn't really a user switch at all. Must
  // only start tracking once `hydrated` (below) is true — `state` (and so
  // `state.colorScheme`) starts at `initialState`'s hardcoded "dark"
  // default and only gets overwritten with the real persisted value
  // asynchronously, in the load-from-localStorage effect a few lines down.
  // Tracking from the very first render was a real, shipped bug: a
  // light-mode user's first render resolves dark=true (the default),
  // establishing that as the "baseline"; the localStorage effect then
  // corrects state.colorScheme to "light", which reads as a GENUINE
  // switch against that wrong baseline and fires the reload logic below —
  // on every single page load, including the reload it triggers, which
  // read the same hardcoded default first for exactly the same reason,
  // for an infinite reload loop that soft-locked the app for any
  // persisted light-mode user. `hasHydratedBaselineRef` below is what
  // fixes this: the baseline is only established the first time this
  // effect runs AFTER `hydrated` is true (see that effect's own guard),
  // by which point state.colorScheme already reflects the real persisted
  // value, not the pre-hydration placeholder.
  const lastAppliedDarkRef = useRef<boolean | null>(null);
  const hasHydratedBaselineRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
      if (raw) setState(migrate(JSON.parse(raw) as Partial<GymState>));
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  // NEVO foods show NEVO's own name in the app's language (nevoFoods.ts's
  // localizeNevoName): after a language switch, or when foods logged in the
  // other language arrive (a cloud pull, an older save), their stored names
  // are switched over — the log, favourites and saved meals and recipes, so
  // search, recents and the star all keep matching by name. The table is
  // only loaded when something carries a NEVO mark.
  const nevoItemCount = useMemo(() => {
    const one = (x: { nevo?: number[] }) => x.nevo?.length === 1;
    return (
      state.foodEntries.filter(one).length +
      state.favoriteFoods.filter(one).length +
      state.mealTemplates.reduce((n, m) => n + m.ingredients.filter(one).length, 0) +
      state.recipes.reduce((n, r) => n + r.ingredients.filter(one).length, 0)
    );
  }, [state.foodEntries, state.favoriteFoods, state.mealTemplates, state.recipes]);
  useEffect(() => {
    if (!hydrated || nevoItemCount === 0) return;
    let alive = true;
    loadNevoFoods()
      .then((foods) => {
        if (!alive) return;
        const byCode = new Map(foods.map((f) => [f.code, f]));
        setState((s) => {
          const lang = s.language;
          const foodEntries = localizeNevoNames(s.foodEntries, byCode, lang);
          const favoriteFoods = localizeNevoNames(s.favoriteFoods, byCode, lang);
          const mealTemplates = s.mealTemplates.map((m) => {
            const ingredients = localizeNevoNames(m.ingredients, byCode, lang);
            return ingredients === m.ingredients ? m : { ...m, ingredients };
          });
          const recipes = s.recipes.map((r) => {
            const ingredients = localizeNevoNames(r.ingredients, byCode, lang);
            return ingredients === r.ingredients ? r : { ...r, ingredients };
          });
          const changed =
            foodEntries !== s.foodEntries ||
            favoriteFoods !== s.favoriteFoods ||
            mealTemplates.some((m, i) => m !== s.mealTemplates[i]) ||
            recipes.some((r, i) => r !== s.recipes[i]);
          return changed ? { ...s, foodEntries, favoriteFoods, mealTemplates, recipes } : s;
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [hydrated, state.language, nevoItemCount]);

  useEffect(() => onAuthStateChange(setSession), []);

  useEffect(() => {
    if (!session) setSyncStatus("offline");
  }, [session]);

  /** Pushes a state to the cloud and remembers it as what the cloud holds. */
  const pushNow = useCallback(async (userId: string, value: GymState) => {
    const json = JSON.stringify(value);
    await pushCloudState(userId, value);
    saveSyncedMark({ userId, hash: stateHash(json) });
  }, []);

  // On every launch with a session (and on sign-in), reconcile this device
  // against the cloud. The cloud copy used to win unconditionally, which
  // threw away sets logged mid-workout whenever iOS closed the app before
  // the debounced push got out; syncState.ts's `reconcile` now keeps local
  // edits the cloud never received. A cloud copy still wins on a first
  // sign-in on this device (restoring onto a new phone) and when this
  // device has nothing new (another device may have moved on).
  useEffect(() => {
    if (!session || !hydrated) return;
    const userId = session.user.id;
    let cancelled = false;
    setSyncStatus("syncing");
    void (async () => {
      try {
        const cloud = await pullCloudState(userId);
        if (cancelled) return;
        // Decided after the pull, on the latest local state, so a set
        // logged while the pull was in flight also counts as local news.
        const local = stateRef.current;
        const action = reconcile({
          userId,
          cloudExists: cloud != null,
          localHash: stateHash(JSON.stringify(local)),
          mark: loadSyncedMark(),
        });
        if (action === "adoptCloud") {
          const next = keepRunningWorkout(local, migrate(cloud as Partial<GymState>));
          const keptLocal =
            local.activeWorkout !== null && next.activeWorkout === local.activeWorkout;
          // A kept local workout is news for the cloud, so let it be pushed.
          suppressPush.current = !keptLocal;
          setState(next);
          if (!keptLocal) saveSyncedMark({ userId, hash: stateHash(JSON.stringify(next)) });
        } else {
          await pushNow(userId, local);
        }
        if (!cancelled) setSyncStatus("synced");
      } catch {
        if (!cancelled) setSyncStatus("error");
      } finally {
        if (!cancelled) setReconciledFor(userId);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Reconcile only when the signed-in user changes, not on every edit —
    // the debounced push effect below covers ongoing local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, hydrated]);

  // Mirror local edits up to the cloud (debounced) while signed in, once
  // this launch's reconciliation is done.
  useEffect(() => {
    if (!session || !hydrated || reconciledFor !== session.user.id) return;
    if (suppressPush.current) {
      suppressPush.current = false;
      return;
    }
    const userId = session.user.id;
    setSyncStatus("syncing");
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pushTimer.current = null;
      // Nothing to send when the cloud already holds exactly this (right
      // after the launch's own reconcile, say).
      const mark = loadSyncedMark();
      if (mark?.userId === userId && mark.hash === stateHash(JSON.stringify(state))) {
        setSyncStatus("synced");
        return;
      }
      pushNow(userId, state)
        .then(() => setSyncStatus("synced"))
        .catch(() => setSyncStatus("error"));
    }, 1500);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state, session, hydrated, reconciledFor, pushNow]);

  // Going to the background (switching to YouTube, locking the phone) sends
  // a waiting push straight away rather than leaving it to a timer iOS may
  // never run. If it still doesn't make it, the next launch keeps the local
  // edits anyway (see the reconcile effect above).
  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;
    const flush = () => {
      if (document.visibilityState === "visible" || !pushTimer.current) return;
      clearTimeout(pushTimer.current);
      pushTimer.current = null;
      pushNow(userId, stateRef.current)
        .then(() => setSyncStatus("synced"))
        .catch(() => setSyncStatus("error"));
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [session, pushNow]);

  useEffect(() => {
    const root = document.documentElement;
    Array.from(root.classList).forEach((c) => {
      if (c.startsWith("accent-")) root.classList.remove(c);
    });
    root.classList.add(`accent-${state.accent}`);
    const CUSTOM_VARS = [
      "--custom-primary",
      "--custom-fill-dark",
      "--custom-fill-light",
      "--custom-ink-dark",
      "--custom-ink-light",
      "--custom-text-dark",
      "--custom-text-light",
    ];
    if (state.accent === "custom") {
      // The wheel can give any colour, so what the app draws with it is
      // adjusted per theme until it's visible (accentInk.ts): the fill/shape
      // colour, the ink on that fill, and the colour as text. styles.css
      // picks the set matching .dark/.light.
      root.style.setProperty("--custom-primary", state.customAccent);
      for (const theme of ["dark", "light"] as const) {
        // In the light theme the accent is one colour at text contrast, like
        // the presets (styles.css), so white sits on it at 5:1 or more.
        const fill =
          theme === "light"
            ? readableAccentText(state.customAccent, theme)
            : visibleAccentFill(state.customAccent, theme);
        root.style.setProperty(`--custom-fill-${theme}`, fill);
        root.style.setProperty(`--custom-ink-${theme}`, readableInk(fill));
        root.style.setProperty(
          `--custom-text-${theme}`,
          readableAccentText(state.customAccent, theme),
        );
      }
    } else {
      CUSTOM_VARS.forEach((v) => root.style.removeProperty(v));
    }
  }, [state.accent, state.customAccent]);

  // Applies light/dark to <html> the same way the accent effect above
  // applies accent-<id> — RootShell SSRs `class="dark"` unconditionally
  // (no access to a stored preference at request time), so this corrects
  // it client-side once hydrated, same tradeoff the accent class already
  // makes (a possible one-frame flash of the wrong theme, not solved here
  // — see CLAUDE.md's Styling section for why that's an accepted gap
  // rather than something this reaches into RootShell's own SSR'd markup
  // to fix). "system" tracks the device live via matchMedia, updating the
  // class immediately if the user flips their OS setting while the app is
  // still open, without needing a reload.
  //
  // Also flips the two iOS-PWA chrome meta tags __root.tsx's head() SSRs
  // (apple-mobile-web-app-status-bar-style/theme-color), AND writes the
  // resolved scheme to a `forge-color-scheme` cookie so the NEXT request's
  // SSR can read it too — both parts are needed, for two different iOS
  // status-bar-related bugs that were reported in sequence. First: unlike
  // the <html> class above, nothing was updating these two meta tags'
  // live DOM content at all before this, so a light-mode user's actual
  // status bar (the real OS chrome, not page content) stayed a solid
  // black bar for the whole session — the direct DOM `setAttribute` calls
  // below fix that (confirmed via Playwright that this survives repeated
  // client-side route navigation without TanStack Router's HeadContent
  // reconciliation stomping it back). Second, reported after that fix:
  // even force-quitting and reopening the installed PWA still showed
  // black. That's because iOS reads apple-mobile-web-app-status-bar-style
  // straight from the SSR'd HTML at cold-launch time, before any of this
  // JS has had a chance to run — and __root.tsx's head() had no way to
  // know the user's preference at request time, so it always served the
  // same hardcoded dark value, every launch, forever. A client-side-only
  // fix structurally cannot reach back and change what iOS already read
  // from that response. The cookie write below closes that gap: it's the
  // one piece of this preference an HTTP request can actually carry back
  // to the server, so head() (see its own comment) can read it and bake
  // the correct value into the NEXT request's HTML from the start.
  useEffect(() => {
    const root = document.documentElement;
    const statusBarMeta = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]',
    );
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const applyScheme = (dark: boolean) => {
      void applySchemeAsync(dark);
    };
    const applySchemeAsync = async (dark: boolean) => {
      root.classList.toggle("dark", dark);
      root.classList.toggle("light", !dark);
      // "default" = white bar, black icons; "black" = black bar, white
      // icons — matches this app's own --background for each mode.
      statusBarMeta?.setAttribute("content", dark ? "black" : "default");
      // #f2f2f7 mirrors .light's --background choice below (iOS's own
      // light "systemGroupedBackground" rather than pure white).
      themeColorMeta?.setAttribute("content", dark ? "#000000" : "#f2f2f7");
      // 1yr expiry: this is a durable preference, not a session value: no
      // `Secure` attribute so it still round-trips on a plain-http local
      // dev server, which every production deploy of this app is served
      // over https anyway (Cloudflare terminates TLS in front of it).
      document.cookie = `forge-color-scheme=${dark ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;

      // Everything below only matters on a GENUINE switch, and — critically
      // — only once `hydrated` is true. Before that, state.colorScheme is
      // still `initialState`'s hardcoded "dark" default, not the real
      // persisted value, so resolving it here at all would establish the
      // WRONG baseline (see hasHydratedBaselineRef's own comment above for
      // the infinite-reload-loop bug that caused). The first post-hydration
      // run just establishes the correct baseline — no reload, since this
      // isn't a switch, it's the initial correct resolution.
      if (!hydrated) return;
      if (!hasHydratedBaselineRef.current) {
        hasHydratedBaselineRef.current = true;
        lastAppliedDarkRef.current = dark;
        // Reaching a stable post-hydration baseline without immediately
        // needing another reload means the last one (if any) actually
        // worked — clear the guard below so a later, unrelated switch
        // gets its own fresh budget instead of inheriting a stale count.
        try {
          sessionStorage.removeItem(COLOR_SCHEME_RELOAD_GUARD_KEY);
        } catch {
          /* private-mode/disabled storage — nothing to clear */
        }
        return;
      }
      const isGenuineChange = lastAppliedDarkRef.current !== dark;
      lastAppliedDarkRef.current = dark;
      if (!isGenuineChange) return;

      // Circuit breaker: cap how many times this effect will auto-reload
      // per (sessionStorage-scoped) session, regardless of how confident
      // the hydration-gating fix above is. If something we haven't
      // foreseen still causes a reload-triggering false positive right
      // after hydration, this stops it from looping forever again — the
      // DOM/cookie/meta updates above have already applied either way, so
      // the app itself keeps working even if this bails; only the OS
      // status bar might lag until the user relaunches on their own.
      let reloadCount = 0;
      try {
        reloadCount = Number(sessionStorage.getItem(COLOR_SCHEME_RELOAD_GUARD_KEY) ?? "0");
      } catch {
        /* private-mode/disabled storage — treat as 0, same as a fresh session */
      }
      if (reloadCount >= MAX_COLOR_SCHEME_AUTO_RELOADS) return;
      try {
        sessionStorage.setItem(COLOR_SCHEME_RELOAD_GUARD_KEY, String(reloadCount + 1));
      } catch {
        /* private-mode/disabled storage — nothing to persist, proceed anyway */
      }

      // A second, independent race the reload below exposed: while signed
      // in, local edits are pushed to the cloud on a 1.5s DEBOUNCE (the
      // "Mirror local edits up to the cloud" effect above), but a fresh
      // page load unconditionally PULLS the cloud copy and treats it as
      // authoritative the moment session+hydrated are both true (the
      // "reconcile against the cloud" effect above — its own comment says
      // "on sign-in," but it actually re-runs on every load where a
      // session already exists, since `hydrated` goes false→true on every
      // mount). Before this effect started reloading the page itself,
      // nothing else in the app ever navigated away within that 1.5s
      // window, so this race was latent and never actually observable.
      // Reported once it was: switching scheme while signed in reverted
      // right back to whatever the cloud still held, regardless of which
      // way the switch went — the reload was landing before the debounced
      // push ever reached Supabase, so the fresh load's own cloud pull
      // stomped the just-made local change straight back to the stale
      // cloud value. Fixed by pushing this render's state to the cloud
      // directly, bypassing the debounce, and awaiting it before
      // reloading — a 2s cap keeps a slow/failed push from blocking the
      // reload forever, since a stuck reload is worse than occasionally
      // still losing this particular race on a bad connection.
      if (session) {
        if (pushTimer.current) {
          clearTimeout(pushTimer.current);
          pushTimer.current = null;
        }
        try {
          await Promise.race([
            pushNow(session.user.id, state),
            new Promise((resolve) => setTimeout(resolve, 2000)),
          ]);
        } catch {
          /* push failed — proceed with the reload anyway rather than
             getting stuck; the debounced push would have hit the same
             failure mode regardless. */
        }
      }

      // The classList toggle above already repaints the page's own content
      // instantly — that part was never the problem. The real OS status
      // bar chrome doesn't follow it: iOS 26+'s Liquid Glass tints it by
      // sampling the rendered page background (see this section's own
      // writeup above), and that sampling only happens at specific WebKit
      // lifecycle checkpoints — load being the one we can actually confirm,
      // since force-quit + reopen is confirmed correct. There's no public
      // API to ask WebKit to resample it mid-session; a speculative
      // scroll-position nudge (tried here previously) turned out not to
      // work in practice. A real navigation reload DOES hit that same
      // load-time checkpoint, though — it's architecturally the same
      // "fresh load of /" force-quit + reopen already is, just triggered
      // from live JS instead of the OS — so this reloads the page itself,
      // automatically, right after a genuine switch: as close to "reopen
      // the app for the user" as a running page can do to itself. No data
      // is at risk — GymState is already flushed to localStorage on every
      // change by the persistence effect above this one, and the switch
      // only ever happens from the Settings screen, never mid-workout.
      //
      // Reloading immediately would still race sw.js's PAGES_CACHE, which
      // doesn't get refreshed by this client-side switch on its own — an
      // immediate reload could still serve the OLD scheme's cached shell
      // once more. First attempt: ask the SW to refetch-and-recache "/"
      // before reloading. Reported in practice: still a one-frame flash of
      // the old scheme's status bar on reload — a fetch-and-recache is a
      // genuine network round trip, and "wait for that write to settle" as
      // a proxy for "the reload can't read stale content" turned out not
      // to be airtight. sw.js's handler now just deletes the cache entry
      // instead (see its own comment for why that's the actually-airtight
      // fix: a deleted entry forces the navigate handler onto a plain
      // network-only fetch, current cookie and all, with no cached branch
      // left to race against). This still waits for that handler's reply
      // over a dedicated MessageChannel before reloading — eviction is a
      // near-instant storage op, not a network fetch, so this wait is now
      // short and just prevents reloading before the delete has actually
      // landed — with a 1.5s safety timeout if the SW never responds
      // (offline, no controller yet, etc.), so a switch still eventually
      // reloads even then rather than silently doing nothing.
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        let reloaded = false;
        const reload = () => {
          if (reloaded) return;
          reloaded = true;
          location.reload();
        };
        const channel = new MessageChannel();
        channel.port1.onmessage = reload;
        navigator.serviceWorker.controller.postMessage({ type: "forge:revalidate-shell" }, [
          channel.port2,
        ]);
        setTimeout(reload, 1500);
      } else {
        // No controlling SW yet (e.g. the very first load, before one's
        // registered) — nothing cached to be stale, so nothing to wait on.
        location.reload();
      }
    };

    if (state.colorScheme === "light") {
      applyScheme(false);
      return;
    }
    if (state.colorScheme === "dark") {
      applyScheme(true);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    applyScheme(media.matches);
    const onChange = (e: MediaQueryListEvent) => applyScheme(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
    // Deliberately scoped to colorScheme + hydrated only, same as the
    // reconcile-against-cloud effect above: this must NOT re-run on every
    // `state`/`session` change, only when the resolved scheme itself does
    // (or hydration completes) — `state` and `session` are read from the
    // closure purely for the cloud-flush-before-reload step inside
    // applySchemeAsync, which only fires on a genuine switch anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.colorScheme, hydrated]);

  const value = useMemo<Ctx>(() => {
    const allSets = (exerciseId: string) =>
      state.workouts.flatMap((w) => w.completed_sets).filter((s) => s.exercise_id === exerciseId);

    const withPlan = (s: GymState, plan: PlannedExercise[]): GymState =>
      s.activeWorkout ? { ...s, activeWorkout: { ...s.activeWorkout, plan } } : s;

    return {
      ...state,
      hydrated,
      plannedCardio: sortCardioPlan([
        ...state.cardioPlan,
        ...rotationCardioPlan(state.program ?? state.weeklyScheme),
      ]),
      session,
      syncStatus,
      signIn: authSignIn,
      signUp: authSignUp,
      signOut: authSignOut,
      update: (patch) => setState((s) => ({ ...s, ...patch })),
      startWorkout: (input) =>
        setState((s) => ({
          ...s,
          restOverride: null,
          activeWorkout: {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            duration_minutes: input.duration_minutes,
            target_muscles: input.target_muscles,
            plan: input.plan,
            completed_sets: [],
            finished: false,
            unit: "kg",
            fromScheduledDay: input.fromScheduledDay ?? false,
            fromProgramDay: input.fromProgramDay ?? false,
            ...(input.cardio ? { cardio: input.cardio } : {}),
          },
        })),
      updateActiveCardio: (patch) =>
        setState((s) =>
          s.activeWorkout?.cardio
            ? {
                ...s,
                activeWorkout: {
                  ...s.activeWorkout,
                  cardio: { ...s.activeWorkout.cardio, ...patch },
                },
              }
            : s,
        ),
      logSet: (set) =>
        setState((s) =>
          s.activeWorkout
            ? {
                ...s,
                activeWorkout: {
                  ...s.activeWorkout,
                  completed_sets: [...s.activeWorkout.completed_sets, set],
                },
              }
            : s,
        ),
      updateSet: (index, patch) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const { rpe, ...rest } = patch;
          const sets = s.activeWorkout.completed_sets.map((x, i) => {
            if (i !== index) return x;
            const next: LoggedSet = { ...x, ...rest };
            if (rpe === null) delete next.rpe;
            else if (rpe !== undefined) next.rpe = rpe;
            return next;
          });
          return {
            ...s,
            activeWorkout: { ...s.activeWorkout, completed_sets: renumber(sets) },
          };
        }),
      removeSetAt: (index) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const sets = s.activeWorkout.completed_sets.filter((_, i) => i !== index);
          return {
            ...s,
            activeWorkout: { ...s.activeWorkout, completed_sets: renumber(sets) },
          };
        }),
      finishWorkout: () =>
        setState((s) =>
          s.activeWorkout
            ? {
                ...s,
                workouts: [
                  { ...s.activeWorkout, finished: true, finished_at: new Date().toISOString() },
                  ...s.workouts,
                ],
                activeWorkout: null,
                // Only advance the split's rotation for the session it actually
                // scheduled — an off-schedule or repeated session shouldn't
                // silently skip the day that was really next.
                weeklyScheme:
                  s.weeklyScheme && s.activeWorkout.fromScheduledDay
                    ? advanceRotation(s.weeklyScheme, new Date(), new Date(s.activeWorkout.date))
                        .rotation
                    : s.weeklyScheme,
                // Same "only advance the session that actually scheduled it"
                // guard as weeklyScheme above, mirrored for the program cursor.
                program:
                  s.program && s.activeWorkout.fromProgramDay
                    ? advanceProgram(s.program, new Date(), new Date(s.activeWorkout.date))
                    : s.program,
              }
            : s,
        ),
      cancelWorkout: () => setState((s) => ({ ...s, restOverride: null, activeWorkout: null })),
      reorderActivePlan: (from, to) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const plan = [...s.activeWorkout.plan];
          if (to < 0 || to >= plan.length || from < 0 || from >= plan.length) return s;
          const [moved] = plan.splice(from, 1);
          plan.splice(to, 0, moved!);
          return withPlan(s, plan);
        }),
      rateWorkout: (workoutId, rpe) =>
        setState((s) => ({
          ...s,
          workouts: s.workouts.map((w) => {
            if (w.id !== workoutId) return w;
            const { session_rpe: _old, ...rest } = w;
            return rpe == null ? rest : { ...rest, session_rpe: rpe };
          }),
        })),
      setWorkoutWatch: (workoutId, watch) =>
        setState((s) => ({
          ...s,
          workouts: s.workouts.map((w) => {
            if (w.id !== workoutId) return w;
            const { watch: _old, ...rest } = w;
            return watch ? { ...rest, watch: roundWatchNumbers(watch) } : rest;
          }),
        })),
      saveCardioSession: (id, watch, hasRouteMap, kind) =>
        setState((s) => {
          const existing = s.cardioSessions.find((c) => c.id === id);
          const date = cardioStartIso(watch);
          // A re-import without a map keeps the map saved before.
          const map = hasRouteMap || !!existing?.hasRouteMap;
          const next: CardioSession = {
            ...(existing ?? {}),
            id,
            date,
            watch: roundWatchNumbers(watch),
            ...(map ? { hasRouteMap: true } : {}),
            ...(kind ?? {}),
          };
          const rest = s.cardioSessions.filter((c) => c.id !== next.id);
          return {
            ...s,
            cardioSessions: [next, ...rest].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
          };
        }),
      logCardio: ({ activity, effort, minutes, distanceKm, start, label, rpe }) =>
        setState((s) => {
          const watch = manualCardioWatch({
            label,
            start,
            minutes,
            distanceKm,
            importedAt: new Date().toISOString(),
          });
          const next: CardioSession = {
            id: crypto.randomUUID(),
            date: cardioStartIso(watch),
            watch: roundWatchNumbers(watch),
            activity,
            effort,
            manual: true,
            ...(rpe == null ? {} : { session_rpe: rpe }),
          };
          return {
            ...s,
            cardioSessions: [next, ...s.cardioSessions].sort(
              (a, b) => Date.parse(b.date) - Date.parse(a.date),
            ),
          };
        }),
      setCardioKind: (id, activity, effort) =>
        setState((s) => ({
          ...s,
          cardioSessions: s.cardioSessions.map((c) =>
            c.id === id ? { ...c, activity, effort } : c,
          ),
        })),
      setCardioPlan: (plan) => setState((s) => ({ ...s, cardioPlan: sortCardioPlan(plan) })),
      rateCardio: (id, rpe) =>
        setState((s) => ({
          ...s,
          cardioSessions: s.cardioSessions.map((c) => {
            if (c.id !== id) return c;
            const { session_rpe: _old, ...rest } = c;
            return rpe == null ? rest : { ...rest, session_rpe: rpe };
          }),
        })),
      deleteCardioSession: (id) => {
        void deleteRouteMap(id);
        setState((s) => ({ ...s, cardioSessions: s.cardioSessions.filter((c) => c.id !== id) }));
      },
      removeActivePlanEntries: (indices) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const drop = new Set(indices);
          return withPlan(
            s,
            s.activeWorkout.plan.filter((_, i) => !drop.has(i)),
          );
        }),
      moveActiveToEnd: (indices) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const picked = new Set(indices);
          const plan = s.activeWorkout.plan;
          return withPlan(s, [
            ...plan.filter((_, i) => !picked.has(i)),
            ...plan.filter((_, i) => picked.has(i)),
          ]);
        }),
      swapActiveExercise: (index, nextExerciseId) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const plan = s.activeWorkout.plan.map((p, i) => {
            if (i !== index) return p;
            const { suggested_weight: _dropped, ...rest } = p;
            return { ...rest, exercise_id: nextExerciseId };
          });
          return withPlan(s, plan);
        }),
      appendBonusExercise: (exerciseId) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const plan = [
            ...s.activeWorkout.plan,
            {
              exercise_id: exerciseId,
              target_sets: 3,
              warmup_sets: 0,
              target_reps: "8-12",
              rest_seconds: s.restSeconds,
              bonus: true,
            },
          ];
          return withPlan(s, plan);
        }),

      toggleLovedExercise: (exerciseId) =>
        setState((s) => ({
          ...s,
          lovedExerciseIds: s.lovedExerciseIds.includes(exerciseId)
            ? s.lovedExerciseIds.filter((id) => id !== exerciseId)
            : [...s.lovedExerciseIds, exerciseId],
          avoidedExerciseIds: s.avoidedExerciseIds.filter((id) => id !== exerciseId),
        })),

      toggleAvoidedExercise: (exerciseId) =>
        setState((s) => ({
          ...s,
          avoidedExerciseIds: s.avoidedExerciseIds.includes(exerciseId)
            ? s.avoidedExerciseIds.filter((id) => id !== exerciseId)
            : [...s.avoidedExerciseIds, exerciseId],
          lovedExerciseIds: s.lovedExerciseIds.filter((id) => id !== exerciseId),
        })),

      setTodayReadiness: (score) =>
        setState((s) => {
          const key = dayKey(new Date().toISOString());
          const entry: ReadinessCheckIn = { date: new Date().toISOString(), score };
          const withoutToday = s.readinessLog.filter((c) => dayKey(c.date) !== key);
          return { ...s, readinessLog: [entry, ...withoutToday] };
        }),

      lastPerformance: (exerciseId) => allSets(exerciseId).slice(-1)[0],
      // Ranked by estimated 1RM (Epley) so "best set" agrees with the PR
      // definition used everywhere else (progress.ts, history) — it used to
      // rank by raw weight*reps, a third, different notion of "best".
      bestSet: (exerciseId) => {
        // A bodyweight exercise's weight is external load, so rank by what
        // was actually lifted (bodyweight + load); reps break ties, which
        // matters when no bodyweight is on file and every set logs 0.
        const body = isBodyweightExercise(EXERCISES.find((e) => e.id === exerciseId))
          ? (latestBodyKg(state.weightLog, state.nutritionProfile) ?? 0)
          : 0;
        const e1 = (x: LoggedSet) => estimated1RM({ weight: x.weight + body, reps: x.reps });
        return allSets(exerciseId).sort((a, b) => e1(b) - e1(a) || b.reps - a.reps)[0];
      },

      setWeeklyScheme: (scheme) => setState((s) => ({ ...s, weeklyScheme: scheme })),
      updateScheduleSlotDow: (index, dow) =>
        setState((s) => {
          if (!s.weeklyScheme) return s;
          const schedule = s.weeklyScheme.schedule.map((slot, i) =>
            i === index ? { ...slot, dow } : slot,
          );
          return { ...s, weeklyScheme: resortRotation({ ...s.weeklyScheme, schedule }) };
        }),
      clearWeeklyScheme: () => setState((s) => ({ ...s, weeklyScheme: null })),

      setProgram: (program) => setState((s) => ({ ...s, program })),
      updateProgramSlotDow: (index, dow) =>
        setState((s) => {
          if (!s.program) return s;
          const schedule = s.program.schedule.map((slot, i) =>
            i === index ? { ...slot, dow } : slot,
          );
          return { ...s, program: resortRotation({ ...s.program, schedule }) };
        }),
      clearProgram: () => setState((s) => ({ ...s, program: null })),
      updateProgramSchedule: (templateId, schedule, cardio) =>
        setState((s) => {
          if (!s.program) return s;
          const cyclePosition = initialCyclePosition(schedule);
          return {
            ...s,
            program: {
              ...s.program,
              templateId,
              schedule,
              cardio,
              cyclePosition,
              anchor: anchorFor(schedule, cyclePosition),
              dayOverrides: undefined,
              doneOn: undefined,
            },
          };
        }),
      skipScheduledSession: (kind) =>
        setState((s) =>
          kind === "program"
            ? s.program
              ? { ...s, program: advanceProgram(s.program) }
              : s
            : s.weeklyScheme
              ? { ...s, weeklyScheme: advanceRotation(s.weeklyScheme).rotation }
              : s,
        ),
      shiftScheduledSessions: (kind, delta) =>
        setState((s) => updateRotation(s, kind, (r) => shiftRemaining(r, delta))),
      moveScheduledSession: (kind, index, dateKey) =>
        setState((s) =>
          updateRotation(s, kind, (r) => moveSession(r, index, parseDayKey(dateKey))),
        ),
      moveNextWeekSession: (kind, index, dateKey) =>
        setState((s) => {
          const today = new Date();
          const date = parseDayKey(dateKey);
          if (kind === "program") {
            if (!s.program) return s;
            let program = s.program;
            const left = program.schedule.length - program.cyclePosition;
            for (let i = 0; i < left; i++) program = advanceProgram(program, today);
            return { ...s, program: moveIfChanged(program, index, date) };
          }
          if (!s.weeklyScheme) return s;
          return {
            ...s,
            weeklyScheme: moveIfChanged(skipRestOfCycle(s.weeklyScheme, today), index, date),
          };
        }),
      resetScheduledWeek: (kind) =>
        setState((s) => updateRotation(s, kind, (r) => ({ ...r, dayOverrides: undefined }))),

      saveWorkoutTemplate: (name, plan, duration_minutes, target_muscles) =>
        setState((s) => ({
          ...s,
          workoutTemplates: [
            { id: crypto.randomUUID(), name, plan, duration_minutes, target_muscles },
            ...s.workoutTemplates,
          ],
        })),
      deleteWorkoutTemplate: (id) =>
        setState((s) => ({
          ...s,
          workoutTemplates: s.workoutTemplates.filter((t) => t.id !== id),
        })),

      addFoodEntry: (entry) => setState((s) => ({ ...s, foodEntries: [entry, ...s.foodEntries] })),
      updateFoodEntry: (id, patch) =>
        setState((s) => ({
          ...s,
          foodEntries: s.foodEntries.map((e) => {
            if (e.id !== id) return e;
            const { nevo, ...rest } = patch;
            const next: FoodEntry = { ...e, ...rest };
            if (nevo === null) delete next.nevo;
            else if (nevo) next.nevo = nevo;
            return next;
          }),
        })),
      removeFoodEntry: (id) =>
        setState((s) => ({ ...s, foodEntries: s.foodEntries.filter((e) => e.id !== id) })),
      setNutritionGoals: (goals) => setState((s) => ({ ...s, nutritionGoals: goals })),

      setExerciseNote: (exerciseId, note) =>
        setState((s) => {
          const exerciseNotes = { ...s.exerciseNotes };
          const text = note.trim();
          if (text) exerciseNotes[exerciseId] = text;
          else delete exerciseNotes[exerciseId];
          return { ...s, exerciseNotes };
        }),
      toggleFavoriteFood: (food) =>
        setState((s) => {
          const key = food.name.trim().toLowerCase();
          const has = s.favoriteFoods.some((f) => f.name.trim().toLowerCase() === key);
          return {
            ...s,
            favoriteFoods: has
              ? s.favoriteFoods.filter((f) => f.name.trim().toLowerCase() !== key)
              : [
                  // Only the food itself: a row from "your foods" also
                  // carries its barcode and usage counts.
                  {
                    name: food.name.trim(),
                    grams: food.grams,
                    per100: food.per100,
                    ...(food.nevo ? { nevo: food.nevo } : {}),
                  },
                  ...s.favoriteFoods,
                ],
          };
        }),
      rememberFood: (food, barcode) =>
        setState((s) => ({
          ...s,
          myFoods: upsertMyFood(s.myFoods, food, barcode, new Date().toISOString()),
        })),
      forgetFood: (key) => setState((s) => ({ ...s, myFoods: removeMyFood(s.myFoods, key) })),
      saveMealTemplate: (name, ingredients) =>
        setState((s) => ({
          ...s,
          mealTemplates: [{ id: crypto.randomUUID(), name, ingredients }, ...s.mealTemplates],
        })),
      deleteMealTemplate: (id) =>
        setState((s) => ({
          ...s,
          mealTemplates: s.mealTemplates.filter((t) => t.id !== id),
        })),
      logMealTemplate: (id, meal) =>
        setState((s) => {
          const template = s.mealTemplates.find((t) => t.id === id);
          if (!template) return s;
          const now = new Date().toISOString();
          const entries: FoodEntry[] = template.ingredients.map((ing) => ({
            id: crypto.randomUUID(),
            name: ing.name,
            logged_at: now,
            meal,
            grams: ing.grams,
            per100: ing.per100,
            ...(ing.nevo?.length ? { nevo: ing.nevo } : {}),
          }));
          return { ...s, foodEntries: [...entries, ...s.foodEntries] };
        }),

      saveRecipe: (name, servings, ingredients) =>
        setState((s) => ({
          ...s,
          recipes: [{ id: crypto.randomUUID(), name, servings, ingredients }, ...s.recipes],
        })),
      deleteRecipe: (id) =>
        setState((s) => ({ ...s, recipes: s.recipes.filter((r) => r.id !== id) })),
      // A serving's macros are stored as a per100-style figure so this reuses
      // the exact same scaledMacros math every other food entry uses — grams
      // here is just `servings * 100`, not a real weight, purely to encode
      // "how many servings" through the existing grams/per100 shape rather
      // than adding a parallel one just for recipe-sourced entries.
      logRecipe: (id, servings, meal) =>
        setState((s) => {
          const recipe = s.recipes.find((r) => r.id === id);
          if (!recipe) return s;
          const entry: FoodEntry = {
            id: crypto.randomUUID(),
            name: recipe.name,
            logged_at: new Date().toISOString(),
            meal,
            grams: Math.round(Math.max(0, servings) * 100),
            per100: recipePerServing(recipe),
          };
          const nevo = nevoCodes(recipe.ingredients);
          if (nevo) entry.nevo = nevo;
          return { ...s, foodEntries: [entry, ...s.foodEntries] };
        }),

      logWater: (ml, opts) => {
        if (!opts?.tap) {
          lastWaterTap.current = null;
          setState((s) => ({
            ...s,
            waterEntries: [
              { id: crypto.randomUUID(), ml, logged_at: new Date().toISOString() },
              ...s.waterEntries,
            ],
          }));
          return;
        }
        // Decided outside the updater, so a StrictMode double call can't
        // merge a tap into itself.
        const result = mergeWaterTap(
          stateRef.current.waterEntries,
          ml,
          Date.now(),
          lastWaterTap.current,
          () => crypto.randomUUID(),
        );
        lastWaterTap.current = result.tap;
        const merged = result.entries.find((e) => e.id === result.tap.id)!;
        setState((s) =>
          s.waterEntries.some((e) => e.id === merged.id)
            ? {
                ...s,
                waterEntries: s.waterEntries.map((e) =>
                  e.id === merged.id ? { ...e, ml: e.ml + ml } : e,
                ),
              }
            : { ...s, waterEntries: [merged, ...s.waterEntries] },
        );
      },
      logWeight: (kg) =>
        setState((s) => ({
          ...s,
          weightLog: withWeighIn(s.weightLog, {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            kg,
          }),
        })),
      logWeighIn: (entry) =>
        setState((s) => ({
          ...s,
          weightLog: withWeighIn(s.weightLog, { id: crypto.randomUUID(), ...entry }),
        })),
      removeWeightEntry: (id) =>
        setState((s) => ({ ...s, weightLog: s.weightLog.filter((e) => e.id !== id) })),
      removeWaterEntry: (id) =>
        setState((s) => ({ ...s, waterEntries: s.waterEntries.filter((e) => e.id !== id) })),
      logCoffee: (kind) =>
        setState((s) => ({
          ...s,
          coffeeEntries: [
            { id: crypto.randomUUID(), kind, logged_at: new Date().toISOString() },
            ...s.coffeeEntries,
          ],
        })),
      removeCoffeeEntry: (id) =>
        setState((s) => ({ ...s, coffeeEntries: s.coffeeEntries.filter((e) => e.id !== id) })),
    };
  }, [state, hydrated, session, syncStatus]);

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>;
}

export function useGym() {
  const ctx = useContext(GymContext);
  if (!ctx) throw new Error("useGym must be used inside GymProvider");
  return ctx;
}

/** Vibrates where the device can; elsewhere (every iPhone — see
 *  tapFeedback.ts) it tries the hidden-switch haptic tick and also plays a
 *  visual pulse on the tapped control, since there's no way to tell
 *  whether the tick was felt. */
export const haptic = (pattern: number | number[] = 30) => {
  if (canVibrate()) {
    markHaptic();
    navigator.vibrate(pattern);
    return;
  }
  pulseTappedControl();
  switchTick();
};
