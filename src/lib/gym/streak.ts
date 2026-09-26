import type { Workout } from "./types";

/** Local calendar day index (days since epoch), so DST/timezone never skews streaks. */
function dayIndex(iso: string): number {
  const d = new Date(iso);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round(local.getTime() / 86_400_000);
}

/** Inverse of dayIndex — for rendering a calendar cell's actual date (e.g. an aria-label). */
export function dayIndexToDate(index: number): Date {
  return new Date(index * 86_400_000);
}

export function trainingDayIndices(workouts: Workout[]): Set<number> {
  return new Set(workouts.map((w) => dayIndex(w.date)));
}

/**
 * The streak counts weeks, not days. A daily streak rewards training every
 * day and breaks on a planned rest day, which works against the recovery the
 * rest of the app plans for. A week counts when it has at least
 * `MIN_TRAINING_DAYS_PER_WEEK` (2) training days: the WHO 2020 guidelines on
 * physical activity (Bull et al., Br J Sports Med 2020) recommend
 * muscle-strengthening activity on 2 or more days a week, and the ACSM's 2009
 * progression position stand starts novices at 2–3 days a week. Confirmed
 * through web search results (journal sites are blocked here).
 */
export const MIN_TRAINING_DAYS_PER_WEEK = 2;

/** Day index of the Monday that starts `dayIdx`'s week. Day index 0
 *  (1 Jan 1970) was a Thursday, so Monday-first weekday = (idx + 3) mod 7. */
const weekStartIndex = (dayIdx: number) => dayIdx - ((((dayIdx + 3) % 7) + 7) % 7);

/** Distinct training days per week, keyed by that week's Monday day index. */
function daysPerWeek(workouts: Workout[]): Map<number, number> {
  const weeks = new Map<number, number>();
  for (const d of trainingDayIndices(workouts)) {
    const w = weekStartIndex(d);
    weeks.set(w, (weeks.get(w) ?? 0) + 1);
  }
  return weeks;
}

/** Consecutive Monday–Sunday weeks with 2+ training days, ending this week
 *  if it already qualifies, else last week — a week still in progress
 *  doesn't break the streak until it's over. */
export function currentWeekStreak(workouts: Workout[], today = new Date()): number {
  const weeks = daysPerWeek(workouts);
  const ok = (w: number) => (weeks.get(w) ?? 0) >= MIN_TRAINING_DAYS_PER_WEEK;
  const thisWeek = weekStartIndex(dayIndex(today.toISOString()));
  let w = ok(thisWeek) ? thisWeek : thisWeek - 7;
  let n = 0;
  while (ok(w)) {
    n++;
    w -= 7;
  }
  return n;
}

/** Longest run of qualifying weeks across all history. */
export function bestWeekStreak(workouts: Workout[]): number {
  const weeks = [...daysPerWeek(workouts).entries()]
    .filter(([, n]) => n >= MIN_TRAINING_DAYS_PER_WEEK)
    .map(([w]) => w)
    .sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const w of weeks) {
    run = prev !== null && w === prev + 7 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

/** Distinct training days in the Monday–Sunday week containing `today`. */
export function trainingDaysThisWeek(workouts: Workout[], today = new Date()): number {
  return daysPerWeek(workouts).get(weekStartIndex(dayIndex(today.toISOString()))) ?? 0;
}

export interface CalendarDay {
  dayIndex: number;
  trained: boolean;
  isToday: boolean;
}

/** Last `weeks` weeks of calendar cells, oldest-first, grouped into 7-day columns (Mon-first). */
export function recentCalendar(workouts: Workout[], weeks = 12): CalendarDay[][] {
  const days = trainingDayIndices(workouts);
  const today = dayIndex(new Date().toISOString());
  // Monday-first: JS getDay() is 0=Sun..6=Sat.
  const todayDow = (new Date().getDay() + 6) % 7;
  const start = today - todayDow - (weeks - 1) * 7;

  const columns: CalendarDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const idx = start + w * 7 + d;
      if (idx > today) continue;
      column.push({ dayIndex: idx, trained: days.has(idx), isToday: idx === today });
    }
    columns.push(column);
  }
  return columns;
}
