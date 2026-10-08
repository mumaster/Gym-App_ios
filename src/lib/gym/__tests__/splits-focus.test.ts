import { describe, expect, it } from "vitest";
import { buildSchedule, splitDayLabel } from "../splits";

describe("3:1 focus splits", () => {
  it("upper focus gives three upper days per lower day", () => {
    const ids = buildSchedule("upper_focus", [1, 2, 4, 5]).map((s) => s.dayId);
    expect(ids).toEqual(["upper", "upper", "upper", "lower"]);
  });
  it("lower focus gives three lower days per upper day", () => {
    const ids = buildSchedule("lower_focus", [1, 2, 4, 5]).map((s) => s.dayId);
    expect(ids).toEqual(["lower", "lower", "lower", "upper"]);
    expect(splitDayLabel("lower_focus", "upper")).toBe("Upper Body");
  });
});

describe("glute work", () => {
  it("counts split squats and walking lunges as glute exercises", async () => {
    const { EXERCISES } = await import("../data");
    for (const name of ["Bulgarian Split Squat", "Split Squat", "Dumbbell Walking Lunge"]) {
      const ex = EXERCISES.find((e) => e.name === name);
      expect(ex?.primary_muscle).toBe("Glutes");
      expect(ex?.muscle_targets[0]).toBe("Glutes");
    }
  });
});
