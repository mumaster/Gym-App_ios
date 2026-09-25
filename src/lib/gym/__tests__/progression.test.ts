import { describe, expect, it } from "vitest";
import { repRange, rpeAdjustedWeight, suggestWeight } from "../progression";
import type { Workout } from "../types";

const session = (id: string, exercise: string, reps: number[], weight = 100): Workout => ({
  id,
  date: id,
  duration_minutes: 45,
  target_muscles: [],
  plan: [],
  finished: true,
  unit: "kg",
  completed_sets: reps.map((r, i) => ({
    exercise_id: exercise,
    set_number: i + 1,
    set_type: "working",
    weight,
    reps: r,
    completed_at: id,
  })),
});

describe("repRange", () => {
  it("parses ranges and single numbers", () => {
    expect(repRange("8-12")).toEqual([8, 12]);
    expect(repRange("5")).toEqual([5, 5]);
  });
});

describe("suggestWeight (double progression, ACSM 2009 / NSCA 2-for-2)", () => {
  it("repeats the weight after only one session at the top of the range", () => {
    const s = suggestWeight(
      "bb-bench",
      [session("2", "bb-bench", [10, 10, 10]), session("1", "bb-bench", [9, 8, 8])],
      "6-10",
      2.5,
    );
    expect(s).toMatchObject({ weight: 100, reps: 10, bumped: false });
  });

  it("adds 2.5% to an upper-body lift after two sessions at the top", () => {
    const s = suggestWeight(
      "bb-bench",
      [session("2", "bb-bench", [10, 10, 10]), session("1", "bb-bench", [10, 11, 10])],
      "6-10",
      2.5,
    );
    expect(s).toMatchObject({ weight: 102.5, reps: 6, bumped: true });
  });

  it("adds 5% to a lower-body lift after two sessions at the top", () => {
    const s = suggestWeight(
      "bb-squat",
      [session("2", "bb-squat", [10, 10]), session("1", "bb-squat", [10, 10])],
      "6-10",
      2.5,
    );
    expect(s?.weight).toBe(105);
  });

  it("aims for one more rep than the worst set otherwise", () => {
    const s = suggestWeight("bb-bench", [session("1", "bb-bench", [8, 7, 6])], "6-10", 2.5);
    expect(s).toMatchObject({ weight: 100, reps: 7 });
  });

  it("returns null without history", () => {
    expect(suggestWeight("bb-bench", [], "6-10")).toBeNull();
  });
});

describe("rpeAdjustedWeight (Helms et al. 2018)", () => {
  it("leaves RPE 7–9 alone", () => {
    for (const rpe of [7, 8, 9]) expect(rpeAdjustedWeight(100, rpe, 2.5)).toBeNull();
  });
  it("moves 4% per point outside the range, rounded to the plate step", () => {
    expect(rpeAdjustedWeight(100, 10, 2.5)).toEqual({ weight: 95, direction: "down" });
    expect(rpeAdjustedWeight(100, 6, 2.5)).toEqual({ weight: 105, direction: "up" });
  });
  it("skips the change when one plate step would overshoot 4% by far", () => {
    expect(rpeAdjustedWeight(10, 10, 2.5)).toBeNull();
  });
});
