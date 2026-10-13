import { describe, expect, it } from "vitest";
import { exerciseRecords, monthlyStrengthScores, strengthScore } from "../records";
import type { LoggedSet, Workout } from "../types";

const set = (exercise_id: string, weight: number, reps: number, extra: Partial<LoggedSet> = {}) =>
  ({
    exercise_id,
    set_number: 1,
    set_type: "working",
    weight,
    reps,
    completed_at: "",
    ...extra,
  }) as LoggedSet;

const workout = (date: string, sets: LoggedSet[]): Workout => ({
  id: date,
  date,
  duration_minutes: 60,
  target_muscles: [],
  plan: [],
  completed_sets: sets,
  finished: true,
  unit: "kg",
});

const loaded = () => false;
const bodyweight = (id: string) => id === "pullup";

describe("exerciseRecords", () => {
  const ws = [
    workout("2026-09-01T10:00:00Z", [
      set("bb-bench", 80, 5),
      set("bb-bench", 60, 1, { set_type: "warmup" }),
    ]),
    workout("2026-09-08T10:00:00Z", [set("bb-bench", 85, 5)]),
    // Heavier single but a lower estimate than 85 × 5: a heaviest record only.
    workout("2026-09-15T10:00:00Z", [set("bb-bench", 90, 1)]),
    // Nothing new.
    workout("2026-09-22T10:00:00Z", [set("bb-bench", 80, 5)]),
  ];

  it("tracks best e1RM, heaviest set and the sessions that beat them", () => {
    const [r] = exerciseRecords(ws, loaded);
    expect(r!.sessions).toBe(4);
    expect(r!.best).toMatchObject({ weight: 85, reps: 5, e1rm: 99.2 });
    expect(r!.heaviest).toMatchObject({ weight: 90, reps: 1 });
    expect(r!.history.map((e) => e.kinds)).toEqual([["heaviest"], ["e1rm", "heaviest"], []]);
    expect(r!.history.at(-1)!.first).toBe(true);
    expect(r!.lastPr).toBe("2026-09-15T10:00:00Z");
  });

  it("ignores warm-ups", () => {
    const [r] = exerciseRecords([ws[0]!], loaded);
    expect(r!.heaviest!.weight).toBe(80);
  });

  it("estimates bodyweight work only with a bodyweight", () => {
    const pull = [
      workout("2026-09-01T10:00:00Z", [set("pullup", 0, 8)]),
      workout("2026-09-08T10:00:00Z", [set("pullup", 0, 10)]),
    ];
    const [noBw] = exerciseRecords(pull, bodyweight);
    expect(noBw!.best.e1rm).toBeNull();
    expect(noBw!.heaviest).toBeNull();
    expect(noBw!.history[0]!.kinds).toEqual(["e1rm"]);
    const [withBw] = exerciseRecords(pull, bodyweight, 80);
    expect(withBw!.best.e1rm).toBe(106.7);
  });
});

describe("strengthScore", () => {
  it("is null until an exercise has two sessions", () => {
    expect(
      strengthScore([workout("2026-09-01T10:00:00Z", [set("bb-bench", 80, 5)])], loaded),
    ).toBeNull();
  });

  it("is 100 × the geometric mean of recent best vs first session", () => {
    const ws = [
      workout("2026-09-01T10:00:00Z", [set("bb-bench", 100, 1), set("db-curl", 20, 1)]),
      workout("2026-09-20T10:00:00Z", [set("bb-bench", 121, 1), set("db-curl", 20, 1)]),
    ];
    // sqrt(1.21 × 1) = 1.1
    expect(strengthScore(ws, loaded, null, new Date("2026-10-01T00:00:00Z"))).toEqual({
      score: 110,
      exercises: 2,
    });
  });

  it("leaves out exercises not done in the last 8 weeks", () => {
    const ws = [
      workout("2026-01-01T10:00:00Z", [set("db-curl", 20, 1)]),
      workout("2026-01-08T10:00:00Z", [set("db-curl", 10, 1)]),
      workout("2026-09-01T10:00:00Z", [set("bb-bench", 100, 1)]),
      workout("2026-09-20T10:00:00Z", [set("bb-bench", 110, 1)]),
    ];
    expect(strengthScore(ws, loaded, null, new Date("2026-10-01T00:00:00Z"))?.score).toBe(110);
  });

  it("gives one score per month, null before there is one", () => {
    const ws = [
      workout("2026-09-01T10:00:00Z", [set("bb-bench", 100, 1)]),
      workout("2026-10-02T10:00:00Z", [set("bb-bench", 105, 1)]),
    ];
    const months = monthlyStrengthScores(ws, loaded, null, 3, new Date("2026-10-13T12:00:00"));
    expect(months.map((m) => m.score)).toEqual([null, null, 105]);
  });
});
