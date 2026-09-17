import { createServerFn } from "@tanstack/react-start";

/** Free-tier Gemini model — strong at structured document/label OCR. */
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const PROMPT = `You are reading a photo of a food nutrition label. Extract these values
normalized to PER 100g / PER 100ml, exactly as they'd appear in the label's "per 100g" column.
If the label only shows a per-serving amount and states the serving size in grams/ml, convert it
to per-100g yourself. If a value genuinely isn't present or legible anywhere on the label, return
null for it — do not guess.

Also try to read the product name printed on the packaging; if none is visible, return null.

Return calories in kcal (convert from kJ if that's what's shown: kcal = kJ / 4.184).
Return protein, carbs, fat, fiber in grams. Return salt in grams (if only sodium is listed,
convert: salt_g = sodium_mg * 2.5 / 1000).

Also read the serving/portion size the label itself suggests (e.g. "Serving size: 30g",
"1 portion (45g)") and return it in grams as servingSizeGrams. Only return a number if the label
states it directly in grams/ml or gives an equivalent you can convert (e.g. "30g (1 bar)" ->
30). If the label only gives a non-mass unit with no gram equivalent (e.g. "1 bar", "2 cookies"),
or states no serving size at all, return null — do not guess a weight.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", nullable: true },
    calories: { type: "number", nullable: true },
    protein: { type: "number", nullable: true },
    carbs: { type: "number", nullable: true },
    fat: { type: "number", nullable: true },
    fiber: { type: "number", nullable: true },
    salt: { type: "number", nullable: true },
    servingSizeGrams: { type: "number", nullable: true },
  },
  required: ["name", "calories", "protein", "carbs", "fat", "fiber", "salt", "servingSizeGrams"],
};

export interface ScannedLabel {
  name: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  salt: number | null;
  /** The label's own suggested portion size in grams, if it states one directly. */
  servingSizeGrams: number | null;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

export const scanNutritionLabel = createServerFn({ method: "POST" })
  .validator((input: { imageBase64: string; mimeType: string }) => input)
  .handler(async ({ data }): Promise<ScannedLabel> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      throw new Error("Label scanning isn't set up on this deployment yet.");
    }

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
      return JSON.parse(text) as ScannedLabel;
    } catch {
      throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
    }
  });
