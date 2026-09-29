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
  /** NEVO codes the values come from (a NEVO food, or a recipe with NEVO
   *  ingredients), so the NEVO reference shows where the day uses it.
   *  Dropped once the user changes a value. */
  nevo?: number[];
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
  /** See FoodEntry.nevo. */
  nevo?: number[];
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

/**
 * Total daily energy need, from the US National Academies' Dietary Reference
 * Intakes for Energy (2023): estimated energy requirement (EER) equations
 * fitted to doubly labelled water measurements — measured total energy
 * expenditure, the reference method — for adults 19+, by sex and one of four
 * physical activity level (PAL) categories. The categories count *all*
 * activity, workouts included, so gym sessions aren't added on top.
 *
 * Categories as the report describes them (PAL ranges 1.0–1.53, 1.53–1.68,
 * 1.68–1.85, 1.85–2.50): inactive = typical daily living only; low active =
 * plus 30–60 min of moderate activity a day; active = plus 60+ min a day;
 * very active = plus 60 min moderate and another 60 min vigorous (or 120
 * min moderate). The example in the questionnaire — a desk job plus 3–4
 * strength sessions a week as "low active" — is the app's own reading: four
 * 45-minute sessions average ~26 min a day, resistance training at 3.5 METs
 * is moderate intensity (2024 Compendium), and daily walking fills the rest.
 *
 * These replace Mifflin-St Jeor × the FAO/WHO/UNU 2004 lifestyle PAL bands
 * plus separately added session energy: that combination counted activity
 * twice and landed at the top of the measured range — a 31-year-old man of
 * 97 kg picking "active" got ~3,970 kcal, the 2023 "very active" value, while
 * his PT suggested an intake matching "low active"/"active".
 *
 * Coefficients: EER = intercept − age·A + height·H(cm) + weight·W(kg), in
 * kcal/day, confirmed through web search results quoting the report's tables
 * (the report site isn't reachable from this environment).
 */
export type ActivityLevel = "inactive" | "lowActive" | "active" | "veryActive";

type EerCoefficients = { intercept: number; age: number; height: number; weight: number };

export const EER_2023: Record<Sex, Record<ActivityLevel, EerCoefficients>> = {
  male: {
    inactive: { intercept: 753.07, age: 10.83, height: 6.5, weight: 14.1 },
    lowActive: { intercept: 581.47, age: 10.83, height: 8.3, weight: 14.94 },
    active: { intercept: 1004.82, age: 10.83, height: 6.52, weight: 15.91 },
    veryActive: { intercept: -517.88, age: 10.83, height: 15.61, weight: 19.11 },
  },
  female: {
    inactive: { intercept: 584.9, age: 7.01, height: 5.72, weight: 11.71 },
    lowActive: { intercept: 575.77, age: 7.01, height: 6.6, weight: 12.14 },
    active: { intercept: 710.25, age: 7.01, height: 6.54, weight: 12.34 },
    veryActive: { intercept: 511.83, age: 7.01, height: 9.07, weight: 12.56 },
  },
};

export const ACTIVITY_LEVELS: { id: ActivityLevel }[] = [
  { id: "inactive" },
  { id: "lowActive" },
  { id: "active" },
  { id: "veryActive" },
];

/** Estimated energy requirement (2023 DRI equations above), kcal/day. */
export function estimatedEnergyRequirement(p: NutritionProfile): number {
  const c = EER_2023[p.sex][p.activityLevel] ?? EER_2023[p.sex].lowActive;
  return c.intercept - c.age * p.age + c.height * p.heightCm + c.weight * p.weightKg;
}

export type NutritionGoalType = "lose" | "maintain" | "gain";

export type NutritionPace = "mild" | "moderate" | "aggressive";

/**
 * Cutting: target a bodyweight loss of 0.5–1% per week (Helms, Aragon &
 * Fitschen, J Int Soc Sports Nutr 2014 — the rate that best preserves
 * muscle), with "moderate" at the midpoint. Converted to a daily deficit at
 * 7700 kcal per kg of bodyweight lost (the classic 3500 kcal/lb rule). Hall
 * (Int J Obes 2008) showed that rule overestimates the energy in weight lost
 * by lean people, so real loss can run a bit faster than the target — the
 * questionnaire tells the user to check their weekly weight and adjust.
 */
export const LOSS_RATE_PER_WEEK: Record<NutritionPace, number> = {
  mild: 0.005,
  moderate: 0.0075,
  aggressive: 0.01,
};
export const KCAL_PER_KG = 7700;

/** Bulking: a 10–20% energy surplus (Iraki, Fitschen, Espinar & Helms,
 *  Sports 2019, for a gain of ~0.25–0.5% bodyweight per week), with
 *  "moderate" at the midpoint. */
const GAIN_SURPLUS: Record<NutritionPace, number> = {
  mild: 0.1,
  moderate: 0.15,
  aggressive: 0.2,
};

/**
 * Protein, g/kg bodyweight. Maintain/gain: 1.6, the point past which extra
 * protein stopped adding muscle in Morton et al.'s meta-analysis (Br J
 * Sports Med 2018, breakpoint 1.62 g/kg). Cut: 2.2, the upper end of that
 * analysis's confidence interval — chosen because Helms et al. 2014
 * recommend 2.3–3.1 g/kg of *lean* mass in a deficit, and 2.2 g/kg of
 * bodyweight meets that lower bound for anyone above ~4% body fat, without
 * needing a body-fat measurement the app doesn't have.
 */
