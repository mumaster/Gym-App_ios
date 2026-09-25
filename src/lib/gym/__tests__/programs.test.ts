import { describe, expect, it } from "vitest";
import { DELOAD_WEEK, PROGRAM_PRESETS, advanceProgram, type Program } from "../programs";

describe("program presets (Bell et al. 2023–2025)", () => {
  it("deload every 4–6 weeks, ending each wave", () => {
    for (const p of PROGRAM_PRESETS) {
      expect(p.weeks.length).toBeGreaterThanOrEqual(4);
      expect(p.weeks.length).toBeLessThanOrEqual(6);
      expect(p.weeks.at(-1)).toEqual(DELOAD_WEEK);
      expect(p.weeks.slice(0, -1).every((w) => w.intensity === 1 && w.volume === 1)).toBe(true);
    }
  });
  it("deload keeps half the sets at 90% of the weight", () => {
    expect(DELOAD_WEEK).toMatchObject({ intensity: 0.9, volume: 0.5 });
  });
});

describe("advanceProgram", () => {
  const program: Program = {
    id: "p",
    name: "Upper / Lower",
    templateId: "upper_lower",
    schedule: [
      { dow: 1, dayId: "upper" },
      { dow: 4, dayId: "lower" },
    ],
    weeks: PROGRAM_PRESETS[0]!.weeks,
    currentWeek: 0,
    cyclePosition: 0,
    anchor: "2026-09-21",
  };

  it("moves to the next week when the week's sessions are done", () => {
    const once = advanceProgram(program, new Date(2026, 8, 21));
    expect(once).toMatchObject({ currentWeek: 0, cyclePosition: 1 });
    const twice = advanceProgram(once, new Date(2026, 8, 24));
    expect(twice).toMatchObject({ currentWeek: 1, cyclePosition: 0, anchor: "2026-09-28" });
  });

  it("wraps back to week one after the deload", () => {
    const last = { ...program, currentWeek: program.weeks.length - 1, cyclePosition: 1 };
    expect(advanceProgram(last, new Date(2026, 8, 24)).currentWeek).toBe(0);
  });
});
