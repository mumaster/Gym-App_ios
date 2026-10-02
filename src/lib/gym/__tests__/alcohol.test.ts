import { describe, expect, it } from "vitest";
import { NEVO_FOODS } from "../nevoFoods.data";
import { nevoFoodFromRow } from "../nevoFoods";
import {
  ALCOHOL_DRINKS,
  DEFAULT_ALCOHOL_SETTINGS,
  DEFAULT_DRINK_CHOICES,
  STANDARD_GLASS_ALCOHOL_G,
  alcoholCardVisible,
  alcoholDrinkById,
  alcoholGrams,
  alcoholLoggable,
  buildDrinkEntry,
  drinkEntries,
  drinkOf,
  isWeekend,
  quickDrinkChoices,
  servingKcal,
  standardGlasses,
} from "../alcohol";
import { dailyTotals, type FoodEntry } from "../nutrition";

const foods = NEVO_FOODS.map(nevoFoodFromRow);
const byCode = (code: number) => foods.find((f) => f.code === code)!;

/** Values per 100 g as printed in NEVO online 2025/9.0 (kcal, protein,
 *  carbohydrate, fat, alcohol), read from the file. */
const NEVO_VALUES: Record<number, [string, number, number, number, number, number]> = {
  390: ["Bier pils", 44, 0.4, 3, 0, 4.3],
  3214: ["Bier wit", 47, 0.5, 3.7, 0, 4.2],
  1468: ["Bier zwaar >7 vol% alcohol", 64, 0.5, 4.3, 0, 6.3],
  3267: ["Bier Radler", 39, 0.4, 6.5, 0, 1.6],
  1519: ["Bier alcoholvrij <0,1 vol% alcohol", 26, 0.3, 6.1, 0, 0],
  422: ["Wijn rode", 76, 0.1, 0.2, 0, 10.7],
  423: ["Wijn witte droge", 67, 0.1, 0.6, 0, 9.1],
  2610: ["Wijn rose", 71, 0.1, 2.5, 0, 8.7],
  2142: ["Wijn witte zoete", 96, 0.2, 5.9, 0, 10.2],
  5246: ["Wijn alcoholvrij", 23, 0.1, 5.3, 0.1, 0],
};

describe("alcohol drinks and NEVO", () => {
  it("lists ten drinks, each a NEVO food", () => {
    expect(ALCOHOL_DRINKS).toHaveLength(10);
    expect(new Set(ALCOHOL_DRINKS.map((d) => d.id)).size).toBe(10);
    expect(ALCOHOL_DRINKS.map((d) => d.nevo).sort()).toEqual(
      Object.keys(NEVO_VALUES).map(Number).sort(),
    );
  });

  it("keeps NEVO's values unchanged in the generated data", () => {
    for (const [code, [nl, kcal, protein, carbs, fat]] of Object.entries(NEVO_VALUES)) {
      const food = byCode(Number(code));
      expect(food.nl, code).toBe(nl);
      expect(food.per100, code).toMatchObject({ calories: kcal, protein, carbs, fat });
    }
  });

  it("repeats NEVO's alcohol (ALC) values exactly as the data carries them", () => {
    for (const drink of ALCOHOL_DRINKS) {
      const [, , , , , alc] = NEVO_VALUES[drink.nevo]!;
      expect(drink.alcoholPer100, drink.id).toBe(alc);
      expect(byCode(drink.nevo).alcohol, drink.id).toBe(alc);
    }
  });

  it("keeps the serving sizes", () => {
    const sizes = (id: Parameters<typeof alcoholDrinkById>[0]) => alcoholDrinkById(id)!.sizes;
    expect(sizes("pils")).toEqual([250, 300, 330, 500]);
    expect(sizes("strongBeer")).toEqual([250, 330]);
    expect(sizes("redWine")).toEqual([100, 125, 175, 750]);
    for (const d of ALCOHOL_DRINKS) expect(d.sizes).toEqual([...d.sizes].sort((a, b) => a - b));
  });

  it("counts a serving's kcal from NEVO's per-100 value", () => {
    expect(servingKcal(byCode(390), 330)).toBe(145);
    expect(servingKcal(byCode(422), 125)).toBe(95);
  });
});

