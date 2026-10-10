import { describe, expect, it } from "vitest";
import { exerciseBreakdown } from "../exerciseBreakdown";
import type { LoggedSet, Workout } from "../types";

const set = (
  exercise_id: string,
  weight: number,
  reps: number,
  set_type: LoggedSet["set_type"] = "working",
  set_number = 1,
): LoggedSet => ({
  exercise_id,
  set_number,
  set_type,
  weight,
  reps,
  completed_at: "2026-09-01T18:00:00",
});

const workout = (id: string, completed_sets: LoggedSet[]): Workout => ({
  id,
  date: "2026-09-01T18:00:00",
  duration_minutes: 45,
  target_muscles: [],
  plan: [],
  finished: true,
  unit: "kg",
  completed_sets,
});

describe("exerciseBreakdown", () => {
  it("groups sets per exercise in first-logged order, keeping warm-ups in the rows", () => {
    const w = workout("a", [
      set("bb-bench", 40, 10, "warmup", 1),
      set("bb-squat", 80, 5, "working", 1),
      set("bb-bench", 60, 8, "working", 1),
      set("bb-squat", 80, 5, "working", 2),
    ]);
    const out = exerciseBreakdown(w, [w]);
    expect(out.map((e) => e.id)).toEqual(["bb-bench", "bb-squat"]);
    expect(out[0]!.rows).toHaveLength(2);
    expect(out[0]!.rows[0]!.set_type).toBe("warmup");
    expect(out[1]!.rows).toHaveLength(2);
  });

  it("takes the best set from working sets only", () => {
    const w = workout("a", [
      set("bb-bench", 100, 5, "warmup", 1),
      set("bb-bench", 60, 8, "working", 1),
      set("bb-bench", 70, 5, "working", 2),
    ]);
    const [ex] = exerciseBreakdown(w, [w]);
    expect(ex!.bestSet).toMatchObject({ weight: 70, reps: 5 });
    expect(ex!.bestE1rm).toBeCloseTo(70 * (1 + 5 / 30), 1);
  });

  it("has no best set and no PR when only warm-ups were logged", () => {
    const w = workout("a", [set("bb-bench", 40, 10, "warmup")]);
    const [ex] = exerciseBreakdown(w, [w]);
    expect(ex!.bestSet).toBeNull();
    expect(ex!.bestE1rm).toBe(0);
    expect(ex!.isPR).toBe(false);
  });

  it("flags a PR only when the best set beats every other session", () => {
    const prior = workout("old", [set("bb-bench", 60, 8)]);
    const better = workout("new", [set("bb-bench", 65, 8)]);
    const same = workout("same", [set("bb-bench", 60, 8)]);
    expect(exerciseBreakdown(better, [better, prior])[0]!.isPR).toBe(true);
    expect(exerciseBreakdown(same, [same, prior])[0]!.isPR).toBe(false);
  });

  it("counts a first-ever session as a PR and ignores the session itself", () => {
    const w = workout("a", [set("bb-bench", 60, 8)]);
    expect(exerciseBreakdown(w, [w])[0]!.isPR).toBe(true);
  });

  it("ignores warm-ups when working out the prior best", () => {
    // A heavy warm-up in an earlier session must not hide a real PR.
    const prior = workout("old", [set("bb-bench", 100, 5, "warmup"), set("bb-bench", 50, 8)]);
    const w = workout("new", [set("bb-bench", 60, 8)]);
    expect(exerciseBreakdown(w, [w, prior])[0]!.isPR).toBe(true);
  });
});
