import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SATFAT_GOAL_SHARES,
  cleanSatFat,
  dailyTotals,
  recipePerServing,
  restDayGoals,
  satFatComplete,
  satFatGoalGrams,
  satFatGoalTakesMostOfFat,
  scaledMacros,
  withEnergyShift,
  withSatFat,
  withSatFatGoal,
  withSugarGoal,
  type Macros,
} from "../nutrition";
import { lookupBarcode } from "../barcodeLookup";

const food = (fat: number, satFat?: number): Macros => ({
  calories: 100,
  protein: 5,
  carbs: 10,
  fat,
  ...(satFat != null ? { satFat } : {}),
  fiber: 1,
  salt: 0.1,
});

describe("cleanSatFat and withSatFat", () => {
  it("is unknown for null, NaN and negatives, and never above fat", () => {
    expect(cleanSatFat(null, 10)).toBeUndefined();
    expect(cleanSatFat(undefined, 10)).toBeUndefined();
    expect(cleanSatFat(Number.NaN, 10)).toBeUndefined();
    expect(cleanSatFat(-1, 10)).toBeUndefined();
    expect(cleanSatFat(0, 10)).toBe(0);
    expect(cleanSatFat(4, 10)).toBe(4);
    expect(cleanSatFat(12, 10)).toBe(10);
  });

  it("drops the key when unknown instead of storing undefined", () => {
    const out = withSatFat(food(10, 3), null);
    expect("satFat" in out).toBe(false);
    expect(withSatFat(food(10), 4).satFat).toBe(4);
    expect(withSatFat(food(10, 3), 20).satFat).toBe(10);
  });
});

describe("totals with unknown saturated fat", () => {
  it("leaves it out when no food knows it", () => {
    expect(dailyTotals([{ grams: 100, per100: food(10) }]).satFat).toBeUndefined();
    expect(scaledMacros({ grams: 50, per100: food(10) }).satFat).toBeUndefined();
  });

  it("sums the known ones and reports the total as incomplete", () => {
    const entries = [
      { grams: 200, per100: food(10, 4) },
      { grams: 100, per100: food(8) },
    ];
    expect(dailyTotals(entries).satFat).toBe(8);
    expect(satFatComplete(entries)).toBe(false);
  });

  it("is complete when every food with fat has it (or has no fat, or no grams)", () => {
    expect(
      satFatComplete([
        { grams: 100, per100: food(10, 3) },
        { grams: 100, per100: food(0) },
        { grams: 0, per100: food(8) },
      ]),
    ).toBe(true);
  });

  it("scales by grams and never above fat", () => {
    expect(scaledMacros({ grams: 50, per100: food(10, 4) }).satFat).toBe(2);
    expect(scaledMacros({ grams: 100, per100: food(3, 9) }).satFat).toBe(3);
  });

  it("gives a recipe per-serving saturated fat only when all ingredients know it", () => {
    const known = {
      id: "r",
      name: "R",
      servings: 2,
      ingredients: [
        { name: "a", grams: 100, per100: food(10, 6) },
        { name: "b", grams: 100, per100: food(4, 2) },
      ],
    };
    expect(recipePerServing(known).satFat).toBe(4);
    const partial = {
      ...known,
      ingredients: [known.ingredients[0]!, { name: "c", grams: 100, per100: food(5) }],
    };
    expect(recipePerServing(partial).satFat).toBeUndefined();
  });
});

describe("saturated fat goal", () => {
  it("offers 10% and 6%, at 9 kcal per gram: 10% of 2000 kcal = 22 g", () => {
    expect(SATFAT_GOAL_SHARES).toEqual([0.1, 0.06]);
    expect(satFatGoalGrams(2000, 0.1)).toBe(22);
    expect(satFatGoalGrams(2000, 0.06)).toBe(13);
    expect(satFatGoalGrams(2000, 0.13)).toBe(29);
    expect(withSatFatGoal({ calories: 2000 }, 0.1, 2000)).toEqual({ calories: 2000, satFat: 22 });
  });

  it("lets the user's own value win, and does nothing when off or without calories", () => {
    const own = { calories: 2000, satFat: 15 };
    expect(withSatFatGoal(own, 0.1, 2000)).toBe(own);
    const goals = { calories: 2000 };
    expect(withSatFatGoal(goals, null, 2000)).toBe(goals);
    expect(withSatFatGoal(goals, 0, 2000)).toBe(goals);
    expect(withSatFatGoal({ protein: 150 }, 0.1, undefined)).toEqual({ protein: 150 });
    expect(withSatFatGoal({ protein: 150 }, 0.1, null)).toEqual({ protein: 150 });
  });

  it("works from the base calories even when the goals have none of their own", () => {
    expect(withSatFatGoal({ protein: 150 }, 0.1, 2500)).toEqual({ protein: 150, satFat: 28 });
  });

  it("is capped at the fat goal", () => {
    expect(withSatFatGoal({ calories: 2000, fat: 15 }, 0.1, 2000).satFat).toBe(15);
    expect(withSatFatGoal({ calories: 2000, fat: 70 }, 0.1, 2000).satFat).toBe(22);
  });

  it("gives training, rest and weekend-budget days the same grams", () => {
    const training = { calories: 2400, protein: 160, fat: 80 };
    const base = training.calories;
    const rest = restDayGoals(training, {}, 0);
    const shifted = withEnergyShift(training, 300);
    const days = [training, rest, shifted].map((g) => withSatFatGoal(g, 0.1, base).satFat);
    expect(days).toEqual([27, 27, 27]);
    // Sugars, by contrast, follow each day's own calories.
    expect(withSugarGoal(shifted, 0.1).sugars).not.toBe(withSugarGoal(training, 0.1).sugars);
  });

  it("flags a goal that takes more than half of the fat goal", () => {
    expect(satFatGoalTakesMostOfFat({ fat: 60, satFat: 31 })).toBe(true);
    expect(satFatGoalTakesMostOfFat({ fat: 60, satFat: 30 })).toBe(false);
    expect(satFatGoalTakesMostOfFat({ satFat: 30 })).toBe(false);
    expect(satFatGoalTakesMostOfFat({ fat: 60 })).toBe(false);
  });
});

describe("Open Food Facts saturated fat", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (nutriments: Record<string, number>) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ status: 1, product: { product_name: "X", nutriments } }),
      })),
    );

  it("reads saturated-fat_100g next to fat_100g", async () => {
    respond({ "energy-kcal_100g": 500, fat_100g: 30, "saturated-fat_100g": 12.5 });
    const label = await lookupBarcode("satfat-1");
    expect(label?.fat).toBe(30);
    expect(label?.saturatedFat).toBe(12.5);
  });

  it("keeps a missing saturated-fat_100g unknown, not 0", async () => {
    respond({ "energy-kcal_100g": 500, fat_100g: 30 });
    const label = await lookupBarcode("satfat-2");
    expect(label?.saturatedFat).toBeNull();
  });
});
