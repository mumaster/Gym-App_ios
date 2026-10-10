import { describe, expect, it } from "vitest";
import {
  calorieAdjustment,
  chartSelection,
  targetKgPerWeek,
  weightTrend,
  type WeightEntry,
} from "../bodyweight";
import type { NutritionProfile } from "../nutrition";

const today = new Date(2026, 8, 28, 12);
const entries = (kgs: number[], everyDays = 3): WeightEntry[] =>
  kgs.map((kg, i) => ({
    id: String(i),
    date: new Date(today.getTime() - (kgs.length - 1 - i) * everyDays * 86_400_000).toISOString(),
    kg,
  }));

describe("weightTrend", () => {
  it("needs at least two weeks and four weigh-ins", () => {
    expect(weightTrend(entries([80, 79.8, 79.6]), today)).toBeNull();
    expect(weightTrend(entries([80, 79.9, 79.8, 79.7], 2), today)).toBeNull(); // 6 days
  });

  it("fits a line through noisy weigh-ins", () => {
    // Losing 0.5 kg/week, weighed every 3.5 days, with ±0.3 kg noise.
    const kgs = [80, 79.45, 79.8, 78.95, 79.3, 78.45, 78.8, 78.25];
    const t = weightTrend(entries(kgs, 3.5), today)!;
    expect(t.kgPerWeek).toBeCloseTo(-0.5, 1);
    expect(t.days).toBe(25);
    // The drawn line's ends agree with the slope.
    const weeks = (t.endMs - t.startMs) / (7 * 86_400_000);
    expect((t.endKg - t.startKg) / weeks).toBeCloseTo(t.kgPerWeek, 6);
  });

  it("ignores weigh-ins older than four weeks", () => {
    const old = { id: "old", date: new Date(2026, 6, 1).toISOString(), kg: 90 };
    const t = weightTrend([old, ...entries([80, 80, 80, 80, 80, 80], 3)], today)!;
    expect(t.kgPerWeek).toBeCloseTo(0, 5);
  });
});

describe("adaptive calories", () => {
  const profile = { goal: "lose", pace: "moderate" } as NutritionProfile;
  const base = { latestKg: 80, entries: 6, days: 20, startMs: 0, endMs: 1, startKg: 80, endKg: 80 };

  it("targets the same rates as the calorie calculator", () => {
    expect(targetKgPerWeek(profile, 80)).toBeCloseTo(-0.6);
    expect(targetKgPerWeek({ ...profile, goal: "gain", pace: "aggressive" }, 80)).toBeCloseTo(0.4);
    expect(targetKgPerWeek({ ...profile, goal: "maintain" }, 80)).toBe(0);
    // Recomposition: 250 kcal a day × 7 / 7700 kcal per kg, whatever the pace.
    expect(targetKgPerWeek({ ...profile, goal: "recomp" }, 80)).toBeCloseTo(-0.227, 3);
  });

  it("suggests eating less when losing slower than the target", () => {
    const trend = { ...base, kgPerWeek: -0.2, pctPerWeek: -0.0025 };
    // (−0.6 − −0.2) × 7700 / 7 = −440
    expect(calorieAdjustment(trend, -0.6)).toBe(-440);
  });

  it("suggests eating more when losing faster than the target", () => {
    const trend = { ...base, kgPerWeek: -1, pctPerWeek: -0.0125 };
    expect(calorieAdjustment(trend, -0.6)).toBe(440);
  });
});

describe("chartSelection", () => {
  const pts = [{ t: 100 }, { t: 200 }, { t: 300 }];

  it("returns the picked weigh-in's index while it still exists", () => {
    expect(chartSelection(pts, 200)).toEqual({ index: 1, picked: true });
  });

  it("follows the picked weigh-in when earlier ones are removed", () => {
    expect(chartSelection(pts.slice(1), 200)).toEqual({ index: 0, picked: true });
  });

  it("falls back to the latest, unpicked, when the picked weigh-in is removed", () => {
    // Pick the newest, then remove it: the old index (2) is now out of range.
    const after = pts.slice(0, 2);
    const sel = chartSelection(after, 300)!;
    expect(sel).toEqual({ index: 1, picked: false });
    expect(after[sel.index]).toBeDefined();
  });

  it("shows the latest when nothing is picked", () => {
    expect(chartSelection(pts, null)).toEqual({ index: 2, picked: false });
  });

  it("is null when there are no points", () => {
    expect(chartSelection([], null)).toBeNull();
    expect(chartSelection([], 100)).toBeNull();
  });
});
