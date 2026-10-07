import { addDays, dayKey, dayKeyFromDate } from "./date";
import { sessionEnergyKcal } from "./nutrition";
import { mondayOf, weekIndex } from "./schedule";
import type {
  CardioActivity,
  CardioEffort,
  CardioPlanDay,
  CardioSession,
  WatchData,
} from "./types";

/**
 * Cardio next to strength training.
 *
 * How the two fit in one week, from the umbrella review of concurrent
 * training (Held et al., Sports Med 2026, PMID 41762427): adding cardio to
 * strength training gives the same gains in maximal strength, power and
 * muscle size as strength training alone, and that "no interference on
 * hypertrophy" finding is the most robust one. It found no difference
 * between doing both in one session, on the same day or on separate days,
 * nor by cardio intensity, modality or frequency. So the app doesn't
 * restrict where cardio goes in the week. The one ordering advice with
 * support is small: strength first (same review), and the one measurable
 * cost, a smaller gain in explosive strength (Schumann et al., Sports Med
 * 2022, PMID 34757594: SMD −0.28), only showed when both were done in the
 * same session — with 3 or more hours between them it was gone. Robineau et
 * al. (J Strength Cond Res 2016, PMID 25546450) likewise found lower
 * strength gains with 0 h between, and none with 6 or 24 h. Hence the single
 * hint when a cardio day falls on a strength day: strength first, and if you
 * can, `SAME_DAY_GAP_HOURS` apart. Confirmed by reading the review's full
 * text and the other two abstracts on PubMed.
 */
export const SAME_DAY_GAP_HOURS = 3;

export const CARDIO_ACTIVITIES: CardioActivity[] = [
  "run",
  "cycle",
  "walk",
  "swim",
  "row",
  "elliptical",
  "intervals",
];
export const CARDIO_EFFORTS: CardioEffort[] = ["easy", "moderate", "hard"];

/**
 * METs per activity and effort, from the 2024 Adult Compendium of Physical
 * Activities (Herrmann et al., J Sport Health Sci 2024, PMID 38242596),
 * read directly from its published tables (pacompendium.com). Code per cell.
 * Where the Compendium has no entry for an effort, the nearest one is reused
 * and that's said here:
 *
 * - run: easy 12020 "jogging, general, self-selected pace" 7.5; moderate and
 *   hard 12145 "running, self-selected pace" 10.5 — there is no faster
 *   self-selected entry. With a distance, `RUN_BY_SPEED` is used instead.
 * - cycle: 01015 "bicycling, general, self-selected easy pace" 4.3, 01016
 *   "moderate pace" 7.0, 01017 "vigorous pace" 9.0.
 * - walk: 17190 "walking, 2.8–3.4 mph, level, moderate pace" 3.8, 17200
 *   "brisk pace" 4.8, 17220 "very brisk pace" 5.5.
 * - swim: 18240 "freestyle, slow, recreational" 5.8, 18290 "crawl, medium
 *   speed" 8.0, 18230 "freestyle, fast, vigorous effort" 9.8.
 * - row (ergometer): easy and moderate 02071 "moderate effort" 5.0 (there's
 *   no lighter entry), hard 02070 "vigorous effort, general" 7.3.
 * - elliptical: easy and moderate 02048 "moderate effort" 5.0, hard 02049
 *   "vigorous effort" 9.0.
 * - intervals (HIIT): easy and moderate 02210 "moderate effort" 7.0, hard
 *   02214 "vigorous effort" 11.0.
 */
export const CARDIO_METS: Record<CardioActivity, Record<CardioEffort, number>> = {
  run: { easy: 7.5, moderate: 10.5, hard: 10.5 },
  cycle: { easy: 4.3, moderate: 7.0, hard: 9.0 },
  walk: { easy: 3.8, moderate: 4.8, hard: 5.5 },
  swim: { easy: 5.8, moderate: 8.0, hard: 9.8 },
  row: { easy: 5.0, moderate: 5.0, hard: 7.3 },
  elliptical: { easy: 5.0, moderate: 5.0, hard: 9.0 },
  intervals: { easy: 7.0, moderate: 7.0, hard: 11.0 },
};

/**
 * Running METs by speed, same Compendium (codes 12028–12135), as
 * [mph, MET]. A range in the table ("5.0–5.2 mph") is stored at its middle.
 * A known speed says more than a self-rated effort, so a run with a
 * distance uses the nearest row here.
 */
export const RUN_BY_SPEED: [number, number][] = [
  [4.1, 6.5], // 12028, 4–4.2 mph
  [5.1, 8.5], // 12030, 5.0–5.2 mph
  [5.65, 9.0], // 12045, 5.5–5.8 mph
  [6.15, 9.3], // 12050, 6–6.3 mph
  [6.7, 10.5], // 12060
  [7, 11.0], // 12070
  [7.5, 11.8], // 12080
  [8, 12.0], // 12090
  [8.6, 12.5], // 12100
  [9, 13.0], // 12110
  [9.45, 14.8], // 12115, 9.3–9.6 mph
  [10, 14.8], // 12120
  [11, 16.8], // 12130
  [12, 18.5], // 12132
  [13, 19.8], // 12134
  [14, 23.0], // 12135
];

