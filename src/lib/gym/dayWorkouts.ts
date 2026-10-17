import { fitDayOf } from "./dayFit";
import { regionsForMuscles, targetsFromRegions } from "./anatomy";
import { exerciseById } from "./data";
import { generateWorkout, suggestionFor, type GenerateArgs } from "./generator";
import type { Program, ProgramWeek } from "./programs";
import { dayKey, dayKeyFromDate } from "./date";
import { doneDate, isCardioSlot, type Rotation } from "./schedule";
import { musclesForSlot, type ScheduleSlot, type SplitTemplateId } from "./splits";
import type { CardioSession, DayWorkout, PlannedExercise, Workout } from "./types";
import type { VolumeMuscle } from "./volume";

/**
 * Workouts saved per day of a weekly plan or program, so the week repeats as
 * a fixed routine: each lifting slot can hold a `workout` that "Start {day}"
 * uses as is instead of generating a new one, and a program can be
 * pre-generated in full, one workout per day per week (`weekWorkouts`).
 *
 * Pre-generating gives every week its own exercises, unless the program's
 * "same exercises every week" is on (a routine, so the progression in
 * progression.ts has the same lifts to build on); each week's volume is
 * applied, so a deload week has half the working sets. The
 * suggested weights are not frozen: they're worked out again when the day
 * is started (`readyToStart`), from the history up to that day.
 */

/** Everything the generator needs that isn't the day itself. */
export type DayWorkoutContext = Omit<
  GenerateArgs,
  "duration" | "targets" | "variation" | "weekDone" | "intensityMultiplier" | "volumeMultiplier"
> & { growthFocus: VolumeMuscle[] };

/** The workout to use for a slot: its week's pre-generated one (programs),
 *  else the one saved for the day, else null (generate as before). */
export function savedWorkoutFor(slot: ScheduleSlot | undefined, week?: number): DayWorkout | null {
  if (!slot || isCardioSlot(slot)) return null;
  return (week !== undefined ? slot.weekWorkouts?.[week] : null) ?? slot.workout ?? null;
}

/** True when the slot's workout for `week` was pre-generated for that week
 *  (so its sets already match the week). */
export const hasWeekWorkout = (slot: ScheduleSlot | undefined, week: number): boolean =>
  !!slot?.weekWorkouts?.[week];

/** Generates a workout for one slot's day type: its muscles (a full-body day
 *  picks the most-due ones now), a fresh week (nothing done yet, since it's
 *  repeated every week), and `variation` so two days of the same type in a
 *  week don't get the same plan. */
export function generateDayWorkout(
  ctx: DayWorkoutContext,
  templateId: SplitTemplateId,
  slot: ScheduleSlot,
  duration: number,
  variation = 0,
  now = new Date(),
): DayWorkout | null {
  if (isCardioSlot(slot)) return null;
  const { growthFocus, ...args } = ctx;
  const muscles = musclesForSlot(templateId, slot, args.history ?? [], growthFocus);
  const targets = targetsFromRegions(regionsForMuscles(muscles, slot.dayId));
  const plan = generateWorkout({
    ...args,
    focusMuscles: args.focusMuscles ?? growthFocus,
    duration,
    targets,
    variation,
    weekDone: {},
    ...(fitDayOf(slot.dayId) ? { day: fitDayOf(slot.dayId)! } : {}),
  });
  return { plan, duration_minutes: duration, target_muscles: muscles, saved_at: now.toISOString() };
}

/** How many earlier slots in the schedule train the same day type: the
 *  variation for that slot, so Upper A and Upper B differ. */
export const slotVariation = (schedule: ScheduleSlot[], index: number): number =>
  schedule.slice(0, index).filter((s) => s.dayId === schedule[index]?.dayId).length;

/** A schedule with a workout generated and saved for every lifting slot that
 *  has none yet (all of them with `replace`). Cardio days are left alone. */
export function withAllDayWorkouts(
  schedule: ScheduleSlot[],
  ctx: DayWorkoutContext,
  templateId: SplitTemplateId,
  duration: number,
  { replace = false, now = new Date() }: { replace?: boolean; now?: Date } = {},
): ScheduleSlot[] {
  return schedule.map((slot, i) => {
    if (isCardioSlot(slot) || (slot.workout && !replace)) return slot;
    const workout = generateDayWorkout(
      ctx,
      templateId,
      slot,
      duration,
      slotVariation(schedule, i),
      now,
    );
    return workout ? { ...slot, workout } : slot;
  });
}

/** A saved workout as it is in a given program week: the week's volume
 *  applied to its working sets (a deload halves them, at least 1 each). */
export function forWeek(workout: DayWorkout, week: ProgramWeek): DayWorkout {
  if (week.volume === 1) return workout;
  return {
    ...workout,
    plan: workout.plan.map((p) => ({
      ...p,
      target_sets: Math.max(1, Math.round(p.target_sets * week.volume)),
    })),
  };
}

