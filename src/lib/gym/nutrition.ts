import { dayKey } from "./date";

export { dayKey };

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

/** Scales a food entry's per-100g label values by the grams actually eaten. */
export function scaledMacros(entry: FoodEntry): Macros {
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

export function dailyTotals(entries: FoodEntry[]): Macros {
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
