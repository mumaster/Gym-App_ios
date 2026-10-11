import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardioDayBlock } from "../../../components/gym/CardioDayBlock";
import { DayTypePicker } from "../../../components/gym/DayTypePicker";
import { ProgramBuilderSheet } from "../../../components/gym/ProgramBuilderSheet";
import { WeeklyPlanSheet } from "../../../components/gym/WeeklyPlanSheet";
import { DAY_TYPES } from "../splits";
import { GymProvider } from "../store";

const render = (node: ReturnType<typeof createElement>) =>
  renderToString(createElement(GymProvider, null, node));

const picker = (props: Partial<Parameters<typeof DayTypePicker>[0]>) =>
  render(
    createElement(DayTypePicker, {
      templateId: "upper_lower",
      value: "upper",
      onChange: () => {},
      ...props,
    }),
  );

/** The page as text per button: icons and React's text separators dropped. */
const plain = (html: string) => html.replace(/<svg.*?<\/svg>/g, "").replace(/<!-- -->/g, "");
const buttons = (html: string, attr: 'role="radio"' | "aria-pressed") =>
  [...plain(html).matchAll(/<button([^>]*)>(.*?)<\/button>/g)]
    .filter((m) => m[1]!.includes(attr))
    .map((m) => ({ on: /aria-(checked|pressed)="true"/.test(m[1]!), label: m[2]!.trim() }));
const radios = (html: string) => buttons(html, 'role="radio"').map((b) => b.label);
const pressed = (html: string) =>
  buttons(html, 'role="radio"')
    .filter((b) => b.on)
    .map((b) => b.label);
/** The picked buttons of the cardio plan controls (activity, effort, minutes). */
const picked = (html: string) =>
  buttons(html, "aria-pressed")
    .filter((b) => b.on)
    .map((b) => b.label);

describe("DayTypePicker render", () => {
  it("offers every day type for a split, the split's own first", () => {
    const html = picker({});
    expect(radios(html)).toEqual([
      "Upper Body",
      "Lower Body",
      ...DAY_TYPES.filter((d) => d.id !== "upper" && d.id !== "lower").map((d) => d.label),
    ]);
    expect(pressed(html)).toEqual(["Upper Body"]);
    expect(html).toContain("Other day types");
  });

  it("renders for Full Body too, which used to show nothing", () => {
    const html = picker({ templateId: "full_body", value: "full" });
    expect(radios(html)).toHaveLength(DAY_TYPES.length);
    expect(pressed(html)).toEqual(["Full Body"]);
  });

  it("marks a day outside the split as the picked one", () => {
    expect(pressed(picker({ value: "push" }))).toEqual(["Push"]);
    expect(pressed(picker({ value: "cardio" }))).toEqual(["Cardio"]);
  });

  it("keeps the split's own label for the hybrid split", () => {
    const html = picker({ templateId: "hybrid", value: "upper" });
    expect(pressed(html)).toEqual(["Upper + Cardio"]);
  });

  it("shows the cardio plan to change for a cardio day, and only there", () => {
    const cardio = { activity: "swim" as const, effort: "hard" as const, minutes: 45 };
    const html = picker({ value: "cardio", cardio, onCardioChange: () => {} });
    expect(html).toContain("Cardio on this day");
    expect(picked(html)).toEqual(["Swim", "Hard", "45"]);
    // Without a handler (the builder's per-day picks) or on another day: none.
    expect(picker({ value: "cardio" })).not.toContain("Cardio on this day");
    expect(picker({ value: "push", onCardioChange: () => {} })).not.toContain("Cardio on this day");
  });

  it("falls back to the default plan for a cardio day without one", () => {
    const html = picker({ value: "cardio", onCardioChange: () => {} });
    expect(picked(html)).toEqual(["Run", "Moderate", "30"]);
  });
});

describe("CardioDayBlock render", () => {
  it("says what is planned on one line and offers to log it", () => {
    const html = render(
      createElement(CardioDayBlock, {
        plan: { activity: "run", effort: "moderate", minutes: 30 },
        onLog: () => {},
      }),
    );
    expect(html).toContain("Run · Moderate · 30 min");
    expect(html).toContain("Log cardio");
  });
});

describe("plan sheets render", () => {
  it("renders open and closed without crashing", () => {
    const props = { open: true, onClose: () => {} };
    expect(() => render(createElement(ProgramBuilderSheet, props))).not.toThrow();
    expect(() => render(createElement(WeeklyPlanSheet, props))).not.toThrow();
    expect(() =>
      render(createElement(ProgramBuilderSheet, { ...props, open: false })),
    ).not.toThrow();
  });
});
