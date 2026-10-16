import { addDays, dayKey, dayKeyFromDate } from "./date";

export { addDays, dayKey, dayKeyFromDate };

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/** Display order for grouping a day's log by meal. */
export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** Sensible default meal for a timestamp, based on local time of day. */
export function mealForTime(iso: string): MealType {
  const hour = new Date(iso).getHours();
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 18 && hour < 23) return "dinner";
  return "snack";
}

export interface FoodEntry {
  id: string;
  name: string;
  /** ISO timestamp when logged. */
  logged_at: string;
  /** Which meal this was logged under — set by the user when adding food. */
  meal: MealType;
  /** Grams actually eaten. */
  grams: number;
  /** Macros as labeled per 100g — the source-of-truth a scanned or entered label gives us. */
  per100: Macros;
  /** NEVO codes the values come from (a NEVO food, or a recipe with NEVO
   *  ingredients), so the NEVO reference shows where the day uses it.
   *  Dropped once the user changes a value. */
  nevo?: number[];
  /** Set on a beer or wine logged from Nutrition → Drinks (alcohol.ts's
   *  drink id), so it counts as a drink even after an edit drops the NEVO
   *  mark. The values are still the entry's own: calories count like any
   *  food. */
  drink?: string;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  /** Total sugars, the part of `carbs` that is sugar ("of which sugars" on
   *  an EU label): sugar from fruit and milk included, since no source gives
   *  free or added sugars per 100 g. Optional: undefined means not known
   *  (an old entry, or a food without the figure), never 0. Kept at or
   *  below `carbs` (see withSugars). */
  sugars?: number;
  fat: number;
  /** Saturated fat, the part of `fat` that is saturated ("of which
   *  saturates" on an EU label). Optional: undefined means not known (an
   *  old entry, or a food without the figure), never 0. Kept at or below
   *  `fat` (see withSatFat). */
  satFat?: number;
  fiber: number;
  salt: number;
}

/** `sugars` as a value to store: undefined when unknown (null, NaN or
 *  negative), never more than `carbs`. */
export function cleanSugars(sugars: number | null | undefined, carbs: number): number | undefined {
  if (sugars == null || !Number.isFinite(sugars) || sugars < 0) return undefined;
  return Math.min(sugars, Math.max(0, carbs));
}

/** Copies macros with `sugars` cleaned (see cleanSugars), dropping the key
 *  when it isn't known so saved state never holds `sugars: undefined`. */
export function withSugars<T extends Macros>(m: T, sugars: number | null | undefined): T {
  const { sugars: _old, ...rest } = m;
  const clean = cleanSugars(sugars, m.carbs);
  return (clean == null ? rest : { ...rest, sugars: clean }) as T;
}

/** `satFat` as a value to store: undefined when unknown (null, NaN or
 *  negative), never more than `fat`. */
export function cleanSatFat(satFat: number | null | undefined, fat: number): number | undefined {
  if (satFat == null || !Number.isFinite(satFat) || satFat < 0) return undefined;
  return Math.min(satFat, Math.max(0, fat));
}

/** Copies macros with `satFat` cleaned (see cleanSatFat), dropping the key
 *  when it isn't known so saved state never holds `satFat: undefined`. */
export function withSatFat<T extends Macros>(m: T, satFat: number | null | undefined): T {
  const { satFat: _old, ...rest } = m;
  const clean = cleanSatFat(satFat, m.fat);
  return (clean == null ? rest : { ...rest, satFat: clean }) as T;
}

export type NutrientKey = keyof Macros;

/** One ingredient within a saved MealTemplate — same shape a food entry uses. */
export interface MealIngredient {
  name: string;
  grams: number;
  per100: Macros;
  /** See FoodEntry.nevo. */
  nevo?: number[];
}

/** A named, reusable combo of ingredients (e.g. "Banana oatmeal") the user can log in one tap. */
export interface MealTemplate {
  id: string;
  name: string;
  ingredients: MealIngredient[];
}

/**
 * A named, reusable recipe: an ingredient list plus how many servings the
 * whole batch yields. Distinct from a MealTemplate above (which logs every
 * ingredient as its own entry, unscaled, every time): a Recipe computes
 * per-serving macros from its ingredients' combined totals divided by
 * `servings`, and logging it records a single food entry sized to however
 * many servings were actually eaten, rather than the whole batch.
 */
export interface Recipe {
  id: string;
  name: string;
  /** How many servings the full ingredient list yields. */
  servings: number;
  ingredients: MealIngredient[];
}

/** Per-serving macros — the whole batch's combined totals divided by `servings`. */
export function recipePerServing(recipe: Recipe): Macros {
  const total = dailyTotals(recipe.ingredients);
  const servings = Math.max(1, recipe.servings);
  return {
    calories: Math.round(total.calories / servings),
    protein: Number((total.protein / servings).toFixed(1)),
    carbs: Number((total.carbs / servings).toFixed(1)),
    ...(total.sugars != null && sugarsComplete(recipe.ingredients)
      ? { sugars: Number((total.sugars / servings).toFixed(1)) }
      : {}),
    fat: Number((total.fat / servings).toFixed(1)),
    ...(total.satFat != null && satFatComplete(recipe.ingredients)
      ? { satFat: Number((total.satFat / servings).toFixed(1)) }
      : {}),
    fiber: Number((total.fiber / servings).toFixed(1)),
    salt: Number((total.salt / servings).toFixed(2)),
  };
}

/** One logged glass/bottle/etc of water. */
export interface WaterEntry {
  id: string;
  ml: number;
  /** ISO timestamp when logged. */
  logged_at: string;
}

