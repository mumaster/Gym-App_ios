import { describe, expect, it } from "vitest";
import { formatDuration, matchWorkout } from "../watch";
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
