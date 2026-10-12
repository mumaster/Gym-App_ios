import { describe, expect, it } from "vitest";
import { addDays, dayKey, dayKeyFromDate, loggedAtForDay } from "../date";

describe("loggedAtForDay", () => {
  it("is now for today or no day", () => {
    const before = Date.now();
    expect(new Date(loggedAtForDay()).getTime()).toBeGreaterThanOrEqual(before);
    expect(dayKey(loggedAtForDay(dayKeyFromDate(new Date())))).toBe(dayKeyFromDate(new Date()));
  });

  it("lands on the chosen future day", () => {
    const key = dayKeyFromDate(addDays(new Date(), 3));
    expect(dayKey(loggedAtForDay(key))).toBe(key);
  });
});