describe("standard glasses", () => {
  const pils330 = { grams: 330, nevo: [390] };

  it("is 10 g of alcohol (Trimbos)", () => {
    expect(STANDARD_GLASS_ALCOHOL_G).toBe(10);
  });

  it("works out a 330 ml pils as 14.19 g, 1.4 glasses", () => {
    expect(alcoholGrams(pils330)).toBeCloseTo(14.19, 6);
    expect(standardGlasses([pils330])).toBeCloseTo(1.419, 6);
    expect(standardGlasses([pils330]).toFixed(1)).toBe("1.4");
  });

  it("matches Trimbos' standard glasses: 250 ml pils is about 1, 100 ml red wine about 1", () => {
    expect(standardGlasses([{ grams: 250, nevo: [390] }])).toBeCloseTo(1.075, 6);
    expect(standardGlasses([{ grams: 100, nevo: [422] }])).toBeCloseTo(1.07, 6);
  });

  it("adds drinks up and counts alcohol-free ones as zero", () => {
    const wine = { grams: 125, drink: "redWine" };
    expect(standardGlasses([pils330, wine])).toBeCloseTo(1.419 + 1.3375, 6);
    expect(standardGlasses([{ grams: 330, drink: "alcoholFreeBeer" }])).toBe(0);
    expect(standardGlasses([])).toBe(0);
  });
});

describe("telling drinks from other foods", () => {
  it("counts an entry marked as a drink", () => {
    expect(drinkOf({ drink: "pils" })?.id).toBe("pils");
    expect(drinkOf({ drink: "nonsense" })).toBeUndefined();
  });

  it("counts an entry whose only NEVO code is a listed drink (a beer from Add food's search)", () => {
    expect(drinkOf({ nevo: [422] })?.id).toBe("redWine");
    expect(drinkOf({ nevo: [422, 390] })).toBeUndefined();
    expect(drinkOf({ nevo: [151] })).toBeUndefined();
    expect(drinkOf({})).toBeUndefined();
  });

  it("keeps the marker when an edit drops the NEVO mark", () => {
    expect(drinkOf({ drink: "pils" })?.id).toBe("pils");
    expect(alcoholGrams({ drink: "pils", grams: 100 })).toBeCloseTo(4.3, 6);
  });

  it("is not alcohol for an ordinary food", () => {
    expect(alcoholGrams({ nevo: [151], grams: 120 })).toBe(0);
    expect(drinkEntries([{ nevo: [151] }, { drink: "pils" }])).toEqual([{ drink: "pils" }]);
  });
});

describe("building a drink's food entry", () => {
  const pils = alcoholDrinkById("pils")!;
  const evening = new Date(2026, 9, 3, 20, 15); // Saturday 3 October 2026, 20:15

  it("logs ml as grams with NEVO's values and code, and the meal for the time", () => {
    const entry = buildDrinkEntry(pils, 330, byCode(390), "en", evening, "x1");
    expect(entry).toMatchObject({
      id: "x1",
      name: "Beer pilsner",
      grams: 330,
      meal: "dinner",
      nevo: [390],
      drink: "pils",
    });
    expect(entry.per100).toEqual(byCode(390).per100);
    expect(entry.logged_at).toBe(evening.toISOString());
    expect(dailyTotals([entry]).calories).toBeCloseTo(145.2, 0);
  });

  it("is named in the app's language", () => {
    expect(buildDrinkEntry(pils, 250, byCode(390), "nl", evening, "x2").name).toBe("Bier pils");
    const wine = alcoholDrinkById("redWine")!;
    expect(buildDrinkEntry(wine, 125, byCode(422), "nl", evening, "x3").name).toBe("Wijn rode");
    expect(buildDrinkEntry(wine, 125, byCode(422), "en", evening, "x4").name).toBe("Wine red");
  });

  it("uses the meal for the time: a lunchtime beer is lunch, late night a snack", () => {
    const at = (h: number) =>
      buildDrinkEntry(pils, 330, byCode(390), "en", new Date(2026, 9, 3, h), "x").meal;
    expect(at(12)).toBe("lunch");
    expect(at(23)).toBe("snack");
  });

  it("is recognised as a drink afterwards", () => {
    const entry = buildDrinkEntry(pils, 330, byCode(390), "en", evening, "x1");
    expect(drinkOf(entry)?.id).toBe("pils");
    expect(standardGlasses([entry])).toBeCloseTo(1.419, 6);
  });
});

