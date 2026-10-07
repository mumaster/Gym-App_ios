import { describe, expect, it } from "vitest";
import { cardioDay, finisherCardioLog, plannedWhoMinutes } from "../cardio";
import {
  buildSchedule,
  rotationCardioPlan,
  slotCardio,
  templateCardio,
  templateHasCardio,
} from "../splits";

describe("hybrid split", () => {
  it("is the only template with cardio after lifting", () => {
    expect(templateHasCardio("hybrid")).toBe(true);
    expect(templateHasCardio("upper_lower")).toBe(false);
    expect(templateCardio("full_body")).toEqual({});
  });

  it("defaults to 20 minutes, an easy ride after legs", () => {
    const [upper, lower] = buildSchedule("hybrid", [1, 2]);
    expect(slotCardio("hybrid", upper)).toEqual({
      activity: "run",
      effort: "moderate",
      minutes: 20,
    });
    expect(slotCardio("hybrid", lower)).toEqual({ activity: "cycle", effort: "easy", minutes: 20 });
  });

  it("uses the plan's own choice over the default", () => {
    const [upper] = buildSchedule("hybrid", [1]);
    const own = { upper: { activity: "row" as const, effort: "hard" as const, minutes: 15 } };
    expect(slotCardio("hybrid", upper, own)).toEqual(own.upper);
    expect(templateCardio("hybrid", own)["lower"]?.activity).toBe("cycle");
  });

  it("turns the plan's cardio into weekly plan days on the slots' weekdays", () => {
    const schedule = buildSchedule("hybrid", [1, 2, 4, 5]);
    const plan = rotationCardioPlan({ templateId: "hybrid", schedule });
    expect(plan.map((d) => [d.dow, d.activity])).toEqual([
      [1, "run"],
      [2, "cycle"],
      [4, "run"],
      [5, "cycle"],
    ]);
    // Moderate minutes count once (run 10.5 METs is vigorous, so twice).
    expect(plannedWhoMinutes(plan)).toBe(2 * 40 + 2 * 20);
    expect(rotationCardioPlan({ templateId: "upper_lower", schedule })).toEqual([]);
    expect(rotationCardioPlan(null)).toEqual([]);
  });

  it("raises a planned hybrid day's calories like any planned cardio", () => {
    const schedule = buildSchedule("hybrid", [1]);
    const plan = rotationCardioPlan({ templateId: "hybrid", schedule });
    const monday = new Date(2030, 0, 7);
    expect(cardioDay(monday, plan, [], 80, monday).kcal).toBeGreaterThan(0);
  });
});

describe("finisherCardioLog", () => {
  const end = new Date(2030, 0, 7, 19, 10);

  it("logs nothing until it's marked done", () => {
    expect(finisherCardioLog({ activity: "run", effort: "easy", minutes: 20 }, end, "Run")).toBe(
      null,
    );
    expect(finisherCardioLog(undefined, end, "Run")).toBe(null);
  });

  it("logs the cardio as ending when the workout does", () => {
    expect(
      finisherCardioLog({ activity: "hike", effort: "easy", minutes: 25, done: true }, end, "Hike"),
    ).toEqual({
      activity: "hike",
      effort: "easy",
      minutes: 25,
      distanceKm: null,
      start: "2030-01-07T18:45",
      label: "Hike",
      rpe: null,
    });
  });
});
