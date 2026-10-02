/**
 * Beer and wine for Nutrition → Drinks: the list of drinks, the usual
 * serving sizes, and how many standard glasses a day's drinks add up to.
 *
 * A drink is an ordinary FoodEntry (so its calories count in the day's
 * totals, the Home tile, the week strip and the weekly averages like any
 * food), made from a NEVO food (nevoFoods.ts): grams = ml, per-100 values
 * and the NEVO code exactly as NEVO has them. `FoodEntry.drink` marks it as
 * one of these; an entry logged through Add food's NEVO search with the same
 * single NEVO code counts as well (`drinkOf`).
 *
 * Numbers and where they come from:
 *  - Values per 100 g (kcal, protein, carbs, fat, alcohol): NEVO online
 *    version 2025/9.0, RIVM, unchanged. Alcohol is NEVO's `ALC (g)` column;
 *    the generated data carries it too (nevoFoods.data.ts, a test pins the
 *    two against each other). It is repeated here only because the card
 *    needs it before the lazily-loaded NEVO chunk has arrived.
 *  - ml as grams: NEVO is per 100 g, the app logs ml as g (1 ml ≈ 1 g).
 *    Beer and wine are within about 1–2% of water's density. That is the
 *    app's own approximation; NEVO's values themselves are not changed.
 *  - Standard glass: a Dutch standard glass holds about 10 g of pure alcohol
 *    (Trimbos-instituut): 250 ml of 5% beer or 100 ml of 12% wine.
 *  - Serving sizes. 250 ml beer and 100 ml wine are Trimbos' standard
 *    glasses. 125 ml and 175 ml are the UK's legal measures for wine by the
 *    glass (Weights and Measures (Specified Quantities) (Unwrapped Bread and
 *    Intoxicating Liquor) Order 2011), 175 ml being a common large pour.
 *    750 ml is the EU nominal size of a bottle of still wine (Directive
 *    2007/45/EC). 300 ml (the Dutch standard beer bottle), 330 ml (a can)
 *    and 500 ml (a large can, half a litre) are package sizes, not nutrition
 *    numbers. A strong beer comes as 250 or 330 ml.
 *  - Weekends by default. The Alcohol card on Nutrition → Drinks appears on
 *    Saturdays and Sundays (local time), the user's own choice for a light,
 *    fun feature: `isWeekend`, `alcoholCardVisible`. Other days show it only
 *    when that day already has drinks (logged through Add food's search),
 *    read-only. Quick-adds are for today only, as with water and coffee
 *    (`alcoholLoggable`). Two Settings switches change this: "Track alcohol"
 *    off hides the card on every day (logged drinks stay in the food log),
 *    and "Also on weekdays" shows it every day like a weekend.
 *  - Guidance (shown only in a note, never as a limit, bar or warning
 *    colour): the Dutch Health Council (Gezondheidsraad, June 2026 advice)
 *    says there is no safe lower limit for alcohol, the less the better; it
 *    replaced the 2015 advice of at most one glass a day. Found through web
 *    search results.
 */
import { mealForTime, type FoodEntry } from "./nutrition";
import { nevoName, type NevoFood } from "./nevoFoods";

export type AlcoholCategory = "beer" | "wine";

export type AlcoholDrinkId =
  | "pils"
  | "witbier"
  | "strongBeer"
  | "radler"
  | "alcoholFreeBeer"
  | "redWine"
  | "whiteWine"
  | "rose"
  | "sweetWine"
  | "alcoholFreeWine";

export interface AlcoholDrink {
  id: AlcoholDrinkId;
  category: AlcoholCategory;
  /** The NEVO food its values come from. */
  nevo: number;
  /** NEVO's alcohol (ALC) in g per 100 g, unchanged. */
  alcoholPer100: number;
  /** Usual servings in ml, smallest first. */
  sizes: number[];
}

/** Trimbos-instituut: a Dutch standard glass holds about 10 g of alcohol. */
export const STANDARD_GLASS_ALCOHOL_G = 10;

