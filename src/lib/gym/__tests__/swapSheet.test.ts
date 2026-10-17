import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SwapSheet } from "../../../components/gym/SwapSheet";
import { GymProvider } from "../store";

const render = (props: Partial<Parameters<typeof SwapSheet>[0]>) =>
  renderToString(
    createElement(
      GymProvider,
      null,
      createElement(SwapSheet, {
        exerciseId: "bb-bench",
        onClose: () => {},
        onPick: () => {},
        ...props,
      }),
    ),
  );

// A swap sheet that read a const before it was declared crashed the whole
// session screen when it rendered (reported on the live app).
describe("SwapSheet render", () => {
  it("renders closed and open, with and without a superset partner", () => {
    expect(() => render({ exerciseId: null })).not.toThrow();
    expect(() => render({ inWorkoutIds: ["bb-bench", "db-bench"] })).not.toThrow();
    expect(() =>
      render({ partnerExerciseId: "bb-row", inWorkoutIds: ["bb-bench", "bb-row", "pullup"] }),
    ).not.toThrow();
  });

  it("renders for a push day without offering rows", () => {
    const html = render({
      exerciseId: "ohp",
      dayId: "push",
      dayMuscles: ["Chest", "Shoulders", "Arms"],
    });
    expect(html).toContain("Lateral Raise");
    expect(html).not.toContain("Face Pull");
    expect(html).not.toContain("Rear Delt");
    expect(() =>
      render({ exerciseId: "face-pull", dayMuscles: ["Chest", "Shoulders"] }),
    ).not.toThrow();
  });
});
