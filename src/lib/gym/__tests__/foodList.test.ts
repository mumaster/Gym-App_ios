import { describe, expect, it } from "vitest";
import {
  amountText,
  completeLines,
  linesFromResult,
  resolveMatch,
  toGrams,
  type ListFood,
} from "../foodList";

const per100 = { calories: 100, protein: 10, carbs: 10, fat: 1, fiber: 0, salt: 0 };
const nevo = (code: number): ListFood | null =>
  code === 1634 ? { name: "Kipfilet rauw", per100, nevo: [1634] } : null;
const own: ListFood[] = [{ name: "Arla Protein kwark", per100 }];

describe("toGrams", () => {
  it("copies grams and converts the fixed mass and volume units", () => {
    expect(toGrams(152, "gram")).toBe(152);
    expect(toGrams(75, "g")).toBe(75);
    expect(toGrams(412, "gr.")).toBe(412);
    expect(toGrams(1.5, "kg")).toBe(1500);
    expect(toGrams(2, "ons")).toBe(200);
    expect(toGrams(1, "pond")).toBe(500);
    // 1 ml ≈ 1 g, the app's own approximation.
    expect(toGrams(200, "ml")).toBe(200);
    expect(toGrams(2.5, "dl")).toBe(250);
  });
  it("takes a bare number on a weighed note as grams", () => {
    expect(toGrams(250, null)).toBe(250);
  });
  it("leaves counts and spoons alone rather than guessing", () => {
    expect(toGrams(2, "eieren")).toBeNull();
    expect(toGrams(1, "el")).toBeNull();
    expect(toGrams(null, null)).toBeNull();
    expect(toGrams(0, "g")).toBeNull();
  });
});

describe("check-screen lines", () => {
  it("keeps the written amount when it isn't in grams", () => {
    expect(amountText(2, "eieren")).toBe("2 eieren");
    expect(amountText(null, null)).toBeNull();
  });

  it("resolves NEVO and own-food matches, and a bad code to no food", () => {
    expect(resolveMatch("n:1634", nevo, own)?.name).toBe("Kipfilet rauw");
    expect(resolveMatch("o:0", nevo, own)?.name).toBe("Arla Protein kwark");
    expect(resolveMatch("n:999", nevo, own)).toBeNull();
    expect(resolveMatch("o:5", nevo, own)).toBeNull();
    expect(resolveMatch("kipfilet", nevo, own)).toBeNull();
  });

  it("builds lines with grams kept apart from the food", () => {
    let id = 0;
    const lines = linesFromResult(
      [
        {
          written: "kipfilet 152 gram",
          name: "kipfilet",
          quantity: 152,
          unit: "gram",
          match: "n:1634",
        },
        { written: "2 eieren", name: "eieren", quantity: 2, unit: "eieren", match: "n:1" },
      ],
      nevo,
      own,
      () => String(id++),
    );
    expect(lines[0]).toMatchObject({ grams: "152", amount: null, food: { name: "Kipfilet rauw" } });
    expect(lines[1]).toMatchObject({ grams: "", amount: "2 eieren", food: null });
    // Swapping the food leaves the grams as they were.
    const swapped = { ...lines[0]!, food: own[0]! };
    expect(completeLines([swapped, lines[1]!], Number)).toEqual([
      { name: "Arla Protein kwark", per100, grams: 152 },
    ]);
  });
});
