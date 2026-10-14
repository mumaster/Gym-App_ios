import { describe, expect, it } from "vitest";
import { buildWeekRecap, type WeekRecapInput } from "../weekRecap";
import type { FoodEntry } from "../nutrition";

// Saturday 26 Sep 2026, so the week is Mon 21 – Sun 27 Sep.
const now = new Date(2026, 8, 26, 12);
const monday = new Date(2026, 8, 21);

export const carbFood = (day: number, carbs: number, sugars?: number): FoodEntry => ({
  id: `f${day}-${carbs}-${sugars}`,
  name: "Food",
  logged_at: new Date(2026, 8, day, 12).toISOString(),
  meal: "lunch",
  grams: 100,
  per100: {
    calories: 100,
    protein: 1,
    carbs,
    ...(sugars != null ? { sugars } : {}),
    fat: 1,
    fiber: 1,
    salt: 0.1,
  },
});

const base: WeekRecapInput = {
  workouts: [],
  cardioSessions: [],
  foodEntries: [],
  waterEntries: [],
  coffeeEntries: [],
  weightLog: [],
};

describe("buildWeekRecap carbs", () => {
  it("is empty without food", () => {
    const { carbs } = buildWeekRecap(base, monday, now);
    expect(carbs.totalCarbs).toBe(0);
    expect(carbs.totalSugars).toBeNull();
    expect(carbs.sugarsPct).toBeNull();
    expect(carbs.averageCarbs).toBeNull();
    expect(carbs.highestSugars).toBeNull();
  });

  it("sums known sugars and flags an incomplete week", () => {
    const r = buildWeekRecap(
      {
        ...base,
        foodEntries: [carbFood(21, 200, 50), carbFood(22, 100), carbFood(23, 100, 20)],
        sugarGoalFor: () => 40,
      },
      monday,
      now,
    );
    const { carbs } = r;
    expect(carbs.totalCarbs).toBe(400);
    expect(carbs.totalSugars).toBe(70);
    expect(carbs.complete).toBe(false);
    expect(carbs.sugarsPct).toBe(18);
    expect(carbs.averageCarbs).toBe(133);
    expect(carbs.averageSugars).toBe(23);
    expect(carbs.highestSugars).toEqual({ key: "2026-09-21", value: 50 });
    // Tuesday's sugars are unknown, so it can't count as within the goal.
    expect(carbs.daysWithSugarGoal).toBe(2);
    expect(carbs.daysWithinSugarGoal).toBe(1);
    const [mon, tue, wed] = r.days;
    expect(mon).toMatchObject({ carbs: 200, sugars: 50, sugarsComplete: true, sugarGoal: 40 });
    expect(tue).toMatchObject({ carbs: 100, sugars: null, sugarsComplete: false });
    expect(wed!.sugars).toBe(20);
    expect(r.days[3]).toMatchObject({ carbs: 0, sugars: null });
  });

  it("is complete when every food has sugars, and has no peak with one sugar day", () => {
    const { carbs } = buildWeekRecap(
      { ...base, foodEntries: [carbFood(21, 200, 50), carbFood(22, 100, 10)] },
      monday,
      now,
    );
    expect(carbs.complete).toBe(true);
    expect(carbs.daysWithSugarGoal).toBe(0);
    const one = buildWeekRecap({ ...base, foodEntries: [carbFood(21, 200, 50)] }, monday, now);
    expect(one.carbs.highestSugars).toBeNull();
  });
});
