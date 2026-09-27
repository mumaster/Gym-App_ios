import { describe, expect, it } from "vitest";
import { regionsForMuscles } from "../anatomy";

describe("map regions for a split day", () => {
  it("gives a push day triceps and a pull day biceps", () => {
    expect(regionsForMuscles(["Chest", "Shoulders", "Arms"], "push")).toEqual([
      "chest",
      "shoulders",
      "triceps",
    ]);
    expect(regionsForMuscles(["Back", "Arms"], "pull")).toEqual(["lats", "biceps"]);
  });

  it("gives any other day both arm regions", () => {
    expect(regionsForMuscles(["Arms"], "arms")).toEqual(["biceps", "triceps"]);
    expect(regionsForMuscles(["Chest", "Arms"])).toEqual(["chest", "biceps", "triceps"]);
  });
});
