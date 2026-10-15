import { createElement, Fragment } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DayWorkoutSheet } from "../../../components/gym/DayWorkoutSheet";
import { DiyBuilder, type DiyDraft } from "../../../components/gym/DiyBuilder";
import { WorkoutScoreCard } from "../../../components/gym/WorkoutScoreCard";
import { EXERCISES } from "../data";
import { dictFor } from "../i18n";
import type { Program } from "../programs";
import { GymProvider } from "../store";
import type { PlannedExercise, WorkoutTemplate } from "../types";

const seed = vi.hoisted(() => ({
  templates: [] as unknown[],
  program: null as unknown,
}));

vi.mock("../store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../store")>();
  return {
    ...actual,
    useGym: () => ({
      ...actual.useGym(),
      workoutTemplates: seed.templates,
      program: seed.program,
    }),
  };
});

const ids = EXERCISES.slice(0, 3).map((e) => e.id);
const planned = (i: number, extra: Partial<PlannedExercise> = {}): PlannedExercise => ({
  exercise_id: ids[i]!,
  target_sets: 3,
  target_reps: "8-12",
  rest_seconds: 90,
  warmup_sets: 0,
  ...extra,
});
/** A superset of the first two exercises, then one loose exercise. */
const plan: PlannedExercise[] = [
  planned(0, { superset_group: 1, superset_slot: "A", rest_seconds: 0 }),
  planned(1, { superset_group: 1, superset_slot: "B", rest_seconds: 120 }),
  planned(2, { warmup_sets: 1 }),
];
const template: WorkoutTemplate = {
  id: "tpl-1",
  name: "Push day mine",
  plan,
  duration_minutes: 40,
  target_muscles: ["Chest"],
};

const text = (html: string) => html.replace(/<svg.*?<\/svg>/g, "").replace(/<!-- -->/g, "");
const render = (node: ReturnType<typeof createElement>) =>
  text(renderToString(createElement(GymProvider, null, createElement(Fragment, null, node))));

describe("DiyBuilder", () => {
  it("lists saved workouts under a New workout button at the top", () => {
    seed.templates = [template];
    const html = render(createElement(DiyBuilder, { onStarted: () => {} }));
    expect(html).toContain("New workout");
    expect(html).toContain("Saved workouts");
    expect(html).toContain("Push day mine");
    expect(html).toContain("3 exercises · ~");
    expect(html).toContain('aria-label="Start Push day mine"');
    expect(html).toContain('aria-label="Edit Push day mine"');
    expect(html.indexOf("New workout")).toBeLessThan(html.indexOf("Saved workouts"));
  });

  it("says so when nothing is saved", () => {
    seed.templates = [];
    const html = render(createElement(DiyBuilder, { onStarted: () => {} }));
    expect(html).toContain("No saved workouts yet");
  });

  it("shows the editor with a superset card, a loose card, the score and no delete for a new draft", () => {
    seed.templates = [];
    const draft: DiyDraft = { name: "Mine", plan, editingId: null, duration: 75 };
    const html = render(createElement(DiyBuilder, { initialDraft: draft, onStarted: () => {} }));
    expect(html).toContain("data-diy-editor");
    expect(html).toContain('value="Mine"');
    expect(html.match(/data-diy-superset/g)).toHaveLength(1);
    expect(html).toContain("Superset");
    expect(html).toContain("3 rounds · 120s rest per round");
    expect(html).toContain("1 warm-up · 3 × 8-12 · 90s");
    expect(html).toContain("Add exercise");
    // Add exercise is the one solid accent button; Save is tonal.
    expect(html).toMatch(/bg-primary px-5[^"]*" data-diy-add/);
    expect(html.match(/bg-primary px-5/g)).toHaveLength(1);
    expect(html).toContain("Planned length");
    expect(html).toContain('value="75"');
    expect(html).toContain("This plan takes about");
    expect(html).toContain("Workout score");
    expect(html).toContain("Muscles");
    expect(html).toContain("Unlink superset");
    // Only one loose block: nothing to pair it with.
    expect(html).not.toContain("Pair these two exercises");
    expect(html).not.toContain("Delete workout");
  });

  it("offers Superset between two loose exercises and Delete for a saved workout", () => {
    seed.templates = [template];
    const loose = plan.map(({ superset_group: _g, superset_slot: _s, ...p }) => p);
    const html = render(
      createElement(DiyBuilder, {
        initialDraft: { name: "Mine", plan: loose, editingId: "tpl-1" },
        onStarted: () => {},
      }),
    );
    expect(html.match(/Pair these two exercises as a superset/g)).toHaveLength(2);
    expect(html).not.toContain("data-diy-superset");
    expect(html).toContain("Delete workout");
  });
});

describe("WorkoutScoreCard", () => {
  it("shows the score, the comparison, the six parts and a bar per muscle", () => {
    seed.templates = [];
    const html = render(createElement(WorkoutScoreCard, { plan, minutes: 40, targetMinutes: 60 }));
    expect(html).toContain("Workout score");
    expect(html).toContain("out of 100");
    expect(html).toContain("A generated 60-minute workout scores");
    expect(html).toContain("Useful sets: yours");
    for (const part of [
      "Volume",
      "Fills your time",
      "Sets per muscle",
      "Exercise order",
      "Rep ranges",
      "Rest",
    ]) {
      expect(html).toContain(part);
    }
    expect(html).toContain("bar-fill-x");
    expect(html).toContain("of your weekly");
    expect(html).toContain('aria-label="How the score works"');
  });

  it("asks for exercises when the plan is empty", () => {
    const html = render(
      createElement(WorkoutScoreCard, { plan: [], minutes: 0, targetMinutes: 45 }),
    );
    expect(html).toContain("Add exercises to see which muscles you train");
  });
});

describe("DayWorkoutSheet saved workouts", () => {
  const program: Program = {
    id: "p",
    name: "Program",
    templateId: "upper_lower",
    schedule: [{ dow: 1, dayId: "upper" }],
    weeks: [{ type: "build", intensity: 1, volume: 1 }],
    currentWeek: 0,
    cyclePosition: 0,
    anchor: "2026-09-21",
  };
  const open = () =>
    render(
      createElement(DayWorkoutSheet, {
        open: true,
        onClose: () => {},
        kind: "program",
        slotIndex: 0,
        title: "Upper · Monday",
      }),
    );

  it("offers Use a saved workout when templates exist", () => {
    seed.program = program;
    seed.templates = [template];
    expect(open()).toContain("Use a saved workout");
  });

  it("doesn't when there are none", () => {
    seed.program = program;
    seed.templates = [];
    expect(open()).not.toContain("Use a saved workout");
  });
});

describe("DIY copy", () => {
  it("has Dutch for the tabs, the picker button and the score", () => {
    const nl = dictFor("nl");
    expect(nl.generate.tabs.diy).toBe("Zelf maken");
    expect(nl.generate.tabs.build).toBe("Generator");
    expect(nl.diy.useSaved).not.toBe(dictFor("en").diy.useSaved);
    expect(nl.workoutScore.title).not.toBe(dictFor("en").workoutScore.title);
  });
});
