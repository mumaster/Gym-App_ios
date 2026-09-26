import { describe, expect, it } from "vitest";
import { loadRatio, sessionLoad, sessionMinutes, weeklyLoads } from "../trainingLoad";
import type { Workout } from "../types";

const today = new Date(2026, 8, 26, 12); // a Saturday
const w = (daysAgo: number, rpe: number | undefined, minutes = 60): Workout => {
  const start = new Date(today.getTime() - daysAgo * 86_400_000);
  return {
    id: `w${daysAgo}`,
    date: start.toISOString(),
    finished_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
    duration_minutes: 45,
    target_muscles: [],
    plan: [],
    completed_sets: [],
    finished: true,
    unit: "kg",
    ...(rpe == null ? {} : { session_rpe: rpe }),
  };
};

describe("session-RPE load (Foster 2001)", () => {
  it("is rating × actual minutes, and null when unrated", () => {
    expect(sessionMinutes(w(0, 7, 52))).toBe(52);
    expect(sessionLoad(w(0, 7, 60))).toBe(420);
    expect(sessionLoad(w(0, undefined))).toBeNull();
  });

  it("falls back to the planned length without a finish time", () => {
    const { finished_at: _f, ...old } = w(0, 5);
    expect(sessionMinutes(old)).toBe(45);
  });

  it("sums Monday–Sunday weeks, oldest first", () => {
    const weeks = weeklyLoads([w(0, 5), w(1, 5), w(8, 6)], 3, today);
    expect(weeks.map((x) => x.load)).toEqual([0, 360, 600]);
  });

  it("needs rated sessions in 3 of the last 4 weeks before comparing", () => {
    expect(loadRatio([w(1, 5), w(9, 5)], today)).toBeNull();
    const r = loadRatio([w(1, 8), w(2, 8), w(9, 5), w(16, 5), w(23, 5)], today);
    // acute 960; chronic (960 + 3 × 300) / 4 = 465
    expect(r?.ratio).toBeCloseTo(960 / 465, 5);
  });
});
