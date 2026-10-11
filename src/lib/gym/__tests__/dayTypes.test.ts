import { describe, expect, it } from "vitest";
import { cardioDay, plannedWhoMinutes } from "../cardio";
import { advanceProgram, type Program } from "../programs";
import {
  CARDIO_DAY_ID,
  advanceRotation,
  dayTypeFor,
  hasPlannedSession,
  isLiftingSlot,
  parseDayKey,
  plannedDate,
  type Rotation,
} from "../schedule";
import {
  DAY_TYPES,
  DEFAULT_CARDIO_DAY,
  SLOT_CARDIO_PREFIX,
  SPLIT_TEMPLATES,
  applyDayPicks,
  buildSchedule,
  cardioDayPlan,
  dayTypeById,
  dayTypeOptions,
  distinctDays,
  findDay,
  musclesForSlot,
  rotationCardioPlan,
  slotCardio,
  splitDayLabel,
  withCardioSlotDone,
  withSlotCardio,
  withSlotDay,
  type ScheduleSlot,
} from "../splits";

const d = parseDayKey;

describe("day-type catalog", () => {
  it("has every kind of day, once each, with cardio last", () => {
    expect(DAY_TYPES.map((x) => x.id)).toEqual([
      "full",
      "upper",
      "lower",
      "push",
      "pull",
      "legs",
      "chest",
      "back",
      "shoulders",
      "arms",
      "cardio",
    ]);
    expect(dayTypeById("cardio")).toMatchObject({ label: "Cardio", muscles: [] });
    expect(dayTypeById("full")).toMatchObject({ label: "Full Body", muscles: [] });
    expect(dayTypeById("nope")).toBeUndefined();
  });

  it("matches the days every template uses", () => {
    for (const tpl of SPLIT_TEMPLATES) {
      for (const day of tpl.days) {
        const { cardio: _finisher, ...plain } = day;
        // The hybrid split's own labels ("Upper + Cardio") are the template's.
        if (tpl.id === "hybrid") continue;
        expect(
          DAY_TYPES.find((x) => x.id === day.id),
          `${tpl.id}/${day.id}`,
        ).toEqual(plain);
      }
    }
  });

  it("resolves a slot's day from the template first, then the catalog", () => {
    expect(splitDayLabel("hybrid", "upper")).toBe("Upper + Cardio");
    expect(splitDayLabel("upper_lower", "upper")).toBe("Upper Body");
    expect(splitDayLabel("upper_lower", "push")).toBe("Push");
    expect(splitDayLabel("full_body", "cardio")).toBe("Cardio");
    expect(splitDayLabel("upper_lower", "mystery")).toBe("mystery");
    expect(findDay("hybrid", "upper")?.cardio).toBeDefined();
    expect(findDay("upper_lower", "legs")?.label).toBe("Legs");
    expect(findDay("upper_lower", "mystery")).toBeUndefined();
  });

  it("keeps the hybrid finisher only on the hybrid template's own days", () => {
    const own: ScheduleSlot = { dow: 1, dayId: "upper" };
    expect(slotCardio("hybrid", own)).toMatchObject({ minutes: 20 });
    expect(slotCardio("hybrid", { dow: 1, dayId: "push" })).toBeNull();
    expect(
      slotCardio("hybrid", { dow: 1, dayId: "cardio", cardio: DEFAULT_CARDIO_DAY }),
    ).toBeNull();
    expect(slotCardio("upper_lower", own)).toBeNull();
  });

  it("gives a day outside the template its catalog muscles", () => {
    const muscles = (id: string) => musclesForSlot("upper_lower", { dow: 1, dayId: id }, []);
    expect(muscles("push")).toEqual(["Chest", "Shoulders", "Arms"]);
    expect(muscles("legs")).toEqual(["Quads", "Hamstrings", "Glutes", "Calves"]);
    expect(muscles("cardio")).toEqual([]);
    expect(muscles("mystery")).toEqual([]);
    // Full body is "whichever rested longest", also inside a split without it.
    expect(muscles("full")).toHaveLength(3);
  });
});

