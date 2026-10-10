import { describe, expect, it } from "vitest";
import { buildWeekRecap, parseWeekKey, weekKeyOf, type WeekRecapInput } from "../weekRecap";
import type { FoodEntry } from "../nutrition";
import type { Workout } from "../types";

// Saturday 26 Sep 2026, so the week is Mon 21 – Sun 27 Sep.
const now = new Date(2026, 8, 26, 12);
const monday = new Date(2026, 8, 21);

const food = (day: number, kcal: number, id = `f${day}-${kcal}`): FoodEntry => ({
  id,
  name: "Food",
  logged_at: new Date(2026, 8, day, 12).toISOString(),
  meal: "lunch",
  grams: 100,
  per100: { calories: kcal, protein: 20, carbs: 30, fat: 10, fiber: 2, salt: 0.5 },
});

const workout = (day: number, id: string): Workout => ({
  id,
  date: new Date(2026, 8, day, 18).toISOString(),
  duration_minutes: 45,
  target_muscles: [],
  plan: [],
  completed_sets: [
    { exercise_id: "bench-press", set_type: "working", weight: 100, reps: 5, completed_at: "" },
  ] as unknown as Workout["completed_sets"],
  finished: true,
  unit: "kg",
});

const base: WeekRecapInput = {
  workouts: [],
  cardioSessions: [],
  foodEntries: [],
  waterEntries: [],
  coffeeEntries: [],
  weightLog: [],
};

describe("week keys", () => {
  it("keys a week by its Monday and rejects anything else", () => {
    expect(weekKeyOf(new Date(2026, 8, 27))).toBe("2026-09-21");
    expect(parseWeekKey("2026-09-21")?.getDate()).toBe(21);
    expect(parseWeekKey("2026-09-22")).toBeNull();
    expect(parseWeekKey("nope")).toBeNull();
  });
});

