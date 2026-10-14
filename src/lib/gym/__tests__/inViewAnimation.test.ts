import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IN_VIEW_SELECTOR, installInViewAnimations } from "../inViewAnimation";

describe("in-view animations", () => {
  it("watches every grow-in utility defined in styles.css", () => {
    const css = readFileSync("src/styles.css", "utf8");
    // Every bar/chart utility that runs an animation (bar-track and the
    // bar-fill-* shapes don't).
    const utilities = [...css.matchAll(/@utility ((?:bar|chart)-[a-z-]+) \{([^}]*)/g)]
      .filter((m) => m[2]!.includes("animation:"))
      .map((m) => m[1]!);
    expect(utilities.length).toBeGreaterThan(4);
    for (const u of utilities) {
      expect(IN_VIEW_SELECTOR).toContain(`.${u}`);
    }
  });

  it("does nothing without a browser", () => {
    expect(() => installInViewAnimations()()).not.toThrow();
  });
});
