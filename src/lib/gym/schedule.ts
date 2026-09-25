import { addDays, dayKey, dayKeyFromDate } from "./date";
import type { ScheduleSlot } from "./splits";
import type { Workout } from "./types";

/**
 * Calendar layer over a rotation (a WeeklyScheme or a Program). The rotation
 * itself stays order-based — `cyclePosition` only moves when a session is
 * finished or skipped, so a missed day never silently loses a session — but
 * every remaining session also gets a real planned date: the cycle's
 * `anchor` Monday plus that slot's weekday offset, unless `dayOverrides`
 * moved it for this cycle only. Overrides are cleared whenever the cycle
 * wraps, so a shifted week never leaks into the next one.
 */
export interface Rotation {
  schedule: ScheduleSlot[];
  cyclePosition: number;
  /** dayKey of the Monday the current pass through `schedule` is planned against. */
  anchor: string;
  /** slot index → days after `anchor`, replacing that slot's normal weekday for this cycle. */
  dayOverrides?: Record<number, number> | undefined;
}

/** Monday-first position of a Date#getDay value (Mon = 0 … Sun = 6). */
export const weekIndex = (dow: number) => (dow + 6) % 7;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const mondayOf = (d: Date) => addDays(startOfDay(d), -weekIndex(d.getDay()));

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Whole calendar days from `a` to `b` (rounded, so DST shifts don't matter). */
export const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);

export const slotOffset = (r: Rotation, i: number) =>
  r.dayOverrides?.[i] ?? weekIndex(r.schedule[i]?.dow ?? 1);

export const plannedDate = (r: Rotation, i: number) =>
  addDays(parseDayKey(r.anchor), slotOffset(r, i));

/** Anchor for a rotation whose next session is `cursor`: this week if that
 *  session's weekday is still ahead (or today), otherwise next week — so a
 *  freshly-created or migrated rotation never starts out "overdue". */
export function anchorFor(schedule: ScheduleSlot[], cursor: number, today = new Date()): string {
  const monday = mondayOf(today);
  const slot = schedule[cursor];
  const ahead = slot ? weekIndex(slot.dow) >= weekIndex(today.getDay()) : true;
  return dayKeyFromDate(ahead ? monday : addDays(monday, 7));
}

/** Anchor for the cycle after one whose last session fell on `lastDate`: the
 *  week of the first normal slot-0 weekday strictly after it. */
export function nextCycleAnchor(schedule: ScheduleSlot[], lastDate: Date): string {
  const first = schedule[0]?.dow ?? 1;
  let d = addDays(startOfDay(lastDate), 1);
  while (d.getDay() !== first) d = addDays(d, 1);
  return dayKeyFromDate(mondayOf(d));
}

/** Moves the cursor past the current session (finished or skipped). On
 *  wrapping, re-anchors to the next cycle and drops this cycle's overrides. */
export function advanceRotation<R extends Rotation>(
  r: R,
  today = new Date(),
): { rotation: R; wrapped: boolean } {
  const next = r.cyclePosition + 1;
  if (next < r.schedule.length) return { rotation: { ...r, cyclePosition: next }, wrapped: false };
  const last = plannedDate(r, r.schedule.length - 1);
  const lastDate = last > startOfDay(today) ? last : today;
  return {
    rotation: {
      ...r,
      cyclePosition: 0,
      anchor: nextCycleAnchor(r.schedule, lastDate),
      dayOverrides: undefined,
    },
    wrapped: true,
  };
}

/** Days the next session is overdue by (0 when it's today or still ahead). */
export function overdueDays(r: Rotation, today = new Date()): number {
  if (!r.schedule.length) return 0;
  return Math.max(0, daysBetween(plannedDate(r, r.cyclePosition), today));
}

/** Moves every remaining session (cursor onward) by `delta` days, this cycle only. */
export function shiftRemaining<R extends Rotation>(r: R, delta: number): R {
  const dayOverrides = { ...r.dayOverrides };
  for (let i = r.cyclePosition; i < r.schedule.length; i++) {
    dayOverrides[i] = slotOffset(r, i) + delta;
  }
  return { ...r, dayOverrides };
}

/** Moves one remaining session to `date`, this cycle only. Callers keep the
 *  order intact (see `allowedDatesFor`). */
export function moveSession<R extends Rotation>(r: R, index: number, date: Date): R {
  return {
    ...r,
    dayOverrides: { ...r.dayOverrides, [index]: daysBetween(parseDayKey(r.anchor), date) },
  };
}

/** Dates session `index` can move to without overtaking its neighbours:
 *  strictly after the previous remaining session (or yesterday, if it's the
 *  next one up) and strictly before the following one, capped at two weeks. */
export function allowedDatesFor(r: Rotation, index: number, today = new Date()): Date[] {
  const lower =
    index > r.cyclePosition ? plannedDate(r, index - 1) : addDays(startOfDay(today), -1);
  const floor = lower < addDays(startOfDay(today), -1) ? addDays(startOfDay(today), -1) : lower;
  const upper =
    index + 1 < r.schedule.length ? plannedDate(r, index + 1) : addDays(startOfDay(today), 15);
  const out: Date[] = [];
  for (let d = addDays(floor, 1); d < upper && out.length < 14; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Keeps `schedule` Monday-first by weekday after a permanent edit. The
 *  cursor lands on the earliest session (in the new order) that was still
 *  remaining before the edit, so moving the next session later in the week
 *  never marks the sessions it jumped over as done. Overrides are
 *  index-keyed, so they're dropped; if the edit made the next session
 *  overdue, re-anchor. */
export function resortRotation<R extends Rotation>(r: R, today = new Date()): R {
  const remaining = new Set(r.schedule.slice(r.cyclePosition));
  const schedule = [...r.schedule].sort((a, b) => weekIndex(a.dow) - weekIndex(b.dow));
  const cyclePosition = Math.max(
    0,
    schedule.findIndex((slot) => remaining.has(slot)),
  );
  const next = { ...r, schedule, cyclePosition, dayOverrides: undefined };
  return overdueDays(next, today) > 0
    ? { ...next, anchor: anchorFor(schedule, cyclePosition, today) }
    : next;
}

/** True when a remaining session of `r` is planned on `date`. */
export function hasPlannedSession(r: Rotation, date: Date): boolean {
  for (let i = r.cyclePosition; i < r.schedule.length; i++) {
    if (daysBetween(plannedDate(r, i), date) === 0) return true;
  }
  return false;
}

export type DayType = "training" | "rest";

/** A day is a training day if a workout was done on it, or — for today and
 *  later only — a remaining session is planned on it. Past days go purely
 *  by what actually happened. */
export function dayTypeFor(
  date: Date,
  {
    rotation,
    workouts,
    activeWorkout,
  }: { rotation: Rotation | null; workouts: Workout[]; activeWorkout: Workout | null },
  today = new Date(),
): DayType {
  const key = dayKeyFromDate(date);
  if (activeWorkout && dayKey(activeWorkout.date) === key) return "training";
  if (workouts.some((w) => dayKey(w.date) === key)) return "training";
  if (rotation && daysBetween(today, date) >= 0 && hasPlannedSession(rotation, date)) {
    return "training";
  }
  return "rest";
}
