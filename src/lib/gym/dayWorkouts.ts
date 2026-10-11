import { regionsForMuscles, targetsFromRegions } from "./anatomy";
import { exerciseById } from "./data";
import { generateWorkout, suggestionFor, type GenerateArgs } from "./generator";
import type { Program, ProgramWeek } from "./programs";
import { isCardioSlot } from "./schedule";
import { musclesForSlot, type ScheduleSlot, type SplitTemplateId } from "./splits";
import type { DayWorkout, PlannedExercise } from "./types";
import { focusMuscles, type FocusGroup } from "./volume";

/**
 * Workouts saved per day of a weekly plan or program, so the week repeats as
 * a fixed routine: each lifting slot can hold a `workout` that "Start {day}"
 * uses as is instead of generating a new one, and a program can be
 * pre-generated in full, one workout per day per week (`weekWorkouts`).
 *
 * Pre-generating keeps the same exercises every week (a routine, so the
 * progression in progression.ts has the same lifts to build on); only a
 * week's volume changes, so a deload week has half the working sets. The
 * suggested weights are not frozen: they're worked out again when the day
 * is started (`readyToStart`), from the history up to that day.
 */

/** Everything the generator needs that isn't the day itself. */
export type DayWorkoutContext = Omit<
  GenerateArgs,
  "duration" | "targets" | "variation" | "weekDone" | "intensityMultiplier" | "volumeMultiplier"
> & { growthFocus: FocusGroup[] };

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
    focusMuscles: args.focusMuscles ?? [...focusMuscles(growthFocus)],
    duration,
    targets,
    variation,
    weekDone: {},
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

/** The program with every week's workout made for every lifting day: each
 *  day's saved workout (generated first where there is none) carried through
 *  the weeks with each week's volume. Replaces earlier pre-generated weeks. */
export function pregenerateProgram(
  program: Program,
  ctx: DayWorkoutContext,
  duration: number,
  now = new Date(),
): Program {
  const schedule = withAllDayWorkouts(program.schedule, ctx, program.templateId, duration, {
    now,
  }).map((slot) =>
    slot.workout
      ? { ...slot, weekWorkouts: program.weeks.map((w) => forWeek(slot.workout!, w)) }
      : slot,
  );
  return { ...program, schedule };
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
