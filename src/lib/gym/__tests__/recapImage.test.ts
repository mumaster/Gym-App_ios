import { describe, expect, it } from "vitest";
import { toCanvasColor } from "../recapImage";

describe("toCanvasColor", () => {
  it("turns hex into rgb(), so the glows can add alpha to a custom accent", () => {
    expect(toCanvasColor("#327742")).toBe("rgb(50, 119, 66)");
    expect(toCanvasColor(" #fff ")).toBe("rgb(255, 255, 255)");
  });
  it("converts oklch to rgb()", () => {
    expect(toCanvasColor("oklch(1 0 0)")).toBe("rgb(255, 255, 255)");
    expect(toCanvasColor("oklch(0% 0 0)")).toBe("rgb(0, 0, 0)");
  });
  it("uses the fallback for an empty value", () => {
    expect(toCanvasColor("")).toBe("rgb(74, 222, 128)");
  });
});