const PROTEIN_PER_KG: Record<NutritionGoalType, number> = {
  lose: 2.2,
  maintain: 1.6,
  gain: 1.6,
};

/**
 * Fat, as the midpoint of where the relevant ranges overlap: cutting, Helms
 * et al. 2014's 15–30% of calories within the US Institute of Medicine's
 * acceptable 20–35% → 20–30%, midpoint 25%; maintaining/gaining, the IOM's
 * 20–35%, midpoint 27.5%, kept within Iraki et al. 2019's 0.5–1.5 g/kg.
 * Carbohydrate is the remainder, as both papers recommend.
 */
const FAT_SHARE: Record<NutritionGoalType, number> = {
  lose: 0.25,
  maintain: 0.275,
  gain: 0.275,
};
const FAT_G_PER_KG_RANGE: [number, number] = [0.5, 1.5];

/** 14 g per 1000 kcal — the US Dietary Guidelines / Institute of Medicine
 *  adequate intake for fiber. */
const FIBER_PER_1000_KCAL = 14;

/** Under 5 g salt (2 g sodium) a day — the WHO guideline for adults. */
const SALT_LIMIT_G = 5;

/** Never suggest below the lower end of the 2013 AHA/ACC/TOS obesity
 *  guideline's diet prescriptions (1200–1500 kcal/day for women,
 *  1500–1800 for men) — a floor for safety, not a recommendation. */
const MIN_CALORIES: Record<Sex, number> = { female: 1200, male: 1500 };

export interface NutritionProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  /** Strength sessions a week — splits the week into training and rest
   *  days (trainingDayGoalsFromAverage). Missing on profiles saved before
   *  this was asked. */
  sessionsPerWeek?: number;
  goal: NutritionGoalType;
  /** Ignored when goal is "maintain". */
  pace: NutritionPace;
}

/**
 * Suggests daily limits from a short profile — a starting point to review
 * and adjust, not a prescription. Every constant above names its source.
 * Energy: the 2023 DRI estimated energy requirement for the chosen
 * activity level (workouts included — see EER_2023); then the goal's
 * deficit/surplus; then the safety floor.
 */
export function suggestNutritionGoals(p: NutritionProfile): NutritionGoals {
  const tdee = estimatedEnergyRequirement(p);
  const target =
    p.goal === "lose"
      ? tdee - (LOSS_RATE_PER_WEEK[p.pace] * p.weightKg * KCAL_PER_KG) / 7
      : p.goal === "gain"
        ? tdee * (1 + GAIN_SURPLUS[p.pace])
        : tdee;
  const calories = Math.max(MIN_CALORIES[p.sex], Math.round(target));

  const protein = Math.round(PROTEIN_PER_KG[p.goal] * p.weightKg);
  let fat = (calories * FAT_SHARE[p.goal]) / 9;
  if (p.goal !== "lose") {
    const [lo, hi] = FAT_G_PER_KG_RANGE;
    fat = Math.min(hi * p.weightKg, Math.max(lo * p.weightKg, fat));
  }
  fat = Math.round(fat);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  const fiber = Math.round((calories / 1000) * FIBER_PER_1000_KCAL);

  return { calories, protein, carbs, fat, fiber, salt: SALT_LIMIT_G };
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

/**
 * Protein per meal: 0.4 g per kg of bodyweight. Schoenfeld & Aragon's review
 * (J Int Soc Sports Nutr 2018) concludes that, to maximise muscle building,
 * protein should be eaten at a target of 0.4 g/kg per meal across at least
 * four meals, reaching at least 1.6 g/kg a day (the same daily figure as the
 * protein target above). Confirmed through web search results. Shown as a
 * check on a meal in the food log — a nudge, never a limit.
 */
export const PROTEIN_PER_MEAL_G_PER_KG = 0.4;

export function proteinPerMealTarget(bodyKg: number | null): number | null {
  return bodyKg ? Math.round(PROTEIN_PER_MEAL_G_PER_KG * bodyKg) : null;
}

export interface WeekDayIntake {
  key: string;
  calories: number;
  goal: number | undefined;
  logged: boolean;
}

/**
 * Average calories over a week's finished, logged days against the average
 * of those same days' limits. Today is left out while it's still going (a
 * half-logged day would drag the average down), as are days with nothing
 * logged — a missing log isn't a zero-calorie day. Null with no such day.
 * When cutting, the weekly average is what moves weight, not any one day.
 */
export function weeklyAverage(
  days: WeekDayIntake[],
  todayKey: string,
): { calories: number; goal: number | null; days: number } | null {
  const counted = days.filter((d) => d.logged && d.key < todayKey);
  if (!counted.length) return null;
  const calories = Math.round(counted.reduce((s, d) => s + d.calories, 0) / counted.length);
  const withGoal = counted.filter((d) => d.goal != null);
  const goal =
    withGoal.length === counted.length
      ? Math.round(withGoal.reduce((s, d) => s + d.goal!, 0) / withGoal.length)
      : null;
  return { calories, goal, days: counted.length };
}

/** Distinct NEVO codes behind a list of foods, or undefined if none. */
export function nevoCodes(foods: { nevo?: number[] }[]): number[] | undefined {
  const codes = [...new Set(foods.flatMap((f) => f.nevo ?? []))];
  return codes.length ? codes : undefined;
}
