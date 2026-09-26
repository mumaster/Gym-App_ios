import { describe, expect, it } from "vitest";
import { WARMUP_REPS, warmupFractions, warmupLoad } from "../warmup";

describe("warm-up loads (Ribeiro et al. 2014, 2020)", () => {
  it("uses 6 reps at 40% then 80% for two sets, 80% for one", () => {
    expect(warmupFractions(2)).toEqual([0.4, 0.8]);
    expect(warmupFractions(1)).toEqual([0.8]);
    expect(WARMUP_REPS).toBe(6);
  });

  it("rounds to the plate step and never goes below the empty bar", () => {
    expect(warmupLoad(100, 0, 2, 2.5, 20)).toMatchObject({ weight: 40, reps: 6 });
    expect(warmupLoad(100, 1, 2, 2.5, 20)).toMatchObject({ weight: 80, reps: 6 });
    // 40% of 30 kg is 12 kg, lighter than a 20 kg bar.
    expect(warmupLoad(30, 0, 2, 2.5, 20)?.weight).toBe(20);
  });

  it("returns nothing without a working weight to base it on", () => {
    expect(warmupLoad(null, 0, 2, 2.5)).toBeNull();
    expect(warmupLoad(0, 0, 2, 2.5)).toBeNull();
  });
});
