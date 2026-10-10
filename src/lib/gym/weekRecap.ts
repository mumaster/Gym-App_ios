import { cardioInfo, whoMinutes, WHO_WEEKLY_MINUTES } from "./cardio";
import { addDays, dayKey, dayKeyFromDate } from "./date";
import { drinkOf, standardGlasses } from "./alcohol";
import {
  caffeineMg,
  COFFEE_KINDS,
  type CoffeeKind,
  dailyTotals,
  entriesForDay,
  type CoffeeEntry,
  type FoodEntry,
  type Macros,
  type WaterEntry,
} from "./nutrition";
import { buildRecap } from "./recap";
import { mondayOf, parseDayKey } from "./schedule";
import { sessionLoad, sessionMinutes } from "./trainingLoad";
import type { WeightEntry } from "./bodyweight";
import type { CardioSession, Workout } from "./types";
import { cardioMinutes } from "./watch";

/**
 * Everything a Monday–Sunday week adds up to, as plain data. The recap screen
 * (routes/history.week.$weekStart.tsx) only draws it, so a new figure is added
 * here and then shown, and a later feature (a comparison with last week, a
 * share image) can read the same object.
 *
 * Week boundaries are `mondayOf`, the same as History's week cards and the
 * streak. A week still in progress is summarised up to today: `daysElapsed`
 * says how many of its seven days have started, and every average is per day
 * that was logged or has passed, never per seven.
 */
export interface WeekRecapInput {
  workouts: Workout[];
  cardioSessions: CardioSession[];
  foodEntries: FoodEntry[];
  waterEntries: WaterEntry[];
  coffeeEntries: CoffeeEntry[];
  weightLog: WeightEntry[];
  /** The daily calorie limit that applies to a date, if the user set one. */
  calorieGoalFor?: (date: Date) => number | undefined;
  /** Daily water target in ml. */
  waterGoalMl?: number | null;
}

export interface WeekRecapDay {
  key: string;
  date: Date;
  /** Today. */
  today: boolean;
  /** Hasn't started yet (a day later this week). */
  future: boolean;
  workouts: number;
  cardio: number;
  calories: number;
  /** Any food was logged that day. */
  logged: boolean;
  calorieGoal: number | undefined;
  waterMl: number;
  /** Cups of coffee, in total and per kind. */
  coffeeCups: number;
  coffeeByKind: Record<CoffeeKind, number>;
  /** Alcoholic drinks logged that day (servings, not glasses). */
  beers: number;
  wines: number;
  /** Standard glasses of alcohol that day. */
  glasses: number;
}

/** A day that stands out, for the fun facts: its key and the figure. */
export interface WeekRecapPeak {
  key: string;
  value: number;
}

