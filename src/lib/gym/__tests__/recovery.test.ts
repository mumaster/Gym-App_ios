import { describe, expect, it } from "vitest";
import { recoveryHours, regionContribution, regionRecovery, recoveryLevel } from "../recovery";
import type { LoggedSet, Workout } from "../types";

const sets = (exercise_id: string, n: number, rpe?: number): LoggedSet[] =>
  Array.from({ length: n }, (_, i) => ({
    exercise_id,
    set_number: i + 1,
    set_type: "working",
    weight: 50,
    reps: 8,
    completed_at: "",
    ...(rpe != null ? { rpe } : {}),
  }));

const finishedAt = (iso: string, completed: LoggedSet[]): Workout => ({
  id: iso,
  date: iso,
  finished_at: iso,
  duration_minutes: 60,
  target_muscles: [],
  plan: [],
  completed_sets: completed,
  finished: true,
  unit: "kg",
});

describe("recovery", () => {
  it("maps an exercise's targets to map regions, main target first", () => {
    expect(regionContribution("bb-bench")).toEqual({ chest: 1, triceps: 0.5, shoulders: 0.5 });
  });

  it("needs 48 h for easy low-volume work and up to 72 h at failure or high volume", () => {
    expect(recoveryHours(1, 7)).toBeCloseTo(48 + 24 / 11);
    expect(recoveryHours(3, 10)).toBe(72);
    expect(recoveryHours(11, 7)).toBe(72);
    expect(recoveryHours(30, 10)).toBe(72);
  });

  it("shades regions trained in the last days and lets them recover", () => {
    const w = finishedAt("2026-10-12T10:00:00Z", [
      ...sets("bb-bench", 4, 10),
      ...sets("db-curl", 1),
    ]);
    const r = regionRecovery([w], new Date("2026-10-13T10:00:00Z"));
    expect(r.chest!.hoursLeft).toBe(48);
    expect(recoveryLevel(r.chest)).toBe("low");
    // 4 bench sets give the triceps 2 fractional sets.
    expect(r.triceps).toBeDefined();
    // One curl set: biceps get 1, forearms only 0.5, which isn't shaded.
    expect(r.biceps).toBeDefined();
    expect(r.forearms).toBeUndefined();
    expect(regionRecovery([w], new Date("2026-10-15T11:00:00Z")).chest).toBeUndefined();
  });

  it("takes the slowest of several sessions", () => {
    const now = new Date("2026-10-13T10:00:00Z");
    const r = regionRecovery(
      [
        finishedAt("2026-10-11T10:00:00Z", sets("bb-bench", 3, 7)),
        finishedAt("2026-10-13T08:00:00Z", sets("bb-bench", 3, 7)),
      ],
      now,
    );
    expect(r.chest!.hoursLeft).toBeGreaterThan(40);
  });
});
