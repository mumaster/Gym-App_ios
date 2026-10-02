/**
 * Unpackaged food — fruit, vegetables, potatoes, grains, eggs, meat, fish,
 * dairy, nuts, drinks — from NEVO online (RIVM, the Dutch food composition table),
 * extracted by scripts/build-nevo-foods.mjs into nevoFoods.data.ts.
 *
 * Why NEVO and not Open Food Facts (which the barcode path uses): OFF's
 * entries for unpackaged food are volunteer-entered and inconsistent, and
 * its search is limited to 10 requests a minute. NEVO is the official
 * table, free, with Dutch and English names.
 *
 * RIVM's conditions of use: values only unchanged, with source and version;
 * additions must be clearly marked as such; any nutritional output must say
 * "Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven (and
 * other data sources)" (i18n `nutrition.nevoReference`); no charging users
 * for the data; move to a new NEVO version when one is released.
 */
import type { Macros } from "./nutrition";
import type { NevoRow } from "./nevoFoods.data";

/**
 * NEVO has sodium, not salt. Salt = sodium × 2.5, the conversion EU
 * Regulation 1169/2011 (Annex I) sets for nutrition labels. This is the
 * app's own addition to NEVO, and the review form says so.
 */
export const SALT_PER_SODIUM = 2.5;

export interface NevoFood {
  code: number;
  nl: string;
  en: string;
  /** NEVO's Dutch synonyms ("Bloemkool rauw" for "Kool bloem- rauw"). */
  synonyms: string[];
  group: number;
  per100: Macros;
  /** False when NEVO has no sodium value, so salt is unknown (0, flagged). */
  saltKnown: boolean;
  /** NEVO's alcohol (ALC) in g per 100 g, unchanged; 0 when NEVO lists none. */
  alcohol: number;
}

export function nevoFoodFromRow(row: NevoRow): NevoFood {
  const [code, nl, en, synonyms, group, calories, protein, carbs, fat, fiber, sodiumMg, alcohol] =
    row;
  return {
    code,
    nl,
    en,
    synonyms: synonyms
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean),
    group,
    per100: {
      calories,
      protein,
      carbs,
      fat,
      fiber,
      salt: sodiumMg == null ? 0 : Math.round(sodiumMg * SALT_PER_SODIUM) / 1000,
    },
    saltKnown: sodiumMg != null,
    alcohol: alcohol ?? 0,
  };
}

/** Name in the app's language; NEVO's own wording, unchanged. */
export const nevoName = (food: NevoFood, language: "en" | "nl") =>
  language === "nl" ? food.nl : food.en;

/**
 * A logged, starred or saved food carrying one NEVO code shows NEVO's name
 * in the app's language: an item still named with NEVO's other-language
 * name ("Banana" in the Dutch app) gets NEVO's name in this language
 * ("Banaan"). Anything else — a name the user typed, a recipe (several
 * codes), a food whose NEVO mark was dropped — is left alone. Returns the
 * same object when nothing changes.
 */
export function localizeNevoName<T extends { name: string; nevo?: number[] }>(
  item: T,
  byCode: Map<number, NevoFood>,
  language: "en" | "nl",
): T {
  const code = item.nevo?.length === 1 ? item.nevo[0] : undefined;
  const food = code == null ? undefined : byCode.get(code);
  if (!food) return item;
  const other = nevoName(food, language === "nl" ? "en" : "nl");
  const own = nevoName(food, language);
  if (own === other || foldText(item.name.trim()) !== foldText(other)) return item;
  return { ...item, name: own };
}

/** localizeNevoName over a list; the same array when nothing changes. */
export function localizeNevoNames<T extends { name: string; nevo?: number[] }>(
  items: T[],
  byCode: Map<number, NevoFood>,
  language: "en" | "nl",
): T[] {
  let changed = false;
  const next = items.map((item) => {
    const renamed = localizeNevoName(item, byCode, language);
    if (renamed !== item) changed = true;
    return renamed;
  });
  return changed ? next : items;
}

let loaded: Promise<NevoFood[]> | null = null;

/** The table, loaded on first use (a separate chunk, not the main bundle). */
export function loadNevoFoods(): Promise<NevoFood[]> {
  loaded ??= import("./nevoFoods.data").then((m) => m.NEVO_FOODS.map(nevoFoodFromRow));
  return loaded;
}

/** Lower case, accents dropped: "Crème" → "creme". */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const words = (s: string) =>
  foldText(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export interface NevoMatch {
  food: NevoFood;
  /** The synonym that matched, to show under NEVO's own name. */
  synonym?: string;
}

/**
 * Foods whose name (either language) or a synonym contains every word of
 * the query at the start of one of its words — "ban" finds Banaan/Banana,
 * "kip filet" finds Kipfilet. Ranked: the displayed name starting with the
 * query, then any name or synonym starting with it, then word matches, then
 * shorter names.
 */
export function searchNevoFoods(
  foods: NevoFood[],
  query: string,
  language: "en" | "nl",
  limit = 25,
): NevoMatch[] {
  const q = foldText(query).trim();
  const tokens = words(query);
  if (!tokens.length) return [];
  const scored: { match: NevoMatch; score: number; length: number }[] = [];
  for (const food of foods) {
    const own = nevoName(food, language);
    const candidates = [own, language === "nl" ? food.en : food.nl, ...food.synonyms];
    let best = Infinity;
    let synonym: string | undefined;
    candidates.forEach((name, i) => {
      const folded = foldText(name);
      const nameWords = words(name);
      let score: number;
      if (folded.startsWith(q)) score = i === 0 ? 0 : 1;
      else if (tokens.every((t) => nameWords.some((w) => w.startsWith(t)))) score = 2;
      else if (tokens.every((t) => t.length >= 4 && folded.includes(t))) score = 3;
      else return;
      if (score < best) {
        best = score;
        synonym = i >= 2 ? name : undefined;
      }
    });
    if (best < Infinity) {
      scored.push({
        match: synonym ? { food, synonym } : { food },
        score: best,
        length: own.length,
      });
    }
  }
  scored.sort(
    (a, b) => a.score - b.score || a.length - b.length || a.match.food.code - b.match.food.code,
  );
  return scored.slice(0, limit).map((s) => s.match);
}

/** Whether values still equal NEVO's, so an entry may keep its NEVO mark.
 *  Once the user changes a number it's their own data, not NEVO's. */
export function matchesNevo(values: Macros, nevo: Macros): boolean {
  return (Object.keys(nevo) as (keyof Macros)[]).every((k) => Math.abs(values[k] - nevo[k]) < 1e-9);
}
