import { dayKey } from "./date";
import type { Workout } from "./types";

/** How far apart a watch recording and a Forge session may start and still
 *  be treated as the same session. A matching aid, not a training number:
 *  you start the watch a few minutes before or after tapping Start. */
export const MATCH_WINDOW_MINUTES = 90;

/**
 * The Forge session a watch recording most likely belongs to: the one on
 * the same calendar day whose start is closest to the watch's, within
 * MATCH_WINDOW_MINUTES. With no start time on the screenshot, the latest
 * session that day. Null when nothing fits — the import sheet then asks.
 */
export function matchWorkout(watchStart: string | null, workouts: Workout[]): Workout | null {
  if (!watchStart) return null;
  const day = watchStart.slice(0, 10);
  const sameDay = workouts.filter((w) => dayKey(w.date) === day);
  if (!sameDay.length) return null;
  const hasTime = /T\d{2}:\d{2}/.test(watchStart);
  if (!hasTime) {
    return [...sameDay].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0]!;
  }
  const at = new Date(watchStart).getTime();
  let best: Workout | null = null;
  let bestGap = Infinity;
  for (const w of sameDay) {
    const gap = Math.abs(Date.parse(w.date) - at) / 60_000;
    if (gap < bestGap) {
      best = w;
      bestGap = gap;
    }
  }
  return bestGap <= MATCH_WINDOW_MINUTES ? best : null;
}

/** "27:37" or "1:02:05" for a duration in seconds. */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
