import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IN_VIEW_SELECTOR, installInViewAnimations } from "../inViewAnimation";

describe("in-view animations", () => {
  it("watches every grow-in utility defined in styles.css", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const utilities = [...css.matchAll(/@utility ((?:bar|chart)-[a-z-]+)/g)].map((m) => m[1]!);
    for (const u of utilities) {
      expect(IN_VIEW_SELECTOR).toContain(`.${u}`);
    }
  });

  it("does nothing without a browser", () => {
    expect(() => installInViewAnimations()()).not.toThrow();
  });
});
