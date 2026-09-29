import { describe, expect, it } from "vitest";
import {
  caffeineMg,
  CAFFEINE_DAILY_LIMIT_MG,
  COFFEE_CAFFEINE_MG,
  energySplit,
  ingredientsFromEntries,
  PROTEIN_PER_MEAL_G_PER_KG,
  proteinPerMealTarget,
  weeklyAverage,
  deriveRestDayGoals,
  restDayGoals,
  sessionEnergyKcal,
  suggestNutritionGoals,
  estimatedEnergyRequirement,
  trainingDayGoalsFromAverage,
  type NutritionProfile,
} from "../nutrition";

const man: NutritionProfile = {
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activityLevel: "lowActive",
  sessionsPerWeek: 4,
  goal: "maintain",
  pace: "moderate",
};

describe("sessionEnergyKcal (Compendium: (MET − 1) × kg × h)", () => {
  it("computes the extra energy over resting", () => {
    expect(sessionEnergyKcal(80, 45, 3.5)).toBe(150);
    expect(sessionEnergyKcal(80, 60, 5.8)).toBe(384);
  });
});

describe("suggestNutritionGoals", () => {
  it("uses the 2023 DRI energy equation for the activity level, workouts included", () => {
    // Low active man: 581.47 − 10.83·30 + 8.30·180 + 14.94·80 = 2945.8
    expect(suggestNutritionGoals(man).calories).toBe(2946);
    // Sessions no longer add energy on top: the level already counts them.
    expect(suggestNutritionGoals({ ...man, sessionsPerWeek: 6 }).calories).toBe(2946);
    expect(estimatedEnergyRequirement({ ...man, activityLevel: "inactive" })).toBeCloseTo(
      753.07 - 10.83 * 30 + 6.5 * 180 + 14.1 * 80,
      6,
    );
  });

  it("matches the 2023 tables for women too", () => {
    const woman: NutritionProfile = { ...man, sex: "female", heightCm: 165, weightKg: 62 };
    // Active woman: 710.25 − 7.01·30 + 6.54·165 + 12.34·62 = 2344.3
    expect(suggestNutritionGoals({ ...woman, activityLevel: "active" }).calories).toBe(2344);
  });

  it("gives the user's reported case a PT-comparable cut", () => {
    // 31-year-old man, 97 kg, 190 cm, low active, moderate cut: the old
    // BMR × FAO PAL + sessions model gave ~3,171 kcal; his PT suggested 2,575.
    const g = suggestNutritionGoals({
      ...man,
      age: 31,
      heightCm: 190,
      weightKg: 97,
      goal: "lose",
    });
    // 581.47 − 335.73 + 1577 + 1449.18 = 3271.9, minus 0.0075 · 97 · 7700 / 7 = 800.25
    expect(g.calories).toBe(2472);
  });

  it("cuts by 0.75% bodyweight per week at 7700 kcal/kg for a moderate pace", () => {
    const g = suggestNutritionGoals({ ...man, goal: "lose" });
    expect(g.calories).toBe(2946 - 660);
    expect(g.protein).toBe(176); // 2.2 g/kg
  });

  it("bulks with a 15% surplus and 1.6 g/kg protein", () => {
    const g = suggestNutritionGoals({ ...man, goal: "gain" });
    const maintain = suggestNutritionGoals(man).calories!;
    expect(Math.abs(g.calories! - maintain * 1.15)).toBeLessThanOrEqual(1);
    expect(g.protein).toBe(128);
  });

  it("never goes below the AHA/ACC/TOS floor", () => {
    const small: NutritionProfile = {
      ...man,
      sex: "female",
      age: 45,
      heightCm: 155,
      weightKg: 50,
      activityLevel: "inactive",
      sessionsPerWeek: 0,
      goal: "lose",
      pace: "aggressive",
    };
    expect(suggestNutritionGoals(small).calories).toBe(1200);
    expect(suggestNutritionGoals({ ...small, sex: "male" }).calories).toBe(1500);
  });

  it("uses the WHO salt limit and keeps macros adding up", () => {
    const g = suggestNutritionGoals(man);
    expect(g.salt).toBe(5);
    const kcal = g.protein! * 4 + g.carbs! * 4 + g.fat! * 9;
    expect(Math.abs(kcal - g.calories!)).toBeLessThan(10);
  });
});

