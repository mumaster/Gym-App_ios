/**
 * Spices, herbs and salt, per 100 g of the dried product. NEVO's published
 * groups have none of these, so they are the app's own addition: typical
 * values (rounded) from USDA FoodData Central, with carbohydrates as
 * available carbohydrate (total minus fibre) like NEVO's. Salt is the sodium
 * value × 2.5 (EU Regulation 1169/2011), and table salt is 100 g per 100 g.
 * They carry no NEVO mark. The list is the spices most used in European
 * kitchens; the portions are tiny, so these are for completeness.
 */
import type { Macros } from "./nutrition";
import { foldText } from "./nevoFoods";

/** [id, Dutch name, English name, extra search words, kcal, protein g,
 *  available carbohydrate g, fat g, fibre g, salt g] — all per 100 g. */
type SpiceRow = [string, string, string, string, number, number, number, number, number, number];

const ROWS: SpiceRow[] = [
  ["salt", "Zout", "Salt", "keukenzout tafelzout table salt sea salt zeezout", 0, 0, 0, 0, 0, 100],
  [
    "black-pepper",
    "Zwarte peper",
    "Black pepper",
    "peper pepper",
    251,
    10.4,
    38.7,
    3.3,
    25.3,
    0.05,
  ],
  ["paprika", "Paprikapoeder", "Paprika powder", "paprika", 282, 14.1, 19.1, 12.9, 34.9, 0.17],
  [
    "cayenne",
    "Cayennepeper",
    "Cayenne pepper",
    "chili chilipoeder chili powder peper",
    318,
    12,
    29.4,
    17.3,
    27.2,
    0.08,
  ],
  [
    "garlic-powder",
    "Knoflookpoeder",
    "Garlic powder",
    "knoflook garlic",
    331,
    16.6,
    63.7,
    0.7,
    9,
    0.15,
  ],
  ["onion-powder", "Uienpoeder", "Onion powder", "ui onion", 341, 10.4, 63.9, 1, 15.2, 0.18],
  ["cinnamon", "Kaneel", "Cinnamon", "cinnamon", 247, 4, 27.5, 1.2, 53.1, 0.03],
  ["turmeric", "Kurkuma", "Turmeric", "geelwortel koenjit", 312, 9.7, 44.4, 3.3, 22.7, 0.1],
  ["cumin", "Komijn", "Cumin", "djinten jeera", 375, 17.8, 33.7, 22.3, 10.5, 0.42],
  [
    "coriander-seed",
    "Korianderzaad",
    "Coriander seed",
    "koriander coriander",
    298,
    12.4,
    13.1,
    17.8,
    41.9,
    0.09,
  ],
  ["ginger", "Gemberpoeder", "Ground ginger", "gember ginger", 335, 9, 57.5, 4.2, 14.1, 0.07],
  ["nutmeg", "Nootmuskaat", "Nutmeg", "muskaatnoot", 525, 5.8, 28.5, 36.3, 20.8, 0.04],
  ["cloves", "Kruidnagel", "Cloves", "cloves", 274, 6, 31.6, 13, 33.9, 0.69],
  ["cardamom", "Kardemom", "Cardamom", "cardamon", 311, 10.8, 40.5, 6.7, 28, 0.05],
  ["oregano", "Oregano", "Oregano", "kruiden herbs", 265, 9, 26.4, 4.3, 42.5, 0.06],
  ["basil", "Basilicum", "Basil", "kruiden herbs", 233, 23, 10.1, 4.1, 37.7, 0.19],
  ["thyme", "Tijm", "Thyme", "kruiden herbs", 276, 9.1, 26.9, 7.4, 37, 0.14],
  ["rosemary", "Rozemarijn", "Rosemary", "kruiden herbs", 331, 4.9, 21.5, 15.2, 42.6, 0.13],
  ["parsley", "Peterselie", "Parsley", "kruiden herbs", 292, 26.6, 23.9, 5.5, 26.7, 1.13],
  ["bay-leaf", "Laurierblad", "Bay leaf", "laurier", 313, 7.6, 48.7, 8.4, 26.3, 0.06],
  ["sage", "Salie", "Sage", "kruiden herbs", 315, 10.6, 20.4, 12.7, 40.3, 0.03],
  ["dill", "Dille", "Dill", "kruiden herbs", 253, 20, 42.2, 4.4, 13.6, 0.52],
  ["marjoram", "Marjolein", "Marjoram", "kruiden herbs", 271, 12.7, 20.3, 7, 40.3, 0.19],
  ["tarragon", "Dragon", "Tarragon", "kruiden herbs", 295, 22.8, 42.8, 7.2, 7.4, 0.16],
  [
    "mustard-seed",
    "Mosterdzaad",
    "Mustard seed",
    "mosterd mustard",
    508,
    26.1,
    15.9,
    36.2,
    12.2,
    0.03,
  ],
  ["fennel-seed", "Venkelzaad", "Fennel seed", "venkel fennel", 345, 15.8, 12.5, 14.9, 39.8, 0.22],
  ["caraway", "Karwijzaad", "Caraway seed", "karwij", 333, 19.8, 11.9, 14.6, 38, 0.04],
  ["saffron", "Saffraan", "Saffron", "saffron", 310, 11.4, 61.5, 5.9, 3.9, 0.37],
  ["allspice", "Piment", "Allspice", "jamaicapeper nagelbol", 263, 6.1, 50.5, 8.7, 21.6, 0.19],
  [
    "curry",
    "Kerriepoeder",
    "Curry powder",
    "currypoeder kerrie curry",
    325,
    14.3,
    2.6,
    14,
    53.2,
    0.13,
  ],
];

export interface Spice {
  id: string;
  nl: string;
  en: string;
  /** Extra words that find it ("peper" finds cayenne too). */
  extra: string;
  per100: Macros;
}

export const SPICES: Spice[] = ROWS.map(
  ([id, nl, en, extra, calories, protein, carbs, fat, fiber, salt]) => ({
    id,
    nl,
    en,
    extra,
    per100: { calories, protein, carbs, fat, fiber, salt },
  }),
);

export const spiceName = (s: Spice, language: "en" | "nl") => (language === "nl" ? s.nl : s.en);

/** Spices where a word of the name (either language) or an extra word starts
 *  with every word of the query; names starting with it come first. */
export function searchSpices(query: string, language: "en" | "nl", limit = 10): Spice[] {
  const tokens = foldText(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (!tokens.length) return [];
  const scored: { spice: Spice; score: number }[] = [];
  for (const spice of SPICES) {
    const own = foldText(spiceName(spice, language));
    const pool = foldText(`${spice.nl} ${spice.en} ${spice.extra}`).split(/[^a-z0-9]+/);
    if (!tokens.every((t) => pool.some((w) => w.startsWith(t)))) continue;
    scored.push({ spice, score: own.startsWith(tokens[0]!) ? 0 : 1 });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.spice);
}

/** Every spice for the "Add spices" picker, A to Z in the app's language:
 *  with a query only the matches (as `searchSpices`, no cut-off). */
export function listSpices(query: string, language: "en" | "nl"): Spice[] {
  const found = foldText(query).trim() ? searchSpices(query, language, SPICES.length) : SPICES;
  return [...found].sort((a, b) =>
    spiceName(a, language).localeCompare(spiceName(b, language), language),
  );
}
