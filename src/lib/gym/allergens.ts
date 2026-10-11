/**
 * "Can I eat this?": checks a product's ingredient text (and the allergen
 * data from Open Food Facts) against the allergies picked in Settings.
 * `ALLERGIES` is the list Settings offers: the 14 allergens EU law (Regulation
 * 1169/2011, Annex II) makes labels declare, most common first. Adding one
 * means an entry in `DEFS` and its names in i18n.
 *
 * Three verdicts, not yes/no:
 *  - "contains": the allergen (or a named form of it: casein for milk, E223
 *    for sulphites) is in the text, or the product's allergen data says so.
 *  - "maybe": nothing is named, but the food is a known source (wine for
 *    sulphites, mayonnaise for egg, ...) or the label has "may contain" wording.
 *  - "none": nothing found. Only said when there was text to read; this is a
 *    guide, not a guarantee (sulphites under 10 mg/kg need no label either).
 *
 * Term lists: plain entries match whole words (plural allowed: "raisin" finds
 * "raisins"), entries starting with "~" match inside a word (Dutch compounds:
 * "~tarwe" finds "tarwemeel"). Text is matched without accents.
 */

export type AllergyId =
  | "peanuts"
  | "treeNuts"
  | "milk"
  | "eggs"
  | "gluten"
  | "soy"
  | "fish"
  | "crustaceans"
  | "sesame"
  | "celery"
  | "mustard"
  | "sulphites"
  | "lupin"
  | "molluscs";

export const ALLERGIES: readonly AllergyId[] = [
  "peanuts",
  "treeNuts",
  "milk",
  "eggs",
  "gluten",
  "soy",
  "fish",
  "crustaceans",
  "sesame",
  "celery",
  "mustard",
  "sulphites",
  "lupin",
  "molluscs",
];

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

