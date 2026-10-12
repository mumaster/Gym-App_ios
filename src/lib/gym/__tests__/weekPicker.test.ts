import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardioWeekCard } from "../../../components/gym/CardioWeekCard";
import { TrainingLoadCard } from "../../../components/gym/TrainingLoadCard";
import { WeekPicker } from "../../../components/gym/WeekPicker";
import { WeeklySetsCard } from "../../../components/gym/WeeklyVolume";
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
    expect(() =>
      wrap(createElement(TrainingLoadCard, { weekOf: past, subtitle: "x" })),
    ).not.toThrow();
    expect(() => wrap(createElement(CardioWeekCard, { weekOf: past }))).not.toThrow();
    expect(() => wrap(createElement(WeeklySetsCard, { weekOf: past }))).not.toThrow();
  });
});