describe("dayTypeOptions", () => {
  const ids = (t: Parameters<typeof dayTypeOptions>[0]) => dayTypeOptions(t).map((x) => x.id);

  it("lists the template's own days first, then the rest, cardio last", () => {
    expect(ids("upper_lower")).toEqual([
      "upper",
      "lower",
      "full",
      "push",
      "pull",
      "legs",
      "chest",
      "back",
      "shoulders",
      "arms",
      "cardio",
    ]);
    expect(ids("push_pull_legs").slice(0, 3)).toEqual(["push", "pull", "legs"]);
    expect(ids("push_pull_legs").at(-1)).toBe("cardio");
  });

  it("repeats nothing, even for a 3:1 split", () => {
    for (const tpl of SPLIT_TEMPLATES) {
      const all = ids(tpl.id);
      expect(new Set(all).size, tpl.id).toBe(all.length);
      expect(all.slice(0, distinctDays(tpl.id).length)).toEqual(
        distinctDays(tpl.id).map((x) => x.id),
      );
    }
    expect(ids("upper_focus").slice(0, 2)).toEqual(["upper", "lower"]);
  });

  it("offers a full-body split every other type too", () => {
    expect(ids("full_body")[0]).toBe("full");
    expect(ids("full_body")).toHaveLength(DAY_TYPES.length);
  });

  it("keeps the hybrid split's own versions of upper and lower", () => {
    const hybrid = dayTypeOptions("hybrid");
    expect(hybrid.slice(0, 2).map((x) => x.label)).toEqual(["Upper + Cardio", "Lower + Cardio"]);
    expect(hybrid.filter((x) => x.id === "upper")).toHaveLength(1);
  });
});

describe("applyDayPicks", () => {
  const base = buildSchedule("upper_lower", [1, 3, 5]);

  it("accepts the template's days and any catalog day", () => {
    const out = applyDayPicks("upper_lower", base, { 1: "push", 3: "lower", 5: "cardio" });
    expect(out.map((s) => s.dayId)).toEqual(["push", "lower", "cardio"]);
    expect(out.map((s) => s.dow)).toEqual([1, 3, 5]);
  });

  it("ignores ids neither the template nor the catalog has", () => {
    const out = applyDayPicks("upper_lower", base, { 1: "mystery", 3: "", 5: "Upper" });
    expect(out).toEqual(base);
  });

  it("gives a cardio pick the default, and only a cardio pick", () => {
    const out = applyDayPicks("upper_lower", base, { 3: "cardio" });
    expect(out[1]).toEqual({ dow: 3, dayId: "cardio", cardio: DEFAULT_CARDIO_DAY });
    expect(out[1]!.cardio).not.toBe(DEFAULT_CARDIO_DAY);
    expect(out[0]).not.toHaveProperty("cardio");
  });

  it("keeps what a weekday that stays a cardio day had planned", () => {
    const own = { activity: "swim" as const, effort: "hard" as const, minutes: 45 };
    const previous: ScheduleSlot[] = [{ dow: 3, dayId: "cardio", cardio: own }];
    const out = applyDayPicks("upper_lower", base, { 3: "cardio", 5: "cardio" }, previous);
    expect(out[1]!.cardio).toEqual(own);
    expect(out[2]!.cardio).toEqual(DEFAULT_CARDIO_DAY);
  });
});

