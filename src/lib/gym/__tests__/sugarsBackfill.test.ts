import { describe, expect, it } from "vitest";
import {
  applyBarcodeSugars,
  applySugarsBackfill,
  backfillFromMyFoods,
  backfillNevoSugars,
  fetchBarcodeSugars,
  type NevoLookup,
  type SugarsBackfillFoods,
} from "../sugarsBackfill";
import type { ScannedLabel } from "../labelScan";
import type { MyFood } from "../myFoods";
import type { Macros } from "../nutrition";

const m = (carbs: number, sugars?: number): Macros => ({
  calories: 100,
  protein: 5,
  carbs,
  ...(sugars != null ? { sugars } : {}),
  fat: 2,
  fiber: 1,
  salt: 0.1,
});

const empty: SugarsBackfillFoods = {
  foodEntries: [],
  favoriteFoods: [],
  mealTemplates: [],
  recipes: [],
  myFoods: [],
};

const entry = (name: string, per100: Macros, nevo?: number[]) => ({
  id: name,
  name,
  logged_at: "2026-01-01T10:00:00.000Z",
  meal: "lunch" as const,
  grams: 100,
  per100,
  ...(nevo ? { nevo } : {}),
});

const label = (
  carbs: number | null,
  sugars: number | null,
  fat: number | null = 1,
  saturatedFat: number | null = null,
): ScannedLabel => ({
  name: "x",
  calories: 100,
  protein: 1,
  carbs,
  sugars,
  fat,
  saturatedFat,
  fiber: 0,
  salt: 0,
  servingSizeGrams: null,
});

const nevoTable: NevoLookup = (code) => (code === 1 ? m(20, 12) : code === 2 ? m(20) : undefined);

describe("NEVO sugars backfill", () => {
  it("fills single-code items whose carbs still match NEVO, in all four places", () => {
    const foods: SugarsBackfillFoods = {
      ...empty,
      foodEntries: [entry("Apple", m(20), [1])],
      favoriteFoods: [{ name: "Apple", grams: 100, per100: m(20), nevo: [1] }],
      mealTemplates: [
        {
          id: "t",
          name: "T",
          ingredients: [{ name: "Apple", grams: 50, per100: m(20), nevo: [1] }],
        },
      ],
      recipes: [
        {
          id: "r",
          name: "R",
          servings: 1,
          ingredients: [{ name: "Apple", grams: 50, per100: m(20), nevo: [1] }],
        },
      ],
    };
    const out = backfillNevoSugars(foods, nevoTable);
    expect(out.foodEntries[0]!.per100.sugars).toBe(12);
    expect(out.favoriteFoods[0]!.per100.sugars).toBe(12);
    expect(out.mealTemplates[0]!.ingredients[0]!.per100.sugars).toBe(12);
    expect(out.recipes[0]!.ingredients[0]!.per100.sugars).toBe(12);
  });

  it("skips edited values, several codes, no NEVO sugars and unknown codes", () => {
    const foods: SugarsBackfillFoods = {
      ...empty,
      foodEntries: [
        entry("Edited", m(25), [1]),
        entry("Recipe", m(20), [1, 3]),
        entry("NoSugars", m(20), [2]),
        entry("Unknown", m(20), [99]),
        entry("Plain", m(20)),
      ],
    };
    const out = backfillNevoSugars(foods, nevoTable);
    expect(out).toBe(foods);
    for (const e of out.foodEntries) expect("sugars" in e.per100).toBe(false);
  });

  it("is a no-op with a table that has no sugars, and idempotent", () => {
    const foods = { ...empty, foodEntries: [entry("Apple", m(20), [1])] };
    expect(backfillNevoSugars(foods, () => m(20))).toBe(foods);
    const once = backfillNevoSugars(foods, nevoTable);
    expect(backfillNevoSugars(once, nevoTable)).toBe(once);
  });

  it("keeps sugars it already has, and clamps to carbs", () => {
    const foods = {
      ...empty,
      foodEntries: [entry("Own", m(20, 3), [1]), entry("Low", m(20), [1])],
    };
    const out = backfillNevoSugars(foods, (c) => (c === 1 ? m(20, 99) : undefined));
    expect(out.foodEntries[0]!.per100.sugars).toBe(3);
    expect(out.foodEntries[1]!.per100.sugars).toBe(20);
  });
});

