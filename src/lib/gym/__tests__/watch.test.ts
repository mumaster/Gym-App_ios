import { describe, expect, it } from "vitest";
import { describeHrRecovery, formatDuration, matchWorkout, roundWatchNumbers } from "../watch";
import type { Workout } from "../types";

const at = (y: number, m: number, d: number, h: number, min: number, id: string): Workout => ({
  id,
  date: new Date(y, m, d, h, min).toISOString(),
  duration_minutes: 45,
  target_muscles: [],
  plan: [],
  completed_sets: [],
  finished: true,
  unit: "kg",
});

describe("matching a watch recording to a session", () => {
  const ws = [
    at(2026, 8, 9, 19, 38, "evening"),
    at(2026, 8, 9, 7, 5, "morning"),
    at(2026, 8, 10, 19, 40, "next"),
  ];

  it("picks the same-day session with the closest start", () => {
    expect(matchWorkout("2026-09-09T19:41", ws)?.id).toBe("evening");
    expect(matchWorkout("2026-09-09T07:30", ws)?.id).toBe("morning");
  });

  it("finds nothing when no session that day starts within the window", () => {
    expect(matchWorkout("2026-09-09T13:30", ws)).toBeNull();
    expect(matchWorkout("2026-09-11T19:41", ws)).toBeNull();
    expect(matchWorkout(null, ws)).toBeNull();
  });

  it("takes the latest session that day when the screenshot has no time", () => {
    expect(matchWorkout("2026-09-09", ws)?.id).toBe("evening");
  });
});

describe("duration format", () => {
  it("prints m:ss or h:mm:ss", () => {
    expect(formatDuration(1657)).toBe("27:37");
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});

describe("roundWatchNumbers", () => {
  it("rounds every number to 2 decimals, deep", () => {
    const data = {
      avgSpeedKmh: 4.4312,
      hrZones: [
        { name: "Geavanceerd aeroob", minutes: 0.16666666666666666 },
        { name: "Basis aeroob", minutes: 10 },
      ],
      splits: [{ km: 1, paceSeconds: 612.3333333 }],
      name: "Wandelen",
      start: "2026-09-27T11:20",
    };
    expect(roundWatchNumbers(data)).toEqual({
      avgSpeedKmh: 4.43,
      hrZones: [
        { name: "Geavanceerd aeroob", minutes: 0.17 },
        { name: "Basis aeroob", minutes: 10 },
      ],
      splits: [{ km: 1, paceSeconds: 612.33 }],
      name: "Wandelen",
      start: "2026-09-27T11:20",
    });
  });

  it("rounds long numeric strings, keeping their decimal mark, and leaves other text", () => {
    expect(roundWatchNumbers("0.16666666")).toBe("0.17");
    expect(roundWatchNumbers("49,6667")).toBe("49,67");
    expect(roundWatchNumbers("49,6")).toBe("49,6");
    expect(roundWatchNumbers("Links 49,6 · Rechts 50,4")).toBe("Links 49,6 · Rechts 50,4");
    expect(roundWatchNumbers(null)).toBeNull();
  });
});

describe("describeHrRecovery", () => {
  const r = (drop: number | null, startBpm: number | null, endBpm: number | null) => ({
    drop,
    startBpm,
    endBpm,
    minutes: null,
  });
  it("calls 124 → 128 a rise, whatever the printed drop says", () => {
    expect(describeHrRecovery(r(2, 124, 128))).toMatchObject({ direction: "rose", amount: 4 });
  });
  it("keeps the app's own drop for a fall", () => {
    expect(describeHrRecovery(r(10, 154, 133))).toMatchObject({ direction: "fell", amount: 10 });
  });
  it("reads a negative drop without a pair as a rise", () => {
    expect(describeHrRecovery(r(-3, null, null))).toMatchObject({ direction: "rose", amount: 3 });
  });
  it("says nothing without data", () => {
    expect(describeHrRecovery(null)).toBeNull();
    expect(describeHrRecovery(r(null, null, null))).toBeNull();
  });
});
