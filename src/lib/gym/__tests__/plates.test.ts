import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILES, exerciseById } from "../data";
import { DEFAULT_PLATES, FIXED_DUMBBELL_STEP, plateStep } from "../plates";
import type { EquipmentProfile } from "../types";

const home = DEFAULT_PROFILES.find((p) => p.id === "home-gym")!;
const gym = DEFAULT_PROFILES.find((p) => p.id === "full-gym")!;
const ex = (id: string) => {
  const e = exerciseById(id);
  if (!e) throw new Error(`no exercise ${id}`);
  return e;
};
const withPlates = (p: EquipmentProfile, plates: Record<string, number>): EquipmentProfile => ({
  ...p,
  plates,
});

describe("plateStep: the smallest plates count for every loaded exercise", () => {
  it("steps a barbell by the smallest plate on each side", () => {
    expect(plateStep(ex("bb-bench"), home)).toBe(1);
    expect(plateStep(ex("bb-bench"), withPlates(home, { "20": 2, "1.25": 1 }))).toBe(2.5);
  });

  it("steps loadable dumbbells by the smallest plate", () => {
    expect(plateStep(ex("db-shoulder-press"), home)).toBe(0.5);
  });

  it("keeps a fixed dumbbell rack at its own step", () => {
    expect(gym.loadable_dumbbells).toBe(false);
    expect(plateStep(ex("db-shoulder-press"), gym)).toBe(FIXED_DUMBBELL_STEP);
  });

  it("puts one small plate on a cable or machine pin", () => {
    const cable = ex("seated-cable-row");
    expect(plateStep(cable, gym)).toBe(0.5);
    // Without small plates a stack moves by its usual 2.5 kg, never more.
    expect(plateStep(cable, withPlates(gym, { "20": 2, "5": 2 }))).toBe(2.5);
  });

  it("falls back to the old steps with no plates at all", () => {
    const none = withPlates(home, {});
    expect(plateStep(ex("bb-bench"), none)).toBe(2.5);
    expect(plateStep(ex("db-shoulder-press"), none)).toBe(2);
  });

  it("owns 0.5 and 1.25 kg plates by default", () => {
    expect(DEFAULT_PLATES["0.5"]).toBeGreaterThan(0);
    expect(DEFAULT_PLATES["1.25"]).toBeGreaterThan(0);
  });
});
