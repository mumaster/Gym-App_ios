import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILES, EQUIPMENT, EXERCISES, TARGET_MUSCLE_GROUP } from "../data";
import { mergeCatalog } from "../catalogMerge";
import { EXERCISE_POPULARITY, isNiche, popularityOf } from "../exercisePopularity";
import {
  alternativesFor,
  availableExercises,
  estimateSeconds,
  generateWorkout,
} from "../generator";
import type { Exercise, Muscle, PlannedExercise } from "../types";

const MUSCLES: Muscle[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Core",
  "Calves",
];
const profile = (id: string) => DEFAULT_PROFILES.find((p) => p.id === id)!.active_equipment_ids;

describe("built-in exercise list", () => {
  it("has unique ids and names", () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(new Set(EXERCISES.map((e) => e.name.toLowerCase())).size).toBe(EXERCISES.length);
  });

  it("describes every exercise consistently", () => {
    const gear = new Set(EQUIPMENT.map((q) => q.id));
    for (const e of EXERCISES) {
      // The first target is what the generator picks by, and it has to
      // belong to the primary muscle (volume counts sets by that group).
      expect(TARGET_MUSCLE_GROUP[e.muscle_targets[0]!], e.id).toBe(e.primary_muscle);
      expect(
        e.muscle_targets.every((t) => t in TARGET_MUSCLE_GROUP),
        e.id,
      ).toBe(true);
      expect(e.secondary_muscles.includes(e.primary_muscle), e.id).toBe(false);
      expect(
        e.secondary_muscles.every((m) => MUSCLES.includes(m)),
        e.id,
      ).toBe(true);
      expect(e.equipment_required.length, e.id).toBeGreaterThan(0);
      expect(
        e.equipment_required.every((q) => gear.has(q)),
        e.id,
      ).toBe(true);
      expect(e.instructions.length, e.id).toBeGreaterThan(20);
      expect(e.cues.length, e.id).toBeGreaterThan(0);
    }
  });

  // The reported problem: a home-gym swap offered one near-copy.
  it.each(["home-gym", "home-db", "hotel-gym", "full-gym"])(
    "offers at least 4 alternatives for every exercise in the %s profile",
    (id) => {
      const gear = profile(id);
      for (const e of availableExercises(gear)) {
        expect(alternativesFor(e, gear).length, e.id).toBeGreaterThanOrEqual(4);
      }
    },
  );

  // Without any load there are only a few genuinely different calf
  // exercises; everything else still has 4+.
  it.each(["bands-bodyweight", "bodyweight"])(
    "offers at least 4 alternatives outside the calves in the %s profile",
    (id) => {
      const gear = profile(id);
      for (const e of availableExercises(gear).filter((x) => x.primary_muscle !== "Calves")) {
        expect(alternativesFor(e, gear).length, e.id).toBeGreaterThanOrEqual(4);
      }
    },
  );

  it("gives the hamstrings both hinges and leg curls at home", () => {
    const gear = profile("home-gym");
    const rdl = EXERCISES.find((e) => e.id === "rdl")!;
    const alts = alternativesFor(rdl, gear);
    // Most similar first: another hip hinge for the hamstrings.
    expect(alts[0]!.movement_pattern).toBe("hinge");
    expect(alts[0]!.compound).toBe(true);
    const ids = alts.map((e) => e.id);
    expect(ids).toEqual(
      expect.arrayContaining(["db-lying-leg-curl", "nordic-curl", "good-morning"]),
    );
  });
});

describe("unilateral exercises in the time model", () => {
  const entry = (exercise_id: string): PlannedExercise => ({
    exercise_id,
    target_sets: 3,
    warmup_sets: 0,
    target_reps: "8-12",
    rest_seconds: 120,
  });

  it("counts every set for both sides", () => {
    // 3 sets × 45 s + 2 rests × 120 s, with the set time doubled.
    expect(estimateSeconds([entry("db-rdl")])).toBe(3 * 45 + 2 * 120);
    expect(estimateSeconds([entry("bulgarian-split")])).toBe(3 * 45 * 2 + 2 * 120);
  });
});

describe("mergeCatalog", () => {
  const seed: Exercise[] = [
    { ...EXERCISES.find((e) => e.id === "rdl")! },
    { ...EXERCISES.find((e) => e.id === "bulgarian-split")! },
    { ...EXERCISES.find((e) => e.id === "good-morning")! },
  ];
  const revised = "2026-10-01T18:00:00Z";

  it("keeps the built-in version over an older database copy", () => {
    const stale = { ...seed[0]!, name: "Old name", muscle_targets: [] };
    const out = mergeCatalog(
      seed,
      [{ exercise: stale, updatedAt: "2026-09-16T16:41:30Z" }],
      revised,
    );
    expect(out.map((e) => e.id)).toEqual(["rdl", "bulgarian-split", "good-morning"]);
    expect(out[0]!.name).toBe(seed[0]!.name);
  });

  it("uses an edit saved after the built-in list, keeping the unilateral flag", () => {
    const { unilateral: _drop, ...edited } = { ...seed[1]!, name: "My split squat" };
    const out = mergeCatalog(
      seed,
      [{ exercise: edited, updatedAt: "2026-10-05T10:00:00Z" }],
      revised,
    );
    expect(out[1]!.name).toBe("My split squat");
    expect(out[1]!.unilateral).toBe(true);
  });

  it("adds your own exercises after the built-in ones", () => {
    const own = { ...seed[0]!, id: "my-own", name: "My Own Exercise" };
    const out = mergeCatalog(seed, [{ exercise: own, updatedAt: "2026-09-01T00:00:00Z" }], revised);
    expect(out.map((e) => e.id)).toEqual(["rdl", "bulgarian-split", "good-morning", "my-own"]);
  });
});

describe("popularity", () => {
  it("has a measured popularity for every built-in exercise", () => {
    for (const e of EXERCISES) expect(e.id in EXERCISE_POPULARITY, e.id).toBe(true);
  });

  it("builds the first plan from the most popular exercises", () => {
    const gear = profile("home-gym");
    const plan = generateWorkout({
      duration: 45,
      equipment: gear,
      targets: ["Mid Chest", "Lats", "Quads"],
    });
    // Each target's top pick is a staple (10M+ matched YouTube views).
    for (const p of plan)
      expect(popularityOf(p.exercise_id), p.exercise_id).toBeGreaterThanOrEqual(10);
  });

  it("lists familiar swaps before niche ones", () => {
    const gear = profile("home-gym");
    for (const e of availableExercises(gear)) {
      const niche = alternativesFor(e, gear).map((x) => isNiche(x.id));
      // once a niche exercise appears, only niche ones follow
      expect(
        niche.indexOf(true) === -1 || !niche.slice(niche.indexOf(true)).includes(false),
        e.id,
      ).toBe(true);
    }
  });
});
