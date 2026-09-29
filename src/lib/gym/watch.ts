import { dayKey } from "./date";
import type { CardioSession, WatchData, Workout } from "./types";

/** Most decimals any imported watch figure keeps. Screenshots print whole
 *  or one- to two-decimal values; longer ones come from the reader doing
 *  arithmetic (a 10-second zone as 0.1666… min) and just read as noise. */
export const WATCH_DECIMALS = 2;

const LONG_DECIMAL = /^(-?\d+)([.,])(\d{3,})$/;

/**
 * Every number in imported watch data rounded to WATCH_DECIMALS, deep
 * (zones, splits, tables, metrics), plus numeric strings with more decimals
 * than that ("0.16666666"), keeping their decimal mark. Everything else is
 * returned as it is.
 */
export function roundWatchNumbers<T>(value: T): T {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return value;
    const f = 10 ** WATCH_DECIMALS;
    const r = Math.round(value * f) / f;
    return (Object.is(r, -0) ? 0 : r) as T;
  }
  if (typeof value === "string") {
    const m = LONG_DECIMAL.exec(value.trim());
    if (!m) return value;
    const n = roundWatchNumbers(Number(`${m[1]}.${m[3]}`));
    return String(n).replace(".", m[2]!) as T;
  }
  if (Array.isArray(value)) return value.map((v) => roundWatchNumbers(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, roundWatchNumbers(v)]),
    ) as T;
  }
  return value;
}

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

/** A watch start ("YYYY-MM-DDTHH:mm", local, or a bare date) as an ISO
 *  timestamp. A bare date becomes local noon so no time zone moves it to
 *  another day; no start at all falls back to when it was imported. */
export function cardioStartIso(watch: Pick<WatchData, "start" | "importedAt">): string {
  const start = watch.start;
  if (start && /^\d{4}-\d{2}-\d{2}/.test(start)) {
    const d = new Date(start.length === 10 ? `${start}T12:00` : start);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return watch.importedAt;
}

/** Whether screenshots read as a cardio session (a run, walk, ride…) rather
 *  than a strength one. Only the reader's own judgement or a distance counts. */
export function looksLikeCardio(watch: Pick<WatchData, "kind" | "distanceKm">): boolean {
  if (watch.kind === "cardio") return true;
  if (watch.kind === "strength") return false;
  return (watch.distanceKm ?? 0) > 0;
}

/** "5'42"" for a pace in seconds per km. */
export function formatPace(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}"`;
}

/** Whole minutes for a cardio session's training load, or null without a duration. */
export function cardioMinutes(c: CardioSession): number | null {
  const sec = c.watch.durationSeconds;
  return sec != null && sec > 0 ? Math.round(sec / 60) : null;
}

/** The cardio session a new import should overwrite: the one being replaced,
 *  else one with the same start time (importing a run twice), else none. */
export function cardioTargetId(
  watch: Pick<WatchData, "start">,
  sessions: CardioSession[],
  replaceId?: string,
): string | null {
  if (replaceId) return replaceId;
  if (!watch.start || watch.start.length <= 10) return null;
  return sessions.find((c) => c.watch.start === watch.start)?.id ?? null;
}
