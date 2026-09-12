import type { Workout } from "./types";

/** Local calendar day index (days since epoch), so DST/timezone never skews streaks. */
function dayIndex(iso: string): number {
  const d = new Date(iso);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round(local.getTime() / 86_400_000);
}

export function trainingDayIndices(workouts: Workout[]): Set<number> {
  return new Set(workouts.map((w) => dayIndex(w.date)));
}

/** Consecutive trained days ending today or yesterday (a rest day today doesn't break it yet). */
export function currentStreak(workouts: Workout[]): number {
  const days = trainingDayIndices(workouts);
  if (!days.size) return 0;
  const today = dayIndex(new Date().toISOString());
  const start = days.has(today) ? today : today - 1;
  if (!days.has(start)) return 0;
  let n = 0;
  for (let d = start; days.has(d); d--) n++;
  return n;
}

/** Longest run of consecutive trained days across all history. */
export function bestStreak(workouts: Workout[]): number {
  const days = [...trainingDayIndices(workouts)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
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
