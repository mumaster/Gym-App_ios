import { describe, expect, it } from "vitest";
import { moveBlock, planBlocks } from "../planBlocks";
import type { PlannedExercise } from "../types";

const ex = (id: string, group?: number, slot?: "A" | "B"): PlannedExercise =>
  ({
    exercise_id: id,
    target_sets: 3,
    target_reps: "8-12",
    rest_seconds: 120,
    ...(group !== undefined ? { superset_group: group, superset_slot: slot } : {}),
  }) as PlannedExercise;

const plan = [
  ex("squat"),
  ex("bench", 1, "A"),
  ex("row", 1, "B"),
  ex("curl", 2, "A"),
  ex("pushdown", 2, "B"),
  ex("calf"),
];
const ids = (p: PlannedExercise[]) => p.map((x) => x.exercise_id);

describe("plan blocks", () => {
  it("groups a superset's two halves into one block", () => {
    expect(planBlocks(plan)).toEqual([[0], [1, 2], [3, 4], [5]]);
  });

  it("treats a lone half (its partner moved away) as its own block", () => {
    expect(planBlocks([ex("bench", 1, "A"), ex("squat"), ex("row", 1, "B")])).toEqual([
      [0],
      [1],
      [2],
    ]);
  });

  it("moves a superset up as a pair, past a straight exercise", () => {
    const moved = moveBlock(plan, 1, -1);
    expect(ids(moved)).toEqual(["bench", "row", "squat", "curl", "pushdown", "calf"]);
    expect(planBlocks(moved)).toEqual([[0, 1], [2], [3, 4], [5]]);
  });

  it("moves a straight exercise past a whole superset", () => {
    expect(ids(moveBlock(plan, 0, 1))).toEqual([
      "bench",
      "row",
      "squat",
      "curl",
      "pushdown",
      "calf",
    ]);
  });

  it("renumbers supersets in their new order", () => {
    const moved = moveBlock(plan, 2, -1);
    expect(ids(moved)).toEqual(["squat", "curl", "pushdown", "bench", "row", "calf"]);
    expect(moved.map((p) => p.superset_group)).toEqual([undefined, 1, 1, 2, 2, undefined]);
    expect(moved.map((p) => p.superset_slot)).toEqual([undefined, "A", "B", "A", "B", undefined]);
  });

  it("leaves the plan as it is at either end", () => {
    expect(moveBlock(plan, 0, -1)).toBe(plan);
    expect(moveBlock(plan, 3, 1)).toBe(plan);
  });
});
