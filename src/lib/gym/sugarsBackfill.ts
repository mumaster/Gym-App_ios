/**
 * One-time fill of "of which sugars" into food saved before sugars existed
 * (GymState.sugarsBackfillDone). Everything here is pure except
 * fetchBarcodeSugars, and idempotent: anything that already has sugars is
 * left alone, and anything that can't be matched stays undefined (unknown),
 * never 0.
 *
 *  1. NEVO: an entry, favourite or ingredient carrying exactly one NEVO code
 *     (a plain NEVO food, not a recipe) gets that food's sugars, but only
 *     while its values still equal NEVO's carbs (it wasn't edited). NEVO
 *     sugars aren't in the bundled data yet, so this does nothing until the
 *     table is rebuilt with them (scripts/build-nevo-foods.mjs).
 *  2. Your foods with a barcode and no sugars: Open Food Facts is asked once
 *     (fetchBarcodeSugars); the sugars are kept only if OFF's carbs equal the
 *     food's (so an edited food isn't given the label's sugars). Entries,
 *     favourites and ingredients without sugars that match a food by name
 *     (case-insensitive) and equal carbs per 100 g then get the same value.
 */
import type { ScannedLabel } from "./labelScan";
import { nameKey, type MyFood } from "./myFoods";
import { cleanSugars, withSugars } from "./nutrition";
import type { FoodEntry, Macros, MealIngredient, MealTemplate, Recipe } from "./nutrition";

/** Bump to run the backfill again on every device (e.g. after the NEVO
 *  table gains sugars). */
export const SUGARS_BACKFILL_VERSION = 1;

/** Most barcode lookups in one run, so a big library can't hammer Open Food
 *  Facts; the rest stay unknown. */
export const SUGARS_BACKFILL_MAX_LOOKUPS = 40;

/** The slice of GymState the backfill reads and rewrites. */
export interface SugarsBackfillFoods {
  foodEntries: FoodEntry[];
  favoriteFoods: MealIngredient[];
  mealTemplates: MealTemplate[];
  recipes: Recipe[];
  myFoods: MyFood[];
}

/** NEVO per-100 g values by code (undefined when the code is unknown). */
export type NevoLookup = (code: number) => Macros | undefined;

const sameCarbs = (a: number, b: number) => Math.abs(a - b) < 0.05;

interface Item {
  name: string;
  per100: Macros;
  nevo?: number[];
}

/** `per100` with NEVO's sugars when the item is exactly one NEVO food whose
 *  carbs it still has; the same object otherwise. */
export function nevoSugarsFor(item: Item, lookup: NevoLookup): Macros {
  if (item.per100.sugars != null || item.nevo?.length !== 1) return item.per100;
  const nevo = lookup(item.nevo[0]!);
  if (!nevo || nevo.sugars == null || !sameCarbs(item.per100.carbs, nevo.carbs)) return item.per100;
  return withSugars(item.per100, nevo.sugars);
}

/** Applies `fix` to every per100 of the foods, keeping object identity of
 *  anything unchanged. */
function mapPer100(foods: SugarsBackfillFoods, fix: (item: Item) => Macros): SugarsBackfillFoods {
  const one = <T extends Item>(item: T): T => {
    const per100 = fix(item);
    return per100 === item.per100 ? item : { ...item, per100 };
  };
  const many = <T extends Item>(list: T[]): T[] => {
    const next = list.map(one);
    return next.some((x, i) => x !== list[i]) ? next : list;
  };
  const group = <T extends { ingredients: MealIngredient[] }>(list: T[]): T[] => {
    const next = list.map((g) => {
      const ingredients = many(g.ingredients);
      return ingredients === g.ingredients ? g : { ...g, ingredients };
    });
    return next.some((x, i) => x !== list[i]) ? next : list;
  };
  const next = {
    ...foods,
    foodEntries: many(foods.foodEntries),
    favoriteFoods: many(foods.favoriteFoods),
    mealTemplates: group(foods.mealTemplates),
    recipes: group(foods.recipes),
  };
  const same =
    next.foodEntries === foods.foodEntries &&
    next.favoriteFoods === foods.favoriteFoods &&
    next.mealTemplates === foods.mealTemplates &&
    next.recipes === foods.recipes;
  return same ? foods : next;
}

