import { describe, expect, it } from "vitest";
import {
  DARK_INK,
  LIGHT_INK,
  readableAccentText,
  readableInk,
  visibleAccentFill,
} from "../accentInk";

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

describe("visibleAccentFill", () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const darkSurface = lum("#1a1b1d");
  const lightSurface = lum("#e6e7ea");

  it("lifts a dark colour to 3:1 on the dark theme, but less than text does", () => {
    const fill = visibleAccentFill("#0b5d1e", "dark");
    expect(ratio(lum(fill), darkSurface)).toBeGreaterThanOrEqual(3);
    // Closer to the picked colour than the 4.5:1 text variant.
    expect(lum(fill)).toBeLessThan(lum(readableAccentText("#0b5d1e", "dark")));
  });

  it("darkens a pale colour to 3:1 on the light theme", () => {
    const fill = visibleAccentFill("#fbbf24", "light");
    expect(ratio(lum(fill), lightSurface)).toBeGreaterThanOrEqual(3);
  });

  it("leaves colours that already show, and the ink follows the adjusted fill", () => {
    expect(visibleAccentFill("#0b5d1e", "light")).toBe("#0b5d1e");
    expect(visibleAccentFill("#34d399", "dark")).toBe("#34d399");
    // A lightened dark green still takes white ink.
    expect(readableInk(visibleAccentFill("#0b5d1e", "dark"))).toBe(LIGHT_INK);
  });

  it("always leaves the ink at least 4.5:1 on the adjusted fill, in both themes", () => {
    const inkLum = (ink: string) => (ink === LIGHT_INK ? lum("#f8f8f8") : lum("#0b0f0a"));
    for (const hex of [
      "#0b5d1e",
      "#fbbf24",
      "#34d399",
      "#1e3a8a",
      "#e879f9",
      "#7f1d1d",
      "#808080",
    ]) {
      for (const theme of ["dark", "light"] as const) {
        const fill = visibleAccentFill(hex, theme);
        expect(
          ratio(lum(fill), inkLum(readableInk(fill))),
          `${hex} ${theme}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
