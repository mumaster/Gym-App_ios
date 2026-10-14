import { describe, expect, it } from "vitest";
import { decodeMeal, encodeMeal, mealCodeFrom, mealShareUrl, toBase64Url } from "../mealShare";

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

describe("meal sharing with sugars", () => {
  const withSugarsMeal = {
    name: "Breakfast",
    ingredients: [
      {
        name: "Yoghurt",
        grams: 150,
        per100: { calories: 60, protein: 4, carbs: 6, sugars: 5.5, fat: 2, fiber: 0, salt: 0.1 },
        nevo: [77],
      },
      {
        name: "Muesli",
        grams: 40,
        per100: { calories: 370, protein: 9, carbs: 60, sugars: 14, fat: 7, fiber: 8, salt: 0.05 },
      },
      {
        name: "Mystery",
        grams: 10,
        per100: { calories: 100, protein: 1, carbs: 20, fat: 1, fiber: 0, salt: 0 },
      },
    ],
  };

  it("round-trips sugars where known and leaves them out where not", () => {
    const back = decodeMeal(encodeMeal(withSugarsMeal));
    expect(back).toEqual(withSugarsMeal);
    expect("sugars" in back!.ingredients[2]!.per100).toBe(false);
  });

  it("decodes a link made before sugars existed, with unknown sugars", () => {
    const old = decodeMeal(encodeMeal(meal))!;
    for (const ing of old.ingredients) expect(ing.per100.sugars).toBeUndefined();
  });

  it("keeps sugars at or below carbs from a hand-made link", () => {
    const code = toBase64Url(
      JSON.stringify({ v: 1, n: "x", i: [["Cola", 100, [42, 0, 10, 0, 0, 0], [], 99]] }),
    );
    expect(decodeMeal(code)!.ingredients[0]!.per100.sugars).toBe(10);
  });
});
