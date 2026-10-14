import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const gym = vi.hoisted(() => ({
  state: {
    nutritionGoals: { calories: 2000 } as Record<string, number>,
    sugarGoalShare: null as number | null,
  },
}));

// The sheet's state starts from the store, so a fake store is enough to
// render both the off and on states without clicking.
vi.mock("../store", () => ({
  haptic: () => {},
  useGym: () => ({
    nutritionGoals: gym.state.nutritionGoals,
    nutritionByDayType: false,
    nutritionProfile: null,
    restDayGoalOverrides: {},
    sugarGoalShare: gym.state.sugarGoalShare,
    setNutritionGoals: () => {},
    setSugarGoalShare: () => {},
    update: () => {},
    plannedCardio: [],
    workouts: [],
    supersetsEnabled: false,
    weightLog: [],
    language: "en",
  }),
}));

import { NutritionGoalsSheet } from "../../../components/gym/NutritionGoalsSheet";

const render = () =>
  renderToString(createElement(NutritionGoalsSheet, { open: true, onClose: () => {} }));

describe("NutritionGoalsSheet sugar goal", () => {
  it("shows the switch, off by default, without the shares", () => {
    gym.state.sugarGoalShare = null;
    const html = render();
    expect(html).toContain("Sugar goal");
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"[^>]*aria-label="Sugar goal"/);
    expect(html).not.toContain("10% of calories");
  });

  it("shows 10% and 5% with their grams, and the caveat, when on", () => {
    gym.state.sugarGoalShare = 0.1;
    const html = render();
    expect(html).toContain("10% of calories");
    expect(html).toContain("5% of calories");
    expect(html).toContain("50 g a day");
    expect(html).toContain("25 g a day");
    expect(html).toContain("Recommended");
    expect(html).toContain("A health guide, not a training lever.");
  });

  it("asks for a calorie goal when there is none", () => {
    gym.state.nutritionGoals = {};
    gym.state.sugarGoalShare = 0.1;
    expect(render()).toContain("Set a calorie goal first");
    gym.state.nutritionGoals = { calories: 2000 };
  });
});