const KMH_PER_MPH = 1.609344;

/** METs for a session: by speed for a run with one, else by effort. */
export function cardioMet(
  activity: CardioActivity,
  effort: CardioEffort,
  speedKmh?: number | null,
): number {
  if (activity === "run" && speedKmh != null && speedKmh > 0) {
    const mph = speedKmh / KMH_PER_MPH;
    let best = RUN_BY_SPEED[0]!;
    for (const row of RUN_BY_SPEED) {
      if (Math.abs(row[0] - mph) < Math.abs(best[0] - mph)) best = row;
    }
    return best[1];
  }
  return CARDIO_METS[activity][effort];
}

/**
 * WHO 2020 guidelines on physical activity (Bull et al., Br J Sports Med
 * 2020, PMID 33239350): adults should do 150–300 min of moderate-intensity
 * or 75–150 min of vigorous-intensity aerobic activity a week, "or an
 * equivalent combination" — so a vigorous minute counts as two. Moderate is
 * 3 to under 6 METs, vigorous 6 or more (the guideline's glossary; the MET
 * cut-offs confirmed through web search results, the WHO page itself wasn't
 * reachable from here). The weekly target is the range's lower end, the
 * minimum the guideline asks for; lighter activity (under 3 METs) doesn't
 * count toward it.
 */
export const WHO_WEEKLY_MINUTES = 150;
export const MODERATE_MET = 3;
export const VIGOROUS_MET = 6;

/** Moderate-equivalent minutes toward the WHO target. */
export function whoMinutes(met: number, minutes: number): number {
  if (met >= VIGOROUS_MET) return minutes * 2;
  if (met >= MODERATE_MET) return minutes;
  return 0;
}

export interface CardioInfo {
  activity: CardioActivity;
  effort: CardioEffort;
  minutes: number;
  met: number;
}

/** A logged session's activity, effort, minutes and METs, or null when the
 *  activity/effort weren't set (older watch imports) or it has no duration. */
export function cardioInfo(s: CardioSession): CardioInfo | null {
  const sec = s.watch.durationSeconds;
  if (!s.activity || !s.effort || sec == null || sec <= 0) return null;
  const minutes = sec / 60;
  const speed =
    s.watch.avgSpeedKmh ??
    (s.watch.distanceKm && s.watch.distanceKm > 0 ? s.watch.distanceKm / (sec / 3600) : null);
  return {
    activity: s.activity,
    effort: s.effort,
    minutes,
    met: cardioMet(s.activity, s.effort, speed),
  };
}

/** Extra kcal a cardio session costs over spending that time at rest —
 *  the same net-MET formula the rest-day limits use for strength. */
export const cardioEnergyKcal = (weightKg: number, info: Pick<CardioInfo, "minutes" | "met">) =>
  sessionEnergyKcal(weightKg, info.minutes, info.met);

export const cardioSessionsOn = (sessions: CardioSession[], key: string) =>
  sessions.filter((s) => dayKey(s.date) === key);

/** Moderate-equivalent minutes logged in the Monday–Sunday week of `day`. */
export function weekWhoMinutes(sessions: CardioSession[], day = new Date()): number {
  const from = dayKeyFromDate(mondayOf(day));
  const to = dayKeyFromDate(addDays(mondayOf(day), 6));
  let total = 0;
  for (const s of sessions) {
    const k = dayKey(s.date);
    if (k < from || k > to) continue;
    const info = cardioInfo(s);
    if (info) total += whoMinutes(info.met, info.minutes);
  }
  return Math.round(total);
}

/** Moderate-equivalent minutes a weekly cardio plan adds up to. */
export const plannedWhoMinutes = (plan: CardioPlanDay[]) =>
  plan.reduce((n, d) => n + whoMinutes(cardioMet(d.activity, d.effort), d.minutes), 0);

/** The planned cardio on a date's weekday. */
export const cardioPlannedOn = (plan: CardioPlanDay[], date: Date) =>
  plan.filter((d) => d.dow === date.getDay());

/** Plan days in Monday-first order. */
export const sortCardioPlan = (plan: CardioPlanDay[]) =>
  [...plan].sort((a, b) => weekIndex(a.dow) - weekIndex(b.dow));

/**
 * Planned cardio still to do on `date`: none for a past day, and none once
 * as many sessions were logged that day as were planned (any activity
 * counts — swapping a planned run for a ride still did the job).
 */
export function remainingCardioOn(
  plan: CardioPlanDay[],
  sessions: CardioSession[],
  date: Date,
  today = new Date(),
): CardioPlanDay[] {
  const key = dayKeyFromDate(date);
  if (key < dayKeyFromDate(today)) return [];
  const planned = cardioPlannedOn(plan, date);
  const done = cardioSessionsOn(sessions, key).length;
  return planned.slice(done);
}

