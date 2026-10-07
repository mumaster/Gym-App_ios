import { createServerFn } from "@tanstack/react-start";
import type { ScannedScaleReading } from "./scale";

/** Same free-tier model as the label and watch readers. */
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const PROMPT = `These are screenshots of ONE weigh-in from a smart scale's app (for example
Huawei Health, Withings, Renpho, Xiaomi Zepp Life, Garmin Connect). A long page may be split
over several images, top to bottom, and neighbouring images overlap a little: count anything
that appears twice in an overlap only once. Extract the weigh-in into the JSON schema.

Rules:
- Only use values that are PRINTED AS TEXT or numbers. Never estimate a value from a chart, a
  gauge or a coloured bar; a scale's range labels ("Low / Healthy / Overweight") are not values.
  If a value isn't printed, return null (or an empty list).
- Copy every number exactly as printed. Never compute, derive or convert a value from other
  values (no BMI from weight, no fat mass from a percentage).
- The app may be in Dutch or another language; return numbers as plain numbers (a decimal comma
  "96,85" becomes 96.85; a thousands separator "2.138 kcal" is 2138).
- date: the weigh-in's local date and time as "YYYY-MM-DDTHH:mm". Dates are often written
  day-month-year (e.g. "7-10-2026, 07:42" is 7 October 2026). If only a date is printed, return
  "YYYY-MM-DD".
- weight and weightUnit: the body weight and its unit, "kg" or "lb".
- bmi: BMI. bodyFatPct: body fat in percent ("Lichaamsvet"). fatFreeMassKg: fat-free or lean
  mass ("Vetvrije massa"). skeletalMuscleKg: skeletal muscle mass ("Skeletachtige
  spiermassa", "Skeletspiermassa"). muscleMassKg: total muscle mass only when printed
  separately from skeletal muscle ("Spiermassa"). bodyWaterPct: body water in percent
  ("Lichaamsvocht"). proteinPct: protein in percent ("Proteïne"). boneMassKg: bone mineral
  content or bone mass ("Botmineraalgehalte"). visceralFat: the visceral fat level or rating
  ("Visceraal vetgehalte", e.g. "11,0 Niveau" is 11). bmrKcal: basal metabolic rate in kcal a
  day ("Basisstofwisselingssnelheid"). metabolicAge: metabolic or body age in years.
- fatMassKg: body fat in kg, when printed as a mass (in a composition chart's legend, "Vet"/"Fat"
  in kg counts). The same legend's water and protein in kg repeat the percentages above, so
  leave those out.
- Mass values are in the same unit as the weight.
- source is the app's name; device is the scale's model if printed.
- otherMetrics: every OTHER number printed about this weigh-in that has no field above (e.g.
  heart rate, body type, subcutaneous fat, body score), as label/value/unit in the app's own
  words. Never repeat a value that went into a field above, never include the composition
  chart's water or protein in kg, and skip the person's name, the phone's clock, disclaimers
  and QR codes.`;

const nullableNumber = { type: "number", nullable: true };
const nullableString = { type: "string", nullable: true };

const NUMBER_FIELDS = [
  "weight",
  "bmi",
  "bodyFatPct",
  "fatMassKg",
  "fatFreeMassKg",
  "skeletalMuscleKg",
  "muscleMassKg",
  "bodyWaterPct",
  "proteinPct",
  "boneMassKg",
  "visceralFat",
  "bmrKcal",
  "metabolicAge",
] as const;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    source: nullableString,
    device: nullableString,
    date: nullableString,
    weightUnit: { type: "string", enum: ["kg", "lb"], nullable: true },
    ...Object.fromEntries(NUMBER_FIELDS.map((f) => [f, nullableNumber])),
    otherMetrics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          unit: nullableString,
        },
        required: ["label", "value", "unit"],
      },
    },
  },
  required: ["source", "device", "date", "weightUnit", ...NUMBER_FIELDS, "otherMetrics"],
};

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

/** Reads one weigh-in's screenshots from a smart scale's app. Server-only,
 *  like the label and watch readers, so GEMINI_API_KEY never reaches the
 *  browser. The result is checked client-side (scale.ts). */
export const scanScaleReading = createServerFn({ method: "POST" })
  .validator((input: { images: { imageBase64: string; mimeType: string }[] }) => input)
  .handler(async ({ data }): Promise<ScannedScaleReading> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Screenshot reading isn't set up on this deployment yet.");
    if (!data.images.length) throw new Error("No screenshots to read.");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...data.images.map((img) => ({
                  inline_data: { mime_type: img.mimeType, data: img.imageBase64 },
                })),
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0,
            // Small print (the composition list's decimals) stays legible.
            mediaResolution: "MEDIA_RESOLUTION_HIGH",
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
      return JSON.parse(text) as ScannedScaleReading;
    } catch {
      throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
    }
  });
