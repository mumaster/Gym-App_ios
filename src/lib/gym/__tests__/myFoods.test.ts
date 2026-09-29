import { describe, expect, it } from "vitest";
import {
  backfillMyFoods,
  findByBarcode,
  matchScore,
  myFoodKey,
  removeMyFood,
  searchMyFoods,
  upsertMyFood,
  type MyFood,
} from "../myFoods";
import type { FoodEntry, Macros } from "../nutrition";

const macros = (calories: number): Macros => ({
  calories,
  protein: 10,
  carbs: 5,
  fat: 2,
  fiber: 0,
  salt: 0.1,
});

const entry = (name: string, logged_at: string, extra: Partial<FoodEntry> = {}): FoodEntry => ({
  id: `${name}-${logged_at}`,
  name,
  logged_at,
  meal: "lunch",
  grams: 150,
  per100: macros(60),
  ...extra,
});

describe("your foods: saving", () => {
  it("adds a food, then updates it by name with the latest values", () => {
    let list = upsertMyFood(
      [],
      { name: " Skyr ", grams: 150, per100: macros(60) },
      undefined,
      "t1",
    );
    list = upsertMyFood(list, { name: "skyr", grams: 200, per100: macros(63) }, undefined, "t2");
    expect(list).toEqual([
      { name: "skyr", grams: 200, per100: macros(63), lastUsed: "t2", uses: 2 },
    ]);
  });

  it("matches a barcode, and gives a same-name food without one its barcode", () => {
    let list = upsertMyFood([], { name: "Skyr", grams: 150, per100: macros(60) }, undefined, "t1");
    list = upsertMyFood(list, { name: "Skyr", grams: 150, per100: macros(61) }, "871", "t2");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ barcode: "871", uses: 2 });
    // Renamed later, still the same product by its barcode.
    list = upsertMyFood(list, { name: "Arla skyr", grams: 150, per100: macros(61) }, "871", "t3");
    expect(list).toHaveLength(1);
    expect(findByBarcode(list, "871")?.name).toBe("Arla skyr");
    // A later save without the barcode (editing a logged entry) keeps it.
    list = upsertMyFood(
      list,
      { name: "Arla skyr", grams: 170, per100: macros(61) },
      undefined,
      "t4",
    );
    expect(list[0]).toMatchObject({ barcode: "871", grams: 170, uses: 4 });
  });

  it("keeps two products with the same name but different barcodes apart", () => {
    let list = upsertMyFood([], { name: "Skyr", grams: 150, per100: macros(60) }, "1", "t1");
    list = upsertMyFood(list, { name: "Skyr", grams: 150, per100: macros(70) }, "2", "t2");
    expect(list.map((f) => f.barcode)).toEqual(["2", "1"]);
    expect(new Set(list.map(myFoodKey)).size).toBe(2);
  });

  it("removes one food by its key", () => {
    let list = upsertMyFood([], { name: "Skyr", grams: 150, per100: macros(60) }, "1", "t1");
    list = upsertMyFood(list, { name: "Oats", grams: 50, per100: macros(370) }, undefined, "t2");
    expect(removeMyFood(list, "barcode:1").map((f) => f.name)).toEqual(["Oats"]);
    expect(removeMyFood(list, "name:oats").map((f) => f.name)).toEqual(["Skyr"]);
  });
});

describe("your foods: starting from an older save", () => {
  it("takes each logged food's newest values and counts how often it was logged", () => {
    const list = backfillMyFoods(
      [
        entry("Skyr", "2026-09-01T08:00:00Z", { per100: macros(60) }),
        entry("skyr", "2026-09-20T08:00:00Z", { per100: macros(63), grams: 200 }),
        entry("Oats", "2026-09-10T08:00:00Z"),
      ],
      [],
      [],
    );
    expect(list.find((f) => f.name === "skyr")).toMatchObject({
      grams: 200,
      per100: macros(63),
      uses: 2,
      lastUsed: "2026-09-20T08:00:00Z",
    });
    expect(list).toHaveLength(2);
  });

  it("skips NEVO foods and recipe servings, and adds meal and recipe ingredients", () => {
    const list = backfillMyFoods(
      [
        entry("Banana", "2026-09-01T08:00:00Z", { nevo: [151] }),
        entry("Chili", "2026-09-02T08:00:00Z"),
      ],
      [
        {
          id: "m",
          name: "Breakfast",
          ingredients: [
            { name: "Protein powder", grams: 30, per100: macros(380) },
            { name: "Banana", grams: 120, per100: macros(92), nevo: [151] },
          ],
        },
      ],
      [
        {
          id: "r",
          name: "Chili",
          servings: 4,
          ingredients: [{ name: "Kidney beans (tin)", grams: 400, per100: macros(90) }],
        },
      ],
    );
    expect(list.map((f) => f.name).sort()).toEqual(["Kidney beans (tin)", "Protein powder"]);
    expect(list.every((f) => f.uses === 0 && f.lastUsed === "")).toBe(true);
  });
});

describe("your foods: search", () => {
  it("matches like the NEVO search: case and accents folded, words by their start", () => {
    expect(matchScore("Skyr naturel", "skyr")).toBe(0);
    expect(matchScore("Skyr naturel", "nat")).toBe(1);
    expect(matchScore("Crème fraîche", "creme fr")).toBe(0);
    expect(matchScore("Arla Protein pudding", "pud arla")).toBe(1);
    expect(matchScore("Proteïnereep", "reep")).toBe(2);
    expect(matchScore("Skyr", "yoghurt")).toBeNull();
    expect(matchScore("Skyr", "  ")).toBeNull();
  });

  it("ranks the best match first, then the most used, then the most recent", () => {
    const food = (name: string, uses: number, lastUsed: string): MyFood => ({
      name,
      grams: 100,
      per100: macros(100),
      uses,
      lastUsed,
    });
    const list = [
      food("Greek yoghurt", 9, "2026-09-20"),
      food("Yoghurt 0%", 1, "2026-09-01"),
      food("Yoghurt drink", 3, "2026-09-02"),
      food("Yoghurt bar", 3, "2026-09-10"),
    ];
    expect(searchMyFoods(list, "yog").map((f) => f.name)).toEqual([
      "Yoghurt bar",
      "Yoghurt drink",
      "Yoghurt 0%",
      "Greek yoghurt",
    ]);
  });
});
