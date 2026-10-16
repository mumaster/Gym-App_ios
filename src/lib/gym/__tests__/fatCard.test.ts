import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FatCard } from "../../../components/gym/WeekRecapCards";
import { GymProvider } from "../store";
import { buildWeekRecap } from "../weekRecap";
import type { FoodEntry } from "../nutrition";

const now = new Date(2026, 8, 26, 12);
const monday = new Date(2026, 8, 21);
const food = (day: number, fat: number, satFat?: number): FoodEntry => ({
  id: `f${day}`,
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

const render = (foodEntries: FoodEntry[]) =>
  renderToString(
    createElement(
      GymProvider,
      null,
      createElement(FatCard, {
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

describe("FatCard", () => {
  it("draws nothing without food", () => {
    expect(render([])).toBe("");
  });

  it("renders seven bars, with the accent as tall as saturated over fat", () => {
    const html = render([food(21, 40, 10), food(22, 50, 40)]);
    expect((html.match(/<li/g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect((html.match(/<button/g) ?? []).length).toBe(7);
    expect(html).toContain("Fat per day");
    expect(html).toContain("Pale is fat, solid is the saturated fat in it.");
    expect(html).not.toContain("at least");
    const accents = [...html.matchAll(/data-bar="satFat"[^>]*style="--bar:([\d.]+)%"/g)].map((m) =>
      Number(m[1]),
    );
    expect(accents).toEqual([25, 80]);
    expect(html).toContain("Monday: 40 g fat, of which 10 g saturated");
  });

  it("says at least when a day lacks saturated fat and shows only the pale bar there", () => {
    const html = render([food(21, 40, 10), food(22, 50)]);
    expect(html).toContain("at least");
    expect(html).toContain("Tuesday: 50 g fat");
    expect((html.match(/data-bar="fat"/g) ?? []).length).toBe(2);
    expect((html.match(/data-bar="satFat"/g) ?? []).length).toBe(1);
  });
});
