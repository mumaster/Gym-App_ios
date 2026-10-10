import { describe, expect, it } from "vitest";
import { EQUIPMENT, TARGET_MUSCLE_GROUP } from "../data";
import { estimateMinutes, estimateSeconds, generateWorkout } from "../generator";
import { learnPace } from "../pace";
import type { LoggedSet, PlannedExercise, SetType, TargetMuscle, Workout } from "../types";

const T0 = Date.parse("2026-03-02T10:00:00Z");

const entry = (exercise_id: string, over: Partial<PlannedExercise> = {}): PlannedExercise => ({
  exercise_id,
  target_sets: 3,
  warmup_sets: 0,
  target_reps: "8-12",
  rest_seconds: 120,
  ...over,
});

/** A logged set `at` seconds after the workout started. */
const set = (
  exercise_id: string,
  at: number,
  over: Partial<LoggedSet> & { set_type?: SetType } = {},
): LoggedSet => ({
  exercise_id,
  set_number: 1,
  set_type: "working",
  weight: 50,
  reps: 10,
  completed_at: new Date(T0 + at * 1000).toISOString(),
  ...over,
});

const workout = (plan: PlannedExercise[], sets: LoggedSet[], day = 2): Workout => ({
  id: `w${day}`,
  date: `2026-03-${String(day).padStart(2, "0")}T10:00:00Z`,
  duration_minutes: 45,
  target_muscles: [],
  plan,
  completed_sets: sets,
  finished: true,
  unit: "kg",
});

/** `n` sets of one exercise, `gap` seconds apart, starting at `start`. */
const run = (id: string, start: number, n: number, gap: number): LoggedSet[] =>
  Array.from({ length: n }, (_, i) => set(id, start + i * gap, { set_number: i + 1 }));

describe("learnPace", () => {
  it("returns null with nothing to learn from", () => {
    expect(learnPace([])).toBeNull();
    expect(learnPace([workout([entry("bb-bench")], [set("bb-bench", 0)])])).toBeNull();
  });

  it("ignores the first exercise of a workout (setting up)", () => {
    const plan = [entry("bb-bench"), entry("db-fly")];
    const sets = [...run("bb-bench", 0, 4, 400), ...run("db-fly", 2000, 4, 180)];
    const pace = learnPace([workout(plan, sets)])!;
    expect(pace.workPerSide["bb-bench"]).toBeUndefined();
    expect(pace.workPerSide["db-fly"]).toBe(60);
  });

  it("takes the per-exercise median of gap minus planned rest", () => {
    const plan = [entry("bb-bench"), entry("db-fly")];
    // 3 minutes apart with a 120 s rest = 60 s of work; one slow outlier
    const slow = run("db-fly", 2000, 4, 180);
    slow[3] = set("db-fly", 2000 + 3 * 180 + 200, { set_number: 4 });
    const pace = learnPace([workout(plan, [...run("bb-bench", 0, 3, 200), ...slow])])!;
    expect(pace.workPerSide["db-fly"]).toBe(60);
  });

  it("ignores gaps under 10 s or over 900 s", () => {
    const plan = [entry("bb-bench"), entry("db-fly")];
    const fly = [
      set("db-fly", 1000),
      set("db-fly", 1005), // after the fact
      set("db-fly", 1185),
      set("db-fly", 1365),
      set("db-fly", 1365 + 1000), // a pause
      set("db-fly", 1365 + 1000 + 180),
    ];
    const pace = learnPace([workout(plan, [set("bb-bench", 0), ...fly])])!;
    // three valid 180 s gaps remain: 1005 -> 1185 -> 1365, and the last pair
    expect(pace.workPerSide["db-fly"]).toBe(60);
  });

  it("ignores superset rounds and superset exercises", () => {
    const plan = [
      entry("bb-bench"),
      entry("db-fly", { superset_group: 1, superset_slot: "A" }),
      entry("db-curl", { superset_group: 1, superset_slot: "B" }),
    ];
    const sets: LoggedSet[] = [set("bb-bench", 0)];
    for (let r = 0; r < 5; r++) {
      sets.push(set("db-fly", 1000 + r * 400, { round: r + 1 }));
      sets.push(set("db-curl", 1100 + r * 400, { round: r + 1 }));
    }
    expect(learnPace([workout(plan, sets)])).toBeNull();
  });

  it("falls back to the user's default for exercises with < 3 samples", () => {
    const plan = [entry("bb-bench"), entry("db-fly"), entry("bb-row"), entry("db-curl")];
    const sets = [
      set("bb-bench", 0),
      ...run("db-fly", 1000, 4, 180), // 3 samples of 60 s
      ...run("bb-row", 2000, 3, 150), // 2 samples of 30 s: not enough
      ...run("db-curl", 3000, 2, 170), // 1 sample of 50 s
    ];
    const pace = learnPace([workout(plan, sets)])!;
    expect(pace.workPerSide["db-fly"]).toBe(60);
    expect(pace.workPerSide["bb-row"]).toBeUndefined();
    // 6 samples: 60 x3, 30 x2, 50 -> median 55
    expect(pace.defaultWorkPerSide).toBe(55);
    // the time model uses the default for exercises without data
    const rowSeconds = estimateSeconds([entry("bb-row")], pace);
    expect(rowSeconds).toBe(3 * 55 + 2 * 120);
  });

  it("has no default under 5 samples", () => {
    const plan = [entry("bb-bench"), entry("db-fly")];
    const sets = [set("bb-bench", 0), ...run("db-fly", 1000, 4, 180)];
    expect(learnPace([workout(plan, sets)])!.defaultWorkPerSide).toBeNull();
  });

  it("divides a unilateral exercise's sample by its two sides", () => {
    const plan = [entry("bb-bench"), entry("bulgarian-split")];
    // 4 minutes apart, 120 s rest: 120 s of work = 60 per side
    const sets = [set("bb-bench", 0), ...run("bulgarian-split", 1000, 4, 240)];
    const pace = learnPace([workout(plan, sets)])!;
    expect(pace.workPerSide["bulgarian-split"]).toBe(60);
    expect(estimateSeconds([entry("bulgarian-split")], pace)).toBe(3 * 60 * 2 + 2 * 120);
  });

  it("learns the transition between exercises", () => {
    // bench (first, ignored) -> fly -> row -> curl, over several workouts.
    // fly sets 60 s of work (180 s apart); moving on costs 120 rest + 45 walking
    // + the next exercise's first set (60 s).
    const plan = [entry("bb-bench"), entry("db-fly"), entry("bb-row"), entry("db-curl")];
    const days = [2, 3, 4].map((day) =>
      workout(
        plan,
        [
          set("bb-bench", 0),
          ...run("db-fly", 1000, 3, 180), // last at 1360
          ...run("bb-row", 1360 + 120 + 45 + 60, 3, 180), // first at 1585
          ...run("db-curl", 1585 + 360 + 120 + 45 + 60, 3, 180),
        ],
        day,
      ),
    );
    const pace = learnPace(days)!;
    expect(pace.workPerSide["db-fly"]).toBe(60);
    expect(pace.workPerSide["bb-row"]).toBe(60);
    // fly -> row: 1585 - 1360 = 225 = 120 rest + 45 + 60 work. Warm-up/first set
    // work comes from the learned pace, so the walking time is recovered.
    expect(pace.transitionSeconds).toBe(45);
    // transitions feed the time model
    expect(estimateSeconds([entry("db-fly"), entry("bb-row")], pace)).toBe(
      2 * (3 * 60 + 3 * 120) + 45 - 120,
    );
  });

  it("is learned per user from history of any order", () => {
    const plan = [entry("bb-bench"), entry("db-fly")];
    const a = workout(plan, [set("bb-bench", 0), ...run("db-fly", 1000, 4, 180)], 2);
    const b = workout(plan, [set("bb-bench", 0), ...run("db-fly", 1000, 4, 240)], 9);
    // 6 samples: 60 x3 (older), 120 x3 (newer) -> median 90
    expect(learnPace([a, b])!.workPerSide["db-fly"]).toBe(90);
    expect(learnPace([b, a])!.workPerSide["db-fly"]).toBe(90);
  });
});

