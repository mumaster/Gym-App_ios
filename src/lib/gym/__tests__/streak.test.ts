import { describe, expect, it } from "vitest";
import {
  MIN_TRAINING_DAYS_PER_WEEK,
  bestWeekStreak,
  currentWeekStreak,
  trainingDaysThisWeek,
} from "../streak";
import type { Workout } from "../types";

const today = new Date(2026, 8, 26, 12); // Saturday 26 Sep 2026
const on = (y: number, m: number, d: number, id = `${m}-${d}`): Workout => ({
  id,
  date: new Date(y, m, d, 18).toISOString(),
  duration_minutes: 45,
  target_muscles: [],
  plan: [],
  completed_sets: [],
  finished: true,
  unit: "kg",
});

describe("weekly streak (WHO 2020: strength training on 2+ days a week)", () => {
  it("uses 2 days as the minimum", () => {
    expect(MIN_TRAINING_DAYS_PER_WEEK).toBe(2);
  });

  it("counts Monday–Sunday weeks with 2+ training days", () => {
    const ws = [
      on(2026, 8, 21),
      on(2026, 8, 24), // this week: Mon + Thu
      on(2026, 8, 14),
      on(2026, 8, 20), // last week: Mon + Sun
      on(2026, 8, 8),
      on(2026, 8, 9), // week before
    ];
    expect(currentWeekStreak(ws, today)).toBe(3);
    expect(trainingDaysThisWeek(ws, today)).toBe(2);
  });

  it("doesn't break on a rest day, and a week in progress doesn't break it yet", () => {
    const ws = [on(2026, 8, 22), on(2026, 8, 14), on(2026, 8, 16)];
    expect(currentWeekStreak(ws, today)).toBe(1);
  });

  it("two sessions on the same day count as one training day", () => {
    const ws = [on(2026, 8, 14, "a"), on(2026, 8, 14, "b")];
    expect(currentWeekStreak(ws, today)).toBe(0);
  });

  it("finds the longest run of qualifying weeks", () => {
    const ws = [
      on(2026, 7, 3),
      on(2026, 7, 5),
      on(2026, 7, 10),
      on(2026, 7, 12),
      on(2026, 7, 17),
      on(2026, 7, 19),
      on(2026, 8, 14),
      on(2026, 8, 16),
    ];
    expect(bestWeekStreak(ws)).toBe(3);
  });
});
