import { describe, expect, it } from "vitest";
import { screenshotParts } from "../imageUpload";

describe("cutting tall screenshots", () => {
  it("keeps a short screenshot whole", () => {
    expect(screenshotParts(1500)).toEqual([[0, 1500]]);
  });

  it("cuts a tall one into overlapping parts that cover it exactly", () => {
    const parts = screenshotParts(5000, 1800, 160);
    expect(parts).toEqual([
      [0, 1800],
      [1640, 3440],
      [3280, 5000],
    ]);
    for (let i = 1; i < parts.length; i++) expect(parts[i]![0]).toBeLessThan(parts[i - 1]![1]);
  });
});