/** Names that mean sulphites outright (E220-E228 are matched separately). */
const SULPHITE_NAMED = [
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

/** Foods usually made with sulphites, or sprayed with them, even when the
 *  label doesn't say so. Sources: Anaphylaxis UK, ASCIA, EUFIC. */
const SULPHITE_SOURCE = [
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

interface AllergenDef {
  /** Named forms: "contains" when found. */
  named: string[];
  /** Foods that often hold it without saying so: "maybe". */
  source: string[];
  /** Phrases wiped before matching ("coconut milk" is not milk). */
  ignore?: string[];
  /** Matches Open Food Facts allergen tags ("en:milk"). */
  tag: RegExp;
}

const DEFS: Record<AllergyId, AllergenDef> = {
  peanuts: {
    named: ["peanut", "groundnut", "earthnut", "monkey nut", "arachis", "~pinda", "~arachide"],
    source: [
      "nuts",
      "noten",
      "nut mix",
      "notenmix",
      "satay",
      "sate",
      "satesaus",
      "praline",
      "nougat",
    ],
    tag: /peanut/,
  },
  treeNuts: {
    named: [
      "tree nut",
      "tree nuts",
      "nuts",
      "noten",
      "boomnoot",
      "boomnoten",
      "~almond",
      "~amandel",
      "~hazelnut",
      "~hazelnoot",
      "~walnut",
      "~walnoot",
      "~cashew",
      "~pecan",
      "~pistach",
      "macadamia",
      "brazil nut",
      "~paranoot",
      "~paranoten",
      "marzipan",
      "amaretto",
      "gianduja",
    ],
    source: ["nougat", "praline", "nut mix", "notenmix", "pesto", "granola", "muesli"],
    ignore: [
      "pine nut",
      "pine nuts",
      "pijnboompit",
      "pijnboompitten",
      "nutmeg",
      "muskaatnoot",
      "coconut",
      "kokosnoot",
      "peanut",
      "peanuts",
    ],
    tag: /(^|:)nuts$|tree-nut/,
  },
  milk: {
    named: [
      "milk",
      "melk",
      "milk powder",
      "melkpoeder",
      "milk protein",
      "melkeiwit",
      "milk fat",
      "milkfat",
      "melkvet",
      "buttermilk",
      "karnemelk",
      "whey",
      "wei",
      "weipoeder",
      "~casein",
      "~caseine",
      "lactose",
      "lactalbumin",
      "lactoglobulin",
      "cream",
      "room",
      "slagroom",
      "butter",
      "boter",
      "butterfat",
      "ghee",
      "cheese",
      "kaas",
      "yoghurt",
      "yogurt",
      "kwark",
      "quark",
      "curd",
    ],
    source: ["chocolate", "chocolade", "margarine", "custard", "pudding", "ice cream", "ijs"],
    ignore: [
      "coconut milk",
      "almond milk",
      "oat milk",
      "soy milk",
      "soya milk",
      "rice milk",
      "kokosmelk",
      "amandelmelk",
      "havermelk",
      "sojamelk",
      "rijstmelk",
      "cocoa butter",
      "cacaoboter",
      "shea butter",
      "sheaboter",
      "peanut butter",
      "nut butter",
      "notenboter",
      "coconut cream",
      "kokosroom",
      "cream of tartar",
      "milk free",
      "dairy free",
      "melkvrij",
      "lactosevrij",
    ],
    tag: /(^|:)milk$/,
  },
  eggs: {
    named: [
      "egg",
      "ei",
      "eieren",
      "egg white",
      "egg yolk",
      "eigeel",
      "albumin",
      "albumine",
      "ovalbumin",
      "lysozyme",
      "lysozym",
      "e1105",
      "~eipoeder",
      "~kippenei",
      "~volledig ei",
    ],
    source: ["eiwit", "mayonnaise", "mayonaise", "meringue", "custard", "brioche", "pasta", "cake"],
    ignore: ["eggplant", "egg plant", "egg free", "eivrij", "egg replacer"],
    tag: /(^|:)eggs?$/,
  },
  gluten: {
    named: [
      "gluten",
      "wheat",
      "~tarwe",
      "rye",
      "rogge",
      "barley",
      "gerst",
      "oats",
      "oat",
      "haver",
      "spelt",
      "kamut",
      "triticale",
      "semolina",
      "griesmeel",
      "durum",
      "couscous",
      "bulgur",
      "seitan",
      "malt",
      "mout",
      "~gerstemout",
      "farina",
    ],
    source: [
      "beer",
      "bier",
      "soy sauce",
      "sojasaus",
      "ketjap",
      "flour",
      "bloem",
      "meel",
      "bread",
      "brood",
      "pasta",
      "biscuit",
      "koek",
      "cracker",
      "breadcrumbs",
      "paneermeel",
    ],
    ignore: [
      "gluten free",
      "gluten-free",
      "glutenvrij",
      "without gluten",
      "rice flour",
      "rijstmeel",
      "corn flour",
      "maismeel",
      "maizena",
    ],
    tag: /(^|:)gluten$/,
  },
  soy: {
    named: [
      "soy",
      "soya",
      "~soja",
      "soybean",
      "soybeans",
      "tofu",
      "tempeh",
      "edamame",
      "miso",
      "natto",
      "tamari",
      "shoyu",
      "soy sauce",
      "sojasaus",
      "ketjap",
    ],
    source: ["lecithin", "lecithine", "e322", "vegetable protein", "plantaardig eiwit"],
    ignore: ["soy free", "soya free", "sojavrij"],
    tag: /soy/,
  },
  fish: {
    named: [
      "fish",
      "vis",
      "cod",
      "kabeljauw",
      "salmon",
      "zalm",
      "tuna",
      "tonijn",
      "haddock",
      "schelvis",
      "herring",
      "haring",
      "mackerel",
      "makreel",
      "anchovy",
      "anchovies",
      "ansjovis",
      "sardine",
      "trout",
      "forel",
      "pollock",
      "tilapia",
      "pangasius",
      "sea bass",
      "zeebaars",
      "halibut",
      "eel",
      "paling",
      "surimi",
      "fish sauce",
      "vissaus",
      "fish oil",
      "visolie",
      "isinglass",
      "vislijm",
    ],
    source: ["worcestershire", "worcestersaus", "caesar", "caviar", "kaviaar", "roe", "omega-3"],
    tag: /(^|:)fish$/,
  },
  crustaceans: {
    named: [
      "crustacean",
      "crustaceans",
      "schaaldier",
      "schaaldieren",
      "shrimp",
      "prawn",
      "~garnaal",
      "~garnalen",
      "crab",
      "krab",
      "lobster",
      "kreeft",
      "crayfish",
      "crawfish",
      "langoustine",
      "scampi",
      "krill",
      "shrimp paste",
      "trassi",
      "terasi",
    ],
    source: ["surimi", "fish stock", "paella"],
    tag: /crustacean/,
  },
  sesame: {
    named: ["sesame", "~sesam", "tahini", "tahin", "tahina", "gomasio"],
    source: ["hummus", "houmous", "falafel", "bagel", "halva", "halvah"],
    tag: /sesame/,
  },
  celery: {
    named: [
      "celery",
      "celeriac",
      "~selderij",
      "~selderie",
      "knolselderij",
      "bleekselderij",
      "celery salt",
      "celery seed",
    ],
    source: ["soup", "soep", "bouillon", "stock", "stock cube", "seasoning", "spice mix"],
    tag: /celery/,
  },
  mustard: {
    named: ["mustard", "~mosterd", "dijon"],
    source: ["dressing", "vinaigrette", "curry", "pickle", "augurk", "mayonnaise", "sauce", "saus"],
    tag: /mustard/,
  },
  sulphites: {
    named: SULPHITE_NAMED.map((n) => `~${n}`),
    source: SULPHITE_SOURCE,
    tag: /sulphur-dioxide|sulfur-dioxide|sulphites|sulfites|sulfiet|zwaveldioxide/,
  },
  lupin: {
    named: ["lupin", "lupine", "~lupine", "lupinen"],
    source: [],
    tag: /lupin/,
  },
  molluscs: {
    named: [
      "mollusc",
      "molluscs",
      "mollusk",
      "mollusks",
      "weekdier",
      "weekdieren",
      "mussel",
      "~mosselen",
      "oyster",
      "oester",
      "oesters",
      "clam",
      "venusschelp",
      "scallop",
      "jakobsschelp",
      "squid",
      "inktvis",
      "calamari",
      "octopus",
      "snail",
      "escargot",
      "slak",
      "cuttlefish",
      "whelk",
      "kokkel",
      "abalone",
      "oyster sauce",
      "oestersaus",
    ],
    source: ["seafood", "zeevruchten", "paella"],
    tag: /mollus/,
  },
};

/** Additives (E-numbers) per allergen. `contains`: made from the allergen, so
 *  a hit is a firm "contains". `maybe`: can be made from it or from something
 *  else, which the label doesn't say, so a hit is only a "maybe".
 *  Basis: the EU's Annex II allergen list plus the usual sources of each
 *  additive (Open Food Facts additive pages, Dutch Voedingscentrum, vegan E-number
 *  lists). Web search was thin, so the lists are deliberately short; only
 *  codes with a well-known allergen origin are in. */
const ADDITIVES: Partial<Record<AllergyId, { contains?: string[]; maybe?: string[] }>> = {
  sulphites: {
    contains: ["220", "221", "222", "223", "224", "225", "226", "227", "228"],
    // Caramel made by the sulphite processes.
    maybe: ["150b", "150d"],
  },
  eggs: {
    // Lysozyme comes from egg white.
    contains: ["1105"],
    // Lecithin is mostly soy or sunflower, but can be egg yolk.
    maybe: ["322"],
  },
  soy: {
    // Soybean hemicellulose; thermally oxidised soya bean oil.
    contains: ["426", "479b"],
    // Lecithin, and PGPR (can be made with soy).
    maybe: ["322", "476"],
  },
  milk: {
    // Lactitol is made from lactose; nisin is grown on a milk-based medium.
    maybe: ["966", "234"],
  },
  gluten: {
    // Dextrins, modified starches (wheat is a common source) and amylase.
    maybe: [
      "1100",
      "1400",
      "1401",
      "1402",
      "1403",
      "1404",
      "1405",
      "1410",
      "1412",
      "1413",
      "1414",
      "1420",
      "1422",
      "1440",
      "1442",
      "1450",
      "1451",
    ],
  },
  crustaceans: {
    // Astaxanthin can come from shrimp.
    maybe: ["161j"],
  },
};

/** Matches "E322", "e 322", "E-322", "E322(i)", "E472b" and so on. */
function codeRegex(codes: string[]): RegExp {
  return new RegExp(`\\be[\\s\\-.]?(${codes.join("|")})(?![0-9])`, "gi");
}

/** "May contain" wording: the label's own warning. */
const MAY_CONTAIN =
  /(may contain|traces? of|kan sporen|sporen van|kan .{0,40}bevatten|peut contenir|kann .{0,30}enthalten)[^.;\n]{0,80}/gi;

/** Lowercase, strip accents, and make dashes and odd spaces plain. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ");
}

/** Does `entry` occur in `hay`? A plain entry as a whole word, allowing a
 *  plural ("raisins", "rozijnen"): keeps "jam" out of "jamaican" and "ei" out
 *  of "eigen". A "~" entry matches anywhere. */
function hasTerm(hay: string, entry: string): boolean {
  if (entry.startsWith("~")) return hay.includes(entry.slice(1));
  const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(s|es|en|n)?($|[^a-z0-9])`).test(hay);
}

/** The allergen / additive tags Open Food Facts attaches to a product. */
export interface ProductTags {
  allergens?: string[];
  traces?: string[];
  additives?: string[];
}

export function checkAllergen(
  id: AllergyId,
  ingredientsText: string | null | undefined,
  tags: ProductTags = {},
): AllergenResult | null {
  const def = DEFS[id];
  const raw = ingredientsText?.trim() ?? "";
  const hasTags = Boolean(tags.allergens?.length || tags.traces?.length || tags.additives?.length);
  if (!raw && !hasTags) return null;

  let text = fold(raw);
  // Label photos wrap long words ("natriumdisul-\nfiet"): glue them back.
  text = text.replace(/(\p{L})-\s+(\p{L})/gu, "$1$2");
  for (const phrase of def.ignore ?? []) text = text.split(fold(phrase)).join(" ");

  const hits: Hit[] = [];
  /** Display term -> the list entry it came from, to find it again later. */
  const entryOf = new Map<string, string>();
  const seen = new Set<string>();
  const add = (kind: HitKind, term: string, entry?: string) => {
    const key = `${kind}:${term.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ kind, term });
    if (entry) entryOf.set(key, entry);
  };
  const tagged = (list?: string[]) => (list ?? []).some((t) => def.tag.test(t.toLowerCase()));

  // Strong: additive codes (sulphites), named forms, the product's own data.
  const codes = ADDITIVES[id];
  if (codes?.contains) {
    const re = codeRegex(codes.contains);
    for (const m of text.matchAll(re)) add("additive", `E${m[1]!.toUpperCase()}`);
    for (const tag of tags.additives ?? []) {
      const m = codeRegex(codes.contains).exec(tag);
      if (m) add("additive", `E${m[1]!.toUpperCase()}`);
    }
  }
  // Sulphite names are also looked up with every space and bracket removed,
  // so a word split by a line break or a stray space in a photo still counts.
  const squashed = id === "sulphites" ? text.replace(/[^a-z0-9]+/g, "") : "";
  for (const entry of def.named) {
    if (hasTerm(text, entry)) add("named", entry.replace(/^~/, ""), entry);
    else if (
      squashed &&
      entry.startsWith("~") &&
      squashed.includes(entry.slice(1).replace(/\s/g, ""))
    )
      add("named", entry.replace(/^~/, ""), entry);
  }
  if (tagged(tags.allergens)) add("declared", id);

  // "May contain" wording that mentions the allergen is only a maybe, and so
  // is a trace tag.
  const mayContain = [...text.matchAll(MAY_CONTAIN)].filter((m) =>
    def.named.some((n) => hasTerm(m[0], n)),
  );
  const traceTagged = tagged(tags.traces);

  let strong = hits.length > 0;
  if (strong && mayContain.length && !strongOutside(text, hits, mayContain, entryOf)) {
    // The only mentions sit inside "may contain" sentences.
    strong = false;
    hits.length = 0;
    for (const m of mayContain) add("mayContain", m[0].trim());
  } else if (!strong && (mayContain.length || traceTagged)) {
    if (traceTagged) add("mayContain", id);
    for (const m of mayContain) add("mayContain", m[0].trim());
  }

  if (strong) return { verdict: "contains", hits: dropContained(hits) };

  if (codes?.maybe) {
    const re = codeRegex(codes.maybe);
    for (const m of text.matchAll(re)) add("additive", `E${m[1]!.toUpperCase()}`);
    for (const tag of tags.additives ?? []) {
      const m = codeRegex(codes.maybe).exec(tag);
      if (m) add("additive", `E${m[1]!.toUpperCase()}`);
    }
  }
  for (const food of def.source) {
    if (hasTerm(text, food)) add("sourceFood", food);
  }

  const shown = dropContained(hits).slice(0, 6);
  if (shown.length) return { verdict: "maybe", hits: shown };
  return { verdict: "none", hits: [] };
}

/** Sulphites, the first allergen this was built for. */
export const checkSulphites = (ingredientsText: string | null | undefined, tags?: ProductTags) =>
  checkAllergen("sulphites", ingredientsText, tags);

/** Whether any strong hit is mentioned outside a "may contain" sentence. */
function strongOutside(
  text: string,
  hits: Hit[],
  mayContain: RegExpMatchArray[],
  entryOf: Map<string, string>,
): boolean {
  let rest = text;
  for (const m of mayContain) rest = rest.replace(m[0], " ");
  return hits.some((h) => {
    if (h.kind === "declared") return true;
    if (h.kind === "additive") {
      const re = new RegExp(`\\be[\\s\\-.]?${h.term.slice(1).toLowerCase()}(?![0-9])`);
      // Not in the text at all: it came from the product's additive tags.
      return re.test(rest) || !re.test(text);
    }
    return hasTerm(rest, entryOf.get(`${h.kind}:${h.term.toLowerCase()}`) ?? h.term);
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
