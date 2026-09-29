/**
 * "Your foods": every food you scanned, looked up by barcode or typed in
 * yourself, kept so search finds it again (AddFoodSheet). Separate from the
 * food log on purpose: deleting a log entry shouldn't forget the food, and a
 * library entry can remember the barcode it came from, so scanning the same
 * product again fills in your own values instantly, offline.
 *
 * Unedited NEVO foods aren't kept here — the NEVO search already finds them,
 * and a copy would list every banana twice.
 */
import { foldText } from "./nevoFoods";
import type { FoodEntry, MealIngredient, MealTemplate, Recipe } from "./nutrition";

export interface MyFood extends Omit<MealIngredient, "nevo"> {
  /** Barcode it was scanned from, when it was. */
  barcode?: string;
  /** ISO timestamp it was last logged or saved ("" for foods only known
   *  from a saved meal or recipe). */
  lastUsed: string;
  /** Times logged or saved — ranks search results. */
  uses: number;
}

export const nameKey = (name: string) => name.trim().toLowerCase();

/** Identifies a library entry: its barcode when it has one, else its name. */
export const myFoodKey = (food: Pick<MyFood, "name" | "barcode">) =>
  food.barcode ? `barcode:${food.barcode}` : `name:${nameKey(food.name)}`;

/**
 * Adds a food or updates the one it matches, newest first. A barcode
 * matches by barcode (or a same-name entry that has none yet, which then
 * gains it); without one, the first entry with that name. The latest
 * values and portion win, since they're what you last corrected.
 */
export function upsertMyFood(
  list: MyFood[],
  food: MealIngredient,
  barcode: string | undefined,
  now: string,
): MyFood[] {
  const name = food.name.trim();
  if (!name) return list;
  const key = nameKey(name);
  let index = barcode ? list.findIndex((f) => f.barcode === barcode) : -1;
  if (index < 0) {
    index = list.findIndex(
      (f) => nameKey(f.name) === key && (!barcode || !f.barcode || f.barcode === barcode),
    );
  }
  const previous = index >= 0 ? list[index] : undefined;
  const next: MyFood = {
    name,
    grams: food.grams,
    per100: food.per100,
    lastUsed: now,
    uses: (previous?.uses ?? 0) + 1,
  };
  const keptBarcode = barcode ?? previous?.barcode;
  if (keptBarcode) next.barcode = keptBarcode;
  return [next, ...list.filter((_, i) => i !== index)];
}

export function removeMyFood(list: MyFood[], key: string): MyFood[] {
  return list.filter((f) => myFoodKey(f) !== key);
}

export const findByBarcode = (list: MyFood[], barcode: string) =>
  list.find((f) => f.barcode === barcode);

/**
 * The library for a save made before it existed: every food in the log
 * (its newest values, and how often it was logged), then the ingredients of
 * saved meals and recipes. Skips NEVO-marked foods and entries named after
 * a recipe — those are servings of a recipe (see logRecipe), not a food.
 */
export function backfillMyFoods(
  entries: FoodEntry[],
  mealTemplates: MealTemplate[],
  recipes: Recipe[],
): MyFood[] {
  const recipeNames = new Set(recipes.map((r) => nameKey(r.name)));
  const byName = new Map<string, MyFood>();
  const newestFirst = [...entries].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  for (const e of newestFirst) {
    const key = nameKey(e.name);
    if (!key || e.nevo?.length || recipeNames.has(key)) continue;
    const known = byName.get(key);
    if (known) known.uses += 1;
    else
      byName.set(key, {
        name: e.name.trim(),
        grams: e.grams,
        per100: e.per100,
        lastUsed: e.logged_at,
        uses: 1,
      });
  }
  const ingredients = [...mealTemplates, ...recipes].flatMap((m) => m.ingredients);
  for (const ing of ingredients) {
    const key = nameKey(ing.name);
    if (!key || ing.nevo?.length || byName.has(key)) continue;
    byName.set(key, {
      name: ing.name.trim(),
      grams: ing.grams,
      per100: ing.per100,
      lastUsed: "",
      uses: 0,
    });
  }
  return [...byName.values()];
}

const words = (s: string) =>
  foldText(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * How well a name matches a search, lower is better, or null for no match.
 * Case- and accent-insensitive like the NEVO search: 0 = the name starts
 * with the query, 1 = every query word starts a word of the name ("skyr
 * nat" finds "Skyr naturel"), 2 = every word of 3+ letters appears inside it.
 */
export function matchScore(name: string, query: string): number | null {
  const q = foldText(query).trim();
  const tokens = words(query);
  if (!tokens.length) return null;
  if (foldText(name).startsWith(q)) return 0;
  const nameWords = words(name);
  if (tokens.every((t) => nameWords.some((w) => w.startsWith(t)))) return 1;
  const folded = foldText(name);
  if (tokens.every((t) => t.length >= 3 && folded.includes(t))) return 2;
  return null;
}

/** Library foods matching a search: best match first, then the ones you use
 *  most, then the most recent. */
export function searchMyFoods(list: MyFood[], query: string, limit = 20): MyFood[] {
  const scored: { food: MyFood; score: number }[] = [];
  for (const food of list) {
    const score = matchScore(food.name, query);
    if (score !== null) scored.push({ food, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      b.food.uses - a.food.uses ||
      b.food.lastUsed.localeCompare(a.food.lastUsed),
  );
  return scored.slice(0, limit).map((s) => s.food);
}