/** Quick-add amounts offered wherever water can be logged in one tap —
 *  the Nutrition screen's own Water card and the Home dashboard's Water
 *  tile both use this exact list, so the two never drift apart on what
 *  "quick add" means. */
export const WATER_QUICK_ADD = [250, 500, 750, 1000];

/** Largest single water amount the app accepts (a 3 L jug), so a typo like
 *  "6000" for a 600 ml bottle can't log six litres. A UI bound, not a
 *  nutrition number. */
export const WATER_AMOUNT_MAX_ML = 3000;

/** A typed water amount in ml, or null when it isn't a usable one. */
export function parseWaterMl(text: string): number | null {
  const ml = Math.round(Number(text.replace(",", ".")));
  return Number.isFinite(ml) && ml > 0 && ml <= WATER_AMOUNT_MAX_ML ? ml : null;
}

/** Quick-add taps on water this close together count as one drink
 *  (asked for: tapping +250ml twice logs 500 ml, not two 250s). A UI
 *  choice for telling a double tap from a second glass, not a nutrition
 *  number. */
export const WATER_MERGE_MS = 2000;

/** The last quick-add tap: which entry it went into and when. */
export interface WaterTap {
  id: string;
  at: number;
}

/**
 * Log a quick-add tap. Within WATER_MERGE_MS of the previous tap its amount
 * is added to that tap's entry (each tap restarts the window, so three quick
 * taps make one entry), as long as the entry still exists and the sum stays
 * within WATER_AMOUNT_MAX_ML; otherwise it's a new entry. The entry keeps
 * the time of its first tap.
 */
export function mergeWaterTap(
  entries: WaterEntry[],
  ml: number,
  now: number,
  last: WaterTap | null,
  newId: () => string,
): { entries: WaterEntry[]; tap: WaterTap } {
  if (last && now - last.at >= 0 && now - last.at <= WATER_MERGE_MS) {
    const target = entries.find((e) => e.id === last.id);
    if (target && target.ml + ml <= WATER_AMOUNT_MAX_ML) {
      return {
        entries: entries.map((e) => (e.id === target.id ? { ...e, ml: e.ml + ml } : e)),
        tap: { id: target.id, at: now },
      };
    }
  }
  const entry: WaterEntry = { id: newId(), ml, logged_at: new Date(now).toISOString() };
  return { entries: [entry, ...entries], tap: { id: entry.id, at: now } };
}

/** The user's four water shortcuts (GymState.waterQuickAdd): each slot kept
 *  when it's a usable amount, else that slot's default. */
export function sanitizeWaterShortcuts(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : [];
  return WATER_QUICK_ADD.map((fallback, i) => {
    const v = list[i];
    return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= WATER_AMOUNT_MAX_ML
      ? Math.round(v)
      : fallback;
  });
}

/** "600ml", "1L", "1.5L" — how a shortcut's amount is printed. */
export const formatWaterAmount = (ml: number) => (ml >= 1000 ? formatLiters(ml) : `${ml}ml`);

/**
 * Coffee, tracked by the cup like water, with an estimate of the caffeine.
 * Caffeine per drink is EFSA's (NDA Panel, Scientific opinion on the safety
 * of caffeine, EFSA Journal 2015;13(5):4102, as given in its consumer
 * summary and EUFIC's; confirmed through web search results): an espresso
 * (60 ml) about 80 mg, a cup of filter coffee (200 ml) about 90 mg. A
 * cappuccino or latte is counted as one espresso shot, since that's what's
 * in it — the app's own reading, not a separate published value; a double
 * shot is two espressos.
 */
export type CoffeeKind = "espresso" | "filter" | "milk";
export const COFFEE_KINDS: CoffeeKind[] = ["espresso", "filter", "milk"];
export const COFFEE_CAFFEINE_MG: Record<CoffeeKind, number> = {
  espresso: 80,
  filter: 90,
  milk: 80,
};
/** EFSA 2015 (same opinion): up to 400 mg a day raises no safety concerns
 *  for healthy adults; 200 mg a day for pregnant or breastfeeding women. */
export const CAFFEINE_DAILY_LIMIT_MG = 400;
export const CAFFEINE_PREGNANCY_LIMIT_MG = 200;

/** One logged coffee. */
export interface CoffeeEntry {
  id: string;
  kind: CoffeeKind;
  /** ISO timestamp when logged. */
  logged_at: string;
}

export const caffeineMg = (entries: { kind: CoffeeKind }[]) =>
  entries.reduce((sum, e) => sum + (COFFEE_CAFFEINE_MG[e.kind] ?? 0), 0);

/**
 * Where a meal's energy comes from, as whole percentages of the energy in
 * its protein, carbs and fat, using the EU's energy conversion factors
 * (Regulation 1169/2011, Annex XIV: protein 4, carbohydrate 4, fat
 * 9 kcal/g). Fiber and alcohol are left out, so this is the split between
 * the three macros, not a share of the logged kcal. Null with none of them.
 */
export const ENERGY_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;
export function energySplit(m: Pick<Macros, "protein" | "carbs" | "fat">) {
  const kcal = {
    protein: m.protein * ENERGY_PER_GRAM.protein,
    carbs: m.carbs * ENERGY_PER_GRAM.carbs,
    fat: m.fat * ENERGY_PER_GRAM.fat,
  };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  if (total <= 0) return null;
  const protein = Math.round((kcal.protein / total) * 100);
  const fat = Math.round((kcal.fat / total) * 100);
  // Carbs take the remainder so the three always add up to 100.
  return { protein, carbs: 100 - protein - fat, fat };
}

/** Trims a fixed-2dp liters string down to whatever precision it actually needs. */
export const formatLiters = (ml: number) => `${(ml / 1000).toFixed(2).replace(/\.?0+$/, "")}L`;

