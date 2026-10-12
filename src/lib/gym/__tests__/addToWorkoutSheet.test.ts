import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddToWorkoutSheet } from "../../../components/gym/AddToWorkoutSheet";
import { EXERCISES } from "../data";
import { GymProvider } from "../store";

const render = (props: Partial<Parameters<typeof AddToWorkoutSheet>[0]>) =>
  renderToString(
    createElement(
      GymProvider,
      null,
      createElement(AddToWorkoutSheet, {
        open: true,
        onClose: () => {},
        options: EXERCISES.slice(0, 8),
        targetMuscles: ["Chest"],
        onAuto: () => {},
        onPick: () => {},
        onCardio: () => {},
        ...props,
      }),
    ),
  );

describe("AddToWorkoutSheet render", () => {
  it("renders closed, open, and with nothing left to add", () => {
    expect(() => render({ open: false })).not.toThrow();
    expect(render({})).toContain("Add to your workout");
    expect(() => render({ options: [] })).not.toThrow();
  });
});
