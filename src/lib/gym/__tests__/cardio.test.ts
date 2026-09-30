import { describe, expect, it } from "vitest";
import {
  CARDIO_METS,
  SAME_DAY_GAP_HOURS,
  WHO_WEEKLY_MINUTES,
  cardioDay,
  cardioEnergyKcal,
  cardioInfo,
  cardioMet,
  guessCardioActivity,
  manualCardioWatch,
  plannedWeeklyCardioKcal,
  plannedWhoMinutes,
  remainingCardioOn,
  weekWhoMinutes,
  whoMinutes,
} from "../cardio";
import { addDayEnergy, trainingDayGoalsFromAverage, weeklyAverageCalories } from "../nutrition";
import type { CardioPlanDay, CardioSession } from "../types";

const session = (
  date: Date,
  minutes: number,
  extra: { [K in keyof CardioSession]?: CardioSession[K] | undefined } = {},
  distanceKm: number | null = null,
): CardioSession =>
  ({
    id: `${date.toISOString()}-${minutes}`,
    date: date.toISOString(),
    watch: manualCardioWatch({
      label: "x",
      start: date.toISOString().slice(0, 16),
      minutes,
      distanceKm,
      importedAt: date.toISOString(),
    }),
    activity: "cycle",
    effort: "moderate",
    manual: true,
    ...extra,
  }) as CardioSession;

describe("cardio METs (2024 Compendium)", () => {
  it("pins the Compendium values used", () => {
    expect(CARDIO_METS.cycle).toEqual({ easy: 4.3, moderate: 7.0, hard: 9.0 }); // 01015–01017
    expect(CARDIO_METS.walk).toEqual({ easy: 3.8, moderate: 4.8, hard: 5.5 }); // 17190/17200/17220
    expect(CARDIO_METS.run).toEqual({ easy: 7.5, moderate: 10.5, hard: 10.5 }); // 12020/12145
    expect(CARDIO_METS.swim).toEqual({ easy: 5.8, moderate: 8.0, hard: 9.8 });
    expect(CARDIO_METS.row.hard).toBe(7.3); // 02070
    expect(CARDIO_METS.elliptical.hard).toBe(9.0); // 02049
    expect(CARDIO_METS.intervals.hard).toBe(11.0); // 02214
  });

  it("uses speed for a run when it's known", () => {
    // 10 km/h ≈ 6.2 mph → 12050, 9.3 METs
    expect(cardioMet("run", "easy", 10)).toBe(9.3);
    // 12 km/h ≈ 7.5 mph → 12080, 11.8
    expect(cardioMet("run", "easy", 12)).toBe(11.8);
    // no speed → by effort
    expect(cardioMet("run", "easy")).toBe(7.5);
    // speed only matters for running
    expect(cardioMet("cycle", "easy", 25)).toBe(4.3);
  });
});

describe("WHO minutes", () => {
  it("counts vigorous double, moderate once, light not at all", () => {
    expect(WHO_WEEKLY_MINUTES).toBe(150);
    expect(whoMinutes(7, 30)).toBe(60);
    expect(whoMinutes(6, 30)).toBe(60);
    expect(whoMinutes(4.3, 30)).toBe(30);
    expect(whoMinutes(3, 30)).toBe(30);
    expect(whoMinutes(2.9, 30)).toBe(0);
  });

  it("adds up this week's sessions, Monday to Sunday", () => {
    const wed = new Date(2026, 8, 30, 18); // Wed 30 Sep 2026
    const sessions = [
      session(new Date(2026, 8, 28, 7), 30), // Mon, cycle moderate 7.0 → 60
      session(new Date(2026, 8, 29, 7), 40, { activity: "walk", effort: "easy" }), // 3.8 → 40
      session(new Date(2026, 8, 27, 7), 60), // last Sunday: not this week
      session(new Date(2026, 8, 30, 7), 20, { activity: undefined }), // no activity: not counted
    ];
    expect(weekWhoMinutes(sessions, wed)).toBe(100);
  });

  it("totals a plan", () => {
    const plan: CardioPlanDay[] = [
      { id: "a", dow: 2, activity: "run", minutes: 30, effort: "easy" }, // 7.5 → 60
      { id: "b", dow: 6, activity: "walk", minutes: 45, effort: "moderate" }, // 4.8 → 45
    ];
    expect(plannedWhoMinutes(plan)).toBe(105);
  });
});

