import { describe, expect, it } from "vitest";
import { DARK_INK, LIGHT_INK, readableAccentText, readableInk } from "../accentInk";

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

describe("readableAccentText", () => {
  const ratio = (hex: string, surface: [number, number, number]) => {
    const lum = (r: number, g: number, b: number) => {
      const lin = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
    };
    const a = lum(
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    );
    const b = lum(...surface);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };

  it("lightens a dark colour for the dark theme until it reads as text", () => {
    const out = readableAccentText("#0b5d1e", "dark");
    expect(out).not.toBe("#0b5d1e");
    expect(ratio(out, [26, 27, 29])).toBeGreaterThanOrEqual(4.5);
    // Still green, not washed out to white.
    expect(parseInt(out.slice(3, 5), 16)).toBeGreaterThan(parseInt(out.slice(1, 3), 16));
  });

  it("darkens a pale colour for the light theme", () => {
    const out = readableAccentText("#fbbf24", "light");
    expect(out).not.toBe("#fbbf24");
    expect(ratio(out, [230, 231, 234])).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves a colour alone when it already reads on that theme", () => {
    expect(readableAccentText("#34d399", "dark")).toBe("#34d399");
    expect(readableAccentText("#0b5d1e", "light")).toBe("#0b5d1e");
  });

  it("ends at white/black for the extremes and ignores unparsable input", () => {
    expect(ratio(readableAccentText("#000000", "dark"), [26, 27, 29])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(readableAccentText("#ffffff", "light"), [230, 231, 234])).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(readableAccentText("green", "dark")).toBe("green");
  });
});
