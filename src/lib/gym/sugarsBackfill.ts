/**
 * One-time fill of "of which sugars" and "of which saturates" into food saved
 * before they existed (GymState.sugarsBackfillDone). Everything here is pure
 * except fetchBarcodeSugars, and idempotent: anything that already has a
 * value is left alone, and anything that can't be matched stays undefined
 * (unknown), never 0. Sugars are matched on carbs and saturated fat on fat,
 * each independently.
 *
 *  1. NEVO: an entry, favourite or ingredient carrying exactly one NEVO code
 *     (a plain NEVO food, not a recipe) gets that food's sugars and
 *     saturated fat, but only while its carbs (fat) still equal NEVO's (it
 *     wasn't edited).
 *  2. Your foods with a barcode and no sugars or no saturated fat: Open Food
 *     Facts is asked once (fetchBarcodeSugars); a value is kept only if OFF's
 *     carbs (fat) equal the food's (so an edited food isn't given the
 *     label's figure). Entries, favourites and ingredients without the value
 *     that match a food by name (case-insensitive) and equal carbs (fat) per
 *     100 g then get the same value.
 */
import type { ScannedLabel } from "./labelScan";
import { nameKey, type MyFood } from "./myFoods";
import { cleanSatFat, cleanSugars, withSatFat, withSugars } from "./nutrition";
import type { FoodEntry, Macros, MealIngredient, MealTemplate, Recipe } from "./nutrition";

/** Bump to run the backfill again on every device. 2: the NEVO table gained
 *  sugars, so NEVO foods logged before then get them now. 3: saturated fat. */
export const SUGARS_BACKFILL_VERSION = 3;

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
const sameFat = sameCarbs;

/** What the backfill reads from a label (Open Food Facts' answer). */
type LabelFigures = Pick<ScannedLabel, "carbs" | "sugars" | "fat" | "saturatedFat">;

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

/** `per100` with NEVO's saturated fat when the item is exactly one NEVO food
 *  whose fat it still has; the same object otherwise. */
export function nevoSatFatFor(item: Item, lookup: NevoLookup): Macros {
  if (item.per100.satFat != null || item.nevo?.length !== 1) return item.per100;
  const nevo = lookup(item.nevo[0]!);
  if (!nevo || nevo.satFat == null || !sameFat(item.per100.fat, nevo.fat)) return item.per100;
  return withSatFat(item.per100, nevo.satFat);
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

/** Step 1: sugars and saturated fat from NEVO for single-code NEVO foods. */
export function backfillNevoSugars(
  foods: SugarsBackfillFoods,
  lookup: NevoLookup,
): SugarsBackfillFoods {
  return mapPer100(foods, (item) => {
    const withSugarsFilled = nevoSugarsFor(item, lookup);
    return nevoSatFatFor({ ...item, per100: withSugarsFilled }, lookup);
  });
}

/** Your foods with a barcode and no sugars or saturated fat: the ones worth
 *  asking OFF about. */
export const myFoodsNeedingSugars = (myFoods: MyFood[]): MyFood[] =>
  myFoods.filter((f) => f.barcode && (f.per100.sugars == null || f.per100.satFat == null));

/** Step 2a: puts OFF's sugars and saturated fat (by barcode) on your foods,
 *  when OFF's carbs (fat) are the food's own. `labels` holds what OFF said
 *  per barcode. */
export function applyBarcodeSugars(
  myFoods: MyFood[],
  labels: ReadonlyMap<string, LabelFigures>,
): MyFood[] {
  const next = myFoods.map((f) => {
    if (!f.barcode) return f;
    const label = labels.get(f.barcode);
    if (!label) return f;
    let per100 = f.per100;
    if (per100.sugars == null && label.carbs != null && label.sugars != null) {
      const sugars = sameCarbs(label.carbs, per100.carbs)
        ? cleanSugars(label.sugars, per100.carbs)
        : undefined;
      if (sugars != null) per100 = withSugars(per100, sugars);
    }
    if (per100.satFat == null && label.fat != null && label.saturatedFat != null) {
      const satFat = sameFat(label.fat, per100.fat)
        ? cleanSatFat(label.saturatedFat, per100.fat)
        : undefined;
      if (satFat != null) per100 = withSatFat(per100, satFat);
    }
    return per100 === f.per100 ? f : { ...f, per100 };
  });
  return next.some((f, i) => f !== myFoods[i]) ? next : myFoods;
}

/** Step 2b: entries, favourites and ingredients without sugars (saturated
 *  fat) take them from the your-food of the same name (case-insensitive) and
 *  carbs (fat). */
export function backfillFromMyFoods(foods: SugarsBackfillFoods): SugarsBackfillFoods {
  const knownSugars = foods.myFoods.filter((f) => f.per100.sugars != null);
  const knownSatFat = foods.myFoods.filter((f) => f.per100.satFat != null);
  if (!knownSugars.length && !knownSatFat.length) return foods;
  return mapPer100(foods, (item) => {
    let per100 = item.per100;
    const key = nameKey(item.name);
    if (per100.sugars == null) {
      const hit = knownSugars.find(
        (f) => nameKey(f.name) === key && sameCarbs(f.per100.carbs, per100.carbs),
      );
      if (hit) per100 = withSugars(per100, hit.per100.sugars);
    }
    if (per100.satFat == null) {
      const hit = knownSatFat.find(
        (f) => nameKey(f.name) === key && sameFat(f.per100.fat, per100.fat),
      );
      if (hit) per100 = withSatFat(per100, hit.per100.satFat);
    }
    return per100;
  });
}

/** Asks `lookup` (Open Food Facts) about the barcodes of foods lacking
 *  sugars or saturated fat, one at a time. A network error or unknown barcode just skips
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
  labels: ReadonlyMap<string, LabelFigures>,
  nevo: NevoLookup,
): SugarsBackfillFoods {
  const withNevo = backfillNevoSugars(foods, nevo);
  const myFoods = applyBarcodeSugars(withNevo.myFoods, labels);
  return backfillFromMyFoods(myFoods === withNevo.myFoods ? withNevo : { ...withNevo, myFoods });
}
