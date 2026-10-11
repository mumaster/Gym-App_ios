/**
 * "Can I eat this?": checks a product's ingredient text (and the allergen
 * data from Open Food Facts) against the allergies picked in Settings.
 * Only sulphites for now; `ALLERGIES` is the list Settings offers, so adding
 * another means one entry here plus its terms.
 *
 * Three verdicts, not yes/no:
 *  - "contains": sulphites are named (E220-E228, "sulphite", "sulphur dioxide"
 *    and their Dutch / German / French / Spanish names), or the allergen data says so.
 *  - "maybe": nothing is named, but the food is a known source (wine, wine
 *    vinegar, dried fruit, ...) or the label has "may contain" wording.
 *  - "none": nothing found. Only said when there was text to read; sulphites
 *    under 10 mg/kg need no label, so this is a guide, not a guarantee.
 */

export type AllergyId = "sulphites";

export const ALLERGIES: readonly AllergyId[] = ["sulphites"];

export type Verdict = "contains" | "maybe" | "none";

/** Why a hit counted: an additive code, a named ingredient, the label's own
 *  allergen data, a food that is usually treated with sulphites, or
 *  "may contain" wording. */
export type HitKind = "additive" | "named" | "declared" | "sourceFood" | "mayContain";

export interface Hit {
  kind: HitKind;
  /** What to show: "E223", "sodium metabisulphite", "dried apricots". */
  term: string;
}

export interface AllergenResult {
  verdict: Verdict;
  hits: Hit[];
}

/** E220-E228 (E225 and E228's neighbours included: the whole range). */
const ADDITIVE_CODE = /\be[\s\-.]?(22[0-8])(?![0-9])/gi;

/** Names that mean sulphites outright, across the languages the app and the
 *  products it meets use. Matched on the folded text (no accents). */
const NAMED = [
  "sulphur dioxide",
  "sulfur dioxide",
  "sulphite",
  "sulfite",
  "metabisulphite",
  "metabisulfite",
  "bisulphite",
  "bisulfite",
  "zwaveldioxide",
  "zwaveligzuur",
  "sulfiet",
  "sulfieten",
  "metabisulfiet",
  "bisulfiet",
  "dioxyde de soufre",
  "anhydride sulfureux",
  "sulfites",
  "schwefeldioxid",
  "schwefelige saure",
  "sulfito",
  "dioxido de azufre",
  "anidride solforosa",
  "solfiti",
];

/** Foods that are usually made with sulphites, or sprayed with them, even
 *  when the label doesn't say so. Sources: Anaphylaxis UK, ASCIA, EUFIC. */
const SOURCE_FOODS = [
  "wine",
  "wijn",
  "wine vinegar",
  "wijnazijn",
  "balsamic",
  "balsamico",
  "vinegar",
  "azijn",
  "cider",
  "beer",
  "bier",
  "dried fruit",
  "gedroogd fruit",
  "gedroogde",
  "dried apricot",
  "abrikoos",
  "raisin",
  "rozijn",
  "sultana",
  "currant",
  "prune",
  "pruim",
  "dried fig",
  "dried coconut",
  "dried mushroom",
  "dried onion",
  "dried potato",
  "dehydrated",
  "gedroogd",
  "grape juice",
  "druivensap",
  "lemon juice",
  "lime juice",
  "citroensap",
  "limoensap",
  "jam",
  "marmalade",
  "marmelade",
  "maraschino",
  "glace cherry",
  "glace cherries",
  "pickle",
  "augurk",
  "sauerkraut",
  "mustard",
  "mosterd",
  "horseradish",
  "mierikswortel",
  "guacamole",
  "coconut milk",
  "kokosmelk",
  "prawn",
  "shrimp",
  "garnaal",
  "sausage",
  "worst",
  "salad dressing",
  "dressing",
  "molasses",
  "stroop",
  "glucose syrup",
  "glucosestroop",
  "corn syrup",
  "tofu",
  "cordial",
  "squash",
  "fruit juice concentrate",
  "vruchtensap",
  "ready made potato",
  "frozen potato",
  "friet",
];

/** Allergen sections that mean "may contain": the label's own warning. */
const MAY_CONTAIN =
  /(may contain|traces? of|kan sporen|sporen van|kan .{0,40}bevatten|peut contenir|kann .{0,30}enthalten)[^.;\n]{0,80}/gi;

