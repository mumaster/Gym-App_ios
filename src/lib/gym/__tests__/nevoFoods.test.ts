import { describe, expect, it } from "vitest";
import { NEVO_FOODS, NEVO_GROUPS, NEVO_VERSION } from "../nevoFoods.data";
import {
  SALT_PER_SODIUM,
  foldText,
  localizeNevoName,
  localizeNevoNames,
  matchesNevo,
  nevoFoodFromRow,
  searchNevoFoods,
} from "../nevoFoods";

const foods = NEVO_FOODS.map(nevoFoodFromRow);
const byCode = (code: number) => foods.find((f) => f.code === code)!;

describe("NEVO data", () => {
  it("is the version the references name", () => {
    expect(NEVO_VERSION).toBe("2025/9.0");
    expect(foods.length).toBeGreaterThan(1000);
  });

  it("has the beer, wine and other drinks groups, whole", () => {
    expect(foods.length).toBe(1486);
    const inGroup = (name: string) => {
      const gi = NEVO_GROUPS.findIndex(([nl]) => nl === name);
      return foods.filter((f) => f.group === gi).length;
    };
    expect(inGroup("Alcoholische dranken")).toBe(41);
    expect(inGroup("Niet-alcoholische dranken")).toBe(112);
  });

  it("carries NEVO's alcohol (ALC) only where it's above 0", () => {
    // Bier pils: ALC 4.3 g per 100 g; Banaan has none.
    expect(foods.find((f) => f.code === 390)!.alcohol).toBe(4.3);
    expect(foods.find((f) => f.code === 151)!.alcohol).toBe(0);
    expect(NEVO_FOODS.find((r) => r[0] === 151)).toHaveLength(11);
  });

  it("keeps NEVO's values unchanged (spot checks against the 2025/9.0 file)", () => {
    // Banaan: 92 kcal, protein 1.1, carbohydrate 20, fat 0.3, fibre 1.9, Na 0 mg.
    expect(byCode(151)).toMatchObject({
      nl: "Banaan",
      en: "Banana",
      per100: { calories: 92, protein: 1.1, carbs: 20, fat: 0.3, fiber: 1.9, salt: 0 },
    });
    // Aardappelen rauw: 88 kcal, 2 g protein, 19 g carbohydrate, fibre 1,8.
    expect(byCode(1).per100).toMatchObject({ calories: 88, protein: 2, carbs: 19, fiber: 1.8 });
  });

  it("derives salt from sodium × 2.5 (EU 1169/2011), marking unknown sodium", () => {
    const row = NEVO_FOODS.find((r) => (r[10] ?? 0) > 100)!;
    expect(nevoFoodFromRow(row).per100.salt).toBeCloseTo((row[10]! * SALT_PER_SODIUM) / 1000, 6);
    const missing = NEVO_FOODS.find((r) => r[10] === null);
    if (missing) {
      expect(nevoFoodFromRow(missing)).toMatchObject({ saltKnown: false, per100: { salt: 0 } });
    }
  });

  it("has energy roughly matching its macros (a sanity check on parsing)", () => {
    // NEVO's energy also counts alcohol (7 kcal/g, EU Regulation 1169/2011
    // Annex XIV), organic acids and polyols, so only gross mistakes (a
    // missed decimal comma) would fail this.
    const off = foods.filter((f) => {
      const { calories, protein, carbs, fat, fiber } = f.per100;
      const est = 4 * protein + 4 * carbs + 9 * fat + 2 * fiber + 7 * f.alcohol;
      return calories > 50 && Math.abs(est - calories) / calories > 0.25;
    });
    expect(off.length / foods.length).toBeLessThan(0.02);
  });
});

describe("searching NEVO foods", () => {
  it("finds a food by the start of its name in either language", () => {
    expect(searchNevoFoods(foods, "ban", "nl")[0]!.food.code).toBe(151);
    expect(searchNevoFoods(foods, "banana", "en")[0]!.food.code).toBe(151);
    expect(searchNevoFoods(foods, "banaan", "en")[0]!.food.code).toBe(151);
  });

  it("matches NEVO's synonyms and reports the one that matched", () => {
    const hit = searchNevoFoods(foods, "bloemkool", "nl").find((m) => m.food.code === 14);
    expect(hit?.synonym).toBe("Bloemkool rauw");
  });

  it("needs every word, folds accents and case", () => {
    expect(foldText("Crème Fraîche")).toBe("creme fraiche");
    const eggs = searchNevoFoods(foods, "EI GEKOOKT", "nl");
    expect(eggs.length).toBeGreaterThan(0);
    for (const m of eggs) {
      const text = foldText([m.food.nl, m.food.en, ...m.food.synonyms].join(" "));
      expect(text).toMatch(/gekookt/);
    }
  });

  it("returns nothing for an empty query and respects the limit", () => {
    expect(searchNevoFoods(foods, "  ", "en")).toEqual([]);
    expect(searchNevoFoods(foods, "a", "en", 5)).toHaveLength(5);
  });
});

describe("keeping the NEVO mark", () => {
  const nevo = byCode(151).per100;
  it("only while the values are NEVO's own", () => {
    expect(matchesNevo({ ...nevo }, nevo)).toBe(true);
    expect(matchesNevo({ ...nevo, calories: 95 }, nevo)).toBe(false);
  });
});

describe("NEVO names in the app's language", () => {
  const map = new Map(foods.map((f) => [f.code, f]));
  const per100 = byCode(151).per100;

  it("switches NEVO's other-language name to this language", () => {
    const item = { name: "Banana", grams: 120, per100, nevo: [151] };
    expect(localizeNevoName(item, map, "nl").name).toBe("Banaan");
    expect(localizeNevoName({ ...item, name: "banaan" }, map, "en").name).toBe("Banana");
  });

  it("leaves a name already in this language, a typed name, recipes and unmarked foods", () => {
    const item = { name: "Banaan", grams: 120, per100, nevo: [151] };
    expect(localizeNevoName(item, map, "nl")).toBe(item);
    const typed = { ...item, name: "Rijpe banaan" };
    expect(localizeNevoName(typed, map, "en")).toBe(typed);
    const recipe = { ...item, name: "Banana", nevo: [151, 1] };
    expect(localizeNevoName(recipe, map, "nl")).toBe(recipe);
    const unmarked = { name: "Banana", grams: 120, per100 };
    expect(localizeNevoName(unmarked, map, "nl")).toBe(unmarked);
  });

  it("returns the same list when nothing changes", () => {
    const list = [{ name: "Banaan", grams: 120, per100, nevo: [151] }];
    expect(localizeNevoNames(list, map, "nl")).toBe(list);
    expect(localizeNevoNames(list, map, "en")[0]!.name).toBe("Banana");
  });
});
