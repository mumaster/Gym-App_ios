import { describe, expect, it } from "vitest";
import { EXERCISES } from "../data";
import { suggestWeight } from "../progression";
import {
  crossEstimate,
  heavierHint,
  loadFor,
  REFERENCE_DISCOUNT,
  ROUGH_DISCOUNT,
  setE1rm,
  TARGET_RIR,
  withKnownLifts,
  withRunning,
} from "../startWeight";
import type { KnownLift } from "../startWeight";
import type { LoggedSet, Workout } from "../types";

const ex = (id: string) => EXERCISES.find((e) => e.id === id)!;
const day = 864e5;
const set = (exercise_id: string, weight: number, reps: number, rpe?: number): LoggedSet => ({
  exercise_id,
  set_number: 1,
  set_type: "working",
  weight,
  reps,
  completed_at: "2026-09-01T10:00:00Z",
  ...(rpe != null ? { rpe } : {}),
});
const session = (daysAgo: number, sets: LoggedSet[]): Workout => ({
  id: `w${daysAgo}`,
  date: new Date(Date.parse("2026-10-01T10:00:00Z") - daysAgo * day).toISOString(),
  duration_minutes: 60,
  target_muscles: ["Chest"],
  unit: "kg",
  finished: true,
  plan: [],
  completed_sets: sets,
});

describe("effort-adjusted 1RM (Zourdos 2016, Helms 2016; Epley)", () => {
  it("counts the reps left at the logged RPE", () => {
    expect(setE1rm({ weight: 80, reps: 8, rpe: 8 })).toBeCloseTo(80 * (1 + 10 / 30));
    // without an RPE the set counts as taken to failure
    expect(setE1rm({ weight: 80, reps: 8 })).toBeCloseTo(80 * (1 + 8 / 30));
  });

  it("proposes loads at RIR 2, the middle of RPE 7–9, rounded down", () => {
    expect(TARGET_RIR).toBe(2);
    const e1rm = setE1rm({ weight: 80, reps: 8, rpe: 8 });
    expect(loadFor(e1rm, 8, 2.5)).toBe(80);
    expect(loadFor(100, 10, 2.5)).toBe(70); // 71.4 → 70
  });
});

describe("crossEstimate", () => {
  it("uses the published barbell → dumbbell bench ratio (Saeterbakken 2011)", () => {
    const history = [session(3, [set("bb-bench", 100, 5, 10)])]; // e1RM 116.7
    const est = crossEstimate(ex("db-bench"), history, "8-12", 2)!;
    expect(est.basis).toBe("published");
    expect(est.fromId).toBe("bb-bench");
    expect(est.reps).toBe(12);
    // 116.7 × 0.415 = 48.4 per dumbbell → 12 reps at RIR 2 → 33.8 → 32
    expect(est.weight).toBe(32);
  });

  it("uses the incline regression for the barbell incline bench", () => {
    const history = [session(3, [set("bb-bench", 100, 5, 10)])];
    const est = crossEstimate(ex("bb-incline-bench"), history, "6-10", 2.5)!;
    expect(est.basis).toBe("published");
    // 0.827 × 116.7 − 6.648 = 89.8 → 10 reps at RIR 2 → 63.1 → 62.5
    expect(est.weight).toBe(62.5);
  });

  it("falls back to a rough, discounted estimate within the same family", () => {
    const history = [session(2, [set("db-fly", 16, 12, 8)])];
    const est = crossEstimate(ex("cable-crossover"), history, "10-14", 2.5)!;
    expect(est.basis).toBe("rough");
    expect(est.fromId).toBe("db-fly");
    const e1rm = setE1rm({ weight: 16, reps: 12, rpe: 8 });
    // cables aren't converted (each side has its own stack): the discount only
    expect(est.weight).toBe(loadFor(e1rm * ROUGH_DISCOUNT, 14, 2.5));
    expect(est.weight).toBe(10); // 16 kg dumbbell flye → 10 kg per side, on the light side
  });

  it("prefers the same main target, else any exercise for the muscle group", () => {
    // the barbell bench is logged first, but the dumbbell one needs no conversion
    const history = [session(2, [set("bb-bench", 80, 10, 8), set("db-bench", 30, 10, 8)])];
    const est = crossEstimate(ex("incline-db-press"), history, "6-10", 2)!;
    expect(est.basis).toBe("rough");
    expect(est.fromId).toBe("db-bench");
    // dumbbell → dumbbell: the discount only
    expect(est.weight).toBe(
      loadFor(setE1rm({ weight: 30, reps: 10, rpe: 8 }) * ROUGH_DISCOUNT, 10, 2),
    );
  });

  it("never estimates an isolation lift's rough estimate from a compound one, or for bodyweight", () => {
    const history = [session(2, [set("bb-squat", 120, 5, 8)])];
    expect(crossEstimate(ex("leg-extension"), history, "10-14", 2.5)?.basis).not.toBe("rough");
    expect(
      crossEstimate(ex("pushup"), [session(2, [set("bb-bench", 80, 8)])], "8-12", 2),
    ).toBeNull();
  });
});

