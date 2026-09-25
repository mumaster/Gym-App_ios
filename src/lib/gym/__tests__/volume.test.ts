import { describe, expect, it } from "vitest";
import { EQUIPMENT, TARGET_MUSCLE_GROUP, exerciseById } from "../data";
import { generateWorkout } from "../generator";
import { recommendedMuscles } from "../recommendations";
import type { TargetMuscle, Workout } from "../types";
import {
  BASE_WEEKLY_SETS,
  FOCUS_WEEKLY_SETS,
  MAX_SESSION_SETS_PER_MUSCLE,
  focusMuscles,
  planSets,
  setContribution,
  weeklySets,
} from "../volume";

const workout = (date: string, exercise: string, sets: number): Workout => ({
  id: date,
  date,
  duration_minutes: 45,
  target_muscles: [],
  plan: [],
  finished: true,
  unit: "kg",
  completed_sets: Array.from({ length: sets }, (_, i) => ({
    exercise_id: exercise,
    set_number: i + 1,
    set_type: "working" as const,
    weight: 60,
    reps: 10,
    completed_at: date,
  })),
});

describe("fractional set counting (Pelland et al. 2024)", () => {
  it("counts 1 for the main muscle and 0.5 for each helper", () => {
    const bench = exerciseById("bb-bench")!;
    const c = setContribution("bb-bench");
    expect(c[bench.primary_muscle]).toBe(1);
    for (const m of bench.secondary_muscles) expect(c[m]).toBe(0.5);
  });

  it("only counts this Monday–Sunday week's working sets", () => {
    const done = weeklySets(
      [
        workout("2026-09-22T18:00:00", "bb-bench", 3),
        workout("2026-09-18T18:00:00", "bb-bench", 5),
      ],
      null,
      new Date(2026, 8, 24),
    );
    expect(done.Chest).toBe(3);
  });
});

describe("targets (Schoenfeld 2017, Baz-Valle 2022)", () => {
  it("uses 10 sets normally and 20 for muscles to grow", () => {
    expect(BASE_WEEKLY_SETS).toBe(10);
    expect(FOCUS_WEEKLY_SETS).toBe(20);
    expect([...focusMuscles(["legs"])]).toEqual(["Quads", "Hamstrings", "Glutes", "Calves"]);
  });

  it("recommends the muscle furthest below target, which a focus changes", () => {
    const history = [workout(new Date().toISOString(), "bb-bench", 6)];
    const none = recommendedMuscles(["Chest", "Arms"], history, 1);
    expect(none[0]!.muscle).toBe("Arms");
  });
});

describe("generator focus", () => {
  const equipment = EQUIPMENT.map((e) => e.id);
  const targets = (Object.keys(TARGET_MUSCLE_GROUP) as TargetMuscle[]).filter((k) =>
    ["Chest", "Arms"].includes(TARGET_MUSCLE_GROUP[k]),
  );
  // 45 min: short enough that neither plan reaches the per-session cap.
  const armSets = (focus: boolean) =>
    planSets(
      generateWorkout({ duration: 45, equipment, targets, focusMuscles: focus ? ["Arms"] : [] }),
    ).Arms ?? 0;

  it("plans more sets for a muscle to grow", () => {
    expect(armSets(true)).toBeGreaterThan(armSets(false));
  });

  it("keeps each muscle under the per-session limit", () => {
    for (const duration of [45, 60, 90]) {
      const plan = generateWorkout({ duration, equipment, targets, focusMuscles: ["Arms"] });
      for (const n of Object.values(planSets(plan))) {
        expect(n).toBeLessThanOrEqual(MAX_SESSION_SETS_PER_MUSCLE);
      }
    }
  });
});