export interface WeekRecap {
  weekStart: Date;
  /** The Monday's day key — what the route carries. */
  weekKey: string;
  weekEnd: Date;
  inProgress: boolean;
  /** Days of the week that have started (1–7; 7 for a finished week). */
  daysElapsed: number;
  days: WeekRecapDay[];
  /** Anything at all happened this week. */
  hasData: boolean;
  training: {
    sessions: number;
    /** Distinct days with a strength session. */
    days: number;
    minutes: number;
    workingSets: number;
    volumeKg: number;
    prs: number;
    /** Sum of session RPE × minutes (trainingLoad.ts); null with nothing rated. */
    load: number | null;
    /** The session with the most volume, and the longest; null with under two
     *  sessions, since a single one is trivially both. */
    heaviest: WeekRecapPeak | null;
    longest: WeekRecapPeak | null;
  };
  cardio: {
    sessions: number;
    minutes: number;
    distanceKm: number;
    /** Moderate-equivalent minutes against the WHO's weekly 150. */
    whoMinutes: number;
    whoTarget: number;
    /** The longest session (minutes); null with under two. */
    longest: WeekRecapPeak | null;
  };
  nutrition: {
    /** Days with food logged. */
    loggedDays: number;
    totals: Macros;
    /** Per counted day (see `countedDays`); null with no such day. */
    average: Macros | null;
    /** Days the averages are over: logged days that are over, or today alone
     *  while it's the only one. */
    countedDays: number;
    /** Average of those same days' calorie limits; null when any lacks one. */
    calorieGoal: number | null;
    /** Days within their calorie limit. */
    daysWithinGoal: number;
    entries: number;
    /** The day with the most calories among days that have started; null with
     *  under two logged days. */
    highest: WeekRecapPeak | null;
  };
  water: {
    totalMl: number;
    /** Per day with water logged. */
    averageMl: number | null;
    daysLogged: number;
    goalMl: number | null;
    daysOnGoal: number;
    /** The day with the most water; null with under two days logged. */
    busiest: WeekRecapPeak | null;
  };
  coffee: {
    cups: number;
    caffeineMg: number;
    averageMg: number | null;
    daysLogged: number;
    byKind: Record<CoffeeKind, number>;
    /** The most-drunk kind; null when there's no single favourite. */
    favourite: CoffeeKind | null;
    busiest: WeekRecapPeak | null;
  };
  alcohol: {
    glasses: number;
    beers: number;
    wines: number;
    busiest: WeekRecapPeak | null;
  };
  weight: { first: number; last: number; change: number; weighIns: number } | null;
}

const EMPTY_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 };

/** The Monday-first week containing `date`, as its route key. */
export const weekKeyOf = (date: Date): string => dayKeyFromDate(mondayOf(date));

/** Week key → Monday as a local Date; null for a malformed or non-Monday key. */
export function parseWeekKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = parseDayKey(key);
  return Number.isNaN(d.getTime()) || weekKeyOf(d) !== key ? null : d;
}

/** The day with the highest value (first on a tie); null unless at least two
 *  days have one, since a single day is trivially the peak. */
function peak(days: WeekRecapDay[], value: (d: WeekRecapDay) => number): WeekRecapPeak | null {
  const withValue = days.filter((d) => value(d) > 0);
  if (withValue.length < 2) return null;
  const top = withValue.reduce((a, b) => (value(b) > value(a) ? b : a));
  return { key: top.key, value: value(top) };
}

const emptyKinds = (): Record<CoffeeKind, number> =>
  Object.fromEntries(COFFEE_KINDS.map((k) => [k, 0])) as Record<CoffeeKind, number>;

const avg = (sum: number, n: number, digits = 0): number => {
  const f = 10 ** digits;
  return Math.round((sum / n) * f) / f;
};

