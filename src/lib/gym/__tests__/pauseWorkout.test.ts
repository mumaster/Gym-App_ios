import { afterEach, describe, expect, it, vi } from "vitest";
import { unpaused } from "../store";
import type { Workout } from "../types";

const base = {
  id: "w",
  date: "2026-10-14T10:00:00.000Z",
  duration_minutes: 45,
  target_muscles: [],
  plan: [],
  completed_sets: [],
  finished: false,
  unit: "kg",
} as unknown as Workout;

describe("unpaused", () => {
  afterEach(() => vi.useRealTimers());

  it("leaves a running workout alone", () => {
    expect(unpaused(base)).toBe(base);
  });

  it("moves the start forward by the paused time and clears the pause", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T10:20:00.000Z"));
    const w = {
      ...base,
      paused: { at: "2026-10-14T10:12:00.000Z", restLeftMs: null, restDuration: 0 },
    };
    const out = unpaused(w);
    expect(out.paused).toBeUndefined();
    // paused 8 minutes: the 20 minutes on the clock now count as 12
    expect(Date.parse("2026-10-14T10:20:00.000Z") - Date.parse(out.date)).toBe(12 * 60_000);
  });
});