const ACTIVITY_WORDS: [CardioActivity, RegExp][] = [
  ["intervals", /interval|hiit|tabata/i],
  ["run", /hardlo(o)?p|run|jog|loopband|treadmill/i],
  ["cycle", /fiets|cycl|bike|biking|ride|wielren|spinning/i],
  ["walk", /wandel|walk|hike|hiking|lopen/i],
  ["swim", /zwem|swim/i],
  ["row", /roei|row/i],
  ["elliptical", /crosstrainer|elliptical|cross trainer/i],
];

/** A watch activity name ("Buiten hardlopen", "Outdoor walk") as one of the
 *  app's activities, or null when it doesn't say. Only prefills a choice
 *  the user confirms. Checked in order, so "hardlopen" is a run, not a walk. */
export function guessCardioActivity(name: string | null | undefined): CardioActivity | null {
  if (!name) return null;
  for (const [activity, re] of ACTIVITY_WORDS) if (re.test(name)) return activity;
  return null;
}

/** The watch data a hand-logged session is stored with: only what was typed. */
export function manualCardioWatch(input: {
  label: string;
  start: string;
  minutes: number;
  distanceKm: number | null;
  importedAt: string;
}): WatchData {
  const { label, start, minutes, distanceKm, importedAt } = input;
  const seconds = Math.round(minutes * 60);
  const km = distanceKm && distanceKm > 0 ? distanceKm : null;
  return {
    source: null,
    device: null,
    activity: label,
    start,
    durationSeconds: seconds,
    totalKcal: null,
    activeKcal: null,
    avgHr: null,
    maxHr: null,
    minHr: null,
    hrZones: [],
    trainingEffects: [],
    recoveryHours: null,
    hrRecovery: null,
    otherMetrics: [],
    importedAt,
    kind: "cardio",
    distanceKm: km,
    avgPaceSeconds: km ? Math.round(seconds / km) : null,
    avgSpeedKmh: km ? Math.round((km / (seconds / 3600)) * 100) / 100 : null,
  };
}

/**
 * Activities the activity level already counts, so they never raise a day's
 * calories. The energy need (EER_2023 in nutrition.ts) comes from an
 * activity level the questionnaire asks to include walking, and the
 * categories themselves are defined in walking: the US Dietary Guidelines'
 * calorie table (from the same DRI equations) describes "moderately active"
 * as the equivalent of walking 1.5–3 miles a day at 3–4 mph, and "active" as
 * more than 3 miles a day. Adding a logged walk on top counts it twice.
 * Walks still count toward the WHO minutes (whoMinutes); they just don't
 * make a day a cardio day for nutrition.
 */
export const EVERYDAY_ACTIVITIES: ReadonlySet<CardioActivity> = new Set(["walk"]);

const raisesIntake = (activity: CardioActivity | null | undefined) =>
  activity != null && !EVERYDAY_ACTIVITIES.has(activity);

/** Extra kcal of the cardio planned in a weekly plan (null weight → 0).
 *  Walks add nothing, as on the day itself (EVERYDAY_ACTIVITIES). */
export function plannedWeeklyCardioKcal(plan: CardioPlanDay[], weightKg: number | null): number {
  if (!weightKg) return 0;
  return plan
    .filter((d) => raisesIntake(d.activity))
    .reduce(
      (n, d) =>
        n +
        cardioEnergyKcal(weightKg, { minutes: d.minutes, met: cardioMet(d.activity, d.effort) }),
      0,
    );
}

/**
 * A day's cardio: whether there is any, and its extra kcal. Past days count
 * only what was logged; today and later also count the plan still to do
 * (remainingCardioOn), so a planned run raises the limit before it's run
 * and a logged one keeps it raised. Sessions without an activity/effort
 * (older imports) add nothing until they're set. Walks don't count at all
 * (EVERYDAY_ACTIVITIES): the activity level already includes them. No
 * bodyweight → 0 kcal.
 */
export function cardioDay(
  date: Date,
  plan: CardioPlanDay[],
  sessions: CardioSession[],
  weightKg: number | null,
  today = new Date(),
): { any: boolean; kcal: number } {
  const logged = cardioSessionsOn(sessions, dayKeyFromDate(date)).filter(
    (s) => s.activity == null || raisesIntake(s.activity),
  );
  const planned = remainingCardioOn(plan, sessions, date, today).filter((d) =>
    raisesIntake(d.activity),
  );
  let kcal = 0;
  if (weightKg) {
    for (const s of logged) {
      const info = cardioInfo(s);
      if (info) kcal += cardioEnergyKcal(weightKg, info);
    }
    for (const d of planned) {
      kcal += cardioEnergyKcal(weightKg, {
        minutes: d.minutes,
        met: cardioMet(d.activity, d.effort),
      });
    }
  }
  return { any: logged.length + planned.length > 0, kcal };
}