/** Display order used everywhere a nutrient list is shown. Sugars isn't in
 *  it: it's part of carbs, so it shows as an "of which sugars" line under
 *  carbs, and its goal is the optional sugar goal (sugarGoalGrams). Saturated
 *  fat likewise is an "of which saturates" line under fat (satFatGoalGrams). */
export const NUTRIENT_ORDER: NutrientKey[] = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "salt",
];

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  sugars: "Sugars",
  fat: "Fat",
  satFat: "Saturated fat",
  fiber: "Fiber",
  salt: "Salt",
};

export const NUTRIENT_UNITS: Record<NutrientKey, string> = {
  calories: "kcal",
  protein: "g",
  carbs: "g",
  sugars: "g",
  fat: "g",
  satFat: "g",
  fiber: "g",
  salt: "g",
};

/**
 * Daily limits the user sets for themselves — every field optional, since not
 * everyone wants to cap every nutrient. Can be typed in directly, or
 * pre-filled from a suggestion (see NutritionQuestionnaireSheet /
 * suggestNutritionGoals below) and adjusted from there — either way the
 * result is just plain numbers the user can always override.
 */
export type NutritionGoals = Partial<Record<NutrientKey, number>>;

export type Sex = "male" | "female";

/**
 * Total daily energy need, from the US National Academies' Dietary Reference
 * Intakes for Energy (2023): estimated energy requirement (EER) equations
 * fitted to doubly labelled water measurements — measured total energy
 * expenditure, the reference method — for adults 19+, by sex and one of four
 * physical activity level (PAL) categories. The categories count *all*
 * activity, workouts included, so gym sessions aren't added on top.
 *
 * Categories as the report describes them (PAL ranges 1.0–1.53, 1.53–1.68,
 * 1.68–1.85, 1.85–2.50): inactive = typical daily living only; low active =
 * plus 30–60 min of moderate activity a day; active = plus 60+ min a day;
 * very active = plus 60 min moderate and another 60 min vigorous (or 120
 * min moderate). The example in the questionnaire — a desk job plus 3–4
 * strength sessions a week as "low active" — is the app's own reading: four
 * 45-minute sessions average ~26 min a day, resistance training at 3.5 METs
 * is moderate intensity (2024 Compendium), and daily walking fills the rest.
 *
 * These replace Mifflin-St Jeor × the FAO/WHO/UNU 2004 lifestyle PAL bands
 * plus separately added session energy: that combination counted activity
 * twice and landed at the top of the measured range — a 31-year-old man of
 * 97 kg picking "active" got ~3,970 kcal, the 2023 "very active" value, while
 * his PT suggested an intake matching "low active"/"active".
 *
 * Coefficients: EER = intercept − age·A + height·H(cm) + weight·W(kg), in
 * kcal/day, confirmed through web search results quoting the report's tables
 * (the report site isn't reachable from this environment).
 */
export type ActivityLevel = "inactive" | "lowActive" | "active" | "veryActive";

type EerCoefficients = { intercept: number; age: number; height: number; weight: number };

export const EER_2023: Record<Sex, Record<ActivityLevel, EerCoefficients>> = {
  male: {
    inactive: { intercept: 753.07, age: 10.83, height: 6.5, weight: 14.1 },
    lowActive: { intercept: 581.47, age: 10.83, height: 8.3, weight: 14.94 },
    active: { intercept: 1004.82, age: 10.83, height: 6.52, weight: 15.91 },
    veryActive: { intercept: -517.88, age: 10.83, height: 15.61, weight: 19.11 },
  },
  female: {
    inactive: { intercept: 584.9, age: 7.01, height: 5.72, weight: 11.71 },
    lowActive: { intercept: 575.77, age: 7.01, height: 6.6, weight: 12.14 },
    active: { intercept: 710.25, age: 7.01, height: 6.54, weight: 12.34 },
    veryActive: { intercept: 511.83, age: 7.01, height: 9.07, weight: 12.56 },
  },
};

export const ACTIVITY_LEVELS: { id: ActivityLevel }[] = [
  { id: "inactive" },
  { id: "lowActive" },
  { id: "active" },
  { id: "veryActive" },
];

/** Estimated energy requirement (2023 DRI equations above), kcal/day. */
export function estimatedEnergyRequirement(p: NutritionProfile): number {
  const c = EER_2023[p.sex][p.activityLevel] ?? EER_2023[p.sex].lowActive;
  return c.intercept - c.age * p.age + c.height * p.heightCm + c.weight * p.weightKg;
}

/** "recomp": build muscle while losing fat (body recomposition). */
export type NutritionGoalType = "lose" | "recomp" | "maintain" | "gain";

export type NutritionPace = "mild" | "moderate" | "aggressive";

/**
 * Cutting: target a bodyweight loss of 0.5–1% per week (Helms, Aragon &
 * Fitschen, J Int Soc Sports Nutr 2014 — the rate that best preserves
 * muscle), with "moderate" at the midpoint. Converted to a daily deficit at
 * 7700 kcal per kg of bodyweight lost (the classic 3500 kcal/lb rule). Hall
 * (Int J Obes 2008) showed that rule overestimates the energy in weight lost
 * by lean people, so real loss can run a bit faster than the target — the
 * questionnaire tells the user to check their weekly weight and adjust.
 */
export const LOSS_RATE_PER_WEEK: Record<NutritionPace, number> = {
  mild: 0.005,
  moderate: 0.0075,
  aggressive: 0.01,
};
export const KCAL_PER_KG = 7700;

/** Bulking: a 10–20% energy surplus (Iraki, Fitschen, Espinar & Helms,
 *  Sports 2019, for a gain of ~0.25–0.5% bodyweight per week), with
 *  "moderate" at the midpoint. */
