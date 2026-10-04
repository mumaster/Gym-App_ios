import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILES, exerciseById } from "../data";
import { bestPairing, generateWorkout } from "../generator";
import { sharesLoadStation } from "../stations";
import type { TargetMuscle } from "../types";

const ex = (id: string) => {
  const e = exerciseById(id);
  if (!e) throw new Error(`no exercise ${id}`);
  return e;
};

describe("load stations", () => {
  it("counts the bar, a cable stack and a leg developer as one station each", () => {
    expect(sharesLoadStation(ex("bb-bench"), ex("bb-row"))).toBe(true);
    expect(sharesLoadStation(ex("lat-pulldown"), ex("cable-pushdown"))).toBe(true);
    expect(sharesLoadStation(ex("leg-extension"), ex("leg-curl"))).toBe(true);
  });

  it("counts the high and the low/mid pulley as one stack", () => {
    expect(sharesLoadStation(ex("lat-pulldown"), ex("seated-cable-row"))).toBe(true);
    expect(sharesLoadStation(ex("cable-crossover"), ex("face-pull"))).toBe(true);
  });

  it("lets two dumbbell exercises pair: you pick up another pair", () => {
    expect(sharesLoadStation(ex("db-bench"), ex("db-row"))).toBe(false);
    expect(sharesLoadStation(ex("db-curl"), ex("db-overhead-triceps-ext"))).toBe(false);
  });

  it("keeps different equipment and bodyweight apart", () => {
    expect(sharesLoadStation(ex("bb-bench"), ex("db-row"))).toBe(false);
    expect(sharesLoadStation(ex("bb-bench"), ex("pullup"))).toBe(false);
    expect(sharesLoadStation(ex("pushup"), ex("pullup"))).toBe(false);
    expect(sharesLoadStation(ex("bb-squat"), ex("smith-rdl"))).toBe(false);
  });

  it("treats machines as separate, except one machine with two settings", () => {
    expect(sharesLoadStation(ex("machine-chest-press"), ex("machine-row"))).toBe(false);
    expect(sharesLoadStation(ex("pec-deck"), ex("reverse-pec-deck"))).toBe(true);
    expect(sharesLoadStation(ex("machine-adduction"), ex("machine-abduction"))).toBe(true);
  });
});

describe("superset pairing", () => {
  it("finds the most pairs where a greedy first pick would strand two", () => {
    // Greedy pairs the bench with the pull-up (first of two 300s) and
    // leaves the barbell row and close-grip bench, which share the bar.
    const list = ["db-bench", "pullup", "bb-row", "close-grip-bench"].map(ex);
    expect(bestPairing(list).every((j) => j !== -1)).toBe(true);
  });

  it("never pairs two exercises on the same station in a generated plan", () => {
    const TARGETS: TargetMuscle[][] = [
      ["Mid Chest", "Lats"],
      ["Quads", "Hamstrings", "Glutes"],
      ["Biceps", "Triceps"],
      ["Side Delts", "Rear Delts", "Upper Chest"],
      ["Mid Chest", "Lats", "Quads", "Abs"],
    ];
    let pairs = 0;
    for (const profile of DEFAULT_PROFILES)
      for (const targets of TARGETS)
        for (const duration of [30, 45, 60, 90])
          for (const variation of [0, 1]) {
            const plan = generateWorkout({
              duration,
              equipment: profile.active_equipment_ids,
              targets,
              variation,
              supersets: true,
              profile,
            });
            plan.forEach((p, i) => {
              if (p.superset_slot !== "A") return;
              pairs++;
              const b = plan[i + 1]!;
              expect(b.superset_group).toBe(p.superset_group);
              expect(
                sharesLoadStation(ex(p.exercise_id), ex(b.exercise_id)),
                `${profile.id}: ${p.exercise_id} + ${b.exercise_id}`,
              ).toBe(false);
            });
          }
    expect(pairs).toBeGreaterThan(400);
  });

  it("swaps a leftover for a similar exercise on other gear rather than leaving it unpaired", () => {
    const profile = DEFAULT_PROFILES.find((p) => p.id === "home-gym")!;
    const plan = generateWorkout({
      duration: 45,
      equipment: profile.active_equipment_ids,
      targets: ["Quads", "Hamstrings", "Glutes"],
      supersets: true,
      profile,
    });
    // squat and barbell RDL share the bar: the RDL moves to the Smith machine
    expect(plan.every((p) => p.superset_group !== undefined)).toBe(true);
    expect(plan.map((p) => p.exercise_id)).toContain("smith-rdl");
  });

  it("numbers supersets in the order they're done", () => {
    const profile = DEFAULT_PROFILES.find((p) => p.id === "home-gym")!;
    const plan = generateWorkout({
      duration: 45,
      equipment: profile.active_equipment_ids,
      targets: ["Quads", "Hamstrings", "Glutes"],
      supersets: true,
      profile,
    });
    const groups = plan.flatMap((p) => (p.superset_slot === "A" ? [p.superset_group] : []));
    expect(groups).toEqual(groups.map((_, i) => i + 1));
  });
});