describe("barcode sugars for your foods", () => {
  const myFood = (name: string, per100: Macros, barcode?: string): MyFood => ({
    name,
    grams: 30,
    per100,
    ...(barcode ? { barcode } : {}),
    lastUsed: "",
    uses: 1,
  });

  it("looks up foods with a barcode and no sugars, skipping failures and respecting the cap", async () => {
    const asked: string[] = [];
    const lookup = async (code: string) => {
      asked.push(code);
      if (code === "bad") throw new Error("offline");
      return code === "none" ? null : label(60, 12);
    };
    const foods = [
      myFood("A", m(60), "111"),
      myFood("B", m(60), "bad"),
      myFood("C", m(60), "none"),
      myFood("D", { ...m(60, 5), satFat: 1 }, "222"),
      myFood("E", m(60)),
      myFood("F", m(60), "333"),
    ];
    const labels = await fetchBarcodeSugars(foods, lookup, 4);
    expect(asked).toEqual(["111", "bad", "none", "333"]);
    expect([...labels.keys()]).toEqual(["111", "333"]);
  });

  it("stores sugars only when OFF's carbs equal the food's", () => {
    const foods = [myFood("A", m(60), "111"), myFood("B", m(50), "222")];
    const labels = new Map([
      ["111", label(60, 12)],
      ["222", label(60, 12)],
    ]);
    const out = applyBarcodeSugars(foods, labels);
    expect(out[0]!.per100.sugars).toBe(12);
    expect("sugars" in out[1]!.per100).toBe(false);
    expect(applyBarcodeSugars(out, labels)).toBe(out);
  });

  it("ignores labels without sugars", () => {
    const foods = [myFood("A", m(60), "111")];
    expect(applyBarcodeSugars(foods, new Map([["111", label(60, null)]]))).toBe(foods);
  });

  it("fills entries, favourites and ingredients by name and equal carbs only", () => {
    const foods: SugarsBackfillFoods = {
      ...empty,
      myFoods: [myFood("Muesli", m(60, 12), "111")],
      foodEntries: [entry("muesli", m(60)), entry("Muesli", m(55)), entry("Other", m(60))],
      favoriteFoods: [{ name: " MUESLI ", grams: 40, per100: m(60) }],
      recipes: [
        {
          id: "r",
          name: "R",
          servings: 1,
          ingredients: [{ name: "Muesli", grams: 40, per100: m(60, 7) }],
        },
      ],
    };
    const out = backfillFromMyFoods(foods);
    expect(out.foodEntries[0]!.per100.sugars).toBe(12);
    expect("sugars" in out.foodEntries[1]!.per100).toBe(false);
    expect("sugars" in out.foodEntries[2]!.per100).toBe(false);
    expect(out.favoriteFoods[0]!.per100.sugars).toBe(12);
    expect(out.recipes[0]!.ingredients[0]!.per100.sugars).toBe(7);
  });

  it("runs the whole backfill and is idempotent", () => {
    const foods: SugarsBackfillFoods = {
      ...empty,
      myFoods: [myFood("Muesli", m(60), "111")],
      foodEntries: [entry("Muesli", m(60)), entry("Apple", m(20), [1])],
    };
    const labels = new Map([["111", label(60, 12)]]);
    const out = applySugarsBackfill(foods, labels, nevoTable);
    expect(out.myFoods[0]!.per100.sugars).toBe(12);
    expect(out.foodEntries[0]!.per100.sugars).toBe(12);
    expect(out.foodEntries[1]!.per100.sugars).toBe(12);
    expect(applySugarsBackfill(out, labels, nevoTable)).toEqual(out);
  });
});

