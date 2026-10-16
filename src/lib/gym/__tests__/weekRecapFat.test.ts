import { describe, expect, it } from "vitest";
import { buildWeekRecap, type WeekRecapInput } from "../weekRecap";
import type { FoodEntry } from "../nutrition";

// Saturday 26 Sep 2026, so the week is Mon 21 – Sun 27 Sep.
const now = new Date(2026, 8, 26, 12);
const monday = new Date(2026, 8, 21);

const fatFood = (day: number, fat: number, satFat?: number): FoodEntry => ({
  id: `f${day}-${fat}-${satFat}`,
  name: "Food",
  logged_at: new Date(2026, 8, day, 12).toISOString(),
  meal: "lunch",
  grams: 100,
  per100: {
    calories: 100,
    protein: 1,
    carbs: 1,
    fat,
    ...(satFat != null ? { satFat } : {}),
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

describe("buildWeekRecap fat", () => {
  it("is empty without food", () => {
    const { fat } = buildWeekRecap(base, monday, now);
    expect(fat.totalFat).toBe(0);
    expect(fat.totalSatFat).toBeNull();
    expect(fat.satFatPct).toBeNull();
    expect(fat.averageFat).toBeNull();
    expect(fat.averageSatFat).toBeNull();
    expect(fat.highestSatFat).toBeNull();
    expect(fat.daysWithSatFatGoal).toBe(0);
  });

  it("sums known saturated fat and flags an incomplete week", () => {
    const r = buildWeekRecap(
      {
        ...base,
        foodEntries: [fatFood(21, 40, 15), fatFood(22, 20), fatFood(23, 30, 5)],
        satFatGoalFor: () => 10,
      },
      monday,
      now,
    );
    const { fat } = r;
    expect(fat.totalFat).toBe(90);
    expect(fat.totalSatFat).toBe(20);
    expect(fat.complete).toBe(false);
    expect(fat.satFatPct).toBe(22);
    expect(fat.averageFat).toBe(30);
    expect(fat.averageSatFat).toBe(7);
    expect(fat.highestSatFat).toEqual({ key: "2026-09-21", value: 15 });
    // Tuesday's saturated fat is unknown, so it can't count as within the goal.
    expect(fat.daysWithSatFatGoal).toBe(2);
    expect(fat.daysWithinSatFatGoal).toBe(1);
    const [mon, tue, wed] = r.days;
    expect(mon).toMatchObject({ fat: 40, satFat: 15, satFatComplete: true, satFatGoal: 10 });
    expect(tue).toMatchObject({ fat: 20, satFat: null, satFatComplete: false });
    expect(wed!.satFat).toBe(5);
    expect(r.days[3]).toMatchObject({ fat: 0, satFat: null });
  });

  it("does not count a day with only some saturated fat known as within goal", () => {
    const { fat } = buildWeekRecap(
      {
        ...base,
        foodEntries: [fatFood(21, 10, 1), fatFood(21, 10), fatFood(22, 10, 1)],
        satFatGoalFor: () => 10,
      },
      monday,
      now,
    );
    expect(fat.daysWithSatFatGoal).toBe(1);
    expect(fat.daysWithinSatFatGoal).toBe(1);
  });

  it("is complete when every food has it, and has no peak with one such day", () => {
    const { fat } = buildWeekRecap(
      { ...base, foodEntries: [fatFood(21, 40, 15), fatFood(22, 20, 4)] },
      monday,
      now,
    );
    expect(fat.complete).toBe(true);
    expect(fat.daysWithSatFatGoal).toBe(0);
    const one = buildWeekRecap({ ...base, foodEntries: [fatFood(21, 40, 15)] }, monday, now);
    expect(one.fat.highestSatFat).toBeNull();
  });
});
