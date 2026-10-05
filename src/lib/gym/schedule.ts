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
  /** slot index → dayKey the session was actually done on, this cycle only.
   *  A finished session is shown on this day rather than its planned one; a
   *  skipped session has no entry. */
  doneOn?: Record<number, string> | undefined;
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

/**
 * The next cycle, planned after `after` (the last day this cycle used): its
 * sessions, in order, go on the plan's own training weekdays from the day
 * after, running into the following week where needed, so the next session
 * is always on the next planned training day. Anchored to the Monday of the
 * week its first session falls in; a session off its usual weekday gets an
 * override. After a normal week this is simply next week as planned.
 *
 * Reported twice before it settled here: a leftover from Friday done on
 * Monday used to push the next cycle to the week after (losing a week), and
 * a cycle whose last two sessions moved to Tuesday and Wednesday then
 * waited for next Monday, or (briefly) packed the next cycle onto Thursday
 * to Sunday, rather than carrying on "next in line on Thursday and Friday,
 * following my week planning" (asked for).
 */
export function nextCycle(
  r: Rotation,
  after: Date,
): { anchor: string; dayOverrides?: Record<number, number> } {
  const start = addDays(startOfDay(after), 1);
  // The plan's training days in order; a weekday holding two sessions is
  // used twice. Capped in case a slot carries an impossible weekday.
  const days: Date[] = [];
  for (let d = start; days.length < r.schedule.length && daysBetween(start, d) < 21;) {
    for (const slot of r.schedule) if (slot.dow === d.getDay()) days.push(d);
    d = addDays(d, 1);
  }
  if (days.length < r.schedule.length) return { anchor: dayKeyFromDate(mondayOf(start)) };
  const week = mondayOf(days[0]!);
  const dayOverrides: Record<number, number> = {};
  r.schedule.forEach((slot, i) => {
    const offset = daysBetween(week, days[i]!);
    if (offset !== weekIndex(slot.dow)) dayOverrides[i] = offset;
  });
  return {
    anchor: dayKeyFromDate(week),
    ...(Object.keys(dayOverrides).length ? { dayOverrides } : {}),
  };
}

/** Moves the cursor past the current session (finished or skipped). A
 *  finished session passes `doneOn`, the day it was done, which is kept for
 *  this cycle. On wrapping, starts the next cycle (`nextCycle`) after the
 *  later of the last session's planned day and the day it was done (or,
 *  when skipped, yesterday, so a skipped leftover frees today), and drops
 *  this cycle's overrides and done days. */
export function advanceRotation<R extends Rotation>(
  r: R,
  today = new Date(),
  doneOn?: Date,
): { rotation: R; wrapped: boolean } {
  const next = r.cyclePosition + 1;
  if (next < r.schedule.length) {
    const done = doneOn ? { ...r.doneOn, [r.cyclePosition]: dayKeyFromDate(doneOn) } : r.doneOn;
    return { rotation: { ...r, cyclePosition: next, doneOn: done }, wrapped: false };
  }
  const planned = plannedDate(r, r.schedule.length - 1);
  const taken = startOfDay(doneOn ?? addDays(startOfDay(today), -1));
  const { anchor, dayOverrides } = nextCycle(r, taken > planned ? taken : planned);
  return {
    rotation: { ...r, cyclePosition: 0, anchor, dayOverrides, doneOn: undefined },
    wrapped: true,
  };
}

/** The rotation as it would be with every remaining session of this cycle
 *  skipped: the next cycle, planned from `today`. */
export function skipRestOfCycle<R extends Rotation>(r: R, today = new Date()): R {
  let out = r;
  for (let i = r.cyclePosition; i < r.schedule.length; i++) {
    out = advanceRotation(out, today).rotation;
  }
  return out;
}

/** True when this cycle's last remaining session is planned today or has
 *  passed: the week is over, so the next week's sessions are shown too. */
export function cycleEnding(r: Rotation, today = new Date()): boolean {
  return (
    r.cyclePosition < r.schedule.length &&
    daysBetween(plannedDate(r, r.schedule.length - 1), today) >= 0
  );
}

/** The day session `index` was done on this cycle, or null when it was
 *  skipped or is still to come. */
export const doneDate = (r: Rotation, index: number): Date | null => {
  const key = index < r.cyclePosition ? r.doneOn?.[index] : undefined;
  return key ? parseDayKey(key) : null;
};

/** Done days for a rotation saved before they were recorded: the scheduled
 *  workouts (`fromRotation`) of the last two weeks, newest matched to the
 *  latest done session. With fewer workouts than done sessions, the earliest
 *  ones stay without a day, as skipped. */
export function backfillDoneOn(
  r: Rotation,
  workouts: Workout[],
  fromRotation: (w: Workout) => boolean,
): Record<number, string> {
  const since = addDays(parseDayKey(r.anchor), -7);
  const days = workouts
    .filter((w) => fromRotation(w) && daysBetween(since, new Date(w.date)) >= 0)
    .map((w) => dayKey(w.date))
    .sort()
    .slice(-r.cyclePosition);
  const out: Record<number, string> = {};
  const first = r.cyclePosition - days.length;
  days.forEach((key, k) => {
    out[first + k] = key;
  });
  return out;
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
  // Done days follow their session to its new index.
  let doneOn: Record<number, string> | undefined;
  r.schedule.forEach((slot, i) => {
    const key = r.doneOn?.[i];
    const j = schedule.indexOf(slot);
    if (key && j < cyclePosition) doneOn = { ...doneOn, [j]: key };
  });
  const next = { ...r, schedule, cyclePosition, dayOverrides: undefined, doneOn };
  return overdueDays(next, today) > 0
    ? { ...next, anchor: anchorFor(schedule, cyclePosition, today) }
    : next;
}

/**
 * The days sessions are planned on from today through `until`: the rest of
 * this cycle, then the cycles after it, as `advanceRotation` would plan them
 * if every session is done on its planned day. Missed sessions are first
 * moved up to today, as "Do it today" does. Without this, the week strip
 * showed only the current cycle, so at the end of a cycle that spilled into
 * a new week (two leftovers on Tuesday and Wednesday, say) the rest of that
 * week looked empty until the cycle wrapped (reported).
 */
export function upcomingSessionDates(r: Rotation, until: Date, today = new Date()): Date[] {
  const out: Date[] = [];
  if (!r.schedule.length) return out;
  const overdue = overdueDays(r, today);
  let cur: Rotation = overdue > 0 ? shiftRemaining(r, overdue) : r;
  let prev = addDays(startOfDay(today), -1);
  // A cycle has at most 7 sessions; ~5 weeks of them is plenty for any range asked.
  for (let n = 0; n < 40; n++) {
    let date = plannedDate(cur, cur.cyclePosition);
    if (daysBetween(prev, date) <= 0) date = addDays(prev, 1);
    if (daysBetween(date, until) < 0) break;
    out.push(date);
    cur = advanceRotation(cur, date, date).rotation;
    prev = date;
  }
  return out;
}

/** True when a session of `r` is planned on `date` (today or later), in
 *  this cycle or a later one (`upcomingSessionDates`). */
export function hasPlannedSession(r: Rotation, date: Date, today = new Date()): boolean {
  if (daysBetween(today, date) < 0) return false;
  return upcomingSessionDates(r, date, today).some((d) => daysBetween(d, date) === 0);
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
  if (rotation && hasPlannedSession(rotation, date, today)) {
    return "training";
  }
  return "rest";
}