describe("withSlotDay", () => {
  const program: Program = {
    id: "p",
    name: "Program",
    templateId: "upper_lower",
    schedule: buildSchedule("upper_lower", [1, 2, 4, 5]),
    weeks: [
      { type: "build", intensity: 1, volume: 1 },
      { type: "deload", intensity: 0.9, volume: 0.5 },
    ],
    currentWeek: 1,
    cyclePosition: 2,
    anchor: "2026-10-05",
    dayOverrides: { 3: 5 },
    doneOn: { 0: "2026-10-05", 1: "2026-10-06" },
  };

  it("changes the day to one the template lacks, leaving everything else alone", () => {
    const next = withSlotDay(program, 2, "pull");
    expect(next.schedule.map((s) => s.dayId)).toEqual(["upper", "lower", "pull", "lower"]);
    expect(next.schedule[2]!.dow).toBe(4);
    const { schedule: _a, ...rest } = next;
    const { schedule: _b, ...before } = program;
    expect(rest).toEqual(before);
    expect(program.schedule[2]!.dayId).toBe("upper");
  });

  it("makes a slot a cardio day with the default plan, and drops it when changed away", () => {
    const cardio = withSlotDay(program, 3, "cardio");
    expect(cardio.schedule[3]).toEqual({ dow: 5, dayId: "cardio", cardio: DEFAULT_CARDIO_DAY });
    expect(cardioDayPlan(cardio.schedule[3])).toEqual(DEFAULT_CARDIO_DAY);
    const back = withSlotDay(cardio, 3, "lower");
    expect(back.schedule[3]).toEqual({ dow: 5, dayId: "lower" });
    expect(back.schedule[3]).not.toHaveProperty("cardio");
  });

  it("keeps a cardio day's own plan when it is picked again", () => {
    const own = { activity: "row" as const, effort: "easy" as const, minutes: 60 };
    const once = withSlotCardio(withSlotDay(program, 0, "cardio"), 0, own);
    expect(withSlotDay(once, 0, "cardio").schedule[0]!.cardio).toEqual(own);
  });

  it("ignores an unknown id or index, returning the same object", () => {
    expect(withSlotDay(program, 1, "mystery")).toBe(program);
    expect(withSlotDay(program, 9, "push")).toBe(program);
  });

  it("works for a full-body plan too", () => {
    const full = { templateId: "full_body" as const, schedule: buildSchedule("full_body", [1, 3]) };
    expect(withSlotDay(full, 1, "upper").schedule.map((s) => s.dayId)).toEqual(["full", "upper"]);
  });
});

describe("withSlotCardio", () => {
  const r = {
    schedule: [
      { dow: 1, dayId: "cardio", cardio: DEFAULT_CARDIO_DAY },
      { dow: 3, dayId: "push" },
    ] as ScheduleSlot[],
  };
  const swim = { activity: "swim" as const, effort: "hard" as const, minutes: 45 };

  it("sets what a cardio slot plans", () => {
    expect(withSlotCardio(r, 0, swim).schedule[0]!.cardio).toEqual(swim);
  });

  it("leaves a lifting slot alone", () => {
    expect(withSlotCardio(r, 1, swim)).toBe(r);
  });
});

describe("rotationCardioPlan with cardio days", () => {
  it("adds a cardio slot on its weekday, with its own plan", () => {
    const swim = { activity: "swim" as const, effort: "easy" as const, minutes: 40 };
    const schedule: ScheduleSlot[] = [
      { dow: 1, dayId: "upper" },
      { dow: 3, dayId: "cardio", cardio: swim },
      { dow: 5, dayId: "cardio" },
    ];
    const plan = rotationCardioPlan({ templateId: "upper_lower", schedule });
    expect(plan).toEqual([
      { id: `${SLOT_CARDIO_PREFIX}1`, dow: 3, ...swim },
      { id: `${SLOT_CARDIO_PREFIX}2`, dow: 5, ...DEFAULT_CARDIO_DAY },
    ]);
    expect(plannedWhoMinutes(plan)).toBe(40 + 30 * 2);
  });

  it("counts hybrid finishers and cardio days side by side, each slot once", () => {
    const schedule: ScheduleSlot[] = [
      { dow: 1, dayId: "upper" },
      { dow: 2, dayId: "cardio" },
      { dow: 4, dayId: "push" },
    ];
    const plan = rotationCardioPlan({ templateId: "hybrid", schedule });
    expect(plan.map((p) => [p.id, p.dow])).toEqual([
      ["plan-0", 1],
      ["slot-1", 2],
    ]);
  });

  it("raises a planned cardio day's calories like any planned cardio", () => {
    const schedule: ScheduleSlot[] = [{ dow: 1, dayId: "cardio" }];
    const plan = rotationCardioPlan({ templateId: "upper_lower", schedule });
    const monday = new Date(2030, 0, 7);
    expect(cardioDay(monday, plan, [], 80, monday).kcal).toBeGreaterThan(0);
  });
});

