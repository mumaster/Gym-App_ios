import { describe, expect, it } from "vitest";
import {
  DELOAD_WEEK,
  PROGRAM_PRESETS,
  advanceProgram,
  programPresetById,
  rpeBandForRir,
  weekRirTargets,
  type Program,
} from "../programs";

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

describe("RIR targets per program week", () => {
  it("steps from 3 to 1 reps in reserve across build weeks, 4 in the deload", () => {
    expect(weekRirTargets(programPresetById("wave_4").weeks)).toEqual([3, 2, 1, 4]);
    expect(weekRirTargets(programPresetById("wave_5").weeks)).toEqual([3, 2, 2, 1, 4]);
    expect(weekRirTargets(programPresetById("wave_6").weeks)).toEqual([3, 3, 2, 2, 1, 4]);
  });

  it("aims the load adjustment at the week's target", () => {
    expect(rpeBandForRir(2)).toEqual([7, 9]);
    expect(rpeBandForRir(3)).toEqual([6, 8]);
    expect(rpeBandForRir(1)).toEqual([8, 9]);
    expect(rpeBandForRir(4)).toEqual([5, 7]);
  });
});