describe("estimateSeconds with a pace", () => {
  const plan = [entry("db-fly"), entry("bb-row")];

  it("is unchanged without a pace or with a null one", () => {
    const base = 2 * (3 * 45 + 3 * 120) + 45 - 120;
    expect(estimateSeconds(plan)).toBe(base);
    expect(estimateSeconds(plan, null)).toBe(base);
    expect(estimateSeconds(plan, undefined)).toBe(base);
  });

  it("uses the user's seconds per set and transition", () => {
    const pace = { workPerSide: { "db-fly": 60 }, defaultWorkPerSide: 30, transitionSeconds: 90 };
    // fly: 3 x 60 work + 3 rests; row: default 30, last set has no rest; 90 between
    expect(estimateSeconds(plan, pace)).toBe(3 * 60 + 3 * 120 + 3 * 30 + 2 * 120 + 90);
  });

  it("never lets a negative pace make a set free", () => {
    const pace = { workPerSide: {}, defaultWorkPerSide: -100, transitionSeconds: null };
    const one = [entry("bb-row", { rest_seconds: 10 })];
    // every set cycle (rest + work) is at least 20 s, the unrested last set too
    expect(estimateSeconds(one, pace)).toBe(2 * 20 + 20);
  });
});

describe("generateWorkout with a pace", () => {
  const equipment = EQUIPMENT.map((e) => e.id);
  const targets = (Object.keys(TARGET_MUSCLE_GROUP) as TargetMuscle[]).filter((k) =>
    ["Chest", "Back", "Quads"].includes(TARGET_MUSCLE_GROUP[k]),
  );
  const sets = (p: PlannedExercise[]) => p.reduce((n, x) => n + x.target_sets, 0);

  it("fits fewer sets into the same minutes for a slower lifter", () => {
    const slow = { workPerSide: {}, defaultWorkPerSide: 110, transitionSeconds: 120 };
    const normal = generateWorkout({ duration: 60, equipment, targets });
    const slowed = generateWorkout({ duration: 60, equipment, targets, pace: slow });
    expect(sets(slowed)).toBeLessThan(sets(normal));
    const est = estimateMinutes(slowed, slow);
    expect(Math.abs(est - 60) / 60).toBeLessThan(0.15);
  });

  it("is unchanged with no pace", () => {
    expect(generateWorkout({ duration: 60, equipment, targets, pace: null })).toEqual(
      generateWorkout({ duration: 60, equipment, targets }),
    );
  });
});