export function buildWeekRecap(
  input: WeekRecapInput,
  weekStart: Date,
  now = new Date(),
): WeekRecap {
  const monday = mondayOf(weekStart);
  const mondayKey = dayKeyFromDate(monday);
  const todayKey = dayKeyFromDate(now);
  const weekKeys = Array.from({ length: 7 }, (_, i) => dayKeyFromDate(addDays(monday, i)));
  const inWeek = (iso: string) => {
    const k = dayKey(iso);
    return k >= weekKeys[0]! && k <= weekKeys[6]!;
  };

  const workouts = input.workouts.filter((w) => inWeek(w.date));
  const cardio = input.cardioSessions.filter((c) => inWeek(c.date));
  const food = input.foodEntries.filter((e) => inWeek(e.logged_at));
  const water = input.waterEntries.filter((e) => inWeek(e.logged_at));
  const coffee = input.coffeeEntries.filter((e) => inWeek(e.logged_at));
  const weighIns = input.weightLog
    .filter((e) => inWeek(e.date))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  const days: WeekRecapDay[] = weekKeys.map((key, i) => {
    const date = addDays(monday, i);
    const dayFood = entriesForDay(food, key);
    const dayCoffee = entriesForDay(coffee, key);
    const byKind = emptyKinds();
    for (const c of dayCoffee) byKind[c.kind] += 1;
    const dayDrinks = dayFood.filter((e) => drinkOf(e));
    return {
      key,
      date,
      today: key === todayKey,
      future: key > todayKey,
      workouts: workouts.filter((w) => dayKey(w.date) === key).length,
      cardio: cardio.filter((c) => dayKey(c.date) === key).length,
      calories: dailyTotals(dayFood).calories,
      logged: dayFood.length > 0,
      calorieGoal: input.calorieGoalFor?.(date),
      waterMl: entriesForDay(water, key).reduce((s, e) => s + e.ml, 0),
      coffeeCups: dayCoffee.length,
      coffeeByKind: byKind,
      beers: dayDrinks.filter((e) => drinkOf(e)?.category === "beer").length,
      wines: dayDrinks.filter((e) => drinkOf(e)?.category === "wine").length,
      glasses: Math.round(standardGlasses(dayDrinks) * 10) / 10,
    };
  });

  const inProgress = todayKey >= weekKeys[0]! && todayKey <= weekKeys[6]!;
  const daysElapsed = inProgress ? days.findIndex((d) => d.today) + 1 : 7;

  // Strength
  const trainingDays = new Set(workouts.map((w) => dayKey(w.date)));
  const recaps = workouts.map((w) => buildRecap(w, input.workouts));
  const loads = workouts.map(sessionLoad).filter((l): l is number => l != null);
  const rated = [...cardio.filter((c) => c.session_rpe != null)];
  const cardioLoads = rated
    .map((c) => (c.session_rpe ?? 0) * (cardioMinutes(c) ?? 0))
    .filter((l) => l > 0);
  const allLoads = [...loads, ...cardioLoads];

  // Cardio
  let who = 0;
  for (const c of cardio) {
    const info = cardioInfo(c);
    if (info) who += whoMinutes(info.met, info.minutes);
  }

  // Food. A day that is still going would drag the average down, so today is
  // left out unless it's the only day logged (weeklyAverage in nutrition.ts
  // makes the same call).
  const loggedDays = days.filter((d) => d.logged);
  const finishedLogged = loggedDays.filter((d) => d.key < todayKey);
  const counted = finishedLogged.length ? finishedLogged : loggedDays.filter((d) => !d.future);
  const countedFood = food.filter((e) => counted.some((d) => d.key === dayKey(e.logged_at)));
  const countedTotals = dailyTotals(countedFood);
  const withGoal = counted.filter((d) => d.calorieGoal != null);

  // Water and coffee
  const waterDays = days.filter((d) => d.waterMl > 0);
  const waterGoal = input.waterGoalMl ?? null;
  const coffeeDays = new Set(coffee.map((c) => dayKey(c.logged_at)));
  const mg = caffeineMg(coffee);
  const kinds = emptyKinds();
  for (const c of coffee) kinds[c.kind] += 1;
  const topKind = COFFEE_KINDS.reduce((a, b) => (kinds[b] > kinds[a] ? b : a));
  const favourite =
    coffee.length >= 2 && COFFEE_KINDS.filter((k) => kinds[k] === kinds[topKind]).length === 1
      ? topKind
      : null;
  const started = days.filter((d) => !d.future);
  const pairs = workouts.map((w, i) => ({
    key: dayKey(w.date),
    volume: recaps[i]!.volumeKg,
    minutes: sessionMinutes(w),
  }));
  const topOf = (list: { key: string; v: number }[]): WeekRecapPeak | null => {
    if (list.length < 2) return null;
    const top = list.reduce((a, b) => (b.v > a.v ? b : a));
    return top.v > 0 ? { key: top.key, value: top.v } : null;
  };

  const weight =
    weighIns.length > 0
      ? {
          first: weighIns[0]!.kg,
          last: weighIns[weighIns.length - 1]!.kg,
          change: Math.round((weighIns[weighIns.length - 1]!.kg - weighIns[0]!.kg) * 10) / 10,
          weighIns: weighIns.length,
        }
      : null;

  return {
    weekStart: monday,
    weekKey: mondayKey,
    weekEnd: addDays(monday, 6),
    inProgress,
    daysElapsed,
    days,
    hasData:
      workouts.length + cardio.length + food.length + water.length + coffee.length > 0 ||
      weight != null,
    training: {
      sessions: workouts.length,
      days: trainingDays.size,
      minutes: workouts.reduce((s, w) => s + sessionMinutes(w), 0),
      workingSets: recaps.reduce((s, r) => s + r.workingSets, 0),
      volumeKg: recaps.reduce((s, r) => s + r.volumeKg, 0),
      prs: recaps.reduce((s, r) => s + r.prCount, 0),
      load: allLoads.length ? Math.round(allLoads.reduce((a, b) => a + b, 0)) : null,
      heaviest: topOf(pairs.map((p) => ({ key: p.key, v: p.volume }))),
      longest: topOf(pairs.map((p) => ({ key: p.key, v: p.minutes }))),
    },
    cardio: {
      sessions: cardio.length,
      minutes: Math.round(cardio.reduce((s, c) => s + (cardioMinutes(c) ?? 0), 0)),
      distanceKm: Math.round(cardio.reduce((s, c) => s + (c.watch.distanceKm ?? 0), 0) * 10) / 10,
      whoMinutes: Math.round(who),
      whoTarget: WHO_WEEKLY_MINUTES,
      longest: topOf(
        cardio.map((c) => ({ key: dayKey(c.date), v: Math.round(cardioMinutes(c) ?? 0) })),
      ),
    },
    nutrition: {
      loggedDays: loggedDays.length,
      totals: food.length ? dailyTotals(food) : EMPTY_MACROS,
      countedDays: counted.length,
      average: counted.length
        ? {
            calories: avg(countedTotals.calories, counted.length),
            protein: avg(countedTotals.protein, counted.length),
            carbs: avg(countedTotals.carbs, counted.length),
            fat: avg(countedTotals.fat, counted.length),
            fiber: avg(countedTotals.fiber, counted.length),
            salt: avg(countedTotals.salt, counted.length, 1),
          }
        : null,
      calorieGoal:
        counted.length && withGoal.length === counted.length
          ? avg(
              withGoal.reduce((s, d) => s + d.calorieGoal!, 0),
              withGoal.length,
            )
          : null,
      daysWithinGoal: loggedDays.filter(
        (d) => d.calorieGoal != null && d.key < todayKey && d.calories <= d.calorieGoal,
      ).length,
      entries: food.length,
      highest: peak(
        started.filter((d) => d.logged),
        (d) => d.calories,
      ),
    },
    water: {
      totalMl: water.reduce((s, e) => s + e.ml, 0),
      averageMl: waterDays.length
        ? avg(
            waterDays.reduce((s, d) => s + d.waterMl, 0),
            waterDays.length,
          )
        : null,
      daysLogged: waterDays.length,
      goalMl: waterGoal,
      daysOnGoal: waterGoal ? waterDays.filter((d) => d.waterMl >= waterGoal).length : 0,
      busiest: peak(days, (d) => d.waterMl),
    },
    coffee: {
      cups: coffee.length,
      caffeineMg: mg,
      averageMg: coffeeDays.size ? avg(mg, coffeeDays.size) : null,
      daysLogged: coffeeDays.size,
      byKind: kinds,
      favourite,
      busiest: peak(days, (d) => d.coffeeCups),
    },
    alcohol: {
      glasses: Math.round(days.reduce((s, d) => s + d.glasses, 0) * 10) / 10,
      beers: days.reduce((s, d) => s + d.beers, 0),
      wines: days.reduce((s, d) => s + d.wines, 0),
      busiest: peak(days, (d) => d.beers + d.wines),
    },
    weight,
  };
}