/**
 * Recomposition (building muscle while losing fat): Barakat, Pearson,
 * Escalante, Campbell & De Souza's review (Strength Cond J 2020) found it
 * possible with progressive training, enough protein and a small deficit or
 * maintenance, most of all for novices, returning lifters and people with
 * fat to lose. Murphy & Koehler's meta-regression (Scand J Med Sci Sports
 * 2022, 59 studies) found a deficit of about 500 kcal a day stopped lean
 * mass gains while strength still improved, so the deficit has to stay well
 * under that. 250 kcal is halfway between maintenance and that point: the
 * app's own pick within the "small deficit" the review describes, not a
 * published number. About 0.23 kg a week at 7700 kcal/kg. Both sources
 * confirmed through web search results (journal sites are blocked here).
 */
export const RECOMP_DEFICIT_KCAL = 250;

const GAIN_SURPLUS: Record<NutritionPace, number> = {
  mild: 0.1,
  moderate: 0.15,
  aggressive: 0.2,
};

/**
 * Protein, g/kg bodyweight. Maintain/gain: 1.6, the point past which extra
 * protein stopped adding muscle in Morton et al.'s meta-analysis (Br J
 * Sports Med 2018, breakpoint 1.62 g/kg). Cut: 2.2, the upper end of that
 * analysis's confidence interval — chosen because Helms et al. 2014
 * recommend 2.3–3.1 g/kg of *lean* mass in a deficit, and 2.2 g/kg of
 * bodyweight meets that lower bound for anyone above ~4% body fat, without
 * needing a body-fat measurement the app doesn't have.
 */
const PROTEIN_PER_KG: Record<NutritionGoalType, number> = {
  lose: 2.2,
  // Recomposition: 2.2 too, inside Barakat et al. 2020's 1.6–2.4 g/kg and
  // the same as a cut, since it's also a deficit.
  recomp: 2.2,
  maintain: 1.6,
  gain: 1.6,
};

/**
 * Fat, as the midpoint of where the relevant ranges overlap: cutting, Helms
 * et al. 2014's 15–30% of calories within the US Institute of Medicine's
 * acceptable 20–35% → 20–30%, midpoint 25%; maintaining/gaining, the IOM's
 * 20–35%, midpoint 27.5%, kept within Iraki et al. 2019's 0.5–1.5 g/kg.
 * Carbohydrate is the remainder, as both papers recommend.
 */
const FAT_SHARE: Record<NutritionGoalType, number> = {
  lose: 0.25,
  // A deficit this small is close to maintenance, so maintenance's share.
  recomp: 0.275,
  maintain: 0.275,
  gain: 0.275,
};
const FAT_G_PER_KG_RANGE: [number, number] = [0.5, 1.5];

/** 14 g per 1000 kcal — the US Dietary Guidelines / Institute of Medicine
 *  adequate intake for fiber. */
const FIBER_PER_1000_KCAL = 14;

/** Under 5 g salt (2 g sodium) a day — the WHO guideline for adults. */
const SALT_LIMIT_G = 5;

/** Never suggest below the lower end of the 2013 AHA/ACC/TOS obesity
 *  guideline's diet prescriptions (1200–1500 kcal/day for women,
 *  1500–1800 for men) — a floor for safety, not a recommendation. */
const MIN_CALORIES: Record<Sex, number> = { female: 1200, male: 1500 };

export interface NutritionProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  /** Strength sessions a week — splits the week into training and rest
   *  days (trainingDayGoalsFromAverage). Missing on profiles saved before
   *  this was asked. */
  sessionsPerWeek?: number;
  goal: NutritionGoalType;
  /** Only used for "lose" and "gain". */
  pace: NutritionPace;
}

/**
 * Water, from EFSA's Scientific Opinion on Dietary Reference Values for
 * water (NDA Panel, EFSA Journal 2010;8(3):1459), read from the opinion's
 * full text:
 *
 * - Adequate total water intake (drinks plus the water in food) is 2.0 L a
 *   day for women and 2.5 L for men, at moderate temperature and moderate
 *   activity (PAL 1.6). `WATER_AI_ML`.
 * - Section 6.3.2: total water can also be set per unit of energy; the
 *   Nordic, French and German-speaking guidelines advise 1 mL per kcal for
 *   adults. `WATER_ML_PER_KCAL`. That's what makes the suggestion follow
 *   activity: the energy need comes from the 2023 DRI equation at the
 *   user's own activity level and bodyweight (estimatedEnergyRequirement).
 *   EFSA writes "per unit of energy consumed"; the app uses the energy
 *   *need*, which is the same at energy balance, so a cut doesn't lower it.
 * - Section 6.1: food normally provides 20–30% of total water, drinks
 *   70–80%. `WATER_FROM_DRINKS` takes 80%, the end that assumes the least
 *   from food, so the drinks goal isn't set short.
 *
 * The suggestion is the larger of the adequate intake and 1 mL/kcal, times
 * the drinks share, rounded to 100 mL. EFSA adds 300 mL in pregnancy and
 * 700 mL when breastfeeding; the questionnaire doesn't ask about either,
 * so the goal is left for the user to raise. Heavy sweating (heat, long
 * sessions) needs more again: EFSA only says losses must be replaced, and
 * the ACSM fluid stand (Sawka et al. 2007) says sweat rates vary too much
 * between people for one figure, so no per-hour amount is added.
 */
export const WATER_AI_ML: Record<Sex, number> = { female: 2000, male: 2500 };
export const WATER_ML_PER_KCAL = 1;
export const WATER_FROM_DRINKS = 0.8;