/** The program with every week's workout made for every lifting day. With
 *  the program's "same exercises every week" on (off by default), each day's
 *  saved workout (generated first where there is none) is carried through
 *  the weeks with each week's volume, so day 1 of week 2 repeats day 1 of
 *  week 1. With it off (the default), every week gets its own exercises (week 1 keeps the
 *  day's saved workout). Replaces earlier pre-generated weeks. */
export function pregenerateProgram(
  program: Program,
  ctx: DayWorkoutContext,
  duration: number,
  now = new Date(),
): Program {
  const same = program.sameExercises === true;
  const filled = withAllDayWorkouts(program.schedule, ctx, program.templateId, duration, { now });
  const schedule = filled.map((slot, i) => {
    if (!slot.workout) return slot;
    const base = slot.workout;
    const sameType = filled.filter((s) => s.dayId === slot.dayId).length;
    const weekWorkouts = program.weeks.map((w, k) => {
      if (same || k === 0) return forWeek(base, w);
      const own = generateDayWorkout(
        ctx,
        program.templateId,
        slot,
        base.duration_minutes,
        slotVariation(filled, i) + k * sameType,
        now,
      );
      return forWeek(own ?? base, w);
    });
    return { ...slot, weekWorkouts };
  });
  return { ...program, schedule };
}

/** Every saved workout of a schedule made again (after a setting that shapes
 *  them changed: supersets, warm-ups): days that had one get a new one at
 *  their own length; days without stay generated on the day. */
export function regenerateSaved(
  schedule: ScheduleSlot[],
  ctx: DayWorkoutContext,
  templateId: SplitTemplateId,
  now = new Date(),
): ScheduleSlot[] {
  return schedule.map((slot, i) => {
    if (!slot.workout) return slot;
    const workout = generateDayWorkout(
      ctx,
      templateId,
      slot,
      slot.workout.duration_minutes,
      slotVariation(schedule, i),
      now,
    );
    return workout ? { ...slot, workout } : slot;
  });
}

/** The program without its pre-generated weeks (the days' saved workouts stay). */
export function clearPregenerated(program: Program): Program {
  return {
    ...program,
    schedule: program.schedule.map(({ weekWorkouts: _w, ...slot }) => slot),
  };
}

/** True when every lifting day of the program has a workout for every week. */
export const isPregenerated = (program: Program): boolean =>
  program.schedule.some((s) => !isCardioSlot(s)) &&
  program.schedule.every(
    (s) => isCardioSlot(s) || program.weeks.every((_, w) => !!s.weekWorkouts?.[w]),
  );

/** A saved plan ready to start today: exercises no longer in the catalog
 *  dropped, the week's volume applied unless it was made for that week, and
 *  the suggested weights worked out again from the history so far (with the
 *  week's intensity, e.g. a deload's 90%). */
export function readyToStart(
  workout: DayWorkout,
  ctx: Pick<GenerateArgs, "history" | "knownLifts" | "profile" | "bodyKg">,
  week?: { week: ProgramWeek; preGenerated: boolean },
): PlannedExercise[] {
  const sized = week && !week.preGenerated ? forWeek(workout, week.week) : workout;
  return sized.plan.flatMap((p) => {
    const ex = exerciseById(p.exercise_id);
    if (!ex) return [];
    const { suggested_weight: _w, suggested_reps: _r, suggested_basis: _b, ...rest } = p;
    return [
      {
        ...rest,
        ...suggestionFor(ex, p.target_reps, {
          ...ctx,
          intensityMultiplier: week?.week.intensity ?? 1,
        }),
      },
    ];
  });
}

/** What was logged for a finished session of the current cycle: the
 *  workout finished that day (one started from this plan first), or for a
 *  cardio day the cardio session of that day. Null for a skipped or upcoming
 *  session, or when nothing logged that day is found. */
export function loggedForSlot(
  rotation: Rotation,
  index: number,
  kind: "program" | "weeklyScheme",
  workouts: Workout[],
  cardio: CardioSession[],
): { workout: Workout } | { cardio: CardioSession } | null {
  const day = doneDate(rotation, index);
  const slot = rotation.schedule[index];
  if (!day || !slot) return null;
  const key = dayKeyFromDate(day);
  if (isCardioSlot(slot)) {
    const c = cardio.find((s) => dayKey(s.date) === key);
    return c ? { cardio: c } : null;
  }
  const onDay = workouts.filter((w) => w.finished && dayKey(w.date) === key);
  const fromPlan = onDay.find((w) => (kind === "program" ? w.fromProgramDay : w.fromScheduledDay));
  const workout = fromPlan ?? onDay[0];
  return workout ? { workout } : null;
}
