import { addDays, dayKey, dayKeyFromDate } from "./date";

export { addDays, dayKey, dayKeyFromDate };

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/** Display order for grouping a day's log by meal. */
export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** Sensible default meal for a timestamp, based on local time of day. */
export function mealForTime(iso: string): MealType {
  const hour = new Date(iso).getHours();
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 18 && hour < 23) return "dinner";
  return "snack";
}

export interface FoodEntry {
  id: string;
  name: string;
  /** ISO timestamp when logged. */
  logged_at: string;
  /** Which meal this was logged under — set by the user when adding food. */
  meal: MealType;
  /** Grams actually eaten. */
  grams: number;
  /** Macros as labeled per 100g — the source-of-truth a scanned or entered label gives us. */
  per100: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    salt: number;
  };
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  salt: number;
}

export type NutrientKey = keyof Macros;

/** One ingredient within a saved MealTemplate — same shape a food entry uses. */
export interface MealIngredient {
  name: string;
  grams: number;
  per100: Macros;
}

/** A named, reusable combo of ingredients (e.g. "Banana oatmeal") the user can log in one tap. */
export interface MealTemplate {
  id: string;
  name: string;
  ingredients: MealIngredient[];
}

/**
 * A named, reusable recipe: an ingredient list plus how many servings the
 * whole batch yields. Distinct from a MealTemplate above (which logs every
 * ingredient as its own entry, unscaled, every time): a Recipe computes
 * per-serving macros from its ingredients' combined totals divided by
 * `servings`, and logging it records a single food entry sized to however
 * many servings were actually eaten, rather than the whole batch.
 */
export interface Recipe {
  id: string;
  name: string;
  /** How many servings the full ingredient list yields. */
  servings: number;
  ingredients: MealIngredient[];
}

/** Per-serving macros — the whole batch's combined totals divided by `servings`. */
export function recipePerServing(recipe: Recipe): Macros {
  const total = dailyTotals(recipe.ingredients);
  const servings = Math.max(1, recipe.servings);
  return {
    calories: Math.round(total.calories / servings),
    protein: Number((total.protein / servings).toFixed(1)),
    carbs: Number((total.carbs / servings).toFixed(1)),
    fat: Number((total.fat / servings).toFixed(1)),
    fiber: Number((total.fiber / servings).toFixed(1)),
    salt: Number((total.salt / servings).toFixed(2)),
  };
}

/** One logged glass/bottle/etc of water. */
export interface WaterEntry {
  id: string;
  ml: number;
  /** ISO timestamp when logged. */
  logged_at: string;
}

/** Quick-add amounts offered wherever water can be logged in one tap —
 *  the Nutrition screen's own Water card and the Home dashboard's Water
 *  tile both use this exact list, so the two never drift apart on what
 *  "quick add" means. */
export const WATER_QUICK_ADD = [250, 500, 750, 1000];

/** Trims a fixed-2dp liters string down to whatever precision it actually needs. */
export const formatLiters = (ml: number) => `${(ml / 1000).toFixed(2).replace(/\.?0+$/, "")}L`;

/** Display order used everywhere a nutrient list is shown. */
export const NUTRIENT_ORDER: NutrientKey[] = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "salt",
];

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
  fiber: "Fiber",
  salt: "Salt",
};

export const NUTRIENT_UNITS: Record<NutrientKey, string> = {
  calories: "kcal",
  protein: "g",
  carbs: "g",
  fat: "g",
  fiber: "g",
  salt: "g",
};

/**
 * Daily limits the user sets for themselves — every field optional, since not
 * everyone wants to cap every nutrient. Can be typed in directly, or
 * pre-filled from a suggestion (see NutritionQuestionnaireSheet /
 * suggestNutritionGoals below) and adjusted from there — either way the
 * result is just plain numbers the user can always override.
 */
export type NutritionGoals = Partial<Record<NutrientKey, number>>;

