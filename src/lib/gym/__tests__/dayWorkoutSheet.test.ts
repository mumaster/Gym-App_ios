import { createElement, Fragment } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DayWorkoutSheet } from "../../../components/gym/DayWorkoutSheet";
import { RotationWeekStrip } from "../../../components/gym/RotationWeekStrip";
import { ProgramBuilderSheet } from "../../../components/gym/ProgramBuilderSheet";
import { WeeklyPlanSheet } from "../../../components/gym/WeeklyPlanSheet";
import { EXERCISES } from "../data";
import { DELOAD_WEEK, type Program } from "../programs";
import type { ScheduleSlot, WeeklyScheme } from "../splits";
import { GymProvider } from "../store";
import type { DayWorkout } from "../types";

// Same approach as planSheetsManage.test.ts: the manage views open after an
// effect, so `useGym` is seeded with a plan and `useState` starts in "manage".
const seed = vi.hoisted(() => ({
  program: null as unknown,
  weeklyScheme: null as unknown,
}));

vi.mock("../store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../store")>();
  return {
    ...actual,
    useGym: () => ({ ...actual.useGym(), program: seed.program, weeklyScheme: seed.weeklyScheme }),
  };
});

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (init: unknown) => actual.useState(init === "template" ? "manage" : init),
  };
});

const ids = EXERCISES.slice(0, 6).map((e) => e.id);
const workoutOf = (sets: number): DayWorkout => ({
  plan: ids.map((exercise_id) => ({
    exercise_id,
    target_sets: sets,
    target_reps: "8",
    rest_seconds: 90,
    warmup_sets: 0,
  })),
  duration_minutes: 45,
  target_muscles: ["Chest"],
  saved_at: "2026-09-21T09:00:00.000Z",
});

const weeks = [{ type: "build", intensity: 1, volume: 1 }, DELOAD_WEEK] satisfies Program["weeks"];
const withWorkouts = (pre: boolean): ScheduleSlot[] => [
  {
    dow: 1,
    dayId: "upper",
    workout: workoutOf(4),
    ...(pre ? { weekWorkouts: [workoutOf(4), workoutOf(2)] } : {}),
  },
  { dow: 3, dayId: "cardio", cardio: { activity: "swim", effort: "hard", minutes: 45 } },
  {
    dow: 5,
    dayId: "lower",
    ...(pre ? { workout: workoutOf(4) } : {}),
    ...(pre ? { weekWorkouts: [workoutOf(4), workoutOf(2)] } : {}),
  },
];
const programOf = (schedule: ScheduleSlot[]): Program => ({
  id: "p",
  name: "Program",
  templateId: "upper_lower",
  schedule,
  weeks,
  currentWeek: 0,
  cyclePosition: 0,
  anchor: "2026-09-21",
});

const text = (html: string) => html.replace(/<svg.*?<\/svg>/g, "").replace(/<!-- -->/g, "");
const render = (node: ReturnType<typeof createElement>) =>
  text(renderToString(createElement(GymProvider, null, createElement(Fragment, null, node))));

describe("day workouts in the manage views", () => {
  it("shows the saved line, the buttons and the create-all button in a program", () => {
    seed.program = programOf(withWorkouts(false));
    seed.weeklyScheme = null;
    const html = render(createElement(ProgramBuilderSheet, { open: true, onClose: () => {} }));
    expect(html).toContain("Saved workout · 6 exercises · 45 min");
    expect(html).toContain("Edit workout");
    // The lower day has no workout, the cardio day has no workout line at all.
    expect(html).toContain("Generated on the day");
    expect(html).toContain("Create workout");
    expect(html).toContain("Create workouts for every day");
    expect(html).toContain("Whole program");
    expect(html).toContain("Pre-generate all 4 workouts");
    expect(html).toContain("Supersets");
    expect(html).toContain("Warm-up sets");
    expect(html).toContain("Same exercises every week");
    expect(html).toContain("Changing a switch remakes the saved workouts.");
  });

  it("shows week chips and the pre-generated actions once the program is pre-generated", () => {
    seed.program = programOf(withWorkouts(true));
    seed.weeklyScheme = null;
    const html = render(createElement(ProgramBuilderSheet, { open: true, onClose: () => {} }));
    expect(html).toContain("Week 2");
    expect(html).toContain("Clear pre-generated weeks");
    expect(html).toContain("Regenerate all workouts");
    expect(html).not.toContain("Pre-generate all");
    expect(html).not.toContain("Create workouts for every day");
  });

  it("shows the saved line in the weekly plan", () => {
    seed.program = null;
    const schedule = withWorkouts(false);
    seed.weeklyScheme = {
      templateId: "upper_lower",
      schedule,
      cyclePosition: 0,
      anchor: "2026-09-21",
    } satisfies WeeklyScheme;
    const html = render(createElement(WeeklyPlanSheet, { open: true, onClose: () => {} }));
    expect(html).toContain("Saved workout · 6 exercises · 45 min");
    expect(html).toContain("Create workouts for every day");
    expect(html).toContain("Warm-up sets");
    expect(html).not.toContain("Same exercises every week");
  });
});

describe("DayWorkoutSheet", () => {
  const open = (props: Partial<Parameters<typeof DayWorkoutSheet>[0]> = {}) =>
    render(
      createElement(DayWorkoutSheet, {
        open: true,
        onClose: () => {},
        kind: "program",
        slotIndex: 0,
        title: "Upper · Monday",
        ...props,
      }),
    );

  it("lists the saved workout with its length, sets and a remove button", () => {
    seed.program = programOf(withWorkouts(false));
    const html = open();
    expect(html).toContain("Upper · Monday");
    expect(html).toContain("45 min");
    expect(html).toContain("90 min");
    expect(html).toContain("4 × 8");
    expect(html).toContain("6 exercises");
    expect(html).toContain("Save workout");
    expect(html).toContain("Shuffle");
    expect(html).toContain("Remove saved workout");
  });

  it("generates a draft when nothing is saved, with no remove button", () => {
    seed.program = programOf(withWorkouts(false));
    const html = open({ slotIndex: 2 });
    expect(html).toContain("Save workout");
    expect(html).not.toContain("Remove saved workout");
    expect(html).toMatch(/\d+ × /);
  });

  it("shows a deload week's own sets", () => {
    seed.program = programOf(withWorkouts(true));
    const html = open({ week: 1 });
    expect(html).toContain("2 × 8");
    expect(html).toContain("Week 2");
  });

  it("shows warm-ups and a superset as one card with A and B", () => {
    const w = workoutOf(3);
    w.plan = w.plan.map((p, i) => ({
      ...p,
      warmup_sets: i === 0 ? 2 : 0,
      ...(i < 2 ? { superset_group: 1, superset_slot: i ? ("B" as const) : ("A" as const) } : {}),
    }));
    seed.program = programOf([{ dow: 1, dayId: "upper", workout: w }]);
    const html = open();
    expect(html).toContain("2 warm-up · 3 × 8");
    expect(html).toContain("Superset");
    expect(html).toContain("3 rounds · 90s rest per round");
    expect(html.match(/data-day-superset/g)).toHaveLength(1);
  });
});

describe("week strip days", () => {
  it("are buttons when there's something to open", () => {
    const rotation = programOf(withWorkouts(false));
    const html = render(
      createElement(RotationWeekStrip, {
        rotation,
        templateId: "upper_lower",
        onDay: (i: number) => (i === 1 ? null : () => {}),
      }),
    );
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain("Open Upper");
  });
});
