import { describe, expect, it } from "vitest";
import { EQUIPMENT, TARGET_MUSCLE_GROUP, exerciseById } from "../data";
import { estimateMinutes, generateWorkout } from "../generator";
import { regionsForMuscles, targetsFromRegions } from "../anatomy";
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
    expect([...focusMuscles(["legs"])]).toEqual(["Quads", "Hamstrings", "Calves"]);
    expect([...focusMuscles(["glutes"])]).toEqual(["Glutes"]);
  });

  it("recommends the muscle furthest below target, which a focus changes", () => {
    const history = [workout(new Date().toISOString(), "bb-bench", 6)];
    const none = recommendedMuscles(["Chest", "Arms"], history, 1);
    expect(none[0]!.muscle).toBe("Arms");
  });
});

describe("generator focus", () => {
  const equipment = EQUIPMENT.map((e) => e.id);
  const upper = targetsFromRegions(
    regionsForMuscles(["Chest", "Back", "Shoulders", "Arms"], "upper"),
  );
  const sets = (args: Partial<Parameters<typeof generateWorkout>[0]>, duration = 45) =>
    planSets(generateWorkout({ duration, equipment, targets: upper, ...args }));

  it("plans more sets for a muscle to grow", () => {
    for (const supersets of [false, true]) {
      const focus = sets({ supersets, focusMuscles: ["Arms"] }).Arms ?? 0;
      const plain = sets({ supersets }).Arms ?? 0;
      expect(focus).toBeGreaterThan(plain);
    }
  });

  it("gives a muscle that's behind on this week's target more than one that's done", () => {
    const fresh = sets({ focusMuscles: ["Arms"] }).Arms ?? 0;
    const done = sets({ focusMuscles: ["Arms"], weekDone: { Arms: 20 } }).Arms ?? 0;
    expect(done).toBeLessThan(fresh);
    const behind = sets({ weekDone: { Chest: 10, Back: 10, Shoulders: 10 } }).Arms ?? 0;
    expect(behind).toBeGreaterThan(sets({}).Arms ?? 0);
  });

  it("trains a prioritised group with its own exercises, not only other groups' lifts", () => {
    const plan = generateWorkout({
      duration: 60,
      equipment,
      targets: upper,
      focusMuscles: ["Arms"],
    });
    expect(plan.some((p) => exerciseById(p.exercise_id)?.primary_muscle === "Arms")).toBe(true);
  });

  it("opens with compound lifts even when a small muscle comes first", () => {
    const plan = generateWorkout({
      duration: 60,
      equipment,
      targets: upper,
      focusMuscles: ["Arms"],
    });
    const firstIsolation = plan.findIndex((p) => !exerciseById(p.exercise_id)?.compound);
    const lastCompound = plan.map((p) => exerciseById(p.exercise_id)?.compound).lastIndexOf(true);
    expect(firstIsolation === -1 || lastCompound < firstIsolation).toBe(true);
  });

  it("fills a pull day instead of stopping once the back reaches its cap", () => {
    const pull = targetsFromRegions(regionsForMuscles(["Back", "Arms"], "pull"));
    for (const supersets of [false, true]) {
      const plan = generateWorkout({ duration: 60, equipment, targets: pull, supersets });
      expect(plan.length).toBeGreaterThanOrEqual(4);
      expect(estimateMinutes(plan)).toBeGreaterThanOrEqual(30);
      expect(plan.some((p) => exerciseById(p.exercise_id)?.primary_muscle === "Arms")).toBe(true);
    }
  });

  it("keeps each muscle under the per-session limit", () => {
    const chestArms = (Object.keys(TARGET_MUSCLE_GROUP) as TargetMuscle[]).filter((k) =>
      ["Chest", "Arms"].includes(TARGET_MUSCLE_GROUP[k]),
    );
    for (const duration of [45, 60, 90])
      for (const supersets of [false, true])
        for (const targets of [chestArms, upper]) {
          const plan = generateWorkout({
            duration,
            equipment,
            targets,
            supersets,
            focusMuscles: ["Arms"],
          });
          for (const n of Object.values(planSets(plan))) {
            expect(n).toBeLessThanOrEqual(MAX_SESSION_SETS_PER_MUSCLE);
          }
        }
  });
});
