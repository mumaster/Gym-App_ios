import { describe, expect, it } from "vitest";
import { keepRunningWorkout, reconcile, stateHash } from "../syncState";

describe("which copy wins at launch", () => {
  const a = stateHash(JSON.stringify({ sets: 3 }));
  const b = stateHash(JSON.stringify({ sets: 5 }));

  it("keeps local sets the cloud never received", () => {
    // Synced at 3 sets, then 2 more logged before iOS closed the app.
    expect(
      reconcile({ userId: "u", cloudExists: true, localHash: b, mark: { userId: "u", hash: a } }),
    ).toBe("pushLocal");
  });

  it("takes the cloud when this device has nothing new", () => {
    expect(
      reconcile({ userId: "u", cloudExists: true, localHash: a, mark: { userId: "u", hash: a } }),
    ).toBe("adoptCloud");
  });

  it("restores the cloud copy on a first sign-in on this device", () => {
    expect(reconcile({ userId: "u", cloudExists: true, localHash: b, mark: null })).toBe(
      "adoptCloud",
    );
    // A mark from another account doesn't count as this user's.
    expect(
      reconcile({ userId: "u", cloudExists: true, localHash: b, mark: { userId: "x", hash: a } }),
    ).toBe("adoptCloud");
  });

  it("uploads when the cloud has no copy yet", () => {
    expect(reconcile({ userId: "u", cloudExists: false, localHash: b, mark: null })).toBe(
      "pushLocal",
    );
  });

  it("hashes equal JSON equally and different JSON differently", () => {
    expect(stateHash('{"a":1}')).toBe(stateHash('{"a":1}'));
    expect(stateHash('{"a":1}')).not.toBe(stateHash('{"a":2}'));
  });
});

describe("a cloud copy never takes sets away from the running workout", () => {
  const w = (id: string, sets: number) => ({ id, completed_sets: Array.from({ length: sets }) });
  const state = (active: ReturnType<typeof w> | null, done: string[] = []) => ({
    activeWorkout: active,
    workouts: done.map((id) => ({ id })),
  });

  it("keeps the local workout when it has more sets", () => {
    const local = state(w("w1", 4));
    const cloud = state(w("w1", 2));
    expect(keepRunningWorkout(local, cloud).activeWorkout?.completed_sets).toHaveLength(4);
  });
  it("takes the cloud's when it has as many or more", () => {
    expect(
      keepRunningWorkout(state(w("w1", 2)), state(w("w1", 3))).activeWorkout?.completed_sets,
    ).toHaveLength(3);
  });
  it("keeps a workout the cloud never saw", () => {
    expect(keepRunningWorkout(state(w("w1", 2)), state(null)).activeWorkout?.id).toBe("w1");
  });
  it("lets another device's finish win", () => {
    expect(keepRunningWorkout(state(w("w1", 2)), state(null, ["w1"])).activeWorkout).toBeNull();
  });
  it("leaves the cloud alone when nothing is running here", () => {
    const cloud = state(w("w2", 1));
    expect(keepRunningWorkout(state(null), cloud)).toBe(cloud);
  });
});