describe("a reference for an isolation exercise from a compound lift", () => {
  it("halves the compound lift's 1RM, after the equipment factor", () => {
    // Bench 80 × 10 @ 8 → dumbbell flye, per dumbbell: × 0.415 × 0.5.
    const history = [session(2, [set("bb-bench", 80, 10, 8)])];
    const est = crossEstimate(ex("db-fly"), history, "10-14", 1)!;
    expect(est).toMatchObject({ basis: "reference", fromId: "bb-bench", reps: 14 });
    expect(est.weight).toBe(
      loadFor(setE1rm({ weight: 80, reps: 10, rpe: 8 }) * 0.415 * REFERENCE_DISCOUNT, 14, 1),
    );
    expect(est.weight).toBe(15);
  });

  it("works for a machine from a barbell lift, unconverted", () => {
    const history = [session(2, [set("bb-squat", 120, 5, 8)])];
    const est = crossEstimate(ex("leg-extension"), history, "10-14", 2.5)!;
    expect(est.basis).toBe("reference");
    expect(est.weight).toBe(47.5);
  });

  it("prefers a closer estimate when one exists", () => {
    const history = [
      session(2, [set("bb-bench", 80, 10, 8)]),
      session(5, [set("cable-crossover", 15, 12, 8)]),
    ];
    expect(crossEstimate(ex("db-fly"), history, "10-14", 1)?.basis).toBe("rough");
  });

  it("never goes from an isolation lift to a compound one, or across muscles", () => {
    const history = [session(2, [set("db-fly", 14, 12, 8)])];
    expect(crossEstimate(ex("bb-bench"), history, "6-10", 2.5)).toBeNull();
    const rows = [session(2, [set("bb-row", 80, 8, 8)])];
    expect(crossEstimate(ex("db-curl"), rows, "10-14", 1)).toBeNull();
  });

  it("isn't used for an exercise you've already done", () => {
    const history = [session(2, [set("bb-bench", 100, 5)]), session(9, [set("db-bench", 30, 10)])];
    expect(crossEstimate(ex("db-bench"), history, "8-12", 2)).toBeNull();
  });
});

describe("a new user's first workout", () => {
  it("estimates from an exercise logged earlier in the same workout", () => {
    // No history at all; the running workout has bench 80 × 10 at RPE 10.
    const running = { ...session(0, [set("bb-bench", 80, 10, 10)]), finished: false };
    expect(crossEstimate(ex("db-bench"), [], "8-12", 2)).toBeNull();
    const e = crossEstimate(ex("db-bench"), withRunning([], running), "8-12", 2)!;
    expect(e.basis).toBe("published");
    expect(e.fromId).toBe("bb-bench");
    expect(e.weight).toBe(loadFor((0.83 / 2) * setE1rm({ weight: 80, reps: 10, rpe: 10 }), 12, 2));
  });

  it("leaves history alone when nothing is logged yet", () => {
    const history = [session(3, [set("bb-bench", 80, 10)])];
    expect(withRunning(history, { ...session(0, []), finished: false })).toBe(history);
    expect(withRunning(history, null)).toBe(history);
  });
});

