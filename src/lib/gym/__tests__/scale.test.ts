import { describe, expect, it } from "vitest";
import type { WeightEntry } from "../bodyweight";
import { dayKey } from "../date";
import {
  compositionAt,
  compositionChange,
  readingDate,
  readingToWeighIn,
  withWeighIn,
  type ScannedScaleReading,
} from "../scale";

const NOW = new Date(2026, 9, 7, 12, 0);

/** The user's Huawei Health weigh-in of 7 October 2026, as printed. */
const huawei: ScannedScaleReading = {
  source: "Huawei Gezondheid",
  device: null,
  date: "2026-10-07T07:42",
  weight: 96.85,
  weightUnit: "kg",
  bmi: 25.4,
  bodyFatPct: 23.5,
  fatMassKg: 22.76,
  fatFreeMassKg: 74.1,
  skeletalMuscleKg: 40.7,
  muscleMassKg: null,
  bodyWaterPct: 51.5,
  proteinPct: 21,
  boneMassKg: 3.91,
  visceralFat: 11,
  bmrKcal: 2138,
  metabolicAge: null,
  otherMetrics: [],
};

const entry = (date: string, kg: number, extra: Partial<WeightEntry> = {}): WeightEntry => ({
  id: date,
  date: new Date(date).toISOString(),
  kg,
  ...extra,
});

describe("scale readings", () => {
  it("keeps the printed values and the measurement time", () => {
    const w = readingToWeighIn(huawei, NOW)!;
    expect(w.kg).toBe(96.85);
    expect(dayKey(w.date)).toBe("2026-10-07");
    expect(new Date(w.date).getHours()).toBe(7);
    expect(w.source).toBe("Huawei Gezondheid");
    expect(w.composition).toEqual({
      bmi: 25.4,
      bodyFatPct: 23.5,
      fatMassKg: 22.76,
      fatFreeMassKg: 74.1,
      skeletalMuscleKg: 40.7,
      bodyWaterPct: 51.5,
      proteinPct: 21,
      boneMassKg: 3.91,
      visceralFat: 11,
      bmrKcal: 2138,
    });
  });

  it("returns nothing without a weight in range", () => {
    expect(readingToWeighIn({ ...huawei, weight: null }, NOW)).toBeNull();
    expect(readingToWeighIn({ ...huawei, weight: 968.5 }, NOW)).toBeNull();
    expect(readingToWeighIn({ ...huawei, weight: 12 }, NOW)).toBeNull();
  });

  it("converts a scale set to pounds, masses included", () => {
    const w = readingToWeighIn({ ...huawei, weight: 213.5, weightUnit: "lb", fatMassKg: 50 }, NOW)!;
    expect(w.kg).toBe(96.84);
    expect(w.composition?.fatMassKg).toBe(22.68);
    expect(w.composition?.bodyFatPct).toBe(23.5);
  });

  it("drops impossible values, rounds to 2 decimals and keeps other metrics", () => {
    const w = readingToWeighIn(
      {
        ...huawei,
        bodyFatPct: 235,
        boneMassKg: -1,
        bmi: 25.41666,
        otherMetrics: [
          { label: "Hartslag", value: "62", unit: "spm" },
          { label: " ", value: "1", unit: null },
        ],
      },
      NOW,
    )!;
    expect(w.composition?.bodyFatPct).toBeUndefined();
    expect(w.composition?.boneMassKg).toBeUndefined();
    expect(w.composition?.bmi).toBe(25.42);
    expect(w.composition?.other).toEqual([{ label: "Hartslag", value: "62", unit: "spm" }]);
  });

  it("leaves the composition out when only a weight is printed", () => {
    const bare = Object.fromEntries(
      Object.entries(huawei).map(([k, v]) => [k, typeof v === "number" ? null : v]),
    ) as unknown as ScannedScaleReading;
    const w = readingToWeighIn({ ...bare, weight: 80, otherMetrics: [] }, NOW)!;
    expect(w.composition).toBeUndefined();
  });

  it("dates a bare date at noon and a missing or future one now", () => {
    expect(new Date(readingDate("2026-10-05", NOW)).getHours()).toBe(12);
    expect(readingDate(null, NOW)).toBe(NOW.toISOString());
    expect(readingDate("2026-10-09T07:00", NOW)).toBe(NOW.toISOString());
  });
});

describe("weigh-ins in the log", () => {
  it("replaces that day's weigh-in and keeps the log oldest first", () => {
    const log = [
      entry("2026-10-01T08:00", 98),
      entry("2026-10-05T08:00", 97.4),
      entry("2026-10-07T07:00", 97),
    ];
    const next = withWeighIn(log, entry("2026-10-03T07:30", 97.8));
    expect(next.map((e) => e.kg)).toEqual([98, 97.8, 97.4, 97]);
    const same = withWeighIn(log, entry("2026-10-07T07:42", 96.85));
    expect(same.map((e) => e.kg)).toEqual([98, 97.4, 96.85]);
  });

  it("finds the latest reading on or before a day and the one before it", () => {
    const log = [
      entry("2026-09-20T08:00", 98.6, { composition: { bodyFatPct: 24.3 } }),
      entry("2026-09-30T08:00", 97.6),
      entry("2026-10-03T08:00", 97.2, { composition: { bodyFatPct: 23.9, bmi: 25.5 } }),
      entry("2026-10-07T08:00", 96.85, { composition: { bodyFatPct: 23.5, bmi: 25.4 } }),
    ];
    expect(compositionAt(log, "2026-09-19")).toBeNull();
    const at5 = compositionAt(log, "2026-10-05")!;
    expect(at5.entry.kg).toBe(97.2);
    expect(at5.previous?.kg).toBe(98.6);
    const now = compositionAt(log, "2026-10-07")!;
    expect(compositionChange(now.entry.composition!, now.previous?.composition, "bodyFatPct")).toBe(
      -0.4,
    );
    expect(compositionChange(at5.entry.composition!, at5.previous?.composition, "bmi")).toBeNull();
  });
});
