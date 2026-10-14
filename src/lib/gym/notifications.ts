import { dayKeyFromDate } from "./date";
import { CAFFEINE_DAILY_LIMIT_MG } from "./nutrition";
import { overdueDays, mondayOf, type Rotation } from "./schedule";
import { currentWeekStreak, MIN_TRAINING_DAYS_PER_WEEK, trainingDaysThisWeek } from "./streak";
import { weeklyTarget, weeklySets } from "./volume";
import type { Muscle, Workout } from "./types";

/**
 * The Home bell's messages. Everything is derived from the app's own state
 * each time, never stored: a message is there while its condition holds. Only
 * "seen" is remembered (by id), so an id carries the day or week it belongs
 * to and a repeat tomorrow or next week counts as new again. The thresholds
 * below are UI choices (when a nudge is useful), not training numbers.
 */
export type NotificationKind =
  | "resume"
  | "missed"
  | "targetReached"
  | "streakRisk"
  | "water"
  | "caffeine"
  | "weekendOver"
  | "weighIn";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  /** Where tapping the message goes. */
  href: "/session" | "/generate" | "/history" | "/nutrition";
  /** Search for `href`, when it needs one. */
  search?: Record<string, string>;
  /** Values the message text is built from. */
  muscles?: Muscle[];
  count?: number;
}

export interface NotificationInput {
  now: Date;
  workouts: Workout[];
  activeWorkout: Workout | null;
  rotation: Rotation | null;
  focus: Set<Muscle>;
  waterMl: number;
  waterGoalMl: number | null;
  caffeineMg: number;
  lastWeighInMs: number | null;
  /** Whether the user tracks weight at all (has at least one weigh-in). */
  weighsIn: boolean;
  /** Average kcal a day over the limit on the finished, logged weekend days
   *  (Saturday, Sunday) of the weekend budget; null with it off or none. */
  weekendOverKcal: number | null;
}

/** Local hour after which a water goal under half-way is worth a nudge. */
export const WATER_NUDGE_HOUR = 15;
/** Days without a weigh-in before the reminder (a weekly weigh-in is what the
 *  trend card asks for). */
export const WEIGH_IN_AFTER_DAYS = 7;
/** Calories a day over the weekend budget, on average, that are worth a
 *  nudge: the Lose It! cohort (Reynolds et al., JMIR mHealth 2018) lost as
 *  much with a small weekend excess, and less once it passed 250–500 kcal a
 *  day, so this is the low end of that range. */
export const WEEKEND_OVER_NUDGE_KCAL = 250;
/** Weekday (Date#getDay) from which a week short of its training days is at
 *  risk: Friday, with the weekend left. */
const STREAK_RISK_FROM_DAY = 5;

export function buildNotifications(i: NotificationInput): AppNotification[] {
  const out: AppNotification[] = [];
  const dayKey = dayKeyFromDate(i.now);
  const weekKey = dayKeyFromDate(mondayOf(i.now));

  if (i.activeWorkout) {
    out.push({ id: `resume:${i.activeWorkout.id}`, kind: "resume", href: "/session" });
  } else if (i.rotation) {
    const late = overdueDays(i.rotation, i.now);
    if (late > 0) {
      out.push({
        id: `missed:${i.rotation.anchor}:${i.rotation.cyclePosition}`,
        kind: "missed",
        href: "/generate",
        count: late,
      });
    }
  }

  const done = weeklySets(i.workouts, i.activeWorkout, i.now);
  const reached = (Object.keys(done) as Muscle[]).filter(
    (m) => (done[m] ?? 0) >= weeklyTarget(m, i.focus),
  );
  if (reached.length) {
    out.push({
      id: `target:${weekKey}:${reached.sort().join(",")}`,
      kind: "targetReached",
      href: "/history",
      search: { tab: "activity" },
      muscles: reached,
    });
  }

  const days = trainingDaysThisWeek(i.workouts, i.now);
  if (
    i.now.getDay() >= STREAK_RISK_FROM_DAY &&
    days < MIN_TRAINING_DAYS_PER_WEEK &&
    currentWeekStreak(i.workouts, i.now) > 0
  ) {
    out.push({
      id: `streak:${weekKey}`,
      kind: "streakRisk",
      href: "/generate",
      count: MIN_TRAINING_DAYS_PER_WEEK - days,
    });
  }

  if (i.waterGoalMl && i.now.getHours() >= WATER_NUDGE_HOUR && i.waterMl < i.waterGoalMl / 2) {
    out.push({
      id: `water:${dayKey}`,
      kind: "water",
      href: "/nutrition",
      search: { tab: "drinks" },
    });
  }

  if (i.caffeineMg >= CAFFEINE_DAILY_LIMIT_MG) {
    out.push({
      id: `caffeine:${dayKey}`,
      kind: "caffeine",
      href: "/nutrition",
      search: { tab: "drinks" },
    });
  }

  // Sunday to Tuesday, once a weekend day is finished: the weekend ran over.
  if (
    i.weekendOverKcal != null &&
    i.weekendOverKcal >= WEEKEND_OVER_NUDGE_KCAL &&
    [0, 1, 2].includes(i.now.getDay())
  ) {
    const saturday = new Date(mondayOf(i.now));
    saturday.setDate(saturday.getDate() + (i.now.getDay() === 0 ? 5 : -2));
    out.push({
      id: `weekend:${dayKeyFromDate(saturday)}`,
      kind: "weekendOver",
      href: "/nutrition",
      count: Math.round(i.weekendOverKcal),
    });
  }

  if (
    i.weighsIn &&
    i.lastWeighInMs !== null &&
    i.now.getTime() - i.lastWeighInMs >= WEIGH_IN_AFTER_DAYS * 86_400_000
  ) {
    out.push({
      id: `weigh:${weekKey}`,
      kind: "weighIn",
      href: "/nutrition",
      search: { tab: "weight" },
    });
  }

  return out;
}