describe("a cardio day in the calendar", () => {
  // Mon strength, Wed cardio, Fri strength; 2026-09-21 is a Monday.
  const schedule: ScheduleSlot[] = [
    { dow: 1, dayId: "upper" },
    { dow: 3, dayId: "cardio", cardio: DEFAULT_CARDIO_DAY },
    { dow: 5, dayId: "lower" },
  ];
  const rotation: Rotation = { schedule, cyclePosition: 0, anchor: "2026-09-21" };

  it("is no lifting session, so no training day for nutrition", () => {
    expect(isLiftingSlot(schedule[1]!)).toBe(false);
    expect(CARDIO_DAY_ID).toBe("cardio");
    const today = d("2026-09-21");
    const state = { rotation, workouts: [], activeWorkout: null };
    expect(dayTypeFor(d("2026-09-21"), state, today)).toBe("training");
    expect(dayTypeFor(d("2026-09-23"), state, today)).toBe("rest");
    expect(dayTypeFor(d("2026-09-25"), state, today)).toBe("training");
    expect(hasPlannedSession(rotation, d("2026-09-23"), today)).toBe(true);
    expect(hasPlannedSession(rotation, d("2026-09-23"), today, isLiftingSlot)).toBe(false);
  });

  it("moves the rotation on once the cardio is logged, like a finished session", () => {
    const next = advanceRotation(
      { ...rotation, cyclePosition: 1 },
      d("2026-09-23"),
      d("2026-09-23"),
    );
    expect(next.rotation.cyclePosition).toBe(2);
    expect(next.rotation.doneOn).toEqual({ 1: "2026-09-23" });
    expect(plannedDate(next.rotation, 2).getDay()).toBe(5);
  });
});

describe("withCardioSlotDone", () => {
  const program: Program = {
    id: "p",
    name: "Program",
    templateId: "upper_lower",
    schedule: [
      { dow: 1, dayId: "upper" },
      { dow: 3, dayId: "cardio", cardio: DEFAULT_CARDIO_DAY },
      { dow: 5, dayId: "lower" },
    ],
    weeks: [
      { type: "build", intensity: 1, volume: 1 },
      { type: "deload", intensity: 0.9, volume: 0.5 },
    ],
    currentWeek: 0,
    cyclePosition: 1,
    anchor: "2026-09-21",
    doneOn: { 0: "2026-09-21" },
  };
  const advance = (p: Program, on: Date) => advanceProgram(p, d("2026-09-23"), on);

  it("advances the cursor and records the day it was done", () => {
    const done = withCardioSlotDone(program, advance, d("2026-09-22"));
    expect(done.cyclePosition).toBe(2);
    expect(done.doneOn).toEqual({ 0: "2026-09-21", 1: "2026-09-22" });
    expect(done.currentWeek).toBe(0);
  });

  it("rolls a program into its next week when the cardio day was the last session", () => {
    const last = { ...program, schedule: program.schedule.slice(0, 2) };
    const done = withCardioSlotDone(last, advance, d("2026-09-23"));
    expect(done.cyclePosition).toBe(0);
    expect(done.currentWeek).toBe(1);
    expect(done.doneOn).toBeUndefined();
  });

  it("does nothing when the next session is a lifting day", () => {
    const lifting = { ...program, cyclePosition: 2 };
    expect(withCardioSlotDone(lifting, advance, d("2026-09-23"))).toBe(lifting);
  });
});
