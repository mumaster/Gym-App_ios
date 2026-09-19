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
export async function lookupBarcode(barcode: string): Promise<ScannedLabel | null> {
  const res = await fetch(
    `${OFF_ENDPOINT}${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`,
  );
  if (!res.ok) {
    throw new Error(`Open Food Facts lookup failed (${res.status})`);
  }

  const json = (await res.json()) as OpenFoodFactsResponse;
  if (json.status !== 1 || !json.product) return null;

  const n = json.product.nutriments ?? {};
  const name = json.product.product_name?.trim();

  return {
    name: name || null,
    calories: num(n["energy-kcal_100g"]),
    protein: num(n["proteins_100g"]),
    carbs: num(n["carbohydrates_100g"]),
    fat: num(n["fat_100g"]),
    fiber: num(n["fiber_100g"]),
    salt: num(n["salt_100g"]),
    servingSizeGrams: parseServingSizeGrams(json.product.serving_size),
  };
}
