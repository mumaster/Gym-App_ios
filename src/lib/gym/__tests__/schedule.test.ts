import { describe, expect, it } from "vitest";
import { dayKeyFromDate } from "../date";
import {
  advanceRotation,
  allowedDatesFor,
  anchorFor,
  backfillDoneOn,
  cycleEnding,
  dayTypeFor,
  doneDate,
  overdueDays,
  parseDayKey,
  plannedDate,
  resortRotation,
  shiftRemaining,
  skipRestOfCycle,
  upcomingSessionDates,
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
      r = advanceRotation(r, d(day), d(day)).rotation;
    }
    // The next cycle carries on in the week of 28 September (it used to
    // skip to 5 October), on the plan's own days after Tuesday's legs.
    expect(r.anchor).toBe("2026-09-28");
    expect(keys(r)).toEqual(["2026-09-30", "2026-10-02", "2026-10-05"]);
  });
});

// Upper / lower on Mon / Tue / Thu / Fri; Friday's lower body was missed.
const upperLower: Rotation = {
  schedule: [
    { dow: 1, dayId: "upper" },
    { dow: 2, dayId: "lower" },
    { dow: 4, dayId: "upper" },
    { dow: 5, dayId: "lower" },
  ],
  cyclePosition: 3,
  anchor: "2026-09-21",
};

