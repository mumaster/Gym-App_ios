import { describe, expect, it } from "vitest";
import { dayKeyFromDate } from "../date";
import {
  advanceRotation,
  allowedDatesFor,
  anchorFor,
  dayTypeFor,
  overdueDays,
  parseDayKey,
  plannedDate,
  resortRotation,
  shiftRemaining,
  type Rotation,
} from "../schedule";
import type { Workout } from "../types";

const d = parseDayKey;
const keys = (r: Rotation) => r.schedule.map((_, i) => dayKeyFromDate(plannedDate(r, i)));
// Mon / Wed / Fri push-pull-legs; 2026-09-21 is a Monday.
const schedule = [
  { dow: 1, dayId: "push" },
  { dow: 3, dayId: "pull" },
  { dow: 5, dayId: "legs" },
];
const base: Rotation = { schedule, cyclePosition: 0, anchor: "2026-09-21" };

describe("anchorFor", () => {
  it("anchors this week when the next session is still ahead", () => {
    expect(anchorFor(schedule, 0, d("2026-09-21"))).toBe("2026-09-21");
    expect(anchorFor(schedule, 2, d("2026-09-24"))).toBe("2026-09-21");
  });
  it("anchors next week when the next session's weekday has passed", () => {
    expect(anchorFor(schedule, 0, d("2026-09-24"))).toBe("2026-09-28");
  });
});

describe("missed sessions", () => {
  it("counts overdue days and clears them after 'do it today'", () => {
    const today = d("2026-09-23");
    expect(overdueDays(base, today)).toBe(2);
    const shifted = shiftRemaining(base, 2);
    expect(keys(shifted)).toEqual(["2026-09-23", "2026-09-25", "2026-09-27"]);
    expect(overdueDays(shifted, today)).toBe(0);
  });

  it("resumes the normal week after a shifted cycle wraps", () => {
    let r = shiftRemaining(base, 2);
    for (const day of ["2026-09-23", "2026-09-25", "2026-09-27"]) {
      r = advanceRotation(r, d(day)).rotation;
    }
    expect(r).toMatchObject({ cyclePosition: 0, anchor: "2026-09-28" });
    expect(r.dayOverrides).toBeUndefined();
  });

  it("never stacks two sessions on one day when a shift crosses into next week", () => {
    let r = shiftRemaining(base, 4); // Fri / Sun / Tue
    expect(keys(r)).toEqual(["2026-09-25", "2026-09-27", "2026-09-29"]);
    for (const day of ["2026-09-25", "2026-09-27", "2026-09-29"]) {
      r = advanceRotation(r, d(day)).rotation;
    }
    expect(r.anchor).toBe("2026-10-05");
  });
});

describe("allowedDatesFor", () => {
  it("keeps a moved session between its neighbours", () => {
    const dates = allowedDatesFor(base, 1, d("2026-09-21")).map(dayKeyFromDate);
    expect(dates).toEqual(["2026-09-22", "2026-09-23", "2026-09-24"]);
  });
});

describe("resortRotation", () => {
  it("keeps sessions the user hadn't done yet as remaining", () => {
    const moved = resortRotation(
      { ...base, schedule: [{ dow: 6, dayId: "push" }, schedule[1]!, schedule[2]!] },
      d("2026-09-22"),
    );
    expect(moved.schedule.map((s) => s.dayId)).toEqual(["pull", "legs", "push"]);
    expect(moved.cyclePosition).toBe(0);
  });
});

describe("dayTypeFor", () => {
  const workout = (date: string): Workout => ({
    id: date,
    date,
    duration_minutes: 45,
    target_muscles: [],
    plan: [],
    completed_sets: [],
    finished: true,
    unit: "kg",
  });

  it("treats planned days as training and others as rest", () => {
    const today = d("2026-09-23");
    const ctx = { rotation: shiftRemaining(base, 2), workouts: [], activeWorkout: null };
    expect(dayTypeFor(d("2026-09-23"), ctx, today)).toBe("training");
    expect(dayTypeFor(d("2026-09-24"), ctx, today)).toBe("rest");
  });

  it("uses only logged workouts for past days", () => {
    const today = d("2026-09-25");
    const ctx = { rotation: base, workouts: [workout("2026-09-23T17:00:00")], activeWorkout: null };
    expect(dayTypeFor(d("2026-09-21"), ctx, today)).toBe("rest");
    expect(dayTypeFor(d("2026-09-23"), ctx, today)).toBe("training");
  });
});
