import { describe, expect, it } from "vitest";
import {
  addExercise,
  fixOrder,
  fixedReps,
  fixedRest,
  generatedReference,
  linkSuperset,
  newPlanned,
  parseReps,
  planMuscles,
  planTargets,
  removeExercise,
  scoreWorkout,
  overtimeFit,
  timeFill,
  unlinkSuperset,
  updateExercise,
} from "../diyWorkout";
import { DEFAULT_PROFILES, exerciseById } from "../data";
import { estimateMinutes } from "../generator";
import { planBlocks } from "../planBlocks";
import type { PlannedExercise } from "../types";

const ex = (id: string) => exerciseById(id)!;
const row = (id: string, o: Partial<PlannedExercise> = {}): PlannedExercise => ({
  ...newPlanned(ex(id)),
  ...o,
});
const loose = (): PlannedExercise[] => [row("bb-bench"), row("bb-curl"), row("cable-pushdown")];

describe("newPlanned / addExercise", () => {
  it("uses compound and isolation defaults", () => {
    expect(newPlanned(ex("bb-bench"))).toEqual({
      exercise_id: "bb-bench",
      target_sets: 3,
      warmup_sets: 1,
      target_reps: "6-10",
      rest_seconds: 120,
    });
    const iso = newPlanned(ex("bb-curl"));
    expect(iso).toMatchObject({ target_reps: "10-15", rest_seconds: 75, warmup_sets: 0 });
  });
  it("appends a loose exercise", () => {
    const out = addExercise(loose(), ex("db-fly"));
    expect(out).toHaveLength(4);
    expect(out[3]!.exercise_id).toBe("db-fly");
    expect(out[3]!.superset_group).toBeUndefined();
  });
});

describe("supersets", () => {
  it("links two loose blocks as an A/B pair", () => {
    const plan = loose();
    plan[1]!.target_sets = 4;
    plan[1]!.rest_seconds = 30;
    const out = linkSuperset(plan, 1);
    expect(out[1]).toMatchObject({
      superset_group: 1,
      superset_slot: "A",
      rest_seconds: 0,
      target_sets: 4,
    });
    expect(out[2]).toMatchObject({
      superset_group: 1,
      superset_slot: "B",
      rest_seconds: 75,
      target_sets: 4,
    });
    expect(planBlocks(out)).toEqual([[0], [1, 2]]);
  });
  it("round rest is at least 60", () => {
    const plan = [
      row("bb-curl", { rest_seconds: 30 }),
      row("cable-pushdown", { rest_seconds: 20 }),
    ];
    expect(linkSuperset(plan, 0)[1]!.rest_seconds).toBe(60);
  });
  it("is a no-op for supersets, the last block and bad indexes", () => {
    const linked = linkSuperset(loose(), 1);
    expect(linkSuperset(linked, 1)).toBe(linked);
    expect(linkSuperset(linked, 0)).toBe(linked);
    expect(linkSuperset(loose(), 2)).toEqual(loose());
    expect(linkSuperset(loose(), 9)).toEqual(loose());
  });
  it("renumbers groups in plan order", () => {
    const four = [row("bb-bench"), row("db-fly"), row("bb-curl"), row("cable-pushdown")];
    const a = linkSuperset(four, 2);
    const b = linkSuperset(a, 0);
    expect(b.map((p) => p.superset_group)).toEqual([1, 1, 2, 2]);
  });
  it("unlinks into loose rows with the round rest and rounds", () => {
    const linked = linkSuperset(loose(), 1);
    const out = unlinkSuperset(linked, 1);
    for (const i of [1, 2]) {
      expect(out[i]!.superset_group).toBeUndefined();
      expect(out[i]!.superset_slot).toBeUndefined();
      expect(out[i]!.rest_seconds).toBe(75);
      expect(out[i]!.target_sets).toBe(3);
    }
    expect(planBlocks(out)).toEqual([[0], [1], [2]]);
    expect(unlinkSuperset(loose(), 0)).toEqual(loose());
  });
  it("removing one half loosens the other with the round rest", () => {
    const linked = linkSuperset(loose(), 1);
    const out = removeExercise(linked, 1);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ exercise_id: "cable-pushdown", rest_seconds: 75 });
    expect(out[1]!.superset_group).toBeUndefined();
    const out2 = removeExercise(linked, 2);
    expect(out2[1]).toMatchObject({ exercise_id: "bb-curl", rest_seconds: 75 });
    expect(out2[1]!.superset_slot).toBeUndefined();
  });
  it("removes a loose exercise and ignores bad indexes", () => {
    expect(removeExercise(loose(), 0).map((p) => p.exercise_id)).toEqual([
      "bb-curl",
      "cable-pushdown",
    ]);
    expect(removeExercise(loose(), 5)).toEqual(loose());
  });
});

