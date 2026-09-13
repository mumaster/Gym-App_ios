import { dayKey } from "./date";

export { dayKey };

export interface FoodEntry {
  id: string;
  name: string;
  /** ISO timestamp when logged. */
  logged_at: string;
  /** Grams actually eaten. */
  grams: number;
  /** Macros as labeled per 100g — the source-of-truth a scanned or entered label gives us. */
  per100: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Scales a food entry's per-100g label values by the grams actually eaten. */
export function scaledMacros(entry: FoodEntry): Macros {
  const factor = entry.grams / 100;
  return {
    calories: Math.round(entry.per100.calories * factor),
    protein: Number((entry.per100.protein * factor).toFixed(1)),
    carbs: Number((entry.per100.carbs * factor).toFixed(1)),
    fat: Number((entry.per100.fat * factor).toFixed(1)),
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
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