describe("cardio session info and energy", () => {
  it("needs activity, effort and a duration", () => {
    const d = new Date(2026, 8, 30, 7);
    expect(cardioInfo(session(d, 30))).toMatchObject({ minutes: 30, met: 7.0 });
    expect(cardioInfo(session(d, 30, { effort: undefined }))).toBeNull();
  });

  it("uses the run's speed from its distance", () => {
    const run = session(new Date(2026, 8, 30, 7), 30, { activity: "run", effort: "easy" }, 5);
    expect(run.watch.avgPaceSeconds).toBe(360);
    expect(cardioInfo(run)?.met).toBe(9.3); // 10 km/h
  });

  it("is the net-MET energy, like the strength session estimate", () => {
    // (7.0 − 1) × 80 kg × 0.5 h
    expect(cardioEnergyKcal(80, { minutes: 30, met: 7 })).toBe(240);
  });
});

describe("planned cardio still to do", () => {
  const plan: CardioPlanDay[] = [{ id: "a", dow: 3, activity: "run", minutes: 30, effort: "easy" }];
  const wed = new Date(2026, 8, 30, 12);
  it("is there on a planned day until something's logged", () => {
    expect(remainingCardioOn(plan, [], wed, wed)).toHaveLength(1);
    const rode = session(new Date(2026, 8, 30, 7), 30);
    expect(remainingCardioOn(plan, [rode], wed, wed)).toHaveLength(0);
  });
  it("is never there on a past day", () => {
    expect(remainingCardioOn(plan, [], new Date(2026, 8, 23), wed)).toHaveLength(0);
  });
});

describe("guessing the activity from a watch's name", () => {
  it("reads Dutch and English names", () => {
    expect(guessCardioActivity("Buiten hardlopen")).toBe("run");
    expect(guessCardioActivity("Outdoor run")).toBe("run");
    expect(guessCardioActivity("Buiten wandelen")).toBe("walk");
    expect(guessCardioActivity("Buiten fietsen")).toBe("cycle");
    expect(guessCardioActivity("Zwembad zwemmen")).toBe("swim");
    expect(guessCardioActivity("Roeimachine")).toBe("row");
    expect(guessCardioActivity("Crosstrainer")).toBe("elliptical");
    expect(guessCardioActivity("HIIT")).toBe("intervals");
    expect(guessCardioActivity("Kracht")).toBeNull();
    expect(guessCardioActivity(null)).toBeNull();
  });
});

it("advises a gap of 3+ hours on a shared day (Schumann et al. 2022)", () => {
  expect(SAME_DAY_GAP_HOURS).toBe(3);
});

describe("cardio in the nutrition limits", () => {
  it("adds a day's cardio energy, all from carbs", () => {
    expect(addDayEnergy({ calories: 2200, carbs: 250, protein: 180 }, 240)).toEqual({
      calories: 2440,
      carbs: 310,
      protein: 180,
    });
    expect(addDayEnergy({ protein: 180 }, 240)).toEqual({ protein: 180 });
  });

  it("keeps the weekly average on target with cardio planned", () => {
    const avg = { calories: 2500, carbs: 300 };
    const S = 300; // strength session
    const C = 600; // the week's planned cardio
    const T = trainingDayGoalsFromAverage(avg, 4, S, C);
    expect(T.calories).toBe(2543); // 2500 + (300·3 − 600)/7
    expect(weeklyAverageCalories(T, {}, 4, S, C)).toBe(2500);
    // Without cardio it's the old formula.
    expect(trainingDayGoalsFromAverage(avg, 4, S).calories).toBe(2629);
  });

  it("counts logged cardio on past days and the plan from today on", () => {
    const wed = new Date(2026, 8, 30, 12);
    const plan: CardioPlanDay[] = [
      { id: "a", dow: 3, activity: "cycle", minutes: 30, effort: "moderate" }, // Wed
      { id: "b", dow: 2, activity: "cycle", minutes: 30, effort: "moderate" }, // Tue (past)
    ];
    // (7.0 − 1) × 80 × 0.5 = 240
    expect(cardioDay(wed, plan, [], 80, wed)).toEqual({ any: true, kcal: 240 });
    // A past planned day with nothing logged isn't a cardio day.
    expect(cardioDay(new Date(2026, 8, 29), plan, [], 80, wed)).toEqual({ any: false, kcal: 0 });
    // Logged today replaces the plan rather than adding to it.
    const rode = session(new Date(2026, 8, 30, 7), 30);
    expect(cardioDay(wed, plan, [rode], 80, wed)).toEqual({ any: true, kcal: 240 });
    // No bodyweight: still a cardio day, no energy estimate.
    expect(cardioDay(wed, plan, [], null, wed)).toEqual({ any: true, kcal: 0 });
    expect(plannedWeeklyCardioKcal(plan, 80)).toBe(480);
  });
});
