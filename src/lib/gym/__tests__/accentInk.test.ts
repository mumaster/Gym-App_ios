import { describe, expect, it } from "vitest";
import { DARK_INK, LIGHT_INK, readableInk } from "../accentInk";

describe("readableInk", () => {
  it("puts white on dark colours", () => {
    for (const hex of ["#0b5d1e", "#14532d", "#1e3a8a", "#000000", "#7f1d1d", "#166534"]) {
      expect(readableInk(hex), hex).toBe(LIGHT_INK);
    }
  });

  it("keeps the dark ink on light colours, including the default custom green", () => {
    for (const hex of ["#34d399", "#fbbf24", "#ffffff", "#a3e635", "#fde047", "#22d3ee"]) {
      expect(readableInk(hex), hex).toBe(DARK_INK);
    }
  });

  it("falls back to the dark ink for anything it can't parse", () => {
    expect(readableInk("green")).toBe(DARK_INK);
    expect(readableInk("")).toBe(DARK_INK);
    expect(readableInk("#fff")).toBe(DARK_INK);
  });
});
