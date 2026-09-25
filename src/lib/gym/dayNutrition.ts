import { useMemo } from "react";
import { dayKeyFromDate } from "./date";
import {
  RESISTANCE_TRAINING_MET,
  SUPERSET_TRAINING_MET,
  restDayGoals,
  sessionEnergyKcal,
  type NutritionGoals,
} from "./nutrition";
import { dayTypeFor, parseDayKey, type DayType } from "./schedule";
import { useGym } from "./store";

/** Session length assumed before any workout has been logged — the
 *  generator's own default duration. */
const DEFAULT_SESSION_MINUTES = 45;
/** How many recent sessions "your usual session length" averages over. */
const RECENT_SESSIONS = 10;

export interface SessionEnergy {
  kcal: number;
  weightKg: number;
  minutes: number;
  met: number;
}

/** Your usual session: average planned length of your recent finished
 *  workouts, and the Compendium MET for how you train (supersets on →
 *  the circuit/reciprocal-supersets code, else plain multi-exercise). */
export function useSessionShape(): { minutes: number; met: number } {
  const { workouts, supersetsEnabled } = useGym();
  return useMemo(() => {
    const recent = workouts.filter((w) => w.finished).slice(0, RECENT_SESSIONS);
    const minutes = recent.length
      ? Math.round(recent.reduce((sum, w) => sum + w.duration_minutes, 0) / recent.length)
      : DEFAULT_SESSION_MINUTES;
    const met = supersetsEnabled ? SUPERSET_TRAINING_MET : RESISTANCE_TRAINING_MET;
    return { minutes, met };
  }, [workouts, supersetsEnabled]);
}

/** The extra energy of one of your typical sessions — what a rest day
 *  subtracts (see lib/gym/nutrition.ts for the sources). Null without a
 *  bodyweight from the questionnaire, since the estimate needs one. */
export function useSessionEnergy(): SessionEnergy | null {
  const { nutritionProfile, weightLog } = useGym();
  const { minutes, met } = useSessionShape();
  return useMemo(() => {
    // The latest weigh-in beats the questionnaire's one-off answer.
    const weightKg = weightLog.at(-1)?.kg ?? nutritionProfile?.weightKg;
    if (!weightKg) return null;
    return { kcal: sessionEnergyKcal(weightKg, minutes, met), weightKg, minutes, met };
  }, [nutritionProfile, weightLog, minutes, met]);
}

/** Whether `date` is a training or rest day, and the nutrition limits that
 *  apply to it. With day-type limits off (or no bodyweight to estimate a
 *  session from), every day uses `nutritionGoals` unchanged. The rotation
 *  consulted is the program when one exists, else the weekly plan — the
 *  same precedence the plan cards use. */
export function useDayNutrition(date: Date): {
  dayType: DayType;
  goals: NutritionGoals;
  byDayType: boolean;
} {
  const {
    nutritionGoals,
    nutritionByDayType,
    restDayGoalOverrides,
    program,
    weeklyScheme,
    workouts,
    activeWorkout,
  } = useGym();
  const session = useSessionEnergy();
  const key = dayKeyFromDate(date);
  return useMemo(() => {
    const dayType = dayTypeFor(parseDayKey(key), {
      rotation: program ?? weeklyScheme,
      workouts,
      activeWorkout,
    });
    const goals =
      nutritionByDayType && dayType === "rest"
        ? restDayGoals(nutritionGoals, restDayGoalOverrides, session?.kcal ?? 0)
        : nutritionGoals;
    return { dayType, goals, byDayType: nutritionByDayType };
  }, [
    key,
    program,
    weeklyScheme,
    workouts,
    activeWorkout,
    nutritionByDayType,
    nutritionGoals,
    restDayGoalOverrides,
    session,
  ]);
}