export type Sex = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export const ACTIVITY_LEVELS: {
  id: ActivityLevel;
  label: string;
  description: string;
  factor: number;
}[] = [
  {
    id: "sedentary",
    label: "Sedentary",
    description: "Desk job, little to no exercise",
    factor: 1.2,
  },
  {
    id: "light",
    label: "Lightly active",
    description: "Light exercise 1–3 days/week",
    factor: 1.375,
  },
  {
    id: "moderate",
    label: "Moderately active",
    description: "Moderate exercise 3–5 days/week",
    factor: 1.55,
  },
  {
    id: "active",
    label: "Active",
    description: "Hard exercise 6–7 days/week",
    factor: 1.725,
  },
  {
    id: "very_active",
    label: "Very active",
    description: "Physical job or training twice a day",
    factor: 1.9,
  },
];

export type NutritionGoalType = "lose" | "maintain" | "gain";

export type NutritionPace = "mild" | "moderate" | "aggressive";

/** Calorie deficit/surplus applied to TDEE, as a fraction — smaller for a
 *  surplus than a deficit at the same "aggressive" label, since a fast bulk
 *  mostly adds fat rather than muscle. */
const PACE_ADJUSTMENT: Record<NutritionGoalType, Record<NutritionPace, number>> = {
  lose: { mild: -0.15, moderate: -0.2, aggressive: -0.25 },
  maintain: { mild: 0, moderate: 0, aggressive: 0 },
  gain: { mild: 0.08, moderate: 0.12, aggressive: 0.18 },
};

/** Protein target in g/kg bodyweight — higher on a cut to help preserve
 *  muscle through the deficit. */
const PROTEIN_PER_KG: Record<NutritionGoalType, number> = {
  lose: 2.2,
  maintain: 1.8,
  gain: 1.8,
};

/** Never suggest below this, regardless of inputs — a floor for safety, not
 *  a recommendation to eat this little. */
const MIN_CALORIES = 1200;

export interface NutritionProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: NutritionGoalType;
  /** Ignored when goal is "maintain". */
  pace: NutritionPace;
}

