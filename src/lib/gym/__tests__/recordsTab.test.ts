import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecordsTab } from "../../../components/gym/RecordsTab";
import { EXERCISES } from "../data";
import { GymProvider } from "../store";
import type { Workout } from "../types";

const id = EXERCISES[0]!.id;
const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const workout = (daysAgo: number, weight: number, reps: number): Workout =>
  ({
    id: `w${daysAgo}`,
    date: day(daysAgo),
    completed_sets: [
      { exercise_id: id, set_type: "working", weight, reps, set_number: 1 },
      { exercise_id: id, set_type: "working", weight: weight + 5, reps: 1, set_number: 2 },
    ],
  }) as unknown as Workout;

const render = (props: Parameters<typeof RecordsTab>[0]) =>
  renderToString(createElement(GymProvider, null, createElement(RecordsTab, props)));

describe("RecordsTab render", () => {
  it("renders empty, with workouts, and with a record's sheet open", () => {
    expect(() => render({ workouts: [] })).not.toThrow();
    const workouts = [workout(40, 60, 8), workout(20, 70, 6), workout(2, 80, 5)];
    expect(() => render({ workouts })).not.toThrow();
    const html = render({ workouts, openId: id });
    expect(html).toContain("Strength score");
    expect(() => render({ workouts: [workout(3, 50, 10)], openId: id })).not.toThrow();
  });
});
