import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardioWeekCard } from "../../../components/gym/CardioWeekCard";
import { TrainingLoadCard } from "../../../components/gym/TrainingLoadCard";
import { WeekPicker } from "../../../components/gym/WeekPicker";
import { GrowthFocusCard, WeeklySetsCard } from "../../../components/gym/WeeklyVolume";
import { addDays } from "../date";
import { mondayOf } from "../schedule";
import { GymProvider } from "../store";

const wrap = (el: ReturnType<typeof createElement>) =>
  renderToString(createElement(GymProvider, null, el));

describe("Activity week picker", () => {
  const thisMonday = mondayOf(new Date());
  const noop = () => {};

  it("renders the current and a past week, with and without data", () => {
    const past = addDays(thisMonday, -14);
    for (const m of [thisMonday, addDays(thisMonday, -7), past]) {
      const html = wrap(
        createElement(WeekPicker, {
          monday: m,
          canPrev: true,
          canNext: m < thisMonday,
          onPrev: noop,
          onNext: noop,
        }),
      );
      expect(html).toContain("Previous week");
    }
  });

  it("disables next on the current week", () => {
    const html = wrap(
      createElement(WeekPicker, {
        monday: thisMonday,
        canPrev: false,
        canNext: false,
        onPrev: noop,
        onNext: noop,
      }),
    );
    expect(html.match(/disabled=""/g)?.length).toBe(2);
  });

  it("renders the week cards for a past week without crashing", () => {
    const past = addDays(thisMonday, -21);
    expect(() => wrap(createElement(TrainingLoadCard, { weekOf: past }))).not.toThrow();
    expect(() => wrap(createElement(CardioWeekCard, { weekOf: past }))).not.toThrow();
    expect(() => wrap(createElement(WeeklySetsCard, { weekOf: past }))).not.toThrow();
  });

  it("shows the muscles to grow read-only, with no buttons", () => {
    const html = wrap(createElement(GrowthFocusCard));
    expect(html).not.toContain("<button");
  });
});

describe("dailyLoads", () => {
  it("sums rated load per day and ignores other days", async () => {
    const { dailyLoads } = await import("../trainingLoad");
    const mon = mondayOf(new Date("2026-10-07T12:00:00"));
    const at = (n: number) => addDays(mon, n).toISOString();
    const days = dailyLoads(
      [
        { date: at(0), minutes: 60, rpe: 7 },
        { date: at(0), minutes: 30, rpe: 5 },
        { date: at(2), minutes: 40, rpe: null },
        { date: at(9), minutes: 60, rpe: 8 },
      ],
      mon,
      7,
    );
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ load: 570, sessions: 2, rated: 2 });
    expect(days[2]).toMatchObject({ load: 0, sessions: 1, rated: 0 });
    expect(days.reduce((n, d) => n + d.load, 0)).toBe(570);
  });
});
