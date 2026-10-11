import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MoveDataSheet } from "../../../components/gym/MoveDataSheet";
import { moveExerciseData, noteMoves, sessionsOf } from "../moveExercise";
import { GymProvider } from "../store";
import type { LoggedSet, PlannedExercise, Workout } from "../types";

const set = (exercise_id: string, n: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({
  exercise_id,
  set_number: n,
  set_type: "working",
  weight: 60,
  reps: 8,
  rpe: 8,
  round: 2,
  completed_at: `2026-09-01T18:0${n}:00`,
  ...extra,
});

const plan = (exercise_id: string, extra: Partial<PlannedExercise> = {}): PlannedExercise => ({
  exercise_id,
  target_sets: 3,
  warmup_sets: 0,
  target_reps: "8-10",
  rest_seconds: 90,
  ...extra,
});

const workout = (
  id: string,
  date: string,
  sets: LoggedSet[],
  p: PlannedExercise[] = [],
): Workout => ({
  id,
  date,
  duration_minutes: 45,
  target_muscles: [],
  plan: p,
  finished: true,
  unit: "kg",
  completed_sets: sets,
});

const state = () => ({
  workouts: [
    workout(
      "a",
      "2026-09-01",
      [set("wrong", 1), set("wrong", 2), set("other", 1)],
      [plan("wrong"), plan("other")],
    ),
    workout(
      "b",
      "2026-09-08",
      [set("wrong", 1, { set_type: "warmup", weight: 20 }), set("wrong", 2)],
      [plan("wrong")],
    ),
    workout("c", "2026-09-15", [set("right", 1), set("wrong", 1)], [plan("wrong"), plan("right")]),
  ],
  exerciseNotes: { wrong: "felt heavy" } as Record<string, string>,
});

describe("moveExerciseData", () => {
  it("moves every field of the chosen sessions and leaves nothing behind", () => {
    const next = moveExerciseData(state(), "wrong", "right", new Set(["a", "b", "c"]));
    const all = next.workouts.flatMap((w) => w.completed_sets);
    expect(all.some((s) => s.exercise_id === "wrong")).toBe(false);
    const a = next.workouts[0]!;
    expect(a.completed_sets.filter((s) => s.exercise_id === "right")).toEqual([
      set("right", 1),
      set("right", 2),
    ]);
    expect(a.completed_sets[2]).toEqual(set("other", 1));
    expect(a.plan.map((p) => p.exercise_id)).toEqual(["right", "other"]);
    expect(next.workouts[1]!.completed_sets[0]).toMatchObject({
      exercise_id: "right",
      set_type: "warmup",
      weight: 20,
      completed_at: "2026-09-01T18:01:00",
    });
  });

  it("moves only the ticked sessions and keeps the note then", () => {
    const next = moveExerciseData(state(), "wrong", "right", new Set(["a"]));
    expect(sessionsOf(next.workouts, "wrong").map((s) => s.workoutId)).toEqual(["c", "b"]);
    expect(next.exerciseNotes).toEqual({ wrong: "felt heavy" });
  });

  it("renumbers when the target already has sets in that session", () => {
    const next = moveExerciseData(state(), "wrong", "right", new Set(["c"]));
    const sets = next.workouts[2]!.completed_sets;
    expect(sets.map((s) => [s.exercise_id, s.set_number])).toEqual([
      ["right", 1],
      ["right", 2],
    ]);
    // Only one plan entry for the target, not a duplicate.
    expect(next.workouts[2]!.plan.map((p) => p.exercise_id)).toEqual(["right"]);
  });

  it("moves the note along only when nothing stays and the target has none", () => {
    const all = new Set(["a", "b", "c"]);
    expect(moveExerciseData(state(), "wrong", "right", all).exerciseNotes).toEqual({
      right: "felt heavy",
    });
    expect(noteMoves(state(), "wrong", "right", all)).toBe(true);
    const withNote = { ...state(), exerciseNotes: { wrong: "x", right: "y" } };
    expect(moveExerciseData(withNote, "wrong", "right", all).exerciseNotes).toEqual({
      wrong: "x",
      right: "y",
    });
  });

  it("does nothing for the same exercise or no sessions", () => {
    const s = state();
    expect(moveExerciseData(s, "wrong", "wrong", new Set(["a"]))).toBe(s);
    expect(moveExerciseData(s, "wrong", "right", new Set())).toBe(s);
  });

  it("does not mutate its input", () => {
    const s = state();
    const copy = JSON.stringify(s);
    moveExerciseData(s, "wrong", "right", new Set(["a", "b", "c"]));
    expect(JSON.stringify(s)).toBe(copy);
  });
});

describe("MoveDataSheet render", () => {
  it("renders closed and open", () => {
    for (const open of [false, true]) {
      expect(() =>
        renderToString(
          createElement(
            GymProvider,
            null,
            createElement(MoveDataSheet, { open, onClose: () => {} }),
          ),
        ),
      ).not.toThrow();
    }
  });
});
