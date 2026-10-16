import { describe, expect, it } from "vitest";
import { EQUIPMENT, EXERCISES, TARGET_MUSCLE_GROUP, exerciseById } from "../data";
import { estimateMinutes, generateWorkout } from "../generator";
import { regionsForMuscles, targetsFromRegions } from "../anatomy";
import { recommendedMuscles } from "../recommendations";
import type { TargetMuscle, Workout } from "../types";
import {
  BASE_WEEKLY_SETS,
  FOCUS_WEEKLY_SETS,
  MAX_SESSION_SETS_PER_MUSCLE,
  mainPlanSets,
  migrateFocus,
  musclesInGroups,
  planSets,
  setContribution,
  volumeMuscleOf,
  weeklySets,
  weeklyTarget,
  type VolumeMuscle,
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

describe("whole set counting by specific muscle", () => {
  it("counts one whole set for every muscle the exercise lists, no halves", () => {
    expect(setContribution("bb-bench")).toEqual({ Chest: 1, Triceps: 1, "Front Delts": 1 });
    expect(setContribution("db-curl")).toEqual({ Biceps: 1, Forearms: 1 });
    expect(setContribution("seated-cable-row")).toEqual({ Lats: 1, Traps: 1, Biceps: 1 });
    for (const ex of EXERCISES) {
      for (const n of Object.values(setContribution(ex.id))) expect(n).toBe(1);
    }
  });

  it("counts the three chest heads as one muscle", () => {
    expect(volumeMuscleOf("Upper Chest")).toBe("Chest");
    expect(volumeMuscleOf("Lower Chest")).toBe("Chest");
    const flat = EXERCISES.find((e) => e.muscle_targets.includes("Upper Chest"))!;
    expect(setContribution(flat.id).Chest).toBe(1);
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
    expect(done.Triceps).toBe(3);
  });

  it("keeps biceps and triceps apart: Max's week of 13 and 14 October", () => {
    // Tuesday and Wednesday, from the finished sessions' screenshots.
    const sets: [string, number][] = [
      ["db-curl", 4],
      ["bench-dip", 4],
      ["bb-bench", 3],
      ["seated-cable-row", 3],
      ["cable-rear-delt-fly", 4],
      ["db-shrug", 4],
      ["bb-bench", 3],
      ["seated-cable-row", 3],
      ["db-curl", 4],
      ["face-pull", 4],
      ["pushup", 4],
      ["db-overhead-triceps-ext", 4],
      ["cable-lateral", 3],
    ];
    const done = weeklySets(
      sets.map(([id, n], i) => workout(`2026-10-1${i < 6 ? 3 : 4}T18:00:00`, id, n)),
      null,
      new Date(2026, 9, 15),
    );
    expect(done.Biceps).toBe(14);
    expect(done.Triceps).toBe(18);
    expect(done.Chest).toBe(10);
  });
});

describe("targets (Schoenfeld 2017, Baz-Valle 2022)", () => {
  it("uses 10 sets normally and 20 for muscles to grow", () => {
    expect(BASE_WEEKLY_SETS).toBe(10);
    expect(FOCUS_WEEKLY_SETS).toBe(20);
    const focus = new Set(musclesInGroups(["arms"]));
    expect(weeklyTarget("Biceps", focus)).toBe(20);
    expect(weeklyTarget("Chest", focus)).toBe(10);
    expect(musclesInGroups(["legs"])).toEqual(["Quads", "Adductors", "Hamstrings", "Calves"]);
  });

  it("stars one muscle without the rest of its group", () => {
    const focus = new Set<VolumeMuscle>(["Biceps"]);
    expect(weeklyTarget("Biceps", focus)).toBe(20);
    expect(weeklyTarget("Triceps", focus)).toBe(10);
  });

  it("carries an older save's starred groups over to their muscles", () => {
    expect(migrateFocus(["arms", "chest"])).toEqual(["Chest", "Biceps", "Triceps", "Forearms"]);
    expect(migrateFocus(["Biceps"])).toEqual(["Biceps"]);
    expect(migrateFocus(undefined)).toEqual([]);
  });

  it("recommends the group furthest below its targets, which a focus changes", () => {
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
  const ARMS = musclesInGroups(["arms"]);
  // Direct arm work: sets of exercises whose main muscle is the arms. (The
  // fractional count also gets half a set from every press and row, which
  // popular programs' favourite compound lifts fill up either way.)
  const directArms = (args: Partial<Parameters<typeof generateWorkout>[0]>, duration = 45) =>
    generateWorkout({ duration, equipment, targets: upper, ...args })
      .filter((p) => exerciseById(p.exercise_id)?.primary_muscle === "Arms")
      .reduce((n, p) => n + p.target_sets, 0);

  it("plans more sets for a muscle to grow", () => {
    for (const supersets of [false, true]) {
      const focus = directArms({ supersets, focusMuscles: ARMS }, 60);
      const plain = directArms({ supersets }, 60);
      expect(focus).toBeGreaterThan(plain);
    }
  });

  it("gives a muscle that's behind on this week's target more than one that's done", () => {
    const fresh = directArms({ focusMuscles: ARMS });
    const done = directArms({
      focusMuscles: ARMS,
      weekDone: { Biceps: 20, Triceps: 20, Forearms: 20 },
    });
    expect(done).toBeLessThan(fresh);
    const behind = directArms({
      weekDone: {
        Chest: 10,
        Lats: 10,
        Traps: 10,
        "Front Delts": 10,
        "Side Delts": 10,
        "Rear Delts": 10,
      },
    });
    expect(behind).toBeGreaterThan(directArms({}));
  });

  it("trains a prioritised group with its own exercises, not only other groups' lifts", () => {
    const plan = generateWorkout({
      duration: 60,
      equipment,
      targets: upper,
      focusMuscles: ARMS,
    });
    expect(plan.some((p) => exerciseById(p.exercise_id)?.primary_muscle === "Arms")).toBe(true);
  });

  it("opens with compound lifts even when a small muscle comes first", () => {
    const plan = generateWorkout({
      duration: 60,
      equipment,
      targets: upper,
      focusMuscles: ARMS,
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
            focusMuscles: ARMS,
          });
          for (const n of Object.values(mainPlanSets(plan))) {
            expect(n).toBeLessThanOrEqual(MAX_SESSION_SETS_PER_MUSCLE);
          }
        }
  });
});
