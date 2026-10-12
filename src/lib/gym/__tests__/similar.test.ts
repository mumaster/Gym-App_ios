import { describe, expect, it } from "vitest";
import { EXERCISES } from "../data";
import { generateWorkout } from "../generator";
import { isNearDuplicate, nearDuplicateIn } from "../similar";

describe("near-duplicate exercises", () => {
  it("groups the same movement on different gear", () => {
    expect(isNearDuplicate("bw-calf-raise", "db-calf")).toBe(true);
    expect(isNearDuplicate("bb-squat", "smith-squat")).toBe(true);
    expect(isNearDuplicate("bb-bench", "bb-row")).toBe(false);
    expect(isNearDuplicate("db-calf", "db-calf")).toBe(false);
  });

  it("ignores the exercise being replaced", () => {
    expect(nearDuplicateIn("db-calf", ["bw-calf-raise", "bb-bench"])).toBe("bw-calf-raise");
    expect(nearDuplicateIn("db-calf", ["bw-calf-raise"], "bw-calf-raise")).toBeUndefined();
  });

  it("only lists ids that exist in the catalog", () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const id of ["standing-calf", "db-calf", "bw-calf-raise", "bb-squat", "smith-squat"]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("never plans two of a group in one workout", () => {
    for (let variation = 0; variation < 8; variation++) {
      const w = generateWorkout({
        equipment: [...new Set(EXERCISES.flatMap((e) => e.equipment_required))],
        targets: ["Calves", "Quads", "Glutes", "Mid Chest"],
        duration: 90,
        supersets: variation % 2 === 0,
        variation,
      });
      const ids = w.map((p) => p.exercise_id);
      for (const a of ids) for (const b of ids) expect(isNearDuplicate(a, b)).toBe(false);
    }
  });
});

describe("group ids", () => {
  it("all exist in the catalog and none is in two groups", async () => {
    const src = (await import("node:fs")).readFileSync("src/lib/gym/similar.ts", "utf8");
    const ids = [...src.matchAll(/"([a-z0-9-]+)"/g)]
      .map((m) => m[1]!)
      .filter((id) => id.includes("-") || EXERCISES.some((e) => e.id === id));
    const known = new Set(EXERCISES.map((e) => e.id));
    const seen = new Set<string>();
    for (const id of ids) {
      expect(known.has(id), id).toBe(true);
      expect(seen.has(id), `dup ${id}`).toBe(false);
      seen.add(id);
    }
  });
});