const BEER_SIZES = [250, 300, 330, 500];
/** A strong beer (over 7%) is poured small: a glass or a can. */
const STRONG_BEER_SIZES = [250, 330];
const WINE_SIZES = [100, 125, 175, 750];

export const ALCOHOL_DRINKS: AlcoholDrink[] = [
  // NEVO 390 Bier pils: 44 kcal, protein 0.4, carbohydrate 3, fat 0, ALC 4.3
  { id: "pils", category: "beer", nevo: 390, alcoholPer100: 4.3, sizes: BEER_SIZES },
  // NEVO 3214 Bier wit: 47 kcal, 0.5, 3.7, 0, ALC 4.2
  { id: "witbier", category: "beer", nevo: 3214, alcoholPer100: 4.2, sizes: BEER_SIZES },
  // NEVO 1468 Bier zwaar >7 vol% alcohol: 64 kcal, 0.5, 4.3, 0, ALC 6.3
  { id: "strongBeer", category: "beer", nevo: 1468, alcoholPer100: 6.3, sizes: STRONG_BEER_SIZES },
  // NEVO 3267 Bier Radler: 39 kcal, 0.4, 6.5, 0, ALC 1.6
  { id: "radler", category: "beer", nevo: 3267, alcoholPer100: 1.6, sizes: BEER_SIZES },
  // NEVO 1519 Bier alcoholvrij <0,1 vol% alcohol: 26 kcal, 0.3, 6.1, 0, ALC 0
  { id: "alcoholFreeBeer", category: "beer", nevo: 1519, alcoholPer100: 0, sizes: BEER_SIZES },
  // NEVO 422 Wijn rode: 76 kcal, 0.1, 0.2, 0, ALC 10.7
  { id: "redWine", category: "wine", nevo: 422, alcoholPer100: 10.7, sizes: WINE_SIZES },
  // NEVO 423 Wijn witte droge: 67 kcal, 0.1, 0.6, 0, ALC 9.1
  { id: "whiteWine", category: "wine", nevo: 423, alcoholPer100: 9.1, sizes: WINE_SIZES },
  // NEVO 2610 Wijn rose: 71 kcal, 0.1, 2.5, 0, ALC 8.7
  { id: "rose", category: "wine", nevo: 2610, alcoholPer100: 8.7, sizes: WINE_SIZES },
  // NEVO 2142 Wijn witte zoete: 96 kcal, 0.2, 5.9, 0, ALC 10.2
  { id: "sweetWine", category: "wine", nevo: 2142, alcoholPer100: 10.2, sizes: WINE_SIZES },
  // NEVO 5246 Wijn alcoholvrij: 23 kcal, 0.1, 5.3, 0.1, ALC 0
  { id: "alcoholFreeWine", category: "wine", nevo: 5246, alcoholPer100: 0, sizes: WINE_SIZES },
];

export const ALCOHOL_CATEGORIES: AlcoholCategory[] = ["beer", "wine"];

export const alcoholDrinkById = (id: string): AlcoholDrink | undefined =>
  ALCOHOL_DRINKS.find((d) => d.id === id);

/** Saturday or Sunday, in local time. */
export const isWeekend = (date: Date): boolean => date.getDay() === 0 || date.getDay() === 6;

/** The two Settings switches for the Alcohol card (GymState.alcoholEnabled,
 *  alcoholWeekdays). */
export interface AlcoholSettings {
  /** Off: the card never shows, whatever the day holds. */
  enabled: boolean;
  /** On: the card is there every day, not only on Saturday and Sunday. */
  weekdays: boolean;
}

/** Tracking on, weekends only: how it was before the switches existed. */
export const DEFAULT_ALCOHOL_SETTINGS: AlcoholSettings = { enabled: true, weekdays: false };

/** Whether this day is one the card is offered on (so drinks can be added):
 *  every day with "also on weekdays", otherwise Saturday and Sunday. */
const alcoholDayOn = (day: Date, { weekdays }: AlcoholSettings): boolean =>
  weekdays || isWeekend(day);

/** The Alcohol card shows on its days, and on any other day only when it
 *  already has drinks (then read-only). Tracking off hides it everywhere. */
