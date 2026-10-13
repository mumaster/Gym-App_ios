import { describe, expect, it } from "vitest";
import { SPICES, listSpices, searchSpices } from "../spices";

describe("spices", () => {
  it("has unique ids and names, in both languages", () => {
    expect(SPICES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(SPICES.map((s) => s.id)).size).toBe(SPICES.length);
    expect(new Set(SPICES.map((s) => s.en)).size).toBe(SPICES.length);
    for (const s of SPICES) expect(s.nl && s.en).toBeTruthy();
  });

  it("has sane values per 100 g", () => {
    for (const s of SPICES) {
      const { calories, protein, carbs, fat } = s.per100;
      expect(protein + carbs + fat).toBeLessThanOrEqual(100);
      // Energy roughly matches the macros (USDA uses food-specific factors, so only roughly).
      const est = protein * 4 + carbs * 4 + fat * 9 + s.per100.fiber * 2;
      expect(Math.abs(calories - est)).toBeLessThan(100);
    }
  });

  it("finds salt and pepper in both languages", () => {
    expect(searchSpices("zout", "nl")[0]!.id).toBe("salt");
    expect(searchSpices("salt", "en")[0]!.per100.salt).toBe(100);
    expect(searchSpices("peper", "nl").map((s) => s.id)).toContain("black-pepper");
    expect(searchSpices("pepper", "en")[0]!.id).toBe("black-pepper");
    expect(searchSpices("kaneel", "en")[0]!.id).toBe("cinnamon");
    expect(searchSpices("", "en")).toEqual([]);
  });

  it("lists every spice without a query and filters with one", () => {
    expect(listSpices("", "en")).toHaveLength(SPICES.length);
    const names = listSpices("", "nl").map((s) => s.nl);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "nl")));
    expect(listSpices("zout", "nl")[0]!.id).toBe("salt");
    expect(listSpices("xyz", "en")).toEqual([]);
  });
});
