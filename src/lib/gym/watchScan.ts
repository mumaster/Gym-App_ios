import { createServerFn } from "@tanstack/react-start";
import type { WatchData } from "./types";

/** Same free-tier model as the nutrition-label reader (labelScan.ts). */
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const PROMPT = `These are screenshots of ONE workout from a sports watch's companion app
(for example Huawei Health, Garmin Connect, Samsung Health, Apple Fitness). A long page may be
split over several images, top to bottom, and neighbouring images overlap a little: count
anything that appears twice in an overlap only once. Extract the workout's numbers into the
JSON schema.

Rules:
- Only use values that are PRINTED AS TEXT or numbers in the screenshots. Never estimate a
  value from the shape of a chart or graph; chart axis labels are not data. If a value isn't
  printed, return null (or an empty list).
- Copy every number exactly as printed. Never compute, derive or "correct" a value from other
  values: if the app prints "dropped 10" next to "154 / 133", the drop is 10.
- Keep lists (zones, splits, table rows) in the order printed, top to bottom.
- The app may be in Dutch or another language; keep labels (zone names, activity name,
  training-effect labels) exactly as written, but return numbers as plain numbers
  (a decimal comma "1,7" becomes 1.7).
- start: the workout's local start date and time as "YYYY-MM-DDTHH:mm". Dates are often
  written day-month-year (e.g. "9-9-2026, 19:41" is 9 September 2026). If only a date is
  printed, return "YYYY-MM-DD".
- durationSeconds: the workout duration (e.g. "00:27:37" = 1657).
- totalKcal: total calories for the workout; activeKcal: active calories if shown separately.
- avgHr, maxHr, minHr: heart rate in bpm ("spm" in Dutch), each only where the app prints it
  with its own label ("Average", "Maximum", "Minimum"). The numbers along a chart's axis (e.g.
  158 / 137 / 116 / 95 / 74 beside the heart-rate graph) are never values: most apps print no
  minimum heart rate, so minHr is usually null. The same holds for elevation, pace, cadence and
  SpO2: use the labelled values above each chart, never its axis.
- hrZones: minutes spent per heart-rate zone with the app's zone names, in the legend's own
  order (its first line first — Huawei lists the hardest zone first); don't re-sort them.
- trainingEffects: scores like "Aerobic training stress 1.7" or "Aerobic TE 3.2" with the word
  rating shown next to them (e.g. "Herstel"), if any.
- recoveryHours: recommended recovery time in hours.
- hrRecovery: heart-rate recovery after the workout. drop is the number printed under
  "Dropped" / "Daalde" — its own measurement, which is usually NOT start minus end (e.g.
  "Daalde 10" beside "Begin / Einde 154 / 133" means drop 10). startBpm/endBpm are the pair
  under "Start / End" / "Begin / Einde". minutes only when stated as a value; the "1 min" /
  "2 min" under its chart is an axis label, not a value, so return null then.
- source is the app's name; device is the watch model if printed.
- kind: "cardio" for running, walking, hiking, cycling, swimming, rowing, elliptical, skiing and
  similar; "strength" for strength, weight, functional or core training; otherwise "other".
- distanceKm: the distance (convert miles or metres to km).
- avgPaceSeconds / bestPaceSeconds: average and fastest pace as seconds per km
  (5'42" = 342; 13'40" = 820). Also use the fastest pace printed as "Fastest"/"Snelst".
- avgSpeedKmh, maxSpeedKmh: speed in km/h.
- avgCadence, maxCadence: steps (or strokes) per minute; avgStrideCm: stride length in cm;
  steps: total steps.
- ascentM, descentM: total climb and descent in metres; minElevationM, maxElevationM: the
  lowest and highest elevation printed.
- vo2max; spo2Min, spo2Max: blood oxygen in percent.
- paceZones: minutes per pace zone (a separate list from heart-rate zones), with the app's names.
- splits: the per-km (or per-lap) table, one row per km in order: label ("1", "2"… or the app's
  own text for a shorter last split), its pace in seconds per km, and its average heart rate and
  cadence when that table prints them. Use the table's numbers, not the bars. Include a
  shorter last split (e.g. "Less than 1 km 0'06"") as its own row with that text as label.
- tables: every OTHER table printed as text (for example pace bands with ground-contact time),
  with its title, column headers and rows as the text shown.
- otherMetrics: every OTHER number printed about this workout that has no field of its own
  above (e.g. running dynamics such as ground-contact time, left/right balance and vertical
  oscillation; training load; sweat loss), as label/value/unit, with the app's verdict next to it
  (e.g. "Normaal") as rating. Never repeat a value that already went into a field above (pace,
  speed, cadence, stride, steps, climb, descent, elevation, SpO2, VO2max, heart rate, calories,
  duration, distance), and skip the person's name and the phone's clock.`;

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
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          unit: nullableString,
          rating: nullableString,
        },
        required: ["label", "value", "unit", "rating"],
      },
    },
    kind: { type: "string", enum: ["strength", "cardio", "other"], nullable: true },
    distanceKm: nullableNumber,
    avgPaceSeconds: nullableNumber,
    bestPaceSeconds: nullableNumber,
    avgSpeedKmh: nullableNumber,
    maxSpeedKmh: nullableNumber,
    avgCadence: nullableNumber,
    maxCadence: nullableNumber,
    avgStrideCm: nullableNumber,
    steps: nullableNumber,
    ascentM: nullableNumber,
    descentM: nullableNumber,
    minElevationM: nullableNumber,
    maxElevationM: nullableNumber,
    vo2max: nullableNumber,
    spo2Min: nullableNumber,
    spo2Max: nullableNumber,
    paceZones: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, minutes: { type: "number" } },
        required: ["name", "minutes"],
      },
    },
    splits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          paceSeconds: nullableNumber,
          avgHr: nullableNumber,
          cadence: nullableNumber,
        },
        required: ["label", "paceSeconds", "avgHr", "cadence"],
      },
    },
    tables: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          columns: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        },
        required: ["title", "columns", "rows"],
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
    "kind",
    "distanceKm",
    "avgPaceSeconds",
    "bestPaceSeconds",
    "avgSpeedKmh",
    "maxSpeedKmh",
    "avgCadence",
    "maxCadence",
    "avgStrideCm",
    "steps",
    "ascentM",
    "descentM",
    "minElevationM",
    "maxElevationM",
    "vo2max",
    "spo2Min",
    "spo2Max",
    "paceZones",
    "splits",
    "tables",
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
            // Each image gets a fixed token budget; the highest keeps small
            // print (split tables, zone minutes) legible.
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
      return JSON.parse(text) as ScannedWatchWorkout;
    } catch {
      throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
    }
  });