describe("quick-add choices", () => {
  const entry = (drink: string, grams: number, at: string) =>
    ({ drink, grams, logged_at: at }) as Pick<FoodEntry, "drink" | "grams" | "logged_at">;

  it("starts with Pils 330 ml and Red wine 125 ml", () => {
    expect(DEFAULT_DRINK_CHOICES).toEqual([
      { id: "pils", ml: 330 },
      { id: "redWine", ml: 125 },
    ]);
    expect(quickDrinkChoices([])).toEqual(DEFAULT_DRINK_CHOICES);
  });

  it("lists the latest distinct drink + size combinations, newest first, at most three", () => {
    const list = [
      entry("pils", 330, "2026-09-26T20:00:00Z"),
      entry("redWine", 175, "2026-09-27T20:00:00Z"),
      entry("pils", 330, "2026-10-03T20:00:00Z"),
      entry("pils", 500, "2026-10-03T21:00:00Z"),
      entry("witbier", 300, "2026-09-20T20:00:00Z"),
    ];
    expect(quickDrinkChoices(list)).toEqual([
      { id: "pils", ml: 500 },
      { id: "pils", ml: 330 },
      { id: "redWine", ml: 175 },
    ]);
  });

  it("tops up from the defaults to two, without repeating one", () => {
    expect(quickDrinkChoices([entry("pils", 330, "2026-10-03T20:00:00Z")])).toEqual([
      { id: "pils", ml: 330 },
      { id: "redWine", ml: 125 },
    ]);
    expect(quickDrinkChoices([entry("rose", 175, "2026-10-03T20:00:00Z")])).toEqual([
      { id: "rose", ml: 175 },
      { id: "pils", ml: 330 },
    ]);
  });

  it("ignores foods that aren't drinks", () => {
    expect(
      quickDrinkChoices([{ grams: 120, nevo: [151], logged_at: "2026-10-03T20:00:00Z" }]),
    ).toEqual(DEFAULT_DRINK_CHOICES);
  });
});

describe("weekends only", () => {
  it("is Saturday and Sunday in local time", () => {
    expect(isWeekend(new Date(2026, 9, 2))).toBe(false); // Friday
    expect(isWeekend(new Date(2026, 9, 3))).toBe(true); // Saturday
    expect(isWeekend(new Date(2026, 9, 4))).toBe(true); // Sunday
    expect(isWeekend(new Date(2026, 9, 5))).toBe(false); // Monday
    expect(isWeekend(new Date(2026, 9, 3, 23, 59))).toBe(true);
    expect(isWeekend(new Date(2026, 9, 5, 0, 0))).toBe(false);
  });

  it("shows the card on a weekend, or on another day only when it has drinks", () => {
    expect(alcoholCardVisible(new Date(2026, 9, 3), 0)).toBe(true);
    expect(alcoholCardVisible(new Date(2026, 9, 2), 0)).toBe(false);
    expect(alcoholCardVisible(new Date(2026, 9, 2), 1)).toBe(true);
  });
});

describe("alcohol settings", () => {
  const FRIDAY = new Date(2026, 9, 2);
  const SATURDAY = new Date(2026, 9, 3);
  const on = { enabled: true, weekdays: false };
  const everyDay = { enabled: true, weekdays: true };
  const off = { enabled: false, weekdays: false };
  const offWithWeekdays = { enabled: false, weekdays: true };

  it("defaults to tracking on, weekends only", () => {
    expect(DEFAULT_ALCOHOL_SETTINGS).toEqual(on);
    expect(alcoholCardVisible(FRIDAY, 0)).toBe(false);
    expect(alcoholCardVisible(SATURDAY, 0)).toBe(true);
  });

  it("with weekdays on, shows the card every day", () => {
    expect(alcoholCardVisible(FRIDAY, 0, everyDay)).toBe(true);
    expect(alcoholCardVisible(SATURDAY, 0, everyDay)).toBe(true);
  });

  it("with tracking off, never shows it, even on a day with drinks", () => {
    expect(alcoholCardVisible(SATURDAY, 0, off)).toBe(false);
    expect(alcoholCardVisible(SATURDAY, 3, off)).toBe(false);
    expect(alcoholCardVisible(FRIDAY, 2, off)).toBe(false);
    expect(alcoholCardVisible(FRIDAY, 0, offWithWeekdays)).toBe(false);
  });

  it("lets you add drinks only today, on a day the card is for", () => {
    expect(alcoholLoggable(SATURDAY, true, on)).toBe(true);
    expect(alcoholLoggable(SATURDAY, false, on)).toBe(false);
    expect(alcoholLoggable(FRIDAY, true, on)).toBe(false);
    expect(alcoholLoggable(FRIDAY, true, everyDay)).toBe(true);
    expect(alcoholLoggable(FRIDAY, false, everyDay)).toBe(false);
    expect(alcoholLoggable(SATURDAY, true, off)).toBe(false);
    expect(alcoholLoggable(FRIDAY, true, offWithWeekdays)).toBe(false);
    expect(alcoholLoggable(SATURDAY, true)).toBe(true);
  });
});
