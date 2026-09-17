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
 * everyone wants to cap every nutrient. A future version will suggest these
 * from a short questionnaire instead of asking for raw numbers; for now
 * they're entered directly (see NutritionGoalsSheet).
 */
export type NutritionGoals = Partial<Record<NutrientKey, number>>;

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

export function entriesForDay(entries: FoodEntry[], key: string): FoodEntry[] {
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