export const alcoholCardVisible = (
  day: Date,
  drinkCount: number,
  settings: AlcoholSettings = DEFAULT_ALCOHOL_SETTINGS,
): boolean => settings.enabled && (alcoholDayOn(day, settings) || drinkCount > 0);

/** Quick-adds and "+ Drink": only today, only on a day the card is for. */
export const alcoholLoggable = (
  day: Date,
  isToday: boolean,
  settings: AlcoholSettings = DEFAULT_ALCOHOL_SETTINGS,
): boolean => settings.enabled && isToday && alcoholDayOn(day, settings);

/** What the quick-add row offers before anything has been logged. */
export const DEFAULT_DRINK_CHOICES: { id: AlcoholDrinkId; ml: number }[] = [
  { id: "pils", ml: 330 },
  { id: "redWine", ml: 125 },
];

/** The list drink a food entry is: marked as one, or carrying exactly the
 *  one NEVO code of a listed drink (a beer logged through Add food). */
export function drinkOf(entry: Pick<FoodEntry, "drink" | "nevo">): AlcoholDrink | undefined {
  if (entry.drink) return alcoholDrinkById(entry.drink);
  if (entry.nevo?.length === 1) return ALCOHOL_DRINKS.find((d) => d.nevo === entry.nevo![0]);
  return undefined;
}

/** Grams of pure alcohol in an entry (its ml counted as g × NEVO's ALC / 100);
 *  0 for anything that isn't a listed drink. */
export function alcoholGrams(entry: Pick<FoodEntry, "drink" | "nevo" | "grams">): number {
  const drink = drinkOf(entry);
  return drink ? (entry.grams * drink.alcoholPer100) / 100 : 0;
}

/** Standard glasses (10 g of alcohol each) in a set of entries. */
export function standardGlasses(entries: Pick<FoodEntry, "drink" | "nevo" | "grams">[]): number {
  return entries.reduce((sum, e) => sum + alcoholGrams(e), 0) / STANDARD_GLASS_ALCOHOL_G;
}

/** Only the entries that are listed drinks. */
export const drinkEntries = <T extends Pick<FoodEntry, "drink" | "nevo">>(entries: T[]): T[] =>
  entries.filter((e) => drinkOf(e));

/** Calories of one serving, whole kcal. */
export const servingKcal = (food: Pick<NevoFood, "per100">, ml: number): number =>
  Math.round((food.per100.calories * ml) / 100);

/** The food entry for one serving: NEVO's name in the app's language, ml
 *  as grams, NEVO's values and code unchanged, the meal for the time of day. */
export function buildDrinkEntry(
  drink: AlcoholDrink,
  ml: number,
  food: NevoFood,
  language: "en" | "nl",
  now: Date = new Date(),
  id: string = crypto.randomUUID(),
): FoodEntry {
  const loggedAt = now.toISOString();
  return {
    id,
    name: nevoName(food, language),
    logged_at: loggedAt,
    meal: mealForTime(loggedAt),
    grams: ml,
    per100: { ...food.per100 },
    nevo: [food.code],
    drink: drink.id,
  };
}

export interface DrinkChoice {
  id: AlcoholDrinkId;
  ml: number;
}

/**
 * The quick-add choices: your most recent distinct drink + size
 * combinations, newest first, topped up from the defaults to at least two.
 */
export function quickDrinkChoices(
  entries: Pick<FoodEntry, "drink" | "nevo" | "grams" | "logged_at">[],
  limit = 3,
): DrinkChoice[] {
  const seen = new Set<string>();
  const out: DrinkChoice[] = [];
  const newestFirst = [...entries].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  for (const entry of newestFirst) {
    const drink = drinkOf(entry);
    if (!drink || !(entry.grams > 0)) continue;
    const key = `${drink.id}:${entry.grams}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: drink.id, ml: entry.grams });
    if (out.length >= limit) return out;
  }
  for (const d of DEFAULT_DRINK_CHOICES) {
    if (out.length >= 2) break;
    if (!seen.has(`${d.id}:${d.ml}`)) out.push(d);
  }
  return out;
}
