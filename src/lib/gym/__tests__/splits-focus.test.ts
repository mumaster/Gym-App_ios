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