describe("heavierHint", () => {
  const sugg = (history: Workout[], id: string, reps = "8-12", step = 2.5) =>
    suggestWeight(id, history, reps, step)!;

  it("notes a heavier weight when the last sets had reps to spare (RPE 5)", () => {
    const history = [session(2, [set("bb-bench", 80, 10, 5), set("bb-bench", 80, 10, 5)])];
    const s = sugg(history, "bb-bench");
    const hint = heavierHint(ex("bb-bench"), history, s, 2.5)!;
    expect(hint.why).toBe("rpe");
    expect(hint.rpe).toBe(5);
    expect(hint.weight).toBeGreaterThanOrEqual(s.weight + 2.5);
  });

  it("stays quiet when the extra rep the suggestion asks for covers the spare reps", () => {
    // RPE 6 at 10 reps: the suggestion is 11 reps at 80 kg, and the RIR-2
    // load for 11 reps (81.9 kg) isn't a whole plate step heavier.
    const history = [session(2, [set("bb-bench", 80, 10, 6)])];
    expect(heavierHint(ex("bb-bench"), history, sugg(history, "bb-bench"), 2.5)).toBeNull();
  });

  it("stays quiet when the sets were in the target range (RPE 8)", () => {
    const history = [session(2, [set("bb-bench", 80, 10, 8), set("bb-bench", 80, 10, 8)])];
    expect(heavierHint(ex("bb-bench"), history, sugg(history, "bb-bench"), 2.5)).toBeNull();
  });

  it("scales by your own progress on a related exercise since (personal)", () => {
    const history = [
      session(1, [set("bb-bench", 110, 5, 9)]), // stronger now
      session(20, [set("db-bench", 30, 10, 8), set("bb-bench", 90, 5, 9)]),
    ];
    const s = sugg(history, "db-bench", "8-12", 2);
    const hint = heavierHint(ex("db-bench"), history, s, 2)!;
    expect(hint.why).toBe("personal");
    expect(hint.fromId).toBe("bb-bench");
    expect(hint.weight).toBeGreaterThanOrEqual(s.weight + 2);
  });

  it("never comes from a rough estimate", () => {
    const history = [
      session(1, [set("db-fly", 30, 12, 8)]),
      session(20, [set("cable-crossover", 10, 12, 8)]),
    ];
    const s = sugg(history, "cable-crossover", "10-14");
    expect(heavierHint(ex("cable-crossover"), history, s, 2.5)).toBeNull();
  });
});

describe("in a generated plan", () => {
  it("gives a never-done exercise a starting weight from a related one", async () => {
    const { generateWorkout } = await import("../generator");
    const history = [session(3, [set("bb-bench", 100, 5, 10)])];
    const plan = generateWorkout({
      duration: 30,
      equipment: ["dumbbell", "bench"],
      targets: ["Mid Chest"],
      history,
    });
    const db = plan.find((p) => p.exercise_id === "db-bench");
    expect(db?.suggested_basis).toBe("published");
    expect(db?.suggested_weight).toBeGreaterThan(0);
  });
});

describe("lifts entered in Settings", () => {
  const lift = (exercise_id: string, weight: number, reps: number, rpe?: number): KnownLift => ({
    exercise_id,
    weight,
    reps,
    ...(rpe != null ? { rpe } : {}),
    date: "2026-09-30T10:00:00Z",
  });
  const known = [lift("bb-bench", 100, 5, 8)];

  it("gives the exercise itself its own lift at RIR 2", () => {
    const e = crossEstimate(ex("bb-bench"), withKnownLifts([], known), "8-12", 2.5)!;
    expect(e.basis).toBe("entered");
    expect(e.weight).toBe(loadFor(setE1rm({ weight: 100, reps: 5, rpe: 8 }), 12, 2.5));
  });

  it("works out related exercises from it", () => {
    const e = crossEstimate(ex("db-bench"), withKnownLifts([], known), "8-12", 2)!;
    expect(e.basis).toBe("published");
    expect(e.fromId).toBe("bb-bench");
  });

  it("stops counting once the exercise is logged in the app", () => {
    const history = [session(2, [set("bb-bench", 60, 10)])];
    expect(crossEstimate(ex("bb-bench"), withKnownLifts(history, known), "8-12", 2.5)).toBeNull();
    // and a logged set is the reference for a related exercise, not the entry
    const e = crossEstimate(ex("db-bench"), withKnownLifts(history, known), "8-12", 2)!;
    expect(e.fromSet.weight).toBe(60);
  });

  it("changes nothing when there are none", () => {
    const history = [session(2, [set("bb-bench", 60, 10)])];
    expect(withKnownLifts(history, [])).toBe(history);
  });

  it("gives a first plan starting weights without any history", async () => {
    const { generateWorkout } = await import("../generator");
    const plan = generateWorkout({
      duration: 30,
      equipment: ["dumbbell", "bench"],
      targets: ["Mid Chest"],
      knownLifts: known,
    });
    const db = plan.find((p) => p.exercise_id === "db-bench");
    expect(db?.suggested_basis).toBe("published");
    expect(db?.suggested_weight).toBeGreaterThan(0);
  });
});
