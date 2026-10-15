import { createElement, Fragment } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProgramBuilderSheet } from "../../../components/gym/ProgramBuilderSheet";
import { WeeklyPlanSheet } from "../../../components/gym/WeeklyPlanSheet";
import type { Program } from "../programs";
import { DEFAULT_CARDIO_DAY, type ScheduleSlot, type WeeklyScheme } from "../splits";
import { GymProvider } from "../store";

// Both sheets open on their manage view only after an effect, which a server
// render never runs, and their state comes from the saved plan. So the test
// seeds `useGym` with a plan and starts the sheets' `useState`s where the
// effect would leave them: mode "manage" and (once armed, for the first
// `useState(null)` after it, which is the slot being edited) slot 0.
const seed = vi.hoisted(() => ({
  program: null as unknown,
  weeklyScheme: null as unknown,
  armed: false,
  editSlot: null as number | null,
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
    useState: (init: unknown) => {
      if (init === "template") return actual.useState("manage");
      if (seed.armed && seed.editSlot !== null && init === null) {
        seed.armed = false;
        return actual.useState(seed.editSlot);
      }
      return actual.useState(init);
    },
  };
});

const schedule: ScheduleSlot[] = [
  { dow: 1, dayId: "upper" },
  { dow: 3, dayId: "cardio", cardio: { activity: "swim", effort: "hard", minutes: 45 } },
  { dow: 5, dayId: "push" },
];
const program: Program = {
  id: "p",
  name: "Program",
  templateId: "upper_lower",
  schedule,
  weeks: [{ type: "build", intensity: 1, volume: 1 }],
  currentWeek: 0,
  cyclePosition: 1,
  anchor: "2026-09-21",
};
const scheme: WeeklyScheme = {
  templateId: "upper_lower",
  schedule,
  cyclePosition: 1,
  anchor: "2026-09-21",
};

const Arm = () => {
  seed.armed = true;
  return null;
};
const render = (
  sheet: typeof ProgramBuilderSheet | typeof WeeklyPlanSheet,
  editSlot: number | null,
) => {
  seed.editSlot = editSlot;
  seed.armed = false;
  return renderToString(
    createElement(
      GymProvider,
      null,
      createElement(
        Fragment,
        null,
        createElement(Arm),
        createElement(sheet, { open: true, onClose: () => {} }),
      ),
    ),
  );
};
const text = (html: string) => html.replace(/<svg.*?<\/svg>/g, "").replace(/<!-- -->/g, "");

describe.each([
  ["ProgramBuilderSheet", ProgramBuilderSheet, "program"],
  ["WeeklyPlanSheet", WeeklyPlanSheet, "weeklyScheme"],
] as const)("%s manage view", (_name, sheet, key) => {
  const set = () => {
    seed.program = key === "program" ? program : null;
    seed.weeklyScheme = key === "weeklyScheme" ? scheme : null;
  };

  it("names a cardio day and a day outside the split, with the cardio planned", () => {
    set();
    const html = text(render(sheet, null));
    expect(html).toContain("Upper Body");
    expect(html).toContain("Cardio");
    expect(html).toContain("Push");
    expect(html).toContain("Wed, Sep 23 · Swim · Hard · 45 min");
    // The editor is closed: no cardio controls yet.
    expect(html).not.toContain("Cardio on this day");
  });

  it("opens a slot to every day type, with the cardio plan to change on a cardio day", () => {
    set();
    const html = text(render(sheet, 1));
    expect(html).toContain("Other day types");
    expect(html).toContain("Cardio on this day");
    expect(html).toMatch(/aria-pressed="true"[^>]*> ?Swim</);
  });

  it("renders a full-body plan's slot editor, which used to be empty", () => {
    seed.program = key === "program" ? { ...program, templateId: "full_body" } : null;
    seed.weeklyScheme = key === "weeklyScheme" ? { ...scheme, templateId: "full_body" } : null;
    const html = text(render(sheet, 0));
    expect(html).toContain("Other day types");
    expect(html).not.toContain("Cardio on this day");
  });

  it("falls back to the default plan for a cardio slot saved without one", () => {
    const bare: ScheduleSlot[] = [{ dow: 2, dayId: "cardio" }];
    seed.program = key === "program" ? { ...program, schedule: bare, cyclePosition: 0 } : null;
    seed.weeklyScheme =
      key === "weeklyScheme" ? { ...scheme, schedule: bare, cyclePosition: 0 } : null;
    const { activity, effort, minutes } = DEFAULT_CARDIO_DAY;
    expect(activity).toBe("run");
    expect(text(render(sheet, null))).toContain(`Tue, Sep 22 · Run · Moderate · ${minutes} min`);
    expect(effort).toBe("moderate");
  });
});
