import { createServerFn } from "@tanstack/react-start";
import type { ProductTags } from "./allergens";

/** Same free-tier model as the nutrition-label reader (labelScan.ts). */
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const PROMPT = `You are reading a photo of a food package. Find the INGREDIENTS list and copy
it out exactly as printed, in the language it is printed in, including every E-number, additive
code and any allergen line (e.g. "Contains: ...", "Bevat: ...", "May contain traces of ...",
"Kan sporen bevatten van ..."). Keep brackets and percentages. Do not translate, summarise or
guess. If there is no ingredients list visible or legible, return null. Also read the product name
if one is printed; otherwise null.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", nullable: true },
    ingredientsText: { type: "string", nullable: true },
  },
  required: ["name", "ingredientsText"],
};

/** What "Can I eat this?" reads off a product: its name, the ingredient
 *  text, and Open Food Facts' own allergen tags when it came from a barcode. */
export interface ScannedIngredients {
  name: string | null;
  ingredientsText: string | null;
  tags?: ProductTags;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export const scanIngredients = createServerFn({ method: "POST" })
  .validator((input: { imageBase64: string; mimeType: string }) => input)
  .handler(async ({ data }): Promise<ScannedIngredients> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Label scanning isn't set up on this deployment yet.");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: data.mimeType, data: data.imageBase64 } },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as GeminiResponse;
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const reason =
        json.promptFeedback?.blockReason ?? json.candidates?.[0]?.finishReason ?? "no result";
      throw new Error(`Gemini didn't return usable text (${reason})`);
    }
    try {
      return JSON.parse(text) as ScannedIngredients;
    } catch {
      throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
    }
  });

interface OffIngredients {
  status?: number;
  product?: {
    product_name?: string;
    ingredients_text?: string;
    allergens_tags?: string[];
    traces_tags?: string[];
    additives_tags?: string[];
  };
}

/** Open Food Facts by barcode, for ingredients and allergen tags. Null when
 *  the product isn't in the database. Throws on a network failure. */
export async function lookupIngredients(barcode: string): Promise<ScannedIngredients | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,ingredients_text,allergens_tags,traces_tags,additives_tags`,
  );
  if (!res.ok) throw new Error(`Open Food Facts lookup failed (${res.status})`);
  const json = (await res.json()) as OffIngredients;
  if (json.status !== 1 || !json.product) return null;
  const p = json.product;
  return {
    name: p.product_name?.trim() || null,
    ingredientsText: p.ingredients_text?.trim() || null,
    tags: {
      allergens: p.allergens_tags ?? [],
      traces: p.traces_tags ?? [],
      additives: p.additives_tags ?? [],
    },
  };
}
