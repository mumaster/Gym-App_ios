import { useMemo } from "react";
import { dayKeyFromDate } from "./date";
import { restDayGoals, type NutritionGoals } from "./nutrition";
import { dayTypeFor, parseDayKey, type DayType } from "./schedule";
import { useGym } from "./store";

/** Whether `date` is a training or rest day, and the nutrition limits that
 *  apply to it. With day-type limits off, every day uses `nutritionGoals`
 *  unchanged. The rotation consulted is the program when one exists, else
 *  the weekly plan — the same precedence the plan cards use. */
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
  const key = dayKeyFromDate(date);
  return useMemo(() => {
    const dayType = dayTypeFor(parseDayKey(key), {
      rotation: program ?? weeklyScheme,
      workouts,
      activeWorkout,
    });
    const goals =
      nutritionByDayType && dayType === "rest"
        ? restDayGoals(nutritionGoals, restDayGoalOverrides)
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
  ]);
}