/** Suggested daily drinks in mL for a profile (see WATER_AI_ML). */
export function suggestWaterGoalMl(p: NutritionProfile): number {
  const total = Math.max(WATER_AI_ML[p.sex], estimatedEnergyRequirement(p) * WATER_ML_PER_KCAL);
  return Math.round((total * WATER_FROM_DRINKS) / 100) * 100;
}

/**
 * Suggests daily limits from a short profile — a starting point to review
 * and adjust, not a prescription. Every constant above names its source.
 * Energy: the 2023 DRI estimated energy requirement for the chosen
 * activity level (workouts included — see EER_2023); then the goal's
 * deficit/surplus; then the safety floor.
 */
export function suggestNutritionGoals(p: NutritionProfile): NutritionGoals {
  const tdee = estimatedEnergyRequirement(p);
  const target =
    p.goal === "lose"
      ? tdee - (LOSS_RATE_PER_WEEK[p.pace] * p.weightKg * KCAL_PER_KG) / 7
      : p.goal === "gain"
        ? tdee * (1 + GAIN_SURPLUS[p.pace])
        : p.goal === "recomp"
          ? tdee - RECOMP_DEFICIT_KCAL
          : tdee;
  const calories = Math.max(MIN_CALORIES[p.sex], Math.round(target));

  const protein = Math.round(PROTEIN_PER_KG[p.goal] * p.weightKg);
  let fat = (calories * FAT_SHARE[p.goal]) / 9;
  if (p.goal !== "lose") {
    // Includes recomp, whose fat share is maintenance's.
    const [lo, hi] = FAT_G_PER_KG_RANGE;
    fat = Math.min(hi * p.weightKg, Math.max(lo * p.weightKg, fat));
  }
  fat = Math.round(fat);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  const fiber = Math.round((calories / 1000) * FIBER_PER_1000_KCAL);

  return { calories, protein, carbs, fat, fiber, salt: SALT_LIMIT_G };
}

/**
 * Rest-day adjustment, grounded in two published sources rather than a flat
 * percentage:
 *
 * - How much: the energy cost of the session that a rest day doesn't have,
 *   from the 2024 Adult Compendium of Physical Activities (Herrmann et al.,
 *   J Sport Health Sci 2024). Code 02054, "resistance (weight) training,
 *   multiple exercises, 8-15 reps at varied resistance" = 3.5 METs; code
 *   02055, "resistance training, circuit, reciprocal supersets" = 5.8 METs.
 *   1 MET = 1 kcal/kg/h, the cost of sitting quietly, so the *extra* energy
 *   of a session over spending that time at rest is (MET − 1) × kg × hours.
 * - Where from: carbohydrate only. The ACSM/Academy of Nutrition and
 *   Dietetics/Dietitians of Canada joint position (Thomas et al., 2016) and
 *   Burke et al. (J Sports Sci 2011) scale daily carbohydrate to the fuel
 *   needs of that day's training, while the ISSN protein position stand
 *   (Jäger et al., 2017) sets protein as a daily 1.4–2.0 g/kg target
 *   regardless of whether you trained — so protein and fat stay the same.
 */
export const RESISTANCE_TRAINING_MET = 3.5;
export const SUPERSET_TRAINING_MET = 5.8;

/** Extra kcal a session costs over spending the same time at rest. */
export function sessionEnergyKcal(weightKg: number, minutes: number, met: number): number {
  return Math.max(0, Math.round((met - 1) * weightKg * (minutes / 60)));
}

/** Rest-day limits: training-day limits minus one session's energy, taken
 *  entirely from carbs (1 g carbohydrate ≈ 4 kcal). */
export function deriveRestDayGoals(training: NutritionGoals, sessionKcal: number): NutritionGoals {
  const rest: NutritionGoals = { ...training };
  if (training.calories != null) {
    rest.calories = Math.max(0, Math.round(training.calories - sessionKcal));
    if (training.carbs != null) {
      rest.carbs = Math.max(0, Math.round(training.carbs - sessionKcal / 4));
    }
  }
  return rest;
}

/** Rest-day limits: derived from training-day ones, with any field the user
 *  set by hand taking precedence. */
export const restDayGoals = (
  training: NutritionGoals,
  overrides: NutritionGoals,
  sessionKcal: number,
): NutritionGoals => ({
  ...deriveRestDayGoals(training, sessionKcal),
  ...overrides,
});

/** Turns one average daily target into training-day limits such that, with
 *  rest days derived via deriveRestDayGoals, the weekly average calories
 *  still land on the original target: with n training days and a session
 *  cost D, 7·avg = n·T + (7−n)·(T−D), so T = avg + D·(7−n)/7. The extra
 *  calories go to carbs.
 *
 *  Why training days go *above* the suggestion rather than staying on it:
 *  the suggestion (EER_2023) is an average day. The DRI 2023 equations are
 *  fitted to doubly labelled water, which measures the average daily energy
 *  use over a 7–14 day period (training days and rest days together), and
 *  the activity level already counts the workouts. Keeping training days at
 *  that average while rest days drop by D would put the week D·(7−n)/7 kcal
 *  a day under target: an extra deficit on top of the chosen pace (confirmed
 *  through web search results; the report site isn't reachable from here). */
export function trainingDayGoalsFromAverage(
  average: NutritionGoals,
  trainingDaysPerWeek: number,
  sessionKcal: number,
  weeklyCardioKcal = 0,
): NutritionGoals {
  if (average.calories == null) return average;
  const n = Math.min(7, Math.max(0, trainingDaysPerWeek));
  // Planned cardio is added on its own days (addDayEnergy), so the week's
  // cardio energy C comes out of the base here: 7·avg = n·T + (7−n)·(T−D) + C.
  // The average already includes it, since the activity level counts all
  // activity, cardio as well as the gym.
  const extra = (sessionKcal * (7 - n) - weeklyCardioKcal) / 7;
  const training: NutritionGoals = { ...average, calories: Math.round(average.calories + extra) };
  if (average.carbs != null) training.carbs = Math.round(average.carbs + extra / 4);
  return training;
}