describe("the end of the week", () => {
  it("shows next week once this week's last session is today or missed", () => {
    expect(cycleEnding(upperLower, d("2026-09-27"))).toBe(true);
    expect(cycleEnding(upperLower, d("2026-09-25"))).toBe(true);
    expect(cycleEnding(upperLower, d("2026-09-24"))).toBe(false);
  });

  it("lets next week's upper body go on Monday, skipping the missed lower body", () => {
    const next = skipRestOfCycle(upperLower, d("2026-09-27"));
    expect(next.cyclePosition).toBe(0);
    expect(keys(next)).toEqual(["2026-09-28", "2026-09-29", "2026-10-01", "2026-10-02"]);
    expect(allowedDatesFor(next, 0, d("2026-09-27")).map(dayKeyFromDate)).toEqual([
      "2026-09-27",
      "2026-09-28",
    ]);
  });

  it("keeps next week when the missed session is done on Monday", () => {
    const r = advanceRotation(upperLower, d("2026-09-28"), d("2026-09-28")).rotation;
    expect(r.anchor).toBe("2026-09-28");
    // On the plan's days after Monday, in order, running into next week.
    expect(keys(r)).toEqual(["2026-09-29", "2026-10-01", "2026-10-02", "2026-10-05"]);
  });

  it("starts next week on its usual Monday when the missed session is skipped then", () => {
    const r = advanceRotation(upperLower, d("2026-09-28")).rotation;
    expect(r.anchor).toBe("2026-09-28");
    expect(keys(r)).toEqual(["2026-09-28", "2026-09-29", "2026-10-01", "2026-10-02"]);
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

describe("upcoming sessions (the week strip)", () => {
  const ks = (ds: Date[]) => ds.map(dayKeyFromDate);

  it("continues into the next cycle", () => {
    // Pull is next on Wednesday; next week's push/pull/legs follow.
    const r = { ...base, cyclePosition: 1 };
    expect(ks(upcomingSessionDates(r, d("2026-10-04"), d("2026-09-22")))).toEqual([
      "2026-09-23",
      "2026-09-25",
      "2026-09-28",
      "2026-09-30",
      "2026-10-02",
    ]);
  });

  it("fills the rest of a week that a spilled cycle ends in", () => {
    // Upper/lower Mon/Tue/Thu/Fri; last week's Thursday and Friday moved to
    // this Tuesday and Wednesday. Reported: only those two showed.
    const ul: Rotation = {
      schedule: [
        { dow: 1, dayId: "upper" },
        { dow: 2, dayId: "lower" },
        { dow: 4, dayId: "upper" },
        { dow: 5, dayId: "lower" },
      ],
      cyclePosition: 2,
      anchor: "2026-09-28",
      dayOverrides: { 2: 8, 3: 9 },
    };
    const today = d("2026-10-05");
    expect(ks(upcomingSessionDates(ul, d("2026-10-11"), today))).toEqual([
      "2026-10-06",
      "2026-10-07",
      // Then the next in line on the plan's own days, Thursday and Friday
      // (not packed onto Thursday to Sunday).
      "2026-10-08",
      "2026-10-09",
    ]);
    expect(ks(upcomingSessionDates(ul, d("2026-10-18"), today)).slice(2)).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-12",
      "2026-10-13",
      "2026-10-15",
      "2026-10-16",
    ]);
    expect(
      dayTypeFor(d("2026-10-09"), { rotation: ul, workouts: [], activeWorkout: null }, today),
    ).toBe("training");
  });

  it("carries on with Thursday and Friday after this week's last two moved to Tuesday and Wednesday", () => {
    const ul: Rotation = {
      schedule: [
        { dow: 1, dayId: "upper" },
        { dow: 2, dayId: "lower" },
        { dow: 4, dayId: "upper" },
        { dow: 5, dayId: "lower" },
      ],
      cyclePosition: 2,
      anchor: "2026-10-05",
      dayOverrides: { 2: 1, 3: 2 },
    };
    expect(ks(upcomingSessionDates(ul, d("2026-10-11"), d("2026-10-05")))).toEqual([
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
  });

  it("moves missed sessions up to today, like 'Do it today'", () => {
    expect(ks(upcomingSessionDates(base, d("2026-09-27"), d("2026-09-23")))).toEqual([
      "2026-09-23",
      "2026-09-25",
      "2026-09-27",
    ]);
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

describe("done days", () => {
  it("shows a finished session on the day it was done, not its planned day", () => {
    // Monday's push, moved to Wednesday and done there.
    const moved = shiftRemaining(base, 2);
    const done = advanceRotation(moved, d("2026-09-23"), d("2026-09-23")).rotation;
    expect(dayKeyFromDate(doneDate(done, 0)!)).toBe("2026-09-23");
    expect(doneDate(done, 1)).toBeNull(); // still to come
  });
  it("leaves a skipped session without a day", () => {
    const skipped = advanceRotation(base, d("2026-09-22")).rotation;
    expect(doneDate(skipped, 0)).toBeNull();
  });
  it("forgets done days when the cycle wraps", () => {
    let r = base;
    for (const day of ["2026-09-21", "2026-09-23", "2026-09-25"]) {
      r = advanceRotation(r, d(day), d(day)).rotation;
    }
    expect(r.cyclePosition).toBe(0);
    expect(r.doneOn).toBeUndefined();
  });
  it("keeps done days with their session when the week is re-sorted", () => {
    const done = advanceRotation(base, d("2026-09-22"), d("2026-09-22")).rotation;
    // Pull moves from Wednesday to Thursday: push stays done.
    const resorted = resortRotation(
      { ...done, schedule: [done.schedule[0]!, { dow: 4, dayId: "pull" }, done.schedule[2]!] },
      d("2026-09-22"),
    );
    expect(dayKeyFromDate(doneDate(resorted, 0)!)).toBe("2026-09-22");
  });
  it("backfills older saves from the scheduled workouts", () => {
    const w = (date: string, fromProgramDay: boolean): Workout => ({
      id: date,
      date,
      duration_minutes: 45,
      target_muscles: [],
      plan: [],
      completed_sets: [],
      finished: true,
      unit: "kg",
      fromProgramDay,
    });
    const r = { ...base, cyclePosition: 2 };
    const workouts = [
      w("2026-09-23T18:00:00", true),
      w("2026-09-22T18:00:00", false), // off-schedule, not a program day
      w("2026-09-10T18:00:00", true), // before this cycle
    ];
    // One scheduled workout for two done sessions: the latest gets it, the
    // earlier one counts as skipped.
    expect(backfillDoneOn(r, workouts, (x) => Boolean(x.fromProgramDay))).toEqual({
      1: "2026-09-23",
    });
  });
});
