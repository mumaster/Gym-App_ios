import { mondayOf } from "./schedule";
import type { Workout } from "./types";

/**
 * Session-RPE training load (Foster et al., J Strength Cond Res 2001, "A new
 * approach to monitoring exercise training"; validated for resistance
 * training by Day et al., J Strength Cond Res 2004): after a session you
 * rate how hard the *whole* session was on Foster's modified CR-10 scale,
 * and load = rating × session minutes, in arbitrary units. Foster collected
 * the rating ~30 minutes after the session; a circuit weight-training study
 * found no difference between ratings given 10, 20 or 30 minutes after —
 * rating the moment you finish isn't covered by either, which is why the
 * rating can also be given or changed later from History.
 *
 * The scale's verbal anchors (Foster 2001); 6, 8 and 9 have none.
 */
export const SESSION_RPE_ANCHORS: Partial<Record<number, string>> = {
  0: "rest",
  1: "veryVeryEasy",
  2: "easy",
  3: "moderate",
  4: "somewhatHard",
  5: "hard",
  7: "veryHard",
  10: "maximal",
};

const DAY_MS = 86_400_000;

/** Actual minutes from start to finish; the planned length for sessions
 *  saved before finish times were recorded. */
export function sessionMinutes(w: Workout): number {
  if (w.finished_at) {
    const mins = (new Date(w.finished_at).getTime() - new Date(w.date).getTime()) / 60_000;
    if (mins > 0 && mins < 600) return Math.round(mins);
  }
  return w.duration_minutes;
}

export function sessionLoad(w: Workout): number | null {
  return w.session_rpe == null ? null : w.session_rpe * sessionMinutes(w);
}

export interface WeekLoad {
  /** Monday of the week, as a Date at local midnight. */
  weekStart: Date;
  load: number;
  /** Finished sessions that week, and how many of them were rated. */
  sessions: number;
  rated: number;
}

/** The last `weeks` Monday–Sunday weeks, oldest first, ending with this one. */
export function weeklyLoads(workouts: Workout[], weeks = 6, today = new Date()): WeekLoad[] {
  const thisMonday = mondayOf(today);
  const out: WeekLoad[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday);
    start.setDate(start.getDate() - 7 * i);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const inWeek = workouts.filter((w) => {
      const t = new Date(w.date).getTime();
      return w.finished && t >= start.getTime() && t < end.getTime();
    });
    const loads = inWeek.map(sessionLoad).filter((x): x is number => x != null);
    out.push({
      weekStart: start,
      load: loads.reduce((a, b) => a + b, 0),
      sessions: inWeek.length,
      rated: loads.length,
    });
  }
  return out;
}

/**
 * The last 7 days' load against the average week of the last 28 days — the
 * acute:chronic ratio as Gabbett (Br J Sports Med 2016) used it. That paper
 * linked ratios of 0.8–1.3 with the lowest injury risk in team sports and
 * above 1.5 with more injuries; later work questioned how well the ratio
 * predicts anything (Impellizzeri et al., 2020), and it wasn't derived from
 * lifters — so the app shows it as a hint, never as a rule.
 *
 * Returns null until there's something to compare against: rated sessions
 * in at least 3 of the 4 weeks — this minimum is the app's own choice, not
 * from the literature.
 */
export const LOAD_SPIKE_RATIO = 1.5;
const MIN_WEEKS_WITH_DATA = 3;

export function loadRatio(
  workouts: Workout[],
  today = new Date(),
): { acute: number; chronicWeekly: number; ratio: number } | null {
  const now = today.getTime();
  const within = (days: number) =>
    workouts.filter((w) => {
      const t = new Date(w.date).getTime();
      return w.finished && t <= now && t > now - days * DAY_MS;
    });
  const sum = (ws: Workout[]) => ws.reduce((a, w) => a + (sessionLoad(w) ?? 0), 0);
  const month = within(28);
  const weeksWithData = new Set(
    month
      .filter((w) => w.session_rpe != null)
      .map((w) => Math.floor((now - new Date(w.date).getTime()) / (7 * DAY_MS))),
  ).size;
  if (weeksWithData < MIN_WEEKS_WITH_DATA) return null;
  const acute = sum(within(7));
  const chronicWeekly = sum(month) / 4;
  if (chronicWeekly <= 0) return null;
  return { acute, chronicWeekly, ratio: acute / chronicWeekly };
}
