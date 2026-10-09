import { describe, expect, it } from "vitest";
import { decodeMeal, encodeMeal, mealCodeFrom, mealShareUrl } from "../mealShare";

const meal = {
  name: "Dinner — pasta 🍝",
  ingredients: [
    {
      name: "Pasta",
      grams: 120,
      per100: { calories: 350, protein: 12, carbs: 70, fat: 1.5, fiber: 3, salt: 0.01 },
      nevo: [123],
    },
    {
      name: "Tomatensaus",
      grams: 80,
      per100: { calories: 45, protein: 1.5, carbs: 7, fat: 1, fiber: 1.2, salt: 0.8 },
    },
  ],
};

describe("meal sharing", () => {
  it("round-trips a meal, including unicode names and NEVO codes", () => {
    expect(decodeMeal(encodeMeal(meal))).toEqual(meal);
  });

  it("finds the code in a link, a fragment or a bare code", () => {
    const url = mealShareUrl(meal, "https://app.example");
    const code = encodeMeal(meal);
    expect(mealCodeFrom(url)).toBe(code);
    expect(mealCodeFrom(`#meal=${code}`)).toBe(code);
    expect(mealCodeFrom(code)).toBe(code);
    expect(mealCodeFrom("hello")).toBeNull();
  });

  it("rejects garbage and damaged codes", () => {
    expect(decodeMeal("not a code")).toBeNull();
    expect(decodeMeal(encodeMeal(meal).slice(0, 30))).toBeNull();
    const bad = btoa(JSON.stringify({ v: 1, n: "x", i: [["a", -5, [1, 1, 1, 1, 1, 1]]] }));
    expect(decodeMeal(bad)).toBeNull();
    expect(decodeMeal(btoa(JSON.stringify({ v: 2, n: "x", i: [] })))).toBeNull();
  });
});
