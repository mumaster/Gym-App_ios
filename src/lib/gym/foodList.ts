import type { MealIngredient } from "./nutrition";

/**
 * A list of foods read by Gemini (foodListScan.ts) from a written note or
 * recipe, a photo of a plate, or typed/spoken words. Gemini only copies:
 * each line as written, its amount and unit as written, and which food in
 * NEVO (or your own foods) it is. The grams are worked out here, and the
 * values come from that food, never from Gemini.
 */
export type FoodListSource = "note" | "plate" | "text";

export interface FoodListItem {
  /** The line as written ("kipfilet 152"), or what's seen on a plate. */
  written: string;
  /** A short food name, used to search when you swap the food. */
  name: string;
  /** The amount and unit exactly as written: 152 "g", 2 "eieren". */
  quantity: number | null;
  unit: string | null;
  /** "n:<NEVO code>", "o:<index into the own foods sent>", or null. */
  match: string | null;
}

export interface FoodListResult {
  /** A recipe's title, when the note has one. */
  title: string | null;
  /** Servings the note says the recipe makes ("4 porties"). */
  servings: number | null;
  items: FoodListItem[];
}

/** Units that are a mass by definition. "ons" (100 g) and "pond" (500 g)
 *  are the Dutch everyday units, fixed by Dutch usage. */
const MASS: Record<string, number> = {
  mg: 0.001,
  g: 1,
  gr: 1,
  gm: 1,
  gram: 1,
  grams: 1,
  gramm: 1,
  kg: 1000,
  kilo: 1000,
  kilogram: 1000,
  ons: 100,
  pond: 500,
};

/** Volumes, logged as the same number of grams. 1 ml ≈ 1 g is the app's
 *  own approximation (water-like drinks are within a few percent; oil is
 *  about 8% lighter, honey about 40% heavier), the same reading the alcohol
 *  card uses (alcohol.ts). The check screen shows the written "200 ml", so
 *  it can be corrected. */
const VOLUME: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  millilitre: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  liter: 1000,
  litre: 1000,
};

/** Grams for a written amount, or null when the unit isn't a mass or a
 *  volume ("2 eggs", "1 tbsp"): those aren't converted, since that would be
 *  a guess; the amount is shown and the grams are left for you. A number
 *  without a unit on a weighed note is taken as grams. */
export function toGrams(quantity: number | null, unit: string | null): number | null {
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) return null;
  const u = (unit ?? "").trim().toLowerCase().replace(/\.$/, "");
  const factor = u === "" ? 1 : (MASS[u] ?? VOLUME[u]);
  if (factor == null) return null;
  return Math.round(quantity * factor * 10) / 10;
}

/** "2 eieren", "1 el": the amount as written, for a line without grams. */
export function amountText(quantity: number | null, unit: string | null): string | null {
  if (quantity == null) return unit?.trim() || null;
  const n = String(quantity);
  return unit?.trim() ? `${n} ${unit.trim()}` : n;
}

/** A food without its portion: what a check-screen line points at. Its
 *  grams are kept on the line, apart from the food, so swapping the food
 *  can't change them. */
export type ListFood = Omit<MealIngredient, "grams">;

export interface FoodListLine {
  id: string;
  written: string;
  /** What to search for when swapping. */
  name: string;
  /** Grams as typed in the field (a string, so it can be edited freely). */
  grams: string;
  /** The amount when it isn't in grams ("2 eieren"). */
  amount: string | null;
  food: ListFood | null;
}

/** Turns Gemini's items into check-screen lines. `nevo` looks a NEVO code up
 *  (null when unknown, so a bad code is a line without a food rather than a
 *  wrong one); `own` are the foods sent as "o:<index>". */
export function linesFromResult(
  items: FoodListItem[],
  nevo: (code: number) => ListFood | null,
  own: ListFood[],
  makeId: () => string,
): FoodListLine[] {
  return items.map((item) => {
    const grams = toGrams(item.quantity, item.unit);
    return {
      id: makeId(),
      written: item.written.trim(),
      name: item.name.trim() || item.written.trim(),
      grams: grams == null ? "" : String(grams),
      amount: grams == null ? amountText(item.quantity, item.unit) : null,
      food: resolveMatch(item.match, nevo, own),
    };
  });
}

export function resolveMatch(
  match: string | null,
  nevo: (code: number) => ListFood | null,
  own: ListFood[],
): ListFood | null {
  const m = /^([no]):(\d+)$/.exec(match ?? "");
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === "n" ? nevo(n) : (own[n] ?? null);
}

/** Lines ready to log or save: a food and grams above 0. */
export function completeLines(
  lines: FoodListLine[],
  parse: (s: string) => number,
): MealIngredient[] {
  return lines.flatMap((line) => {
    const grams = parse(line.grams);
    if (!line.food || !(grams > 0)) return [];
    return [{ ...line.food, grams }];
  });
}