/** Mifflin-St Jeor resting energy expenditure, in kcal/day. */
function basalMetabolicRate(p: NutritionProfile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

/**
 * Suggests daily limits from a short profile — a starting point to review
 * and adjust, not a prescription. Calories via Mifflin-St Jeor + activity
 * multiplier + goal/pace adjustment; protein via g/kg bodyweight (goal
 * dependent); fat as a fixed share of calories; carbs as the remainder;
 * fiber/salt from general dietary guidelines (not goal dependent).
 */
export function suggestNutritionGoals(p: NutritionProfile): NutritionGoals {
  const bmr = basalMetabolicRate(p);
  const activityFactor = ACTIVITY_LEVELS.find((a) => a.id === p.activityLevel)!.factor;
  const tdee = bmr * activityFactor;
  const adjustment = PACE_ADJUSTMENT[p.goal][p.pace];
  const calories = Math.max(MIN_CALORIES, Math.round(tdee * (1 + adjustment)));

  const protein = Math.round(PROTEIN_PER_KG[p.goal] * p.weightKg);
  const fatCalories = calories * 0.28;
  const fat = Math.round(fatCalories / 9);
  const carbCalories = Math.max(0, calories - protein * 4 - fatCalories);
  const carbs = Math.round(carbCalories / 4);

  const fiber = Math.round((calories / 1000) * 14);
  const salt = 6;

  return { calories, protein, carbs, fat, fiber, salt };
}

/**
 * Rest-day adjustment, grounded in two published sources rather than a flat
 * percentage:
 *
 * - How much: the energy cost of the session that a rest day doesn't have,
 *   from the 2024 Adult Compendium of Physical Activities (Herrmann et al.,
 *   J Sport Health Sci 2024). Code 02054, "resistance (weight) training,
 *   multiple exercises, 8-15 reps at varied resistance" = 3.5 METs; code
 *   02055, "resistance training, circuit, reciprocal supersets" = 5.8 METs.
 *   1 MET = 1 kcal/kg/h, the cost of sitting quietly, so the *extra* energy
 *   of a session over spending that time at rest is (MET − 1) × kg × hours.
 * - Where from: carbohydrate only. The ACSM/Academy of Nutrition and
 *   Dietetics/Dietitians of Canada joint position (Thomas et al., 2016) and
 *   Burke et al. (J Sports Sci 2011) scale daily carbohydrate to the fuel
 *   needs of that day's training, while the ISSN protein position stand
 *   (Jäger et al., 2017) sets protein as a daily 1.4–2.0 g/kg target
 *   regardless of whether you trained — so protein and fat stay the same.
 */
export const RESISTANCE_TRAINING_MET = 3.5;
export const SUPERSET_TRAINING_MET = 5.8;

/** Extra kcal a session costs over spending the same time at rest. */
export function sessionEnergyKcal(weightKg: number, minutes: number, met: number): number {
  return Math.max(0, Math.round((met - 1) * weightKg * (minutes / 60)));
}

/** Rest-day limits: training-day limits minus one session's energy, taken
 *  entirely from carbs (1 g carbohydrate ≈ 4 kcal). */
export function deriveRestDayGoals(training: NutritionGoals, sessionKcal: number): NutritionGoals {
  const rest: NutritionGoals = { ...training };
  if (training.calories != null) {
    rest.calories = Math.max(0, Math.round(training.calories - sessionKcal));
    if (training.carbs != null) {
      rest.carbs = Math.max(0, Math.round(training.carbs - sessionKcal / 4));
    }
  }
  return rest;
}

/** Rest-day limits: derived from training-day ones, with any field the user
 *  set by hand taking precedence. */
export const restDayGoals = (
  training: NutritionGoals,
  overrides: NutritionGoals,
  sessionKcal: number,
): NutritionGoals => ({
  ...deriveRestDayGoals(training, sessionKcal),
  ...overrides,
});

/** Turns one average daily target into training-day limits such that, with
 *  rest days derived via deriveRestDayGoals, the weekly average calories
 *  still land on the original target: with n training days and a session
 *  cost D, 7·avg = n·T + (7−n)·(T−D), so T = avg + D·(7−n)/7. The extra
 *  calories go to carbs. */
export function trainingDayGoalsFromAverage(
  average: NutritionGoals,
  trainingDaysPerWeek: number,
  sessionKcal: number,
): NutritionGoals {
  if (average.calories == null) return average;
  const n = Math.min(7, Math.max(0, trainingDaysPerWeek));
  const extra = (sessionKcal * (7 - n)) / 7;
  const training: NutritionGoals = { ...average, calories: Math.round(average.calories + extra) };
  if (average.carbs != null) training.carbs = Math.round(average.carbs + extra / 4);
  return training;
}

export type NutrientStatus = "none" | "ok" | "near" | "over";

/** How close `consumed` is to `limit` — drives the overview meter's color/copy. */
export function nutrientStatus(consumed: number, limit: number | undefined): NutrientStatus {
  if (limit == null || limit <= 0) return "none";
  if (consumed > limit) return "over";
  if (consumed >= limit * 0.85) return "near";
  return "ok";
}

/** Scales per-100g label values by grams — works for a FoodEntry or a MealIngredient alike. */
export function scaledMacros(entry: { grams: number; per100: Macros }): Macros {
  const factor = entry.grams / 100;
  return {
    calories: Math.round(entry.per100.calories * factor),
    protein: Number((entry.per100.protein * factor).toFixed(1)),
    carbs: Number((entry.per100.carbs * factor).toFixed(1)),
    fat: Number((entry.per100.fat * factor).toFixed(1)),
    fiber: Number((entry.per100.fiber * factor).toFixed(1)),
    salt: Number((entry.per100.salt * factor).toFixed(2)),
  };
}

/** Filters any logged_at-timestamped list (FoodEntry, WaterEntry, …) down to one calendar day. */
export function entriesForDay<T extends { logged_at: string }>(entries: T[], key: string): T[] {
  return entries.filter((e) => dayKey(e.logged_at) === key);
}

export function dailyTotals(entries: { grams: number; per100: Macros }[]): Macros {
  return entries.reduce<Macros>(
    (acc, e) => {
      const m = scaledMacros(e);
      return {
        calories: acc.calories + m.calories,
        protein: Number((acc.protein + m.protein).toFixed(1)),
        carbs: Number((acc.carbs + m.carbs).toFixed(1)),
        fat: Number((acc.fat + m.fat).toFixed(1)),
        fiber: Number((acc.fiber + m.fiber).toFixed(1)),
        salt: Number((acc.salt + m.salt).toFixed(2)),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 },
  );
}
