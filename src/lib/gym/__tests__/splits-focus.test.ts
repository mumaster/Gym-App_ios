import { describe, expect, it } from "vitest";
import { buildSchedule, splitDayLabel } from "../splits";

describe("3:1 focus splits", () => {
  it("upper focus gives three upper days per lower day", () => {
    const ids = buildSchedule("upper_focus", [1, 2, 4, 5]).map((s) => s.dayId);
    expect(ids).toEqual(["upper", "upper", "lower", "upper"]);
  });
  it("lower focus gives three lower days per upper day", () => {
    const ids = buildSchedule("lower_focus", [1, 2, 4, 5]).map((s) => s.dayId);
    expect(ids).toEqual(["lower", "lower", "upper", "lower"]);
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

describe("choosing the day type per session", () => {
  it("lists a 3:1 split's day types once and applies picks by weekday", async () => {
    const { distinctDays, applyDayPicks } = await import("../splits");
    expect(distinctDays("upper_focus").map((d) => d.id)).toEqual(["upper", "lower"]);
    expect(distinctDays("full_body")).toHaveLength(1);
    const base = buildSchedule("upper_focus", [1, 2, 4, 5]);
    const picked = applyDayPicks("upper_focus", base, { 2: "lower", 5: "upper", 4: "nope" });
    expect(picked.map((s) => s.dayId)).toEqual(["upper", "lower", "lower", "upper"]);
  });
});
