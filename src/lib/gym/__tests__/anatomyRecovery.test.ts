import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnatomyMap } from "../../../components/gym/AnatomyMap";
import { GymProvider } from "../store";

const render = (recovery: NonNullable<Parameters<typeof AnatomyMap>[0]["recovery"]>) =>
  renderToString(
    createElement(
      GymProvider,
      null,
      createElement(AnatomyMap, { selected: ["biceps"], recovery, onToggle: () => {} }),
    ),
  );

describe("AnatomyMap recovery shading", () => {
  it("labels recovering regions and shows the legend and pills", () => {
    let html = "";
    expect(() => {
      html = render({
        chest: { recovered: 0.2, hoursLeft: 20 },
        quads: { recovered: 0.7, hoursLeft: 9 },
        biceps: { recovered: 0.1, hoursLeft: 30 },
      });
    }).not.toThrow();
    expect(html).toContain("Chest, still recovering, about 20 h to go");
    expect(html).toContain("Tinted muscles are still recovering");
    expect(html).toContain("map-recover-low");
    expect(html).toContain("map-recover-mid");
    // A selected region keeps its plain label.
    expect(html).not.toContain("Biceps, still recovering");
  });

  it("shows nothing extra when nothing is recovering", () => {
    expect(render({})).not.toContain("Tinted muscles");
  });

  it("read-only (History): no muscle chips, says when all is recovered", () => {
    const html = renderToString(
      createElement(
        GymProvider,
        null,
        createElement(AnatomyMap, {
          selected: [],
          recovery: {},
          onToggle: () => {},
          readOnly: true,
        }),
      ),
    );
    expect(html).toContain("Every muscle has recovered");
    expect(html).not.toContain("Tap the map");
    expect(html).toContain("inert");
  });
});
