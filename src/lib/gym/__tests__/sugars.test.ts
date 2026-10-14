import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dailyTotals,
  recipePerServing,
  scaledMacros,
  sugarGoalGrams,
  sugarsComplete,
  withSugarGoal,
  type Macros,
} from "../nutrition";
import { lookupBarcode } from "../barcodeLookup";

const food = (carbs: number, sugars?: number): Macros => ({
  calories: 100,
  protein: 5,
  carbs,
  ...(sugars != null ? { sugars } : {}),
  fat: 2,
  fiber: 1,
  salt: 0.1,
});

describe("totals with unknown sugars", () => {
  it("leaves sugars out when no food knows them", () => {
    const total = dailyTotals([{ grams: 100, per100: food(20) }]);
    expect(total.sugars).toBeUndefined();
    expect(scaledMacros({ grams: 50, per100: food(20) }).sugars).toBeUndefined();
  });

  it("sums the known ones and reports the total as incomplete", () => {
    const entries = [
      { grams: 200, per100: food(20, 10) },
      { grams: 100, per100: food(30) },
    ];
    expect(dailyTotals(entries).sugars).toBe(20);
    expect(sugarsComplete(entries)).toBe(false);
  });

  it("is complete when every food with carbs has sugars (or has no carbs)", () => {
    expect(
      sugarsComplete([
        { grams: 100, per100: food(20, 5) },
        { grams: 100, per100: food(0) },
        { grams: 0, per100: food(30) },
      ]),
    ).toBe(true);
  });

  it("scales sugars by grams and never above carbs", () => {
    expect(scaledMacros({ grams: 50, per100: food(20, 8) }).sugars).toBe(4);
    expect(scaledMacros({ grams: 100, per100: food(5, 9) }).sugars).toBe(5);
  });

  it("gives a recipe per-serving sugars only when all ingredients know them", () => {
    const known = {
      id: "r",
      name: "R",
      servings: 2,
      ingredients: [
        { name: "a", grams: 100, per100: food(20, 10) },
        { name: "b", grams: 100, per100: food(10, 2) },
      ],
    };
    expect(recipePerServing(known).sugars).toBe(6);
    const partial = {
      ...known,
      ingredients: [known.ingredients[0]!, { name: "c", grams: 100, per100: food(10) }],
    };
    expect(recipePerServing(partial).sugars).toBeUndefined();
  });
});

describe("sugar goal", () => {
  it("is a share of calories at 4 kcal per gram: 10% of 2000 kcal = 50 g", () => {
    expect(sugarGoalGrams(2000, 0.1)).toBe(50);
    expect(sugarGoalGrams(2000, 0.05)).toBe(25);
    expect(withSugarGoal({ calories: 2000 }, 0.1)).toEqual({ calories: 2000, sugars: 50 });
  });

  it("lets the user's own value win, and does nothing when off", () => {
    const own = { calories: 2000, sugars: 30 };
    expect(withSugarGoal(own, 0.1)).toBe(own);
    const goals = { calories: 2000 };
    expect(withSugarGoal(goals, null)).toBe(goals);
    expect(withSugarGoal({ protein: 150 }, 0.1)).toEqual({ protein: 150 });
  });
});

describe("Open Food Facts sugars", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (nutriments: Record<string, number>) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ status: 1, product: { product_name: "X", nutriments } }),
      })),
    );

  it("reads sugars_100g next to carbohydrates_100g", async () => {
    respond({ "energy-kcal_100g": 400, carbohydrates_100g: 60, sugars_100g: 12.5 });
    const label = await lookupBarcode("sugar-1");
    expect(label?.carbs).toBe(60);
    expect(label?.sugars).toBe(12.5);
  });

  it("keeps a missing sugars_100g unknown, not 0", async () => {
    respond({ "energy-kcal_100g": 400, carbohydrates_100g: 60 });
    const label = await lookupBarcode("sugar-2");
    expect(label?.sugars).toBeNull();
  });
});
