import { describe, expect, it } from "vitest";
import {
  clearPregenerated,
  forWeek,
  generateDayWorkout,
  hasWeekWorkout,
  isPregenerated,
  pregenerateProgram,
  readyToStart,
  savedWorkoutFor,
  withAllDayWorkouts,
  type DayWorkoutContext,
} from "../dayWorkouts";
import { EQUIPMENT } from "../data";
import { DELOAD_WEEK, type Program, type ProgramWeek } from "../programs";
import { applyDayPicks, buildSchedule, withDayType, type ScheduleSlot } from "../splits";
import type { DayWorkout, PlannedExercise } from "../types";

const ctx: DayWorkoutContext = {
  equipment: EQUIPMENT.map((e) => e.id),
  growthFocus: [],
};
const NOW = new Date(2026, 8, 21, 9);
const BUILD: ProgramWeek = { type: "build", intensity: 1, volume: 1 };

const planned = (id: string, sets = 4): PlannedExercise => ({
  exercise_id: id,
  target_sets: sets,
  target_reps: "8",
  rest_seconds: 120,
  warmup_sets: 0,
});
const workoutOf = (plan: PlannedExercise[]): DayWorkout => ({
  plan,
  duration_minutes: 45,
  target_muscles: ["Chest"],
  saved_at: NOW.toISOString(),
});

const upper: ScheduleSlot = { dow: 1, dayId: "upper" };
const lower: ScheduleSlot = { dow: 2, dayId: "lower" };
const cardio: ScheduleSlot = { dow: 3, dayId: "cardio" };

describe("savedWorkoutFor", () => {
  const day = workoutOf([planned("a")]);
  const wk = workoutOf([planned("b")]);
  it("prefers the week's workout over the day's", () => {
    const slot: ScheduleSlot = { ...upper, workout: day, weekWorkouts: [null, wk] };
    expect(savedWorkoutFor(slot, 1)).toBe(wk);
    expect(savedWorkoutFor(slot, 0)).toBe(day);
    expect(savedWorkoutFor(slot)).toBe(day);
  });
  it("is null for no slot, nothing saved and a cardio day", () => {
    expect(savedWorkoutFor(undefined)).toBeNull();
    expect(savedWorkoutFor(upper)).toBeNull();
    expect(savedWorkoutFor({ ...cardio, workout: day, weekWorkouts: [wk] }, 0)).toBeNull();
  });
  it("hasWeekWorkout only looks at that week", () => {
    const slot: ScheduleSlot = { ...upper, workout: day, weekWorkouts: [null, wk] };
    expect(hasWeekWorkout(slot, 1)).toBe(true);
    expect(hasWeekWorkout(slot, 0)).toBe(false);
  });
});

describe("generateDayWorkout", () => {
  it("makes a non-empty plan for an upper day with full equipment", () => {
    const w = generateDayWorkout(ctx, "upper_lower", upper, 45, 0, NOW)!;
    expect(w.plan.length).toBeGreaterThan(0);
    expect(w.duration_minutes).toBe(45);
    expect(w.target_muscles.length).toBeGreaterThan(0);
    expect(w.saved_at).toBe(NOW.toISOString());
  });
  it("makes nothing for a cardio day", () => {
    expect(generateDayWorkout(ctx, "upper_lower", cardio, 45)).toBeNull();
  });
});

describe("withAllDayWorkouts", () => {
  it("fills only lifting slots that have no workout", () => {
    const own = workoutOf([planned("own")]);
    const out = withAllDayWorkouts(
      [{ ...upper, workout: own }, lower, cardio],
      ctx,
      "upper_lower",
      45,
      {
        now: NOW,
      },
    );
    expect(out[0]!.workout).toBe(own);
    expect(out[1]!.workout?.plan.length).toBeGreaterThan(0);
    expect(out[2]!.workout).toBeUndefined();
  });
  it("replaces existing ones with `replace`", () => {
    const own = workoutOf([planned("own")]);
    const out = withAllDayWorkouts([{ ...upper, workout: own }], ctx, "upper_lower", 45, {
      replace: true,
      now: NOW,
    });
    expect(out[0]!.workout).not.toBe(own);
  });
  it("varies two days of the same type", () => {
    const out = withAllDayWorkouts([upper, { ...upper, dow: 4 }], ctx, "upper_focus", 45, {
      now: NOW,
    });
    const ids = (s: ScheduleSlot) => s.workout!.plan.map((p) => p.exercise_id).join(",");
    expect(ids(out[0]!)).not.toBe(ids(out[1]!));
  });
});

