import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RpePicker } from "../../../routes/session";
import { GymProvider } from "../store";
import { rpeAdjustedWeight } from "../progression";
import { rpeBandForRir, rpeForRir } from "../programs";

const render = (target?: number | null, value: number | null = null) =>
  renderToString(
    createElement(
      GymProvider,
      null,
      createElement(RpePicker, { value, onChange: () => {}, target: target ?? null }),
    ),
  );

describe("RpePicker target marker", () => {
  it("labels and outlines only the target RPE", () => {
    const html = render(rpeForRir(2));
    expect(html).toContain("RPE 8, this week");
    expect(html.match(/outline-dashed/g)).toHaveLength(1);
  });

  it("shows no marker without a target, and none when the target is picked", () => {
    expect(render()).not.toContain("outline-dashed");
    expect(render(8, 8)).not.toContain("outline-dashed");
  });
});

describe("RIR band autoregulation", () => {
  it("adjusts down at RPE 9 but not at RPE 8 in a week aimed at RPE 7", () => {
    const band = rpeBandForRir(3);
    expect(band).toEqual([6, 8]);
    expect(rpeAdjustedWeight(100, 9, 2.5, null, band)?.direction).toBe("down");
    expect(rpeAdjustedWeight(100, 8, 2.5, null, band)).toBeNull();
  });
});
