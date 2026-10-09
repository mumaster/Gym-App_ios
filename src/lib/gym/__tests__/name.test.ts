import { describe, expect, it } from "vitest";
import { cleanFirstName, fitFontSize, MAX_FIRST_NAME } from "../name";

describe("cleanFirstName", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanFirstName("  Max \n ")).toBe("Max");
    expect(cleanFirstName("Anne   Marie")).toBe("Anne Marie");
  });
  it("caps the length", () => {
    expect(cleanFirstName("x".repeat(80))).toHaveLength(MAX_FIRST_NAME);
  });
  it("ignores non-strings", () => {
    expect(cleanFirstName(undefined)).toBe("");
    expect(cleanFirstName(42)).toBe("");
  });
});

describe("fitFontSize", () => {
  it("keeps the max size when the text fits", () => {
    expect(fitFontSize(10, 300, 26, 14)).toBe(26);
  });
  it("shrinks to fit", () => {
    expect(fitFontSize(20, 300, 26, 14)).toBe(15);
  });
  it("never goes below the floor", () => {
    expect(fitFontSize(100, 300, 26, 14)).toBe(14);
  });
});