describe("saturated fat backfill", () => {
  // Fat is 2 g per 100 g in m(); this twin carries a saturated fat figure.
  const sf = (satFat?: number, fat = 2): Macros => ({
    ...m(20),
    fat,
    ...(satFat != null ? { satFat } : {}),
  });
  const myFood = (name: string, per100: Macros, barcode?: string): MyFood => ({
    name,
    grams: 30,
    per100,
    ...(barcode ? { barcode } : {}),
    lastUsed: "",
    uses: 1,
  });
  const nevoSat: NevoLookup = (code) => (code === 1 ? { ...sf(0.7, 2), sugars: 12 } : undefined);

  it("takes NEVO's saturated fat for single-code items whose fat still matches", () => {
    const foods: SugarsBackfillFoods = {
      ...empty,
      foodEntries: [
        entry("Same", sf(), [1]),
        entry("Edited", sf(undefined, 5), [1]),
        entry("Own", sf(0.2), [1]),
        entry("Recipe", sf(), [1, 3]),
      ],
    };
    const out = backfillNevoSugars(foods, nevoSat);
    expect(out.foodEntries[0]!.per100.satFat).toBe(0.7);
    expect(out.foodEntries[0]!.per100.sugars).toBe(12);
    expect("satFat" in out.foodEntries[1]!.per100).toBe(false);
    expect(out.foodEntries[2]!.per100.satFat).toBe(0.2);
    expect("satFat" in out.foodEntries[3]!.per100).toBe(false);
    expect(backfillNevoSugars(out, nevoSat)).toBe(out);
  });

  it("asks OFF about foods lacking either value, and keeps satFat only when OFF's fat is the food's", async () => {
    const foods = [
      myFood("A", sf(), "111"),
      myFood("B", sf(undefined, 5), "222"),
      myFood("C", { ...sf(0.4), sugars: 3 }, "333"),
    ];
    const asked: string[] = [];
    const labels = await fetchBarcodeSugars(foods, async (code) => {
      asked.push(code);
      return label(20, 6, 2, 0.9);
    });
    expect(asked).toEqual(["111", "222"]);
    const out = applyBarcodeSugars(foods, labels);
    expect(out[0]!.per100).toMatchObject({ sugars: 6, satFat: 0.9 });
    // OFF's carbs equal B's (so its sugars are kept) but its fat does not.
    expect(out[1]!.per100.sugars).toBe(6);
    expect("satFat" in out[1]!.per100).toBe(false);
    expect(out[2]).toBe(foods[2]);
    expect(applyBarcodeSugars(out, labels)).toBe(out);
  });

  it("clamps OFF's saturated fat to fat and ignores labels without it", () => {
    const foods = [myFood("A", sf(), "111")];
    expect(
      applyBarcodeSugars(foods, new Map([["111", label(20, null, 2, 9)]]))[0]!.per100.satFat,
    ).toBe(2);
    expect(applyBarcodeSugars(foods, new Map([["111", label(20, null, 2, null)]]))).toBe(foods);
  });

  it("fills by name and equal fat only, leaving existing values alone", () => {
    const foods: SugarsBackfillFoods = {
      ...empty,
      myFoods: [myFood("Cheese", sf(1.5), "111")],
      foodEntries: [entry("cheese", sf()), entry("Cheese", sf(undefined, 3)), entry("Other", sf())],
      favoriteFoods: [{ name: " CHEESE ", grams: 40, per100: sf() }],
      recipes: [
        {
          id: "r",
          name: "R",
          servings: 1,
          ingredients: [{ name: "Cheese", grams: 40, per100: sf(0.1) }],
        },
      ],
    };
    const out = backfillFromMyFoods(foods);
    expect(out.foodEntries[0]!.per100.satFat).toBe(1.5);
    expect("satFat" in out.foodEntries[1]!.per100).toBe(false);
    expect("satFat" in out.foodEntries[2]!.per100).toBe(false);
    expect(out.favoriteFoods[0]!.per100.satFat).toBe(1.5);
    expect(out.recipes[0]!.ingredients[0]!.per100.satFat).toBe(0.1);
    expect(backfillFromMyFoods(out)).toBe(out);
  });

  it("runs the whole fill in one go", () => {
    const foods: SugarsBackfillFoods = {
      ...empty,
      myFoods: [myFood("Cheese", sf(), "111")],
      foodEntries: [entry("Cheese", sf()), entry("Apple", sf(), [1])],
    };
    const out = applySugarsBackfill(foods, new Map([["111", label(20, 1, 2, 1.1)]]), nevoSat);
    expect(out.myFoods[0]!.per100.satFat).toBe(1.1);
    expect(out.foodEntries[0]!.per100.satFat).toBe(1.1);
    expect(out.foodEntries[1]!.per100.satFat).toBe(0.7);
    expect(applySugarsBackfill(out, new Map(), nevoSat)).toBe(out);
  });
});
