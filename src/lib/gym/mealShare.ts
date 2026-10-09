import type { MealIngredient, Macros } from "./nutrition";

/**
 * Sharing a logged meal with another user: the meal and all its ingredients
 * are packed into a link (`/nutrition#meal=<code>`), so there is no server in
 * the middle. The link goes through the iOS share sheet or is shown as a QR
 * the other phone scans with its camera. The code is plain base64url JSON.
 */
export interface SharedMeal {
  name: string;
  ingredients: MealIngredient[];
}

const VERSION = 1;
const MAX_INGREDIENTS = 60;
const MACRO_KEYS: (keyof Macros)[] = ["calories", "protein", "carbs", "fat", "fiber", "salt"];

const round = (n: number) => Math.round(n * 100) / 100;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeMeal(meal: SharedMeal): string {
  return toBase64Url(
    JSON.stringify({
      v: VERSION,
      n: meal.name,
      i: meal.ingredients.map((ing) => [
        ing.name,
        round(ing.grams),
        MACRO_KEYS.map((k) => round(ing.per100[k])),
        ...(ing.nevo?.length ? [ing.nevo] : []),
      ]),
    }),
  );
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

/** The meal in a code, or null when it isn't one of ours (or is damaged). */
export function decodeMeal(code: string): SharedMeal | null {
  try {
    const raw = JSON.parse(fromBase64Url(code.trim()));
    if (raw?.v !== VERSION || typeof raw.n !== "string" || !Array.isArray(raw.i)) return null;
    if (!raw.i.length || raw.i.length > MAX_INGREDIENTS) return null;
    const ingredients: MealIngredient[] = [];
    for (const row of raw.i) {
      if (!Array.isArray(row)) return null;
      const [name, grams, macros, nevo] = row;
      if (typeof name !== "string" || !finite(grams) || grams <= 0) return null;
      if (!Array.isArray(macros) || macros.length !== MACRO_KEYS.length) return null;
      if (!macros.every(finite)) return null;
      const per100 = Object.fromEntries(
        MACRO_KEYS.map((k, idx) => [k, macros[idx]]),
      ) as unknown as Macros;
      const codes = Array.isArray(nevo) ? nevo.filter((c): c is number => Number.isInteger(c)) : [];
      ingredients.push({
        name: name.slice(0, 120),
        grams,
        per100,
        ...(codes.length ? { nevo: codes } : {}),
      });
    }
    return { name: raw.n.slice(0, 80), ingredients };
  } catch {
    return null;
  }
}

/** The link that opens the importer on `origin`. */
export const mealShareUrl = (meal: SharedMeal, origin: string) =>
  `${origin}/nutrition#meal=${encodeMeal(meal)}`;

/** The code in a pasted link, a `#meal=` fragment or a bare code. */
export function mealCodeFrom(text: string): string | null {
  const match = text.match(/meal=([A-Za-z0-9_-]+)/);
  if (match) return match[1] ?? null;
  const bare = text.trim();
  return /^[A-Za-z0-9_-]{20,}$/.test(bare) ? bare : null;
}
