import { describe, expect, it } from "vitest";
import { EQUIPMENT, EXERCISES, exerciseById } from "../data";
import { alternativesFor } from "../generator";
import { antagonistLabel, isAntagonistPair, muscleLabel, sameMuscleSwaps } from "../antagonist";
import type { Exercise } from "../types";

const ex = (id: string) => {
  const e = exerciseById(id);
  if (!e) throw new Error(`no exercise ${id}`);
  return e;
};
const allGear = EQUIPMENT.map((e) => e.id);

describe("muscleLabel", () => {
  it("splits Arms into Biceps (pull) and Triceps (push)", () => {
    expect(muscleLabel(ex("db-curl"))).toBe("Biceps");
    expect(muscleLabel(ex("cable-pushdown"))).toBe("Triceps");
  });

  it("keeps other groups and unknown arm patterns as they are", () => {
    expect(muscleLabel(ex("bb-bench"))).toBe("Chest");
    expect(muscleLabel(ex("bb-row"))).toBe("Back");
    const odd: Exercise = { ...ex("db-curl"), movement_pattern: "carry" };
    expect(muscleLabel(odd)).toBe("Arms");
  });

  it("feeds the antagonist label", () => {
    expect(antagonistLabel(ex("db-curl"), ex("cable-pushdown"))).toBe("BICEPS / TRICEPS");
  });
});

describe("sameMuscleSwaps", () => {
  it("keeps the muscle, drops the exercise itself and the partner", () => {
    const current = ex("bb-bench");
    const partner = ex("bb-row");
    const list = sameMuscleSwaps(current, partner, alternativesFor(current, allGear));
    expect(list.length).toBeGreaterThan(0);
    for (const e of list) {
      expect(e.primary_muscle).toBe("Chest");
      expect(e.id).not.toBe(current.id);
      expect(e.id).not.toBe(partner.id);
      expect(isAntagonistPair(partner, e)).toBe(true);
    }
  });

  it("drops candidates that don't pair with the partner", () => {
    const current = ex("bb-bench");
    const partner = ex("bb-row");
    const squat = EXERCISES.find((e) => e.primary_muscle === "Quads")!;
    const list = sameMuscleSwaps(current, partner, [squat, partner, current]);
    expect(list).toEqual([]);
  });

  it("keeps biceps for biceps, not triceps, in an arm superset", () => {
    const current = ex("db-curl");
    const partner = ex("cable-pushdown");
    const list = sameMuscleSwaps(current, partner, alternativesFor(current, allGear));
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((e) => muscleLabel(e) === "Biceps")).toBe(true);
  });
});
