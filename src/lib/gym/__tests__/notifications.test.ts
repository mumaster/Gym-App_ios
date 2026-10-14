import { describe, expect, it } from "vitest";
import { buildNotifications, type NotificationInput } from "../notifications";
import type { Workout } from "../types";

// Friday 9 Oct 2026, 16:00 local
const now = new Date(2026, 9, 9, 16, 0);
const base: NotificationInput = {
  now,
  workouts: [],
  activeWorkout: null,
  rotation: null,
  focus: new Set(),
  waterMl: 0,
  waterGoalMl: null,
  caffeineMg: 0,
  lastWeighInMs: null,
  weighsIn: false,
  weekendOverKcal: null,
};
const kinds = (i: Partial<NotificationInput>) =>
  buildNotifications({ ...base, ...i }).map((n) => n.kind);

const workout = (date: Date, sets = 0): Workout =>
  ({
    id: `w${date.getTime()}`,
    date: date.toISOString(),
    completed_sets: Array.from({ length: sets }, () => ({
      exercise_id: "bb-bench",
      set_type: "working",
      weight: 50,
      reps: 8,
    })),
    plan: [],
  }) as unknown as Workout;

describe("notifications", () => {
  it("is empty for a fresh install", () => {
    expect(kinds({})).toEqual([]);
  });
  it("offers resume for a running workout", () => {
    expect(kinds({ activeWorkout: workout(now) })).toEqual(["resume"]);
  });
  it("nudges water after the afternoon cut-off when under half", () => {
    expect(kinds({ waterGoalMl: 2600, waterMl: 1000 })).toEqual(["water"]);
    expect(kinds({ waterGoalMl: 2600, waterMl: 1400 })).toEqual([]);
    expect(kinds({ waterGoalMl: 2600, waterMl: 0, now: new Date(2026, 9, 9, 10) })).toEqual([]);
    expect(kinds({ waterMl: 0 })).toEqual([]);
  });
  it("warns at the caffeine limit", () => {
    expect(kinds({ caffeineMg: 400 })).toEqual(["caffeine"]);
    expect(kinds({ caffeineMg: 399 })).toEqual([]);
  });
  it("reminds about a weigh-in after a week", () => {
    const week = now.getTime() - 7 * 86_400_000;
    expect(kinds({ weighsIn: true, lastWeighInMs: week })).toEqual(["weighIn"]);
    expect(kinds({ weighsIn: true, lastWeighInMs: week + 3_600_000 })).toEqual([]);
  });
  it("reports muscles that reached their weekly target, ids tied to the week", () => {
    const w = workout(new Date(2026, 9, 7), 12);
    const [n] = buildNotifications({ ...base, workouts: [w] });
    expect(n?.kind).toBe("targetReached");
    expect(n?.muscles?.length).toBeGreaterThan(0);
    const [later] = buildNotifications({
      ...base,
      workouts: [w],
      now: new Date(2026, 9, 10, 9),
    });
    expect(later?.id).toBe(n?.id);
  });
});

describe("weekend over budget", () => {
  const sunday = new Date(2026, 9, 11, 10, 0);
  const monday = new Date(2026, 9, 12, 10, 0);
  it("nudges from Sunday to Tuesday when the weekend ran 250+ kcal a day over", () => {
    expect(kinds({ now: sunday, weekendOverKcal: 300 })).toEqual(["weekendOver"]);
    expect(kinds({ now: monday, weekendOverKcal: 250 })).toEqual(["weekendOver"]);
    expect(kinds({ now: monday, weekendOverKcal: 249 })).toEqual([]);
    expect(kinds({ now: monday, weekendOverKcal: null })).toEqual([]);
  });
  it("is quiet on weekdays after Tuesday and carries the weekend in its id", () => {
    expect(kinds({ now: new Date(2026, 9, 14, 10, 0), weekendOverKcal: 500 })).toEqual([]);
    const sun = buildNotifications({ ...base, now: sunday, weekendOverKcal: 400 });
    const mon = buildNotifications({ ...base, now: monday, weekendOverKcal: 400 });
    expect(sun[0]!.id).toBe("weekend:2026-10-10");
    expect(mon[0]!.id).toBe("weekend:2026-10-10");
  });
});