/** The average daily calories over a week with this many training days,
 *  using the same rest-day limits the app applies (overrides included).
 *  Null when there are no calorie limits to average. */
export function weeklyAverageCalories(
  training: NutritionGoals,
  overrides: NutritionGoals,
  trainingDaysPerWeek: number,
  sessionKcal: number,
  weeklyCardioKcal = 0,
): number | null {
  if (training.calories == null) return null;
  const n = Math.min(7, Math.max(0, trainingDaysPerWeek));
  const rest = restDayGoals(training, overrides, sessionKcal).calories ?? training.calories;
  return Math.round((n * training.calories + (7 - n) * rest + weeklyCardioKcal) / 7);
}

/** A day's limits plus the energy of that day's cardio, all from carbs —
 *  the same rule as the rest-day reduction, in the other direction: the
 *  joint position (Thomas et al., 2016) and Burke et al. (2011) scale daily
 *  carbohydrate to the day's training, protein and fat stay the same. */
export function addDayEnergy(goals: NutritionGoals, kcal: number): NutritionGoals {
  if (kcal <= 0 || goals.calories == null) return goals;
  const next: NutritionGoals = { ...goals, calories: Math.round(goals.calories + kcal) };
  if (goals.carbs != null) next.carbs = Math.round(goals.carbs + kcal / 4);
  return next;
}

export type NutrientStatus = "none" | "ok" | "near" | "over";

/** How close `consumed` is to `limit` — drives the overview meter's color/copy. */
export function nutrientStatus(consumed: number, limit: number | undefined): NutrientStatus {
  if (limit == null || limit <= 0) return "none";
  if (consumed > limit) return "over";
  if (consumed >= limit * 0.85) return "near";
  return "ok";
}

/** Scales per-100g label values by grams — works for a FoodEntry or a MealIngredient alike. */
export function scaledMacros(entry: { grams: number; per100: Macros }): Macros {
  const factor = entry.grams / 100;
  return {
    calories: Math.round(entry.per100.calories * factor),
    protein: Number((entry.per100.protein * factor).toFixed(1)),
    carbs: Number((entry.per100.carbs * factor).toFixed(1)),
    ...(entry.per100.sugars != null
      ? { sugars: Number((Math.min(entry.per100.sugars, entry.per100.carbs) * factor).toFixed(1)) }
      : {}),
    fat: Number((entry.per100.fat * factor).toFixed(1)),
    ...(entry.per100.satFat != null
      ? { satFat: Number((Math.min(entry.per100.satFat, entry.per100.fat) * factor).toFixed(1)) }
      : {}),
    fiber: Number((entry.per100.fiber * factor).toFixed(1)),
    salt: Number((entry.per100.salt * factor).toFixed(2)),
  };
}

/** Filters any logged_at-timestamped list (FoodEntry, WaterEntry, …) down to one calendar day. */
export function entriesForDay<T extends { logged_at: string }>(entries: T[], key: string): T[] {
  return entries.filter((e) => dayKey(e.logged_at) === key);
}

/** Logged foods as saved-meal ingredients (same name, portion and values;
 *  the NEVO mark travels along, see FoodEntry.nevo). */
export function ingredientsFromEntries(entries: FoodEntry[]): MealIngredient[] {
  return entries.map((e) => ({
    name: e.name,
    grams: e.grams,
    per100: { ...e.per100 },
    ...(e.nevo?.length ? { nevo: [...e.nevo] } : {}),
  }));
}

/** Recently logged distinct foods, newest first, for Add food's Recent list
 *  (asked for: snacks in Snack, dinner foods in Dinner, no potatoes among the
 *  snacks). With a `meal`, only foods logged in that meal; when that meal has
 *  nothing logged yet, the newest from all meals, with `forMeal` false so the
 *  list can say so. Names are compared case-insensitively, the newest entry's
 *  portion wins, and names in `exclude` (the favourites, listed separately)
 *  are skipped. */
export function recentFoods(
  entries: FoodEntry[],
  { meal, exclude, limit }: { meal?: MealType | undefined; exclude: Set<string>; limit: number },
): { foods: MealIngredient[]; forMeal: boolean } {
  const newest = [...entries].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  const pick = (list: FoodEntry[]) => {
    const seen = new Set<string>();
    const out: MealIngredient[] = [];
    for (const entry of list) {
      const key = entry.name.trim().toLowerCase();
      if (!key || seen.has(key) || exclude.has(key)) continue;
      seen.add(key);
      out.push(...ingredientsFromEntries([entry]));
      if (out.length >= limit) break;
    }
    return out;
  };
  if (meal) {
    const own = pick(newest.filter((e) => e.meal === meal));
    if (own.length) return { foods: own, forMeal: true };
  }
  return { foods: pick(newest), forMeal: false };
}

/** Lower-cased names of the foods ever logged in a meal: Add food's search
 *  lists your own matches from that meal first. */
export function foodKeysInMeal(entries: FoodEntry[], meal: MealType): Set<string> {
  return new Set(entries.filter((e) => e.meal === meal).map((e) => e.name.trim().toLowerCase()));
}

/** Totals of a list of foods. `sugars` (and `satFat`) is the sum of the
 *  foods whose value is known, and is left out when none is; use
 *  sugarsComplete (satFatComplete) to tell whether that sum is the whole
 *  figure or "at least". */
