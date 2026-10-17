import { describe, expect, it } from "vitest";
import { EQUIPMENT, EXERCISES, exerciseById } from "../data";
import { exerciseKind, fitDayFromMuscles, fitDayOf, fitsDay } from "../dayFit";
import { generateWorkout } from "../generator";
import type { EquipmentId, TargetMuscle } from "../types";

const equipment = EQUIPMENT.map((e) => e.id) as EquipmentId[];
const kind = (id: string) => exerciseKind(exerciseById(id)!);

describe("exercise kinds", () => {
  it("separates pushing and pulling work inside shoulders and arms", () => {
    expect(kind("face-pull")).toBe("pull");
    expect(kind("db-rear-delt-flye")).toBe("pull");
    expect(kind("cable-rear-delt-fly")).toBe("pull");
    expect(kind("bb-row")).toBe("pull");
    expect(kind("lateral-raise")).toBe("push");
    expect(kind("ohp")).toBe("push");
    expect(kind("bb-curl")).toBe("pull");
    expect(kind("rope-pushdown")).toBe("push");
    expect(kind("bb-squat")).toBe("legs");
  });

  it("fits a push day without rows, face pulls or rear delt flyes", () => {
    for (const id of ["bb-row", "face-pull", "cable-rear-delt-fly", "bb-curl"])
      expect(fitsDay(exerciseById(id)!, "push"), id).toBe(false);
    for (const id of ["db-shoulder-press", "lateral-raise", "incline-db-press", "rope-pushdown"])
      expect(fitsDay(exerciseById(id)!, "push"), id).toBe(true);
    expect(fitsDay(exerciseById("face-pull")!, "pull")).toBe(true);
    expect(fitsDay(exerciseById("bb-squat")!, "upper")).toBe(false);
    expect(fitsDay(exerciseById("bb-row")!, undefined)).toBe(true);
  });
});

describe("day types", () => {
  it("maps day ids and trained muscles to a restricting day", () => {
    expect(fitDayOf("push")).toBe("push");
    expect(fitDayOf("lower")).toBe("legs");
    expect(fitDayOf("full")).toBeUndefined();
    expect(fitDayOf("chest")).toBeUndefined();
    expect(fitDayFromMuscles(["Chest", "Shoulders", "Arms"])).toBe("push");
    expect(fitDayFromMuscles(["Back", "Arms"])).toBe("pull");
    expect(fitDayFromMuscles(["Chest", "Back", "Shoulders", "Arms"])).toBe("upper");
    expect(fitDayFromMuscles(["Quads", "Hamstrings"])).toBe("legs");
    expect(fitDayFromMuscles(["Shoulders"])).toBeUndefined();
    expect(fitDayFromMuscles([])).toBeUndefined();
  });
});

describe("generating a push or pull day", () => {
  const push: TargetMuscle[] = [
    "Upper Chest",
    "Mid Chest",
    "Lower Chest",
    "Front Delts",
    "Side Delts",
    "Rear Delts",
    "Triceps",
  ];
  it("never puts a pull exercise on a push day, with or without supersets", () => {
    for (let variation = 0; variation < 12; variation++)
      for (const supersets of [false, true]) {
        const plan = generateWorkout({
          duration: 60,
          equipment,
          targets: push,
          variation,
          supersets,
          day: "push",
        });
        expect(plan.length).toBeGreaterThan(2);
        for (const p of plan) expect(fitsDay(exerciseById(p.exercise_id)!, "push")).toBe(true);
      }
  });

  it("gives a pull day some rear delt work", () => {
    const plan = generateWorkout({
      duration: 60,
      equipment,
      targets: ["Lats", "Traps", "Biceps"],
      day: "pull",
    });
    for (const p of plan) expect(fitsDay(exerciseById(p.exercise_id)!, "pull")).toBe(true);
    expect(plan.some((p) => exerciseById(p.exercise_id)!.muscle_targets[0] === "Rear Delts")).toBe(
      true,
    );
  });

  it("keeps working when the asked-for muscles don't fit the day", () => {
    const plan = generateWorkout({
      duration: 30,
      equipment,
      targets: ["Rear Delts"],
      day: "push",
    });
    expect(plan.length).toBeGreaterThan(0);
  });

  it("every built-in exercise has a kind", () => {
    expect(EXERCISES.filter((e) => !exerciseKind(e)).map((e) => e.id)).toEqual([]);
  });
});
