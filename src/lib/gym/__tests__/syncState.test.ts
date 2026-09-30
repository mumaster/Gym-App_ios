import { describe, expect, it } from "vitest";
import { reconcile, stateHash } from "../syncState";

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
