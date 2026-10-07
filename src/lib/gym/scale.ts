import { WEIGHT_MAX_KG, WEIGHT_MIN_KG, type BodyComposition, type WeightEntry } from "./bodyweight";
import { dayKey } from "./date";

/**
 * A weigh-in imported from a screenshot of a smart scale's app (Huawei
 * Health's body-composition page and the like). The reader (scaleScan.ts)
 * copies what's printed; this file checks it and turns it into a weigh-in.
 * Nothing here computes a body-composition number: the scale's own figures
 * are kept as printed (rounded to SCALE_DECIMALS), and only the weight is
 * used anywhere else in the app.
 */

/** What the reader returns, before any checks. */
export interface ScannedScaleReading {
  source: string | null;
  device: string | null;
  /** Local date and time as "YYYY-MM-DDTHH:mm", or "YYYY-MM-DD". */
  date: string | null;
  weight: number | null;
  weightUnit: "kg" | "lb" | null;
  bmi: number | null;
  bodyFatPct: number | null;
  fatMassKg: number | null;
  fatFreeMassKg: number | null;
  skeletalMuscleKg: number | null;
  muscleMassKg: number | null;
  bodyWaterPct: number | null;
  proteinPct: number | null;
  boneMassKg: number | null;
  visceralFat: number | null;
  bmrKcal: number | null;
  metabolicAge: number | null;
  otherMetrics: { label: string; value: string; unit: string | null }[];
}

export interface ScaleWeighIn {
  /** ISO timestamp of the measurement. */
  date: string;
  kg: number;
  composition?: BodyComposition;
  source?: string;
}

/** Imported numbers are kept to 2 decimals, like watch data (watch.ts):
 *  enough for every value a scale prints (96.85 kg), and it cuts any
 *  arithmetic the reader slips in. A display choice, not a measurement. */
export const SCALE_DECIMALS = 2;

/** The international pound, defined as exactly 0.45359237 kg (the 1959
 *  international yard and pound agreement). Only for a scale set to lb. */
const KG_PER_LB = 0.45359237;

/** The composition fields in the order the card lists them: fat, then
 *  lean mass, then water and the rest. */
export const COMPOSITION_FIELDS = [
  "bodyFatPct",
  "fatMassKg",
  "fatFreeMassKg",
  "skeletalMuscleKg",
  "muscleMassKg",
  "bodyWaterPct",
  "proteinPct",
  "boneMassKg",
  "visceralFat",
  "bmi",
  "bmrKcal",
  "metabolicAge",
] as const;
export type CompositionField = (typeof COMPOSITION_FIELDS)[number];

const MASS_FIELDS = new Set<CompositionField>([
  "fatMassKg",
  "fatFreeMassKg",
  "skeletalMuscleKg",
  "muscleMassKg",
  "boneMassKg",
]);
const PERCENT_FIELDS = new Set<CompositionField>(["bodyFatPct", "bodyWaterPct", "proteinPct"]);

const round = (n: number) => {
  const f = 10 ** SCALE_DECIMALS;
  return Math.round(n * f) / f;
};

/** The measurement's time as an ISO string: the printed local date and
 *  time, a bare date at local noon, and `now` when nothing usable (or a
 *  date in the future, a misread) is printed. */
export function readingDate(printed: string | null, now = new Date()): string {
  if (printed && /^\d{4}-\d{2}-\d{2}/.test(printed)) {
    const d = new Date(printed.length === 10 ? `${printed}T12:00` : printed.slice(0, 16));
    if (!Number.isNaN(d.getTime()) && d.getTime() <= now.getTime()) return d.toISOString();
  }
  return now.toISOString();
}

/**
 * A checked weigh-in from the reader's output, or null when no weight in
 * the accepted range was read. Pounds are converted to kg (mass fields
 * too). A percentage over 100, a negative number and an empty "other"
 * line are dropped; the composition is left out when nothing is left.
 */
export function readingToWeighIn(raw: ScannedScaleReading, now = new Date()): ScaleWeighIn | null {
  const toKg = raw.weightUnit === "lb" ? KG_PER_LB : 1;
  if (raw.weight == null || !Number.isFinite(raw.weight)) return null;
  const kg = round(raw.weight * toKg);
  if (kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) return null;

  const composition: BodyComposition = {};
  for (const field of COMPOSITION_FIELDS) {
    const value = raw[field];
    if (value == null || !Number.isFinite(value) || value < 0) continue;
    if (PERCENT_FIELDS.has(field) && value > 100) continue;
    composition[field] = round(MASS_FIELDS.has(field) ? value * toKg : value);
  }
  const other = (raw.otherMetrics ?? [])
    .map((m) => ({
      label: m.label?.trim() ?? "",
      value: m.value?.trim() ?? "",
      ...(m.unit?.trim() ? { unit: m.unit.trim() } : {}),
    }))
    .filter((m) => m.label && m.value);
  if (other.length) composition.other = other;

  const source = raw.source?.trim();
  return {
    date: readingDate(raw.date, now),
    kg,
    ...(Object.keys(composition).length ? { composition } : {}),
    ...(source ? { source } : {}),
  };
}

/** The log with this weigh-in in it: one weigh-in a day (a reading on a
 *  day that already has one replaces it, like typing today's weight), and
 *  oldest first, since an imported reading can be from an earlier day. */
export function withWeighIn(log: WeightEntry[], entry: WeightEntry): WeightEntry[] {
  const day = dayKey(entry.date);
  return [...log.filter((e) => dayKey(e.date) !== day), entry].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
}

/** The body composition to show for a picked day: the latest reading on or
 *  before it, plus the reading before that one to compare with. */
export function compositionAt(
  log: WeightEntry[],
  key: string,
): { entry: WeightEntry; previous: WeightEntry | null } | null {
  const readings = log
    .filter((e) => e.composition && dayKey(e.date) <= key)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const entry = readings.at(-1);
  if (!entry) return null;
  return { entry, previous: readings.at(-2) ?? null };
}

/** Change in one field since the previous reading, or null when either
 *  reading lacks it. */
export function compositionChange(
  current: BodyComposition,
  previous: BodyComposition | undefined,
  field: CompositionField,
): number | null {
  const a = current[field];
  const b = previous?.[field];
  if (a == null || b == null) return null;
  const d = round(a - b);
  return Object.is(d, -0) ? 0 : d;
}