describe("buildWeekRecap", () => {
  it("is empty for a week with nothing in it", () => {
    const r = buildWeekRecap(base, monday, now);
    expect(r.hasData).toBe(false);
    expect(r.nutrition.average).toBeNull();
    expect(r.weight).toBeNull();
  });

  it("marks a week in progress and counts the days that have started", () => {
    const r = buildWeekRecap(base, monday, now);
    expect(r.inProgress).toBe(true);
    expect(r.daysElapsed).toBe(6);
    expect(r.days.map((d) => d.future)).toEqual([false, false, false, false, false, false, true]);
    const past = buildWeekRecap(base, new Date(2026, 8, 14), now);
    expect(past.inProgress).toBe(false);
    expect(past.daysElapsed).toBe(7);
  });

  it("averages calories over logged days, leaving out today while it is going", () => {
    const r = buildWeekRecap(
      { ...base, foodEntries: [food(21, 2000), food(22, 2400), food(26, 500)] },
      monday,
      now,
    );
    expect(r.nutrition.loggedDays).toBe(3);
    expect(r.nutrition.countedDays).toBe(2);
    expect(r.nutrition.average?.calories).toBe(2200);
    expect(r.nutrition.totals.calories).toBe(4900);
  });

  it("uses today when it is the only logged day", () => {
    const r = buildWeekRecap({ ...base, foodEntries: [food(26, 800)] }, monday, now);
    expect(r.nutrition.average?.calories).toBe(800);
  });

  it("averages the limits of the same days and counts days within them", () => {
    const r = buildWeekRecap(
      { ...base, foodEntries: [food(21, 2000), food(22, 2600)], calorieGoalFor: () => 2400 },
      monday,
      now,
    );
    expect(r.nutrition.calorieGoal).toBe(2400);
    expect(r.nutrition.daysWithinGoal).toBe(1);
  });

  it("sums strength sessions, sets and volume", () => {
    const r = buildWeekRecap(
      {
        ...base,
        workouts: [workout(21, "a"), workout(21, "b"), workout(23, "c"), workout(14, "x")],
      },
      monday,
      now,
    );
    expect(r.training.sessions).toBe(3);
    expect(r.training.days).toBe(2);
    expect(r.training.workingSets).toBe(3);
    expect(r.training.volumeKg).toBe(1500);
  });

  it("summarises water, coffee and weight", () => {
    const at = (day: number) => new Date(2026, 8, day, 9).toISOString();
    const r = buildWeekRecap(
      {
        ...base,
        waterGoalMl: 2000,
        waterEntries: [
          { id: "1", ml: 1500, logged_at: at(21) },
          { id: "2", ml: 750, logged_at: at(21) },
          { id: "3", ml: 1000, logged_at: at(22) },
        ],
        coffeeEntries: [
          { id: "c1", kind: "espresso", logged_at: at(21) },
          { id: "c2", kind: "filter", logged_at: at(21) },
        ],
        weightLog: [
          { id: "w1", date: at(22), kg: 80.4 },
          { id: "w2", date: at(25), kg: 79.8 },
        ],
      },
      monday,
      now,
    );
    expect(r.water.totalMl).toBe(3250);
    expect(r.water.averageMl).toBe(1625);
    expect(r.water.daysOnGoal).toBe(1);
    expect(r.coffee.cups).toBe(2);
    expect(r.coffee.daysLogged).toBe(1);
    expect(r.weight).toEqual({ first: 80.4, last: 79.8, change: -0.6, weighIns: 2 });
  });

  it("breaks drinks down per day and finds the busiest day", () => {
    const at = (day: number) => new Date(2026, 8, day, 9).toISOString();
    const drink = (day: number, id: string, drinkId: string, ml: number): FoodEntry => ({
      ...food(day, 40, id),
      grams: ml,
      drink: drinkId,
    });
    const r = buildWeekRecap(
      {
        ...base,
        waterEntries: [
          { id: "1", ml: 500, logged_at: at(21) },
          { id: "2", ml: 1500, logged_at: at(22) },
        ],
        coffeeEntries: [
          { id: "c1", kind: "espresso", logged_at: at(21) },
          { id: "c2", kind: "espresso", logged_at: at(22) },
          { id: "c3", kind: "espresso", logged_at: at(22) },
          { id: "c4", kind: "milk", logged_at: at(22) },
        ],
        foodEntries: [
          drink(25, "d1", "pils", 330),
          drink(25, "d2", "pils", 330),
          drink(25, "d3", "redWine", 125),
        ],
      },
      monday,
      now,
    );
    const tue = r.days[1]!;
    expect(tue.waterMl).toBe(1500);
    expect(tue.coffeeCups).toBe(3);
    expect(tue.coffeeByKind).toEqual({ espresso: 2, filter: 0, milk: 1 });
    expect(r.days[4]).toMatchObject({ beers: 2, wines: 1 });
    expect(r.coffee.byKind.espresso).toBe(3);
    expect(r.coffee.favourite).toBe("espresso");
    expect(r.coffee.busiest).toEqual({ key: tue.key, value: 3 });
    expect(r.water.busiest).toEqual({ key: tue.key, value: 1500 });
    expect(r.alcohol).toMatchObject({ beers: 2, wines: 1 });
    // One day with drinks is trivially the busiest, so no fact for it.
    expect(r.alcohol.busiest).toBeNull();
  });

  it("only names a peak when two or more sessions or days compete", () => {
    const one = buildWeekRecap({ ...base, workouts: [workout(21, "a")] }, monday, now);
    expect(one.training.heaviest).toBeNull();
    const two = buildWeekRecap(
      { ...base, workouts: [workout(21, "a"), workout(23, "b")] },
      monday,
      now,
    );
    expect(two.training.heaviest).not.toBeNull();
    const kcal = buildWeekRecap(
      { ...base, foodEntries: [food(21, 400), food(22, 900)] },
      monday,
      now,
    );
    expect(kcal.nutrition.highest).toEqual({ key: "2026-09-22", value: 900 * 1 });
  });
});
