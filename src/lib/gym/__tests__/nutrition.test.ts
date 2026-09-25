import { describe, expect, it } from "vitest";
import {
  deriveRestDayGoals,
  restDayGoals,
  sessionEnergyKcal,
  suggestNutritionGoals,
  trainingDayGoalsFromAverage,
  type NutritionProfile,
} from "../nutrition";

const man: NutritionProfile = {
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activityLevel: "sedentary",
  sessionsPerWeek: 4,
  goal: "maintain",
  pace: "moderate",
};
const session = { minutes: 45, met: 3.5 };

describe("sessionEnergyKcal (Compendium: (MET − 1) × kg × h)", () => {
  it("computes the extra energy over resting", () => {
    expect(sessionEnergyKcal(80, 45, 3.5)).toBe(150);
    expect(sessionEnergyKcal(80, 60, 5.8)).toBe(384);
  });
});

describe("suggestNutritionGoals", () => {
  it("adds training energy on top of BMR × FAO PAL", () => {
    // Mifflin 1780 × 1.55 = 2759 + 4 × 150 / 7 ≈ 2845
    expect(suggestNutritionGoals(man, session).calories).toBe(2845);
  });

  it("cuts by 0.75% bodyweight per week at 7700 kcal/kg for a moderate pace", () => {
    const g = suggestNutritionGoals({ ...man, goal: "lose" }, session);
    expect(g.calories).toBe(2845 - 660);
    expect(g.protein).toBe(176); // 2.2 g/kg
  });

  it("bulks with a 15% surplus and 1.6 g/kg protein", () => {
    const g = suggestNutritionGoals({ ...man, goal: "gain" }, session);
    const maintain = suggestNutritionGoals(man, session).calories!;
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
      sessionsPerWeek: 0,
      goal: "lose",
      pace: "aggressive",
    };
    expect(suggestNutritionGoals(small, session).calories).toBe(1200);
    expect(suggestNutritionGoals({ ...small, sex: "male" }, session).calories).toBe(1500);
  });

  it("uses the WHO salt limit and keeps macros adding up", () => {
    const g = suggestNutritionGoals(man, session);
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
