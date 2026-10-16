import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const gym = vi.hoisted(() => ({
  state: {
    nutritionGoals: { calories: 2000 } as Record<string, number>,
    sugarGoalShare: null as number | null,
    satFatGoalShare: null as number | null,
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
    satFatGoalShare: gym.state.satFatGoalShare,
    setNutritionGoals: () => {},
    setSugarGoalShare: () => {},
    setSatFatGoalShare: () => {},
    update: () => {},
    plannedCardio: [],
    workouts: [],
    supersetsEnabled: false,
    weightLog: [],
    language: "en",
  }),
}));

import { NutritionGoalsSheet } from "../../../components/gym/NutritionGoalsSheet";

const render = (initialPage: "limits" | "options" = "options") =>
  renderToString(
    createElement(NutritionGoalsSheet, { open: true, onClose: () => {}, initialPage }),
  );

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
  });

  it("asks for a calorie goal when there is none", () => {
    gym.state.nutritionGoals = {};
    gym.state.sugarGoalShare = 0.1;
    expect(render()).toContain("Set a calorie goal first");
    gym.state.nutritionGoals = { calories: 2000 };
  });
});

describe("NutritionGoalsSheet saturated fat goal", () => {
  it("shows the switch, off by default, without the chips", () => {
    gym.state.satFatGoalShare = null;
    const html = render();
    expect(html).toContain("Saturated fat goal");
    expect(html).toMatch(
      /role="switch"[^>]*aria-checked="false"[^>]*aria-label="Saturated fat goal"/,
    );
    expect(html).not.toContain("Custom");
  });

  it("highlights 10% as Recommended when on, with 6%, Custom and grams", () => {
    gym.state.satFatGoalShare = 0.1;
    const html = render();
    expect(html).toContain("10%");
    expect(html).toContain("6%");
    expect(html).toContain("Custom");
    expect(html).toContain("22 g a day");
    expect(html).toContain("13 g a day");
    expect(html).toContain("Recommended");
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>(?:(?!<\/button>).)*10%/);
    expect(html).not.toContain("Percent of calories");
    gym.state.satFatGoalShare = null;
  });

  it("opens the percent field for a custom share", () => {
    gym.state.satFatGoalShare = 0.08;
    const html = render();
    expect(html).toContain("Percent of calories");
    expect(html).toContain('value="8"');
    expect(html).toContain("18 g a day");
    gym.state.satFatGoalShare = null;
  });

  it("asks for a calorie goal when there is none", () => {
    gym.state.nutritionGoals = {};
    gym.state.satFatGoalShare = 0.1;
    expect(render()).toContain("Set a calorie goal first: the saturated fat");
    gym.state.nutritionGoals = { calories: 2000 };
    gym.state.satFatGoalShare = null;
  });

  it("warns when it takes more than half of the fat limit", () => {
    gym.state.nutritionGoals = { calories: 2000, fat: 40 };
    gym.state.satFatGoalShare = 0.1;
    expect(render()).toContain("more than half of your fat limit");
    gym.state.nutritionGoals = { calories: 2000 };
    gym.state.satFatGoalShare = null;
  });
});

describe("NutritionGoalsSheet sub tabs", () => {
  it("limits tab shows the suggest button and fields, not the options", () => {
    const html = render("limits");
    expect(html).toContain("Suggest my limits");
    expect(html).toContain("No limit");
    expect(html).not.toContain("Sugar goal");
    expect(html).not.toContain("Saturated fat goal");
    expect(html).not.toContain("Weekend budget");
  });

  it("options tab shows the three options with an info button each", () => {
    const html = render("options");
    expect(html).toContain("Different limits on training and rest days");
    expect(html).toContain("Sugar goal");
    expect(html).toContain("Weekend budget");
    expect(html).not.toContain("Suggest my limits");
    expect(html).toContain('aria-label="About the sugar goal"');
    expect(html).toContain('aria-label="About the weekend budget"');
    expect(html).toContain('aria-label="About training and rest days"');
    // explanations stay hidden until the (i) is tapped
    expect(html).not.toContain("health guide");
    expect(html).not.toContain("weekly average stays");
  });
});