export function dailyTotals(entries: { grams: number; per100: Macros }[]): Macros {
  return entries.reduce<Macros>(
    (acc, e) => {
      const m = scaledMacros(e);
      const sugars =
        m.sugars != null || acc.sugars != null
          ? Number(((acc.sugars ?? 0) + (m.sugars ?? 0)).toFixed(1))
          : undefined;
      const satFat =
        m.satFat != null || acc.satFat != null
          ? Number(((acc.satFat ?? 0) + (m.satFat ?? 0)).toFixed(1))
          : undefined;
      return {
        calories: acc.calories + m.calories,
        protein: Number((acc.protein + m.protein).toFixed(1)),
        carbs: Number((acc.carbs + m.carbs).toFixed(1)),
        ...(sugars != null ? { sugars } : {}),
        fat: Number((acc.fat + m.fat).toFixed(1)),
        ...(satFat != null ? { satFat } : {}),
        fiber: Number((acc.fiber + m.fiber).toFixed(1)),
        salt: Number((acc.salt + m.salt).toFixed(2)),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 },
  );
}

/** True when every food that has carbs also has its sugars known, so the
 *  summed sugars are the real figure; false means show it as "at least". */
export function sugarsComplete(entries: { grams: number; per100: Macros }[]): boolean {
  return entries.every((e) => e.per100.sugars != null || e.per100.carbs <= 0 || e.grams <= 0);
}

/** True when every food that has fat also has its saturated fat known, so
 *  the summed satFat is the real figure; false means show it as "at least". */
export function satFatComplete(entries: { grams: number; per100: Macros }[]): boolean {
  return entries.every((e) => e.per100.satFat != null || e.per100.fat <= 0 || e.grams <= 0);
}

/**
 * The optional sugar goal: a share of the day's calorie goal, at 4 kcal per
 * gram. WHO (2015) advises free sugars below 10% of total energy (strong
 * recommendation) and below 5% for extra benefit (conditional); the US
 * Dietary Guidelines 2025-2030 also use 10% for added sugars. The app only
 * knows total sugars (fruit and milk included), so this is a soft guide.
 * Off unless the user picks a share; a sugars value typed into the goals
 * wins over it.
 */
export const SUGAR_GOAL_SHARES = [0.1, 0.05] as const;
export type SugarGoalShare = (typeof SUGAR_GOAL_SHARES)[number];

export const sugarGoalGrams = (calories: number, share: number): number =>
  Math.round((calories * share) / 4);

/** A day's limits with the sugar goal filled in from that day's calories
 *  (so it follows training, rest and cardio days), unless the user set a
 *  sugars value of their own or the goal is off. */
export function withSugarGoal(goals: NutritionGoals, share: number | null): NutritionGoals {
  if (goals.sugars != null || !share || goals.calories == null) return goals;
  return { ...goals, sugars: sugarGoalGrams(goals.calories, share) };
}

/**
 * The optional saturated fat goal: a share of the calorie goal, at 9 kcal per
 * gram. 10% is the common recommendation (WHO 2023, the Dutch
 * Gezondheidsraad and CVRM guideline, US Dietary Guidelines 2025-2030); 6%
 * is the stricter AHA-style option. Users can also pick a custom whole
 * percent (1-20), so the state holds any number. Off unless the user picks
 * a share; a satFat value typed into the goals wins over it.
 */
export const SATFAT_GOAL_SHARES = [0.1, 0.06] as const;

export const satFatGoalGrams = (calories: number, share: number): number =>
  Math.round((calories * share) / 9);

/** The goals with the saturated fat goal filled in from `baseCalories`, the
 *  unshifted training-day calorie goal: unlike sugars it does not follow
 *  rest, cardio or weekend-budget days (the app keeps fat constant on rest
 *  days, and the budget only moves carbs), so every day gets the same
 *  grams. Capped at the fat goal when there is one. Unchanged when the user
 *  typed a satFat value, the goal is off or there is no calorie goal. */
export function withSatFatGoal(
  goals: NutritionGoals,
  share: number | null,
  baseCalories: number | null | undefined,
): NutritionGoals {
  if (goals.satFat != null || !share || baseCalories == null) return goals;
  const grams = satFatGoalGrams(baseCalories, share);
  return { ...goals, satFat: goals.fat != null ? Math.min(grams, goals.fat) : grams };
}

/** True when the saturated fat goal takes more than half of the fat goal. */
export function satFatGoalTakesMostOfFat(goals: NutritionGoals): boolean {
  return goals.satFat != null && goals.fat != null && goals.satFat > goals.fat / 2;
}

/**
 * Weekend budget: more calories on the weekend, fewer on the other days, the
 * week's total unchanged. Friday counts as half a day (Friday evening), so the
 * weekend is Friday evening, Saturday and Sunday.
 *
 * Sizes. Default 10% of the average daily goal, adjustable 5–20%: the Lose It!
 * cohort (Reynolds et al., JMIR mHealth 2018, 7,007 app users) lost the same
 * or more with a planned small weekend excess (about 50–250 kcal a day over
 * Monday) as with none, and less with 500+ kcal, which is what 20% of a
 * typical goal reaches. The 5/10/15/20 steps and the 15% limit on how far one
 * weekday may drop (`WEEKDAY_MAX_DROP`) are the app's own choices, no source
 * gives them. The week's total is held by construction, so a smaller
 * weekday capacity shrinks the weekend uplift instead of the average moving.
 * The energy is split between carbs and fat (weekend foods are usually
 * heavier in fat); protein stays the same on every day.
 */
export const WEEKEND_SHARES = [0.05, 0.1, 0.15, 0.2] as const;
export const WEEKEND_DEFAULT_SHARE = 0.1;
export const WEEKDAY_MAX_DROP = 0.15;
/** Fri, Sat, Sun (Monday-first): how much of a full weekend day each gets. */
export const WEEKEND_WEIGHTS = [0, 0, 0, 0, 0.5, 1, 1] as const;
/** Where the weekday reduction comes from: every Monday–Thursday, or only the
 *  rest days among them (falling back to all four when none is a rest day). */
export type WeekendFrom = "all" | "rest";
export interface WeekendBudget {
  share: number;
  from: WeekendFrom;
}
export const DEFAULT_WEEKEND_BUDGET: WeekendBudget = {
  share: WEEKEND_DEFAULT_SHARE,
  from: "all",
};
/** Share of an offset taken from carbs; the rest comes from fat. */
export const WEEKEND_CARB_SHARE = 0.5;

/** Calories added to (or taken from) each day of one Monday–Sunday week. The
 *  offsets sum to zero. `base` is each day's calorie limit before the shift,
 *  `restDay` flags the days with no training; `floor` is the lowest limit a
 *  day may be taken to. */
export function weekendOffsets(
  base: number[],
  restDay: boolean[],
  budget: WeekendBudget,
  floor: number,
): number[] {
  const out = base.map(() => 0);
  if (base.length !== 7) return out;
  const avg = base.reduce((a, b) => a + b, 0) / 7;
  const uplift = WEEKEND_WEIGHTS.map((w) => w * budget.share * avg);
  const total = uplift.reduce((a, b) => a + b, 0);
  let from = [0, 1, 2, 3];
  if (budget.from === "rest") {
    const rest = from.filter((i) => restDay[i]);
    if (rest.length) from = rest;
  }
  const room = from.map((i) =>
    Math.max(0, Math.min(WEEKDAY_MAX_DROP * base[i]!, base[i]! - floor)),
  );
  const capacity = room.reduce((a, b) => a + b, 0);
  if (total <= 0 || capacity <= 0) return out;
  const scale = Math.min(1, capacity / total);
  uplift.forEach((u, i) => (out[i] = Math.round(u * scale)));
  const taken = out.reduce((a, b) => a + b, 0);
  let left = taken;
  from.forEach((day, k) => {
    const cut = k === from.length - 1 ? left : Math.round((taken * room[k]!) / capacity);
    out[day] = -cut;
    left -= cut;
  });
  return out;
}

/** A day's limits moved by `kcal`, split between carbs and fat. */
export function withEnergyShift(goals: NutritionGoals, kcal: number): NutritionGoals {
  if (!kcal || goals.calories == null) return goals;
  const next: NutritionGoals = { ...goals, calories: Math.max(0, goals.calories + kcal) };
  if (goals.carbs != null && goals.fat != null) {
    next.carbs = Math.max(0, Math.round(goals.carbs + (kcal * WEEKEND_CARB_SHARE) / 4));
    next.fat = Math.max(0, Math.round(goals.fat + (kcal * (1 - WEEKEND_CARB_SHARE)) / 9));
  } else if (goals.carbs != null) {
    next.carbs = Math.max(0, Math.round(goals.carbs + kcal / 4));
  }
  return next;
}

/** A saved weekend budget, or null when it's off or isn't one. */
export function cleanWeekendBudget(raw: unknown): WeekendBudget | null {
  if (!raw || typeof raw !== "object") return null;
  const { share, from } = raw as Partial<WeekendBudget>;
  if (typeof share !== "number" || !(WEEKEND_SHARES as readonly number[]).includes(share))
    return null;
  return { share, from: from === "rest" ? "rest" : "all" };
}

export const calorieFloor = (sex: Sex | null | undefined): number => MIN_CALORIES[sex ?? "male"];

/**
 * Protein per meal: 0.4 g per kg of bodyweight. Schoenfeld & Aragon's review
 * (J Int Soc Sports Nutr 2018) concludes that, to maximise muscle building,
 * protein should be eaten at a target of 0.4 g/kg per meal across at least
 * four meals, reaching at least 1.6 g/kg a day (the same daily figure as the
 * protein target above). Confirmed through web search results. Shown as a
 * check on a meal in the food log — a nudge, never a limit.
 */
export const PROTEIN_PER_MEAL_G_PER_KG = 0.4;

export function proteinPerMealTarget(bodyKg: number | null): number | null {
  return bodyKg ? Math.round(PROTEIN_PER_MEAL_G_PER_KG * bodyKg) : null;
}

export interface WeekDayIntake {
  key: string;
  calories: number;
  goal: number | undefined;
  logged: boolean;
}

/**
 * Average calories over a week's finished, logged days against the average
 * of those same days' limits. Today is left out while it's still going (a
 * half-logged day would drag the average down), as are days with nothing
 * logged — a missing log isn't a zero-calorie day. Null with no such day.
 * When cutting, the weekly average is what moves weight, not any one day.
 */
export function weeklyAverage(
  days: WeekDayIntake[],
  todayKey: string,
): { calories: number; goal: number | null; days: number } | null {
  const counted = days.filter((d) => d.logged && d.key < todayKey);
  if (!counted.length) return null;
  const calories = Math.round(counted.reduce((s, d) => s + d.calories, 0) / counted.length);
  const withGoal = counted.filter((d) => d.goal != null);
  const goal =
    withGoal.length === counted.length
      ? Math.round(withGoal.reduce((s, d) => s + d.goal!, 0) / withGoal.length)
      : null;
  return { calories, goal, days: counted.length };
}

/** Distinct NEVO codes behind a list of foods, or undefined if none. */
export function nevoCodes(foods: { nevo?: number[] }[]): number[] | undefined {
  const codes = [...new Set(foods.flatMap((f) => f.nevo ?? []))];
  return codes.length ? codes : undefined;
}