/** Step 1: sugars from NEVO for single-code NEVO foods. */
export function backfillNevoSugars(
  foods: SugarsBackfillFoods,
  lookup: NevoLookup,
): SugarsBackfillFoods {
  return mapPer100(foods, (item) => nevoSugarsFor(item, lookup));
}

/** Your foods with a barcode and no sugars: the ones worth asking OFF about. */
export const myFoodsNeedingSugars = (myFoods: MyFood[]): MyFood[] =>
  myFoods.filter((f) => f.barcode && f.per100.sugars == null);

/** Step 2a: puts OFF's sugars (by barcode) on your foods, when OFF's carbs
 *  are the food's own. `labels` holds what OFF said per barcode. */
export function applyBarcodeSugars(
  myFoods: MyFood[],
  labels: ReadonlyMap<string, Pick<ScannedLabel, "carbs" | "sugars">>,
): MyFood[] {
  const next = myFoods.map((f) => {
    if (!f.barcode || f.per100.sugars != null) return f;
    const label = labels.get(f.barcode);
    if (!label || label.carbs == null || label.sugars == null) return f;
    if (!sameCarbs(label.carbs, f.per100.carbs)) return f;
    const sugars = cleanSugars(label.sugars, f.per100.carbs);
    return sugars == null ? f : { ...f, per100: withSugars(f.per100, sugars) };
  });
  return next.some((f, i) => f !== myFoods[i]) ? next : myFoods;
}

/** Step 2b: entries, favourites and ingredients without sugars take them
 *  from the your-food of the same name (case-insensitive) and carbs. */
export function backfillFromMyFoods(foods: SugarsBackfillFoods): SugarsBackfillFoods {
  const known = foods.myFoods.filter((f) => f.per100.sugars != null);
  if (!known.length) return foods;
  return mapPer100(foods, (item) => {
    if (item.per100.sugars != null) return item.per100;
    const key = nameKey(item.name);
    const hit = known.find(
      (f) => nameKey(f.name) === key && sameCarbs(f.per100.carbs, item.per100.carbs),
    );
    return hit ? withSugars(item.per100, hit.per100.sugars) : item.per100;
  });
}

/** Asks `lookup` (Open Food Facts) about the barcodes of foods lacking
 *  sugars, one at a time. A network error or unknown barcode just skips
 *  that food. */
export async function fetchBarcodeSugars(
  myFoods: MyFood[],
  lookup: (barcode: string) => Promise<ScannedLabel | null>,
  max = SUGARS_BACKFILL_MAX_LOOKUPS,
): Promise<Map<string, ScannedLabel>> {
  const labels = new Map<string, ScannedLabel>();
  const barcodes = [...new Set(myFoodsNeedingSugars(myFoods).map((f) => f.barcode!))].slice(0, max);
  for (const barcode of barcodes) {
    try {
      const label = await lookup(barcode);
      if (label) labels.set(barcode, label);
    } catch {
      /* offline or OFF down: this food stays unknown */
    }
  }
  return labels;
}

/** The whole fill, given what the async part found. Run it on the latest
 *  state (setState's updater), so edits made while OFF was answering win. */
export function applySugarsBackfill(
  foods: SugarsBackfillFoods,
  labels: ReadonlyMap<string, Pick<ScannedLabel, "carbs" | "sugars">>,
  nevo: NevoLookup,
): SugarsBackfillFoods {
  const withNevo = backfillNevoSugars(foods, nevo);
  const myFoods = applyBarcodeSugars(withNevo.myFoods, labels);
  return backfillFromMyFoods(myFoods === withNevo.myFoods ? withNevo : { ...withNevo, myFoods });
}