describe("updateExercise", () => {
  it("patches a loose exercise", () => {
    const out = updateExercise(loose(), 0, {
      target_sets: 5,
      rest_seconds: 150,
      warmup_sets: 2,
      target_reps: "5",
    });
    expect(out[0]).toMatchObject({
      target_sets: 5,
      rest_seconds: 150,
      warmup_sets: 2,
      target_reps: "5",
    });
    expect(out[1]).toEqual(loose()[1]);
  });
  it("applies rounds and round rest to the pair, keeping A rest at 0", () => {
    const linked = linkSuperset(loose(), 1);
    for (const idx of [1, 2]) {
      const out = updateExercise(linked, idx, { target_sets: 5, rest_seconds: 90 });
      expect(out[1]).toMatchObject({ target_sets: 5, rest_seconds: 0, superset_slot: "A" });
      expect(out[2]).toMatchObject({ target_sets: 5, rest_seconds: 90, superset_slot: "B" });
      expect(planBlocks(out)).toEqual([[0], [1, 2]]);
    }
  });
  it("keeps reps and warm-ups per exercise in a pair", () => {
    const linked = linkSuperset(loose(), 1);
    const out = updateExercise(linked, 1, { target_reps: "12-20", warmup_sets: 1 });
    expect(out[1]).toMatchObject({ target_reps: "12-20", warmup_sets: 1 });
    expect(out[2]!.target_reps).toBe("10-15");
    expect(out[2]!.warmup_sets).toBe(0);
  });
});

describe("planMuscles / parseReps", () => {
  it("lists primary muscles, most sets first", () => {
    const plan = [row("bb-curl", { target_sets: 2 }), row("bb-bench", { target_sets: 4 })];
    expect(planMuscles(plan)).toEqual(["Chest", "Arms"]);
    expect(planMuscles([])).toEqual([]);
  });
  it("parses rep targets", () => {
    expect(parseReps("8-12")).toEqual({ min: 8, max: 12 });
    expect(parseReps("8–12")).toEqual({ min: 8, max: 12 });
    expect(parseReps("10")).toEqual({ min: 10, max: 10 });
    expect(parseReps("30s")).toBeNull();
    expect(parseReps("")).toBeNull();
  });
});

