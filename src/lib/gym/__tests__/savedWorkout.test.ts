import { describe, expect, it } from "vitest";
import { guessDayType, planFromDone } from "../savedWorkout";
import type { Workout } from "../types";

const base = {
  id: "w",
  date: "2026-10-13T10:00:00Z",
  duration_minutes: 50,
  finished: true,
  unit: "kg",
} as const;
const ex = (id: string, extra = {}) => ({
  exercise_id: id,
  target_sets: 3,
  warmup_sets: 0,
  target_reps: "8-10",
  rest_seconds: 90,
  ...extra,
});
const set = (id: string) => ({
  exercise_id: id,
  set_number: 1,
  set_type: "working",
  weight: 20,
  reps: 8,
  completed_at: "2026-10-13T10:05:00Z",
});

describe("saved done workouts", () => {
  it("keeps only exercises that got sets", () => {
    const w = {
      ...base,
      target_muscles: ["Chest"],
      plan: [ex("a"), ex("b", { bonus: true })],
      completed_sets: [set("b")],
    } as unknown as Workout;
    const plan = planFromDone(w);
    expect(plan.map((p) => p.exercise_id)).toEqual(["b"]);
    expect(plan[0]).not.toHaveProperty("bonus");
  });

  it("guesses the day type from the trained muscles", () => {
    const w = (m: string[]) =>
      ({ ...base, target_muscles: m, plan: [], completed_sets: [] }) as unknown as Workout;
    expect(guessDayType(w(["Quads", "Hamstrings", "Glutes", "Calves"]))).toBe("lower");
    expect(guessDayType(w(["Chest", "Back", "Shoulders", "Arms"]))).toBe("upper");
    expect(guessDayType(w(["Chest"]))).toBe("chest");
    expect(guessDayType(w([]))).toBe("full");
  });
});