describe("rest-day limits", () => {
  const training = { calories: 2600, protein: 180, carbs: 300, fat: 80 };

  it("removes one session's energy from carbs only", () => {
    expect(deriveRestDayGoals(training, 150)).toEqual({
      calories: 2450,
      protein: 180,
      carbs: 263,
      fat: 80,
    });
  });

  it("lets hand-set rest values win", () => {
    expect(restDayGoals(training, { protein: 200 }, 150).protein).toBe(200);
  });

  it("keeps the weekly average on target", () => {
    for (const days of [3, 4, 6]) {
      const t = trainingDayGoalsFromAverage({ calories: 2500, carbs: 280 }, days, 300);
      const r = deriveRestDayGoals(t, 300);
      const avg = (days * t.calories! + (7 - days) * r.calories!) / 7;
      expect(Math.abs(avg - 2500)).toBeLessThanOrEqual(1);
    }
  });
});

describe("protein per meal (Schoenfeld & Aragon 2018)", () => {
  it("is 0.4 g/kg, and nothing without a bodyweight", () => {
    expect(PROTEIN_PER_MEAL_G_PER_KG).toBe(0.4);
    expect(proteinPerMealTarget(82)).toBe(33);
    expect(proteinPerMealTarget(null)).toBeNull();
  });
});

describe("weekly calorie average", () => {
  const d = (key: string, calories: number, logged = true, goal: number | undefined = 2500) => ({
    key,
    calories,
    goal,
    logged,
  });
  it("averages finished logged days only", () => {
    const days = [
      d("2026-09-21", 2400),
      d("2026-09-22", 0, false),
      d("2026-09-23", 2600),
      d("2026-09-24", 900), // today, still going
    ];
    expect(weeklyAverage(days, "2026-09-24")).toEqual({ calories: 2500, goal: 2500, days: 2 });
  });
  it("is null before any finished logged day", () => {
    expect(weeklyAverage([d("2026-09-24", 900)], "2026-09-24")).toBeNull();
  });
  it("has no goal when a counted day has none", () => {
    const noGoal = { key: "2026-09-21", calories: 2000, goal: undefined, logged: true };
    expect(weeklyAverage([noGoal], "2026-09-24")?.goal).toBeNull();
  });
});

describe("ingredientsFromEntries", () => {
  const per100 = { calories: 100, protein: 10, carbs: 5, fat: 2, fiber: 1, salt: 0.1 };
  const base = { id: "a", logged_at: "2026-09-29T12:00:00.000Z", meal: "lunch" as const };

  it("keeps name, portion and values, and drops ids and times", () => {
    const [ing] = ingredientsFromEntries([{ ...base, name: "Rice", grams: 150, per100 }]);
    expect(ing).toEqual({ name: "Rice", grams: 150, per100 });
  });

  it("carries the NEVO mark and copies rather than shares it", () => {
    const entry = { ...base, name: "Banana", grams: 120, per100, nevo: [151] };
    const ing = ingredientsFromEntries([entry])[0]!;
    expect(ing.nevo).toEqual([151]);
    ing.nevo!.push(1);
    ing.per100.calories = 0;
    expect(entry.nevo).toEqual([151]);
    expect(entry.per100.calories).toBe(100);
  });
});

describe("coffee", () => {
  it("uses EFSA's caffeine per drink and 400 mg daily limit", () => {
    expect(COFFEE_CAFFEINE_MG).toEqual({ espresso: 80, filter: 90, milk: 80 });
    expect(CAFFEINE_DAILY_LIMIT_MG).toBe(400);
  });

  it("adds up a day's caffeine", () => {
    expect(caffeineMg([])).toBe(0);
    expect(caffeineMg([{ kind: "espresso" }, { kind: "filter" }, { kind: "milk" }])).toBe(250);
  });
});

describe("energySplit", () => {
  it("splits energy with the EU factors 4/4/9 and sums to 100", () => {
    // 25 g protein = 100, 50 g carbs = 200, 10 g fat = 90 → 390 kcal
    const split = energySplit({ protein: 25, carbs: 50, fat: 10 })!;
    expect(split).toEqual({ protein: 26, carbs: 51, fat: 23 });
    expect(split.protein + split.carbs + split.fat).toBe(100);
  });

  it("returns null without macros", () => {
    expect(energySplit({ protein: 0, carbs: 0, fat: 0 })).toBeNull();
  });
});
