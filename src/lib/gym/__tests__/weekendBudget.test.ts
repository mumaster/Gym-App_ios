import { describe, expect, it } from "vitest";
import {
  cleanWeekendBudget,
  weekendOffsets,
  withEnergyShift,
  WEEKDAY_MAX_DROP,
} from "../nutrition";

const flat = Array(7).fill(2400);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("weekendOffsets", () => {
  it("adds up to zero, so the week's average does not move", () => {
    for (const share of [0.05, 0.1, 0.15, 0.2]) {
      for (const from of ["all", "rest"] as const) {
        const o = weekendOffsets(flat, Array(7).fill(false), { share, from }, 1500);
        expect(sum(o)).toBe(0);
      }
    }
  });

  it("gives Friday half and Saturday and Sunday the full uplift", () => {
    const o = weekendOffsets(flat, Array(7).fill(false), { share: 0.1, from: "all" }, 1500);
    expect(o.slice(4)).toEqual([120, 240, 240]);
    // 600 kcal spread over Monday to Thursday.
    expect(o.slice(0, 4)).toEqual([-150, -150, -150, -150]);
  });

  it("takes it from rest days only when asked, falling back to all four", () => {
    const rest = [false, true, false, true, false, false, false];
    const o = weekendOffsets(flat, rest, { share: 0.1, from: "rest" }, 1500);
    expect(o[0]).toBe(0);
    expect(o[2]).toBe(0);
    expect(o[1]).toBeLessThan(0);
    expect(sum(o)).toBe(0);
    const none = weekendOffsets(flat, Array(7).fill(false), { share: 0.1, from: "rest" }, 1500);
    expect(none.slice(0, 4).every((x) => x < 0)).toBe(true);
  });

  it("never drops a weekday more than the limit and shrinks the weekend instead", () => {
    const rest = [true, false, false, false, false, false, false];
    const o = weekendOffsets(flat, rest, { share: 0.2, from: "rest" }, 1500);
    expect(o[0]).toBe(-Math.round(WEEKDAY_MAX_DROP * 2400));
    expect(sum(o)).toBe(0);
    expect(o[5]).toBeLessThan(480);
  });

  it("keeps every day above the calorie floor", () => {
    const low = Array(7).fill(1550);
    const o = weekendOffsets(low, Array(7).fill(false), { share: 0.2, from: "all" }, 1500);
    o.slice(0, 4).forEach((x) => expect(1550 + x).toBeGreaterThanOrEqual(1500));
    expect(sum(o)).toBe(0);
  });
});

describe("withEnergyShift", () => {
  it("splits the energy between carbs and fat and leaves protein alone", () => {
    const g = withEnergyShift({ calories: 2400, protein: 180, carbs: 250, fat: 70 }, 240);
    expect(g).toEqual({ calories: 2640, protein: 180, carbs: 280, fat: 83 });
  });
  it("does nothing without calories or with no shift", () => {
    const g = { protein: 180 };
    expect(withEnergyShift(g, 100)).toBe(g);
    expect(withEnergyShift({ calories: 2000 }, 0).calories).toBe(2000);
  });
});

describe("cleanWeekendBudget", () => {
  it("accepts a valid saved budget and drops anything else", () => {
    expect(cleanWeekendBudget({ share: 0.15, from: "rest" })).toEqual({
      share: 0.15,
      from: "rest",
    });
    expect(cleanWeekendBudget({ share: 0.5 })).toBeNull();
    expect(cleanWeekendBudget(null)).toBeNull();
    expect(cleanWeekendBudget({ share: 0.1, from: "x" })).toEqual({ share: 0.1, from: "all" });
  });
});
