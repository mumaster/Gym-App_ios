import { describe, expect, it } from "vitest";
import { EQUIPMENT, EXERCISES, exerciseById } from "../data";
import { alternativesFor, availableExercises } from "../generator";
import { isNiche, popularityOf } from "../exercisePopularity";
import { PROGRAM_COUNT_OF_280 } from "../exercisePrograms";
import { isBodyweightExercise } from "../load";
import { loadStations } from "../stations";
import type { EquipmentId } from "../types";

const NEW_GEAR: EquipmentId[] = [
  "plate_machine",
  "ez_bar",
  "preacher_bench",
  "seated_calf",
  "captains_chair",
  "back_ext_bench",
];

describe("gear popular programs use", () => {
  it("lists the six new pieces of gear", () => {
    const ids = EQUIPMENT.map((e) => e.id);
    for (const g of NEW_GEAR) expect(ids, g).toContain(g);
  });

  it("has exercises for every new piece of gear", () => {
    for (const g of NEW_GEAR)
      expect(
        EXERCISES.filter((e) => e.equipment_required.includes(g)).length,
        g,
      ).toBeGreaterThanOrEqual(g === "seated_calf" ? 1 : 2);
  });

  it("only offers gear-bound exercises once the gear is ticked", () => {
    const base: EquipmentId[] = ["bodyweight", "dumbbell", "barbell", "bench", "machine"];
    const ids = (gear: EquipmentId[]) => availableExercises(gear).map((e) => e.id);
    expect(ids(base)).not.toContain("hack-squat");
    expect(ids([...base, "plate_machine"])).toContain("hack-squat");
    expect(ids(base)).not.toContain("ez-bar-curl");
    expect(ids([...base, "ez_bar"])).toContain("ez-bar-curl");
    expect(ids([...base, "ez_bar"])).not.toContain("ez-bar-preacher-curl");
    expect(ids([...base, "ez_bar", "preacher_bench"])).toContain("ez-bar-preacher-curl");
  });

  it("treats the leg raise stations as bodyweight and the EZ bar as a loaded bar", () => {
    expect(isBodyweightExercise(exerciseById("captains-chair-leg-raise"))).toBe(true);
    expect(isBodyweightExercise(exerciseById("back-extension"))).toBe(true);
    expect(isBodyweightExercise(exerciseById("ez-bar-curl"))).toBe(false);
    expect(loadStations(exerciseById("ez-bar-curl")!)).toEqual(["ez_bar"]);
    expect(loadStations(exerciseById("hack-squat")!)).toEqual(["machine:hack-squat"]);
  });
});

describe("ranking by program count", () => {
  it("only lists exercises that exist", () => {
    for (const id of Object.keys(PROGRAM_COUNT_OF_280)) expect(exerciseById(id), id).toBeTruthy();
  });

  it("puts the staples of 280 programs before the niche moves", () => {
    expect(popularityOf("leg-curl")).toBeGreaterThan(popularityOf("sissy-squat"));
    expect(popularityOf("standing-calf")).toBeGreaterThan(popularityOf("bw-calf-raise"));
    expect(isNiche("lat-pulldown")).toBe(false);
  });

  it("suggests the program staples first when swapping", () => {
    const full = EQUIPMENT.map((e) => e.id);
    const alts = alternativesFor(exerciseById("lying-leg-curl")!, full).map((e) => e.id);
    expect(alts.indexOf("seated-leg-curl")).toBeGreaterThanOrEqual(0);
    expect(alts.indexOf("seated-leg-curl")).toBeLessThan(alts.indexOf("sliding-leg-curl"));
  });
});
