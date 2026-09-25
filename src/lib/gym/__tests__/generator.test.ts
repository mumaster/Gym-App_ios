import { describe, expect, it } from "vitest";
import { EQUIPMENT, TARGET_MUSCLE_GROUP } from "../data";
import { estimateMinutes, generateWorkout } from "../generator";
import type { TargetMuscle } from "../types";

const equipment = EQUIPMENT.map((e) => e.id);
const targets = (Object.keys(TARGET_MUSCLE_GROUP) as TargetMuscle[]).filter((k) =>
  ["Chest", "Back", "Quads"].includes(TARGET_MUSCLE_GROUP[k]),
);

describe("generateWorkout", () => {
  it("rests 2 minutes between straight sets (ACSM 2009/2026)", () => {
    const plan = generateWorkout({ duration: 60, equipment, targets });
    expect(plan.every((p) => p.rest_seconds === 120)).toBe(true);
  });

  it("fits more exercises into longer sessions, never fewer", () => {
    const counts = [15, 30, 45, 60, 75, 90].map(
      (duration) => generateWorkout({ duration, equipment, targets }).length,
    );
    for (let i = 1; i < counts.length; i++)
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
  });

  it("stays close to the requested duration", () => {
    for (const duration of [30, 45, 60, 90]) {
      const est = estimateMinutes(generateWorkout({ duration, equipment, targets }));
      expect(Math.abs(est - duration) / duration).toBeLessThan(0.15);
    }
  });

  it("halves sets on a deload after fitting, so they aren't added back", () => {
    const normal = generateWorkout({ duration: 60, equipment, targets });
    const deload = generateWorkout({ duration: 60, equipment, targets, volumeMultiplier: 0.5 });
    const sets = (p: typeof normal) => p.reduce((n, x) => n + x.target_sets, 0);
    expect(sets(deload)).toBeLessThanOrEqual(Math.ceil(sets(normal) / 2) + normal.length);
    expect(deload.every((p) => p.target_sets >= 1)).toBe(true);
  });
});