describe("forWeek", () => {
  const w = workoutOf([planned("a", 4), planned("b", 1), planned("c", 3)]);
  it("leaves a normal week alone", () => {
    expect(forWeek(w, BUILD)).toBe(w);
  });
  it("halves sets on a deload, at least 1", () => {
    expect(forWeek(w, DELOAD_WEEK).plan.map((p) => p.target_sets)).toEqual([2, 1, 2]);
  });
});

const program = (): Program => ({
  id: "p",
  name: "P",
  templateId: "upper_lower",
  weeks: [BUILD, BUILD, DELOAD_WEEK],
  currentWeek: 0,
  schedule: buildSchedule("upper_lower", [1, 2, 3]).map((s, i) =>
    i === 2 ? { ...s, dayId: "cardio" } : s,
  ),
  cyclePosition: 0,
  anchor: "2026-09-21",
});

describe("pregenerateProgram", () => {
  it("fills every week of every lifting day", () => {
    const p = pregenerateProgram(program(), ctx, 45, NOW);
    expect(isPregenerated(p)).toBe(true);
    for (const s of p.schedule) {
      if (s.dayId === "cardio") expect(s.weekWorkouts).toBeUndefined();
      else expect(s.weekWorkouts).toHaveLength(3);
    }
    const s0 = p.schedule[0]!;
    expect(s0.weekWorkouts![2]!.plan[0]!.target_sets).toBeLessThanOrEqual(
      s0.weekWorkouts![0]!.plan[0]!.target_sets,
    );
  });
  it("isn't pregenerated before, nor after clearPregenerated", () => {
    expect(isPregenerated(program())).toBe(false);
    const cleared = clearPregenerated(pregenerateProgram(program(), ctx, 45, NOW));
    expect(isPregenerated(cleared)).toBe(false);
    expect(cleared.schedule[0]!.weekWorkouts).toBeUndefined();
    expect(cleared.schedule[0]!.workout).toBeDefined();
  });
});

describe("readyToStart", () => {
  const known = generateDayWorkout(ctx, "upper_lower", upper, 45, 0, NOW)!;
  const base = { history: [] };

  it("drops exercises no longer in the catalog", () => {
    const w = workoutOf([...known.plan.slice(0, 2), planned("no-such-exercise")]);
    const out = readyToStart(w, base);
    expect(out.map((p) => p.exercise_id)).toEqual(known.plan.slice(0, 2).map((p) => p.exercise_id));
  });
  it("applies a deload's volume only when not pre-generated", () => {
    const w = workoutOf([{ ...known.plan[0]!, target_sets: 4 }]);
    expect(readyToStart(w, base, { week: DELOAD_WEEK, preGenerated: false })[0]!.target_sets).toBe(
      2,
    );
    expect(readyToStart(w, base, { week: DELOAD_WEEK, preGenerated: true })[0]!.target_sets).toBe(
      4,
    );
  });
  it("re-computes suggestions instead of keeping stale ones", () => {
    const stale = { ...known.plan[0]!, suggested_weight: 999, suggested_reps: 8 };
    const out = readyToStart(workoutOf([stale]), base)[0]!;
    expect(out.suggested_weight).not.toBe(999);
  });
});

describe("saved workouts and day types (splits.ts)", () => {
  const w = workoutOf([planned("a")]);
  it("withDayType drops the workout when the day type changes, keeps it when the same", () => {
    const slot: ScheduleSlot = { ...upper, workout: w, weekWorkouts: [w] };
    const changed = withDayType("upper_lower", slot, "lower");
    expect(changed.dayId).toBe("lower");
    expect(changed.workout).toBeUndefined();
    expect(changed.weekWorkouts).toBeUndefined();
    const same = withDayType("upper_lower", slot, "upper");
    expect(same.workout).toBe(w);
    expect(same.weekWorkouts).toEqual([w]);
  });
  it("applyDayPicks keeps the workout for an unchanged weekday", () => {
    const prev: ScheduleSlot[] = [
      { ...upper, workout: w },
      { ...lower, workout: w },
    ];
    const fresh: ScheduleSlot[] = [
      { dow: 1, dayId: "upper" },
      { dow: 2, dayId: "lower" },
    ];
    const out = applyDayPicks("upper_lower", fresh, { 2: "upper" }, prev);
    expect(out[0]!.workout).toBe(w);
    expect(out[1]!.dayId).toBe("upper");
    expect(out[1]!.workout).toBeUndefined();
  });
});
