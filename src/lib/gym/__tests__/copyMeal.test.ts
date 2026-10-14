import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CopyMealSheet } from "../../../components/gym/MealShareSheets";
import { MealOverviewSheet } from "../../../components/gym/MealOverviewSheet";
import { GymProvider } from "../store";
import type { FoodEntry } from "../nutrition";

const entry: FoodEntry = {
  id: "1",
  name: "Oats",
  logged_at: new Date().toISOString(),
  meal: "breakfast",
  grams: 50,
  per100: { calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10, salt: 0 },
};
const render = (node: ReturnType<typeof createElement>) =>
  renderToString(createElement(GymProvider, null, node));

describe("copy a meal to another meal", () => {
  it("shows a Copy to button in the meal overview when the meal has foods", () => {
    const html = render(
      createElement(MealOverviewSheet, {
        meal: "breakfast",
        entries: [entry],
        dayTotals: entry.per100,
        goals: {} as never,
        proteinTarget: null,
        dayLabel: "Today",
        canAdd: true,
        onClose: () => {},
        onAdd: () => {},
        onSaveAsMeal: () => {},
        onShare: () => {},
        onCopy: () => {},
        onEdit: () => {},
      }),
    );
    expect(html).toContain("Copy to");
  });

  it("renders the target picker with all four meals and a day field", () => {
    const html = render(
      createElement(CopyMealSheet, {
        meal: "breakfast",
        entries: [entry],
        day: "2026-10-14",
        onClose: () => {},
      }),
    );
    for (const m of ["Breakfast", "Lunch", "Dinner", "Snack"]) expect(html).toContain(m);
    expect(html).toContain('type="date"');
    expect(html).toContain("2026-10-14");
  });
});