/** Lowercase, strip accents, and make dashes and odd spaces plain. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ");
}

/** Does `needle` occur in `hay` as a whole word, allowing a plural ("raisins",
 *  "rozijnen")? Keeps "jam" out of "jamaican" and "beer" out of "cranberry". */
function hasTerm(hay: string, needle: string): boolean {
  const escaped = needle.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(s|es|en|n)?($|[^a-z0-9])`).test(hay);
}

/** The allergen / additive tags Open Food Facts attaches to a product. */
export interface ProductTags {
  allergens?: string[];
  traces?: string[];
  additives?: string[];
}

const SULPHITE_ALLERGEN_TAG =
  /sulphur-dioxide|sulfur-dioxide|sulphites|sulfites|sulfiet|zwaveldioxide/;

export function checkSulphites(
  ingredientsText: string | null | undefined,
  tags: ProductTags = {},
): AllergenResult | null {
  const raw = ingredientsText?.trim() ?? "";
  const hasTags = Boolean(tags.allergens?.length || tags.traces?.length || tags.additives?.length);
  if (!raw && !hasTags) return null;

  const text = fold(raw);
  const hits: Hit[] = [];
  const seen = new Set<string>();
  const add = (kind: HitKind, term: string) => {
    const key = `${kind}:${term.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ kind, term });
  };

  // Strong: additive codes in the text or the product's additive tags.
  for (const m of text.matchAll(ADDITIVE_CODE)) add("additive", `E${m[1]}`);
  for (const tag of tags.additives ?? []) {
    const m = /e(22[0-8])(?![0-9])/i.exec(tag);
    if (m) add("additive", `E${m[1]}`);
  }
  for (const name of NAMED) {
    if (text.includes(name)) add("named", name);
  }
  for (const tag of tags.allergens ?? []) {
    if (SULPHITE_ALLERGEN_TAG.test(tag.toLowerCase())) add("declared", "sulphites");
  }

  // "May contain" wording that mentions sulphites is only a maybe; a trace
  // tag likewise. Computed before so the named hit above can be downgraded.
  const mayContainHits = [...text.matchAll(MAY_CONTAIN)].filter((m) =>
    NAMED.some((n) => m[0].includes(n)),
  );
  const traceTagged = (tags.traces ?? []).some((tag) =>
    SULPHITE_ALLERGEN_TAG.test(tag.toLowerCase()),
  );

  let strong = hits.length > 0;
  if (strong && mayContainHits.length && !hasStrongOutsideMayContain(text, hits, mayContainHits)) {
    // The only mentions sit inside "may contain" sentences.
    strong = false;
    hits.length = 0;
    for (const m of mayContainHits) add("mayContain", m[0].trim());
  } else if (!strong && (mayContainHits.length || traceTagged)) {
    if (traceTagged) add("mayContain", "sulphites");
    for (const m of mayContainHits) add("mayContain", m[0].trim());
  }

  if (strong) return { verdict: "contains", hits: dropContained(hits) };

  for (const food of SOURCE_FOODS) {
    if (hasTerm(text, food)) add("sourceFood", food.trim());
  }

  const shown = dropContained(hits).slice(0, 6);
  if (shown.length) return { verdict: "maybe", hits: shown };
  return { verdict: "none", hits: [] };
}

/** Whether any strong hit is mentioned outside a "may contain" sentence. */
function hasStrongOutsideMayContain(
  text: string,
  hits: Hit[],
  mayContain: RegExpMatchArray[],
): boolean {
  let rest = text;
  for (const m of mayContain) rest = rest.replace(m[0], " ");
  return hits.some((h) => {
    if (h.kind === "declared") return true;
    if (h.kind === "additive") {
      const re = new RegExp(`\\be[\\s\\-.]?${h.term.slice(1)}(?![0-9])`);
      // Not in the text at all: it came from the product's additive tags.
      return re.test(rest) || !re.test(text);
    }
    return rest.includes(h.term);
  });
}

/** "sulphite" inside "metabisulphite", "wine" inside "wine vinegar": one line
 *  for what the label actually says. Additive codes always stay. */
function dropContained(hits: Hit[]): Hit[] {
  return hits.filter(
    (h) =>
      h.kind === "additive" ||
      !hits.some(
        (o) => o !== h && o.kind === h.kind && o.term !== h.term && o.term.includes(h.term),
      ),
  );
}