describe("scoreWorkout", () => {
  const good = [row("bb-bench"), row("cable-crossover")];
  const opts = { minutes: 50, targetMinutes: 50 };
  const part = (s: ReturnType<typeof scoreWorkout>, id: string) =>
    s.parts.find((p) => p.id === id)!;

  it("scores an empty plan 0", () => {
    const s = scoreWorkout([]);
    expect(s).toMatchObject({ score: 0, grade: "weak", muscles: [] });
    expect(s.parts.map((p) => p.points)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(s.parts.map((p) => p.max)).toEqual([35, 20, 15, 10, 10, 10]);
  });
  it("gives a sound compound-then-isolation plan full marks when it fills its time", () => {
    const s = scoreWorkout(good, { ...opts, muscleSets: () => ({ Chest: 6 }) });
    expect(s.score).toBe(100);
    expect(s.grade).toBe("excellent");
    expect(s.muscles[0]).toMatchObject({ muscle: "Chest", status: "good", weeklyTarget: 10 });
  });
  it("penalises an isolation exercise placed before a compound for the same muscle", () => {
    const s = scoreWorkout([row("cable-crossover"), row("bb-bench")], opts);
    expect(part(s, "order").points).toBe(0);
    expect(part(s, "order").issues).toEqual([ex("cable-crossover").name]);
  });
  it("penalises short rest", () => {
    const s = scoreWorkout(
      [row("bb-bench", { rest_seconds: 30 }), row("cable-crossover", { rest_seconds: 30 })],
      opts,
    );
    expect(part(s, "rest").points).toBeCloseTo(10 * ((0.2 + 0.5) / 2));
    expect(part(s, "rest").issues).toHaveLength(2);
  });
  it("counts a superset's round rest for both halves", () => {
    const linked = linkSuperset(
      [row("bb-curl", { rest_seconds: 30 }), row("cable-pushdown", { rest_seconds: 30 })],
      0,
    );
    expect(part(scoreWorkout(linked, opts), "rest").points).toBe(10);
  });
  it("marks too many sets for one muscle as high", () => {
    const s = scoreWorkout([row("bb-bench", { target_sets: 12 })], {
      ...opts,
      muscleSets: () => ({ Chest: 12 }),
    });
    expect(s.muscles[0]!.status).toBe("high");
    expect(part(s, "muscles").points).toBeCloseTo(9);
    expect(part(s, "muscles").issues).toEqual(["Chest"]);
    // Sets past the cap don't count as useful.
    expect(s.usefulSets).toBe(11);
  });
  it("marks few sets as low", () => {
    const s = scoreWorkout([row("bb-bench", { target_sets: 1 })], {
      ...opts,
      muscleSets: () => ({ Chest: 1 }),
    });
    expect(s.muscles[0]!.status).toBe("low");
    expect(part(s, "muscles").points).toBeCloseTo(5);
  });
  it("counts secondary muscles with the default whole sets", () => {
    const s = scoreWorkout([row("bb-bench", { target_sets: 4 })], opts);
    expect(s.muscles[0]).toMatchObject({ muscle: "Chest", sets: 4 });
    expect(s.muscles.length).toBeGreaterThan(1);
  });
  it("checks reps; time-based targets count as in range", () => {
    const s = scoreWorkout(
      [row("bb-bench", { target_reps: "1-3" }), row("bb-curl", { target_reps: "30s" })],
      opts,
    );
    expect(part(s, "reps").points).toBe(5);
    expect(part(s, "reps").issues).toEqual([ex("bb-bench").name]);
  });
  it("scores filling the planned time", () => {
    expect(timeFill(45, 50)).toBe(1);
    expect(timeFill(7, 60)).toBeCloseTo(7 / 51);
    expect(overtimeFit(57, 50)).toBe(1);
    expect(overtimeFit(80, 50)).toBe(0);
    // An empty hour drags every part down, not only the time part.
    const s = scoreWorkout(good, { minutes: 10, targetMinutes: 60 });
    expect(s.completeness).toBeCloseTo(10 / 51);
    for (const p of s.parts) expect(p.points).toBeLessThan(p.max * 0.2);
  });
  it("uses injected volume functions", () => {
    const s = scoreWorkout(good, {
      ...opts,
      muscleSets: () => ({ Biceps: 4 }),
      weeklyTarget: () => 12,
    });
    expect(s.muscles).toEqual([
      { muscle: "Biceps", sets: 4, weeklyTarget: 12, weekDone: 0, status: "good" },
    ]);
  });
  it("grades by score", () => {
    const bad = scoreWorkout(
      [row("bb-bench", { target_sets: 12, rest_seconds: 20, target_reps: "1" })],
      {
        minutes: 130,
        targetMinutes: 60,
        muscleSets: () => ({ Chest: 12 }),
        reference: [row("bb-bench", { target_sets: 10 }), row("bb-row", { target_sets: 10 })],
      },
    );
    expect(bad.grade).toBe("weak");
    expect(scoreWorkout(good, opts).grade).toBe("excellent");
  });
});

describe("scoring against a generated workout", () => {
  const gym = DEFAULT_PROFILES.find((p) => p.id === "commercial") ?? DEFAULT_PROFILES[0]!;
  const ref = (plan: PlannedExercise[], duration: number) =>
    generatedReference(plan, duration, { equipment: gym.active_equipment_ids, profile: gym });

  it("asks the generator for the plan's main muscles and its supersets", () => {
    const plan = [row("bb-bench"), row("bb-row")];
    expect(planTargets(plan)).toEqual([
      ex("bb-bench").muscle_targets[0],
      ex("bb-row").muscle_targets[0],
    ]);
    expect(ref(plan, 60).length).toBeGreaterThan(2);
    expect(ref(plan, 60).some((p) => p.superset_group !== undefined)).toBe(false);
    expect(ref(linkSuperset(plan, 0), 60).some((p) => p.superset_group !== undefined)).toBe(true);
    expect(ref([], 60)).toEqual([]);
  });
  it("one set of bench press in an hour scores close to 0", () => {
    const one = [row("bb-bench", { target_sets: 1, warmup_sets: 0 })];
    const s1 = scoreWorkout(one, {
      minutes: estimateMinutes(one),
      targetMinutes: 60,
      reference: ref(one, 60),
    });
    expect(s1.score).toBeLessThanOrEqual(3);
  });
  it("one exercise in a 60-minute plan scores low, not 100", () => {
    const plan = [row("bb-bench")];
    const reference = ref(plan, 60);
    const s = scoreWorkout(plan, { minutes: estimateMinutes(plan), targetMinutes: 60, reference });
    expect(s.referenceSets).toBeGreaterThan(s.usefulSets);
    expect(s.score).toBeLessThan(10);
    expect(s.grade).toBe("weak");
  });
  it("the generated workout itself scores high against itself", () => {
    for (const plan of [
      [row("bb-bench"), row("bb-row")],
      [row("bb-bench"), row("bb-row"), row("bb-squat")],
    ]) {
      const reference = ref(plan, 45);
      const s = scoreWorkout(reference, {
        minutes: estimateMinutes(reference),
        targetMinutes: 45,
        reference,
        referenceMinutes: estimateMinutes(reference),
      });
      expect(s.score).toBeGreaterThanOrEqual(85);
    }
  });
  it("scores the generated workout the same when its muscles can't fill the time", () => {
    const reference = ref([row("bb-bench")], 75);
    const refMin = estimateMinutes(reference);
    const s = scoreWorkout(reference, {
      minutes: refMin,
      targetMinutes: 75,
      reference,
      referenceMinutes: refMin,
    });
    expect(s.referenceMinutes).toBe(refMin);
    expect(s.completeness).toBeCloseTo(Math.min(1, refMin / (0.85 * 75)));
  });
  it("a fuller plan scores higher than a thinner one for the same length", () => {
    const thin = [row("bb-bench"), row("bb-row")];
    const full = [
      row("bb-bench", { target_sets: 4 }),
      row("bb-row", { target_sets: 4 }),
      row("cable-crossover"),
      row("bb-curl"),
      row("cable-pushdown"),
    ];
    const score = (plan: PlannedExercise[]) =>
      scoreWorkout(plan, {
        minutes: estimateMinutes(plan),
        targetMinutes: 60,
        reference: ref(thin, 60),
      }).score;
    expect(score(full)).toBeGreaterThan(score(thin));
  });
});

describe("one-tap fixes", () => {
  it("lists the exercises behind order, rep and rest findings", () => {
    const s = scoreWorkout(
      [row("cable-crossover", { target_reps: "2-4", rest_seconds: 20 }), row("bb-bench")],
      { minutes: 30, targetMinutes: 30 },
    );
    const items = (id: string) => s.parts.find((p) => p.id === id)!.items;
    expect(items("order")).toEqual([0]);
    expect(items("reps")).toEqual([0]);
    expect(items("rest")).toEqual([0]);
  });
  it("moves an isolation exercise after its compound lift", () => {
    const out = fixOrder([row("cable-crossover"), row("bb-bench"), row("bb-curl")], 0);
    expect(out.map((p) => p.exercise_id)).toEqual(["bb-bench", "cable-crossover", "bb-curl"]);
    expect(scoreWorkout(out).parts.find((p) => p.id === "order")!.issues).toEqual([]);
  });
  it("suggests the default rep range and rest for the exercise", () => {
    const plan = [row("bb-bench", { target_reps: "1-3" }), row("bb-curl", { rest_seconds: 20 })];
    expect(fixedReps(plan, 0)).toBe("6-10");
    expect(fixedReps(plan, 1)).toBe("10-15");
    expect(fixedRest(plan, 0)).toBe(120);
    expect(fixedRest(plan, 1)).toBe(75);
  });
  it("uses the longer rest for a superset round", () => {
    const pair = linkSuperset([row("bb-bench"), row("bb-curl")], 0);
    expect(fixedRest(pair, 1)).toBe(120);
  });
});

describe("this week's training", () => {
  it("marks a muscle whose weekly target is already reached as done", () => {
    const s = scoreWorkout([row("bb-bench")], {
      minutes: 15,
      targetMinutes: 15,
      weekDone: { Chest: 12 },
    });
    expect(s.muscles[0]).toMatchObject({ muscle: "Chest", status: "done", weekDone: 12 });
    const fresh = scoreWorkout([row("bb-bench")], { minutes: 15, targetMinutes: 15 });
    expect(s.score).toBeLessThan(fresh.score);
  });
});
