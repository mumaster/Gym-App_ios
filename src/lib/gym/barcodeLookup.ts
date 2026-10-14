import type { ScannedLabel } from "./labelScan";

/** Open Food Facts: free, no-auth, CORS-friendly product database keyed by
 *  UPC/EAN barcode — this runs entirely client-side (unlike scanNutritionLabel,
 *  there's no API key or server-only secret involved, so no server function
 *  is needed). Requesting only the fields we use keeps the response small. */
const OFF_ENDPOINT = "https://world.openfoodfacts.org/api/v2/product/";
const OFF_FIELDS = "product_name,nutriments,serving_size";

/** Parses a serving_size string like "30 g", "1 bar (45g)", "250ml" into a
 *  grams figure — mirrors scanNutritionLabel's servingSizeGrams, which
 *  AddFoodSheet already knows how to offer as a one-tap suggestion. Only
 *  grams/ml are meaningful here (ml is treated as ~1g/ml, fine for the
 *  liquids this field actually shows up for); anything else is left null
 *  rather than guessed. */
function parseServingSizeGrams(servingSize: unknown): number | null {
  if (typeof servingSize !== "string") return null;
  const match = /([\d.]+)\s*(g|ml)\b/i.exec(servingSize);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

interface OpenFoodFactsResponse {
  status?: number;
  product?: {
    product_name?: string;
    product_name_nl?: string;
    product_name_en?: string;
    serving_size?: string;
    nutriments?: Record<string, unknown>;
  };
}

/** Looks up a scanned barcode against Open Food Facts, returning the same
 *  shape scanNutritionLabel does so AddFoodSheet can fill the review form
 *  from either path identically. Returns null (not a thrown error) when the
 *  barcode simply isn't in the database — a normal outcome for a lot of
 *  products, not a failure to surface as one. Throws only on an actual
 *  network/request failure, for the caller to catch and fall back from. */
export function lookupBarcode(barcode: string): Promise<ScannedLabel | null> {
  const hit = cache.get(barcode);
  if (hit) return hit;
  const request = fetchBarcode(barcode);
  cache.set(barcode, request);
  // A failure isn't cached: the next scan should try again.
  request.catch(() => cache.delete(barcode));
  // Keep the cache small; Map keeps insertion order, so drop the oldest.
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  return request;
}

/** Recent lookups (and ones in flight), so scanning the same product again,
 *  or two reads of one code, cost one request. Cleared on reload. */
const cache = new Map<string, Promise<ScannedLabel | null>>();
const CACHE_SIZE = 30;

async function fetchBarcode(barcode: string): Promise<ScannedLabel | null> {
  const res = await fetch(
    `${OFF_ENDPOINT}${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`,
  );
  if (!res.ok) {
    throw new Error(`Open Food Facts lookup failed (${res.status})`);
  }

  const json = (await res.json()) as OpenFoodFactsResponse;
  if (json.status !== 1 || !json.product) return null;

  return toLabel(json.product);
}

type OffProduct = NonNullable<OpenFoodFactsResponse["product"]>;

/** One product's per-100g values as the shape both a scan and a search
 *  result share, so a searched product logs exactly like a scanned one. */
function toLabel(product: OffProduct, language?: "en" | "nl"): ScannedLabel {
  const n = product.nutriments ?? {};
  // The generic name is whatever language the contributor typed (often
  // French); Open Food Facts also keeps one per language, so prefer yours.
  const localized = language ? product[`product_name_${language}`]?.trim() : undefined;
  return {
    name: localized || product.product_name?.trim() || null,
    calories: num(n["energy-kcal_100g"]),
    protein: num(n["proteins_100g"]),
    carbs: num(n["carbohydrates_100g"]),
    // Missing stays null (unknown), never 0.
    sugars: num(n["sugars_100g"]),
    fat: num(n["fat_100g"]),
    fiber: num(n["fiber_100g"]),
    salt: num(n["salt_100g"]),
    servingSizeGrams: parseServingSizeGrams(product.serving_size),
  };
}

export interface ProductHit {
  barcode: string;
  name: string;
  brand: string | null;
  label: ScannedLabel;
}

const SEARCH_ENDPOINT = "https://world.openfoodfacts.org/cgi/search.pl";
const SEARCH_FIELDS =
  "code,product_name,product_name_nl,product_name_en,brands,nutriments,serving_size";
const searchCache = new Map<string, Promise<ProductHit[]>>();

/** Text search in the same Open Food Facts database the barcode scanner
 *  uses. Products without a name or without any kcal figure are dropped (a
 *  row you can't log is noise); other missing values stay null and show up
 *  as unfilled in the review form, as with a scan. Throws on a network
 *  failure, for the caller to show. */
export function searchProducts(query: string, language?: "en" | "nl"): Promise<ProductHit[]> {
  const key = `${language ?? ""}:${query.trim().toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit) return hit;
  const request = fetchSearch(query.trim().toLowerCase(), language);
  searchCache.set(key, request);
  request.catch(() => searchCache.delete(key));
  if (searchCache.size > CACHE_SIZE) {
    searchCache.delete(searchCache.keys().next().value as string);
  }
  return request;
}

async function fetchSearch(query: string, language?: "en" | "nl"): Promise<ProductHit[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "20",
    fields: SEARCH_FIELDS,
  });
  const res = await fetch(`${SEARCH_ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`);
  const json = (await res.json()) as {
    products?: (OffProduct & { code?: string; brands?: string })[];
  };
  const hits: ProductHit[] = [];
  for (const p of json.products ?? []) {
    const label = toLabel(p, language);
    if (!label.name || label.calories === null || typeof p.code !== "string") continue;
    const brand = p.brands?.split(",")[0]?.trim() || null;
    hits.push({ barcode: p.code, name: label.name, brand, label });
  }
  return hits;
}
