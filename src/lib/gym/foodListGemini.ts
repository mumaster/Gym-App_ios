/**
 * The Gemini call behind readFoodList (foodListScan.ts), kept apart from the
 * server function so it can be run on its own. Server-only: the handler
 * imports it, so it stays out of the client bundle.
 */
import type { FoodListResult, FoodListSource } from "./foodList";
import type { NevoRow } from "./nevoFoods.data";

/** Same free-tier model as the label and watch readers. */
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const SOURCE_TEXT: Record<FoodListSource, string> = {
  note: `The image is a photo of something written: a handwritten note, a recipe, a cookbook page or a
screenshot listing foods with amounts. Return one item per food line, in the order written.`,
  plate: `The image is a photo of food on a plate or in a bowl. Return one item per distinct food you can
see. Nothing is written down, so quantity and unit are always null: never estimate an amount.`,
  text: `The input is the user's own words (typed or dictated) describing what they ate. Return one item
per food mentioned, in the order mentioned.`,
};

const RULES = `For each item:
- written: the line or words exactly as written (for a plate photo: a short description of what you see).
- name: a short, plain name for the food, in the same language as the input.
- quantity and unit: the amount and unit exactly as written. Use a dot for decimals ("1,5" -> 1.5).
  Never convert, calculate or estimate an amount. A number with no unit written: unit null.
  A count of things ("2 eieren", "3 slices", "1 banaan"): the count as quantity and the counted word
  as unit ("eieren", "slices", "stuks"); "een boterham" or "a banana" is quantity 1 with the noun
  as unit ("boterham", "banana"), never an article like "een" or "a". No amount at all: both null.
- match: the food this is, from the two lists below, as its id:
  * OWN FOODS ("o:<id>") are the user's own saved foods and products. Pick one only when the line is
    clearly that same food or product.
  * Otherwise the FOOD TABLE ("n:<code>", the Dutch NEVO food composition table, Dutch names).
    Weights are noted RAW, so always prefer the raw, uncooked or unprepared variant ("rauw",
    "ongekookt", "onbereid") whenever the table has one for that food, unless the line explicitly says
    it was cooked or prepared. Pick the closest plain variant of the same food; null only when the
    table has nothing that is the same kind of food.

A combination is one item per food: "boterham met pindakaas" is bread and peanut butter, "yoghurt
met granola" is yoghurt and granola. Give each part the same written text, and an amount only if it
was written for that part.

Skip lines that aren't a food: titles, dates, totals, instructions, a servings line. If the input has a
recipe title, return it as title, else null. If it says how many servings or portions it makes, return
that number as servings, else null. Never make up a food that isn't in the input.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", nullable: true },
    servings: { type: "number", nullable: true },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          written: { type: "string" },
          name: { type: "string" },
          quantity: { type: "number", nullable: true },
          unit: { type: "string", nullable: true },
          match: { type: "string", nullable: true },
        },
        required: ["written", "name", "quantity", "unit", "match"],
      },
    },
  },
  required: ["title", "servings", "items"],
};

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

export interface FoodListInput {
  source: FoodListSource;
  imageBase64?: string;
  mimeType?: string;
  text?: string;
  /** The user's own foods (favourites and "your foods"), by index. */
  own: string[];
  /** The app's language, for what a plate photo shows (nothing is written). */
  language: "en" | "nl";
}

/** Sends the input with the NEVO names to Gemini and returns its reading.
 *  The table goes along in the prompt (about 12k tokens; the free tier
 *  counts requests far more tightly than tokens), so Gemini picks real
 *  table entries rather than the app guessing from a search. */
export async function readFoodListWithGemini(
  apiKey: string,
  data: FoodListInput,
  nevoRows: NevoRow[],
): Promise<FoodListResult> {
  const table = nevoRows.map((row) => `n:${row[0]}|${row[1]}`).join("\n");
  const own = data.own
    .slice(0, 200)
    .map((name, i) => `o:${i}|${name}`)
    .join("\n");

  const parts: Record<string, unknown>[] = [];
  if (data.source === "text") {
    parts.push({ text: `INPUT:\n${(data.text ?? "").slice(0, 4000)}` });
  } else {
    if (!data.imageBase64 || !data.mimeType) throw new Error("No photo.");
    parts.push({ inline_data: { mime_type: data.mimeType, data: data.imageBase64 } });
  }
  parts.push({
    text: `${SOURCE_TEXT[data.source]}\n\n${RULES}${
      // Nothing is written on a plate, so its words follow the app.
      data.source === "plate"
        ? `\n\nThis is a photo, so write "written" and "name" in ${data.language === "nl" ? "Dutch" : "English"}.`
        : ""
    }\n\nOWN FOODS:\n${own || "(none)"}\n\nFOOD TABLE:\n${table}`,
  });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
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
  let parsed: FoodListResult;
  try {
    parsed = JSON.parse(text) as FoodListResult;
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
  }
  return {
    title: parsed.title?.trim() || null,
    servings: parsed.servings && parsed.servings > 0 ? Math.round(parsed.servings) : null,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}
