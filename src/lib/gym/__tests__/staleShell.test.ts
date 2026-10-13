import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "../../staleShell";

describe("isChunkLoadError", () => {
  it("recognises stale-chunk errors from each engine", () => {
    expect(
      isChunkLoadError(new Error("Failed to fetch dynamically imported module: /assets/a.js")),
    ).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new SyntaxError("Unexpected token '<'"))).toBe(true);
  });
  it("ignores ordinary errors", () => {
    expect(isChunkLoadError(new Error("x is undefined"))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
