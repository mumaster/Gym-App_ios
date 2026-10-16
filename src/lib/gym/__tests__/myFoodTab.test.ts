import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MyFoodTab } from "../../../components/gym/MyFoodTab";
import { MyFoodEditSheet } from "../../../components/gym/MyFoodEditSheet";
import { deleteSavedFood, editSavedFood, savedFoods, type MyFood } from "../myFoods";
import { GymProvider } from "../store";
import type { MealIngredient, Macros } from "../nutrition";

const macros = (calories: number, extra: Partial<Macros> = {}): Macros => ({
  calories,
  protein: 10,
  carbs: 20,
  fat: 5,
  fiber: 1,
  salt: 0.1,
  ...extra,
});
const mine = (name: string, extra: Partial<MyFood> = {}): MyFood => ({
  name,
  grams: 100,
  per100: macros(100),
  lastUsed: "2026-10-01T10:00:00.000Z",
  uses: 2,
  ...extra,
});
const fav = (name: string): MealIngredient => ({ name, grams: 50, per100: macros(200) });

const seed = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("../store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../store")>();
  return { ...actual, useGym: () => ({ ...actual.useGym(), ...seed.state }) };
});

describe("savedFoods", () => {
  it("lists the library plus favourites that aren't in it, once each, by name", () => {
    const list = savedFoods([mine("Skyr"), mine("apple")], [fav("Banana"), fav("skyr")]);
    expect(list.map((f) => f.name)).toEqual(["apple", "Banana", "Skyr"]);
    expect(list.find((f) => f.name === "Skyr")?.favorite).toBe(true);
    expect(list.find((f) => f.name === "apple")?.favorite).toBe(false);
  });
});

describe("editSavedFood / deleteSavedFood", () => {
  it("edits the library entry in place, keeping barcode and usage, and the favourite too", () => {
    const lists = {
      myFoods: [mine("A"), mine("Skyr", { barcode: "123", uses: 7 })],
      favoriteFoods: [fav("skyr")],
    };
    const next = { name: "Skyr naturel", grams: 150, per100: macros(60, { satFat: 0.1 }) };
    const out = editSavedFood(lists, lists.myFoods[1]!, next, "now");
    expect(out.myFoods.map((f) => f.name)).toEqual(["A", "Skyr naturel"]);
    expect(out.myFoods[1]).toMatchObject({ barcode: "123", uses: 7, grams: 150 });
    expect(out.myFoods[1]!.per100.satFat).toBe(0.1);
    expect(out.favoriteFoods).toEqual([next]);
  });

  it("moves a favourite-only food into the library when edited", () => {
    const lists = { myFoods: [], favoriteFoods: [fav("Banana")] };
    const out = editSavedFood(lists, { name: "Banana" }, fav("Banana x"), "now");
    expect(out.myFoods.map((f) => f.name)).toEqual(["Banana x"]);
    expect(out.favoriteFoods.map((f) => f.name)).toEqual(["Banana x"]);
  });

  it("deletes from both lists", () => {
    const lists = { myFoods: [mine("Skyr"), mine("B")], favoriteFoods: [fav("Skyr")] };
    const out = deleteSavedFood(lists, { name: "Skyr" });
    expect(out.myFoods.map((f) => f.name)).toEqual(["B"]);
    expect(out.favoriteFoods).toEqual([]);
  });
});

describe("MyFoodTab", () => {
  const render = () => renderToString(createElement(GymProvider, null, createElement(MyFoodTab)));

  it("shows the count, the foods, saved meals and recipes", () => {
    seed.state = {
      myFoods: [mine("Skyr"), mine("Oats")],
      favoriteFoods: [fav("Banana")],
      mealTemplates: [{ id: "m", name: "Breakfast bowl", ingredients: [fav("a"), fav("b")] }],
      recipes: [{ id: "r", name: "Chili", servings: 4, ingredients: [fav("a")] }],
    };
    const html = render();
    expect(html).toContain("3 foods saved");
    for (const name of ["Skyr", "Oats", "Banana", "Breakfast bowl", "Chili"])
      expect(html).toContain(name);
    expect(html).toContain("Add a food");
  });

  it("shows an empty message with nothing saved", () => {
    seed.state = { myFoods: [], favoriteFoods: [], mealTemplates: [], recipes: [] };
    const html = render();
    expect(html).toContain("0 foods saved");
    expect(html).toContain("No saved foods yet");
  });
});

describe("MyFoodEditSheet", () => {
  it("renders the label rows with sugars and saturated fat, and a delete button when editing", () => {
    const food = {
      ...mine("Skyr", { per100: macros(60, { sugars: 4, satFat: 0.2 }) }),
      favorite: false,
    };
    const html = renderToString(
      createElement(
        GymProvider,
        null,
        createElement(MyFoodEditSheet, {
          open: true,
          food,
          onClose: () => {},
          onSave: () => {},
          onDelete: () => {},
        }),
      ),
    );
    expect(html).toContain("Edit food");
    expect(html).toContain("Of which saturated");
    expect(html).toContain("Of which sugars");
    expect(html).toContain("Delete food");
  });
});
