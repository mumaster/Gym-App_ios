import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarbsCard } from "../../../components/gym/WeekRecapCards";
import { GymProvider } from "../store";
import { buildWeekRecap } from "../weekRecap";
import type { FoodEntry } from "../nutrition";

const now = new Date(2026, 8, 26, 12);
const monday = new Date(2026, 8, 21);
const food = (day: number, carbs: number, sugars?: number): FoodEntry => ({
  id: `f${day}`,
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

const render = (foodEntries: FoodEntry[]) =>
  renderToString(
    createElement(
      GymProvider,
      null,
      createElement(CarbsCard, {
        recap: buildWeekRecap(
          {
            workouts: [],
            cardioSessions: [],
            foodEntries,
            waterEntries: [],
            coffeeEntries: [],
            weightLog: [],
          },
          monday,
          now,
        ),
      }),
    ),
  );

describe("CarbsCard", () => {
  it("draws nothing without food", () => {
    expect(render([])).toBe("");
  });

  it("renders seven bars, with the accent as tall as sugars over carbs", () => {
    const html = render([food(21, 200, 50), food(22, 100, 80)]);
    expect((html.match(/<li/g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect((html.match(/<button/g) ?? []).length).toBe(7);
    expect(html).toContain("Carbs per day");
    expect(html).toContain("Pale is carbs, solid is the sugars in them.");
    expect(html).not.toContain("at least");
    const accents = [
      ...html.matchAll(/data-bar="sugars"[^>]*style="height:max\(8px, ([\d.]+)%\)/g),
    ].map((m) => Number(m[1]));
    expect(accents).toEqual([25, 80]);
    expect(html).toContain("Monday: 200 g carbs, of which 50 g sugars");
  });

  it("says at least when a day lacks sugars and shows only the pale bar there", () => {
    const html = render([food(21, 200, 50), food(22, 100)]);
    expect(html).toContain("at least");
    expect(html).toContain("Tuesday: 100 g carbs");
    expect((html.match(/data-bar="carbs"/g) ?? []).length).toBe(2);
    expect((html.match(/data-bar="sugars"/g) ?? []).length).toBe(1);
  });
});
