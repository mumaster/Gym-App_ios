import { createServerFn } from "@tanstack/react-start";
import type { WatchData } from "./types";

/** Same free-tier model as the nutrition-label reader (labelScan.ts). */
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const PROMPT = `These are screenshots of ONE workout from a sports watch's companion app
(for example Huawei Health, Garmin Connect, Samsung Health, Apple Fitness), possibly split
over several screenshots. Extract the workout's numbers into the JSON schema.

Rules:
- Only use values that are PRINTED AS TEXT or numbers in the screenshots. Never estimate a
  value from the shape of a chart or graph; chart axis labels are not data. If a value isn't
  printed, return null (or an empty list).
- The app may be in Dutch or another language; keep labels (zone names, activity name,
  training-effect labels) exactly as written, but return numbers as plain numbers
  (a decimal comma "1,7" becomes 1.7).
- start: the workout's local start date and time as "YYYY-MM-DDTHH:mm". Dates are often
  written day-month-year (e.g. "9-9-2026, 19:41" is 9 September 2026). If only a date is
  printed, return "YYYY-MM-DD".
- durationSeconds: the workout duration (e.g. "00:27:37" = 1657).
- totalKcal: total calories for the workout; activeKcal: active calories if shown separately.
- avgHr, maxHr, minHr: heart rate in bpm ("spm" in Dutch).
- hrZones: minutes spent per heart-rate zone, in the order listed, with the app's zone names.
- trainingEffects: scores like "Aerobic training stress 1.7" or "Aerobic TE 3.2" with the word
  rating shown next to them (e.g. "Herstel"), if any.
- recoveryHours: recommended recovery time in hours.
- hrRecovery: heart-rate recovery after the workout — how many bpm it dropped, the start and
  end bpm (e.g. "154 / 133"), and over how many minutes if printed.
- otherMetrics: every OTHER number printed about this workout (e.g. VO2max, steps, cadence,
  training load, body battery, sweat loss), as label/value/unit. Do not repeat values already
  captured above, and skip the person's name and the phone's clock.
- source is the app's name; device is the watch model if printed.`;

const nullableNumber = { type: "number", nullable: true };
const nullableString = { type: "string", nullable: true };

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    source: nullableString,
    device: nullableString,
    activity: nullableString,
    start: nullableString,
    durationSeconds: nullableNumber,
    totalKcal: nullableNumber,
    activeKcal: nullableNumber,
    avgHr: nullableNumber,
    maxHr: nullableNumber,
    minHr: nullableNumber,
    hrZones: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, minutes: { type: "number" } },
        required: ["name", "minutes"],
      },
    },
    trainingEffects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "number" },
          rating: nullableString,
        },
        required: ["label", "value", "rating"],
      },
    },
    recoveryHours: nullableNumber,
    hrRecovery: {
      type: "object",
      nullable: true,
      properties: {
        drop: nullableNumber,
        startBpm: nullableNumber,
        endBpm: nullableNumber,
        minutes: nullableNumber,
      },
      required: ["drop", "startBpm", "endBpm", "minutes"],
    },
    otherMetrics: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, value: { type: "string" }, unit: nullableString },
        required: ["label", "value", "unit"],
      },
    },
  },
  required: [
    "source",
    "device",
    "activity",
    "start",
    "durationSeconds",
    "totalKcal",
    "activeKcal",
    "avgHr",
    "maxHr",
    "minHr",
    "hrZones",
    "trainingEffects",
    "recoveryHours",
    "hrRecovery",
    "otherMetrics",
  ],
};

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

export type ScannedWatchWorkout = Omit<WatchData, "importedAt">;

/** Reads one workout's screenshots from a watch's companion app. Server-only,
 *  like scanNutritionLabel, so GEMINI_API_KEY never reaches the browser. */
export const scanWatchWorkout = createServerFn({ method: "POST" })
  .validator((input: { images: { imageBase64: string; mimeType: string }[] }) => input)
  .handler(async ({ data }): Promise<ScannedWatchWorkout> => {
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
      return JSON.parse(text) as ScannedWatchWorkout;
    } catch {
      throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
    }
  });
