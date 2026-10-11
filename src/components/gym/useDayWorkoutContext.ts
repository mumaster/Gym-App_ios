import { useMemo } from "react";
import type { DayWorkoutContext } from "../../lib/gym/dayWorkouts";
import { latestBodyKg } from "../../lib/gym/load";
import { learnPace } from "../../lib/gym/pace";
import { useGym } from "../../lib/gym/store";

/** What the generator needs to make a day's workout, from the app state:
 *  the same inputs the Generate screen uses (active equipment, history,
 *  pace, loved and avoided lifts, settings). */
export function useDayWorkoutContext(): DayWorkoutContext {
  const {
    profiles,
    activeProfileId,
    workouts,
    knownLifts,
    supersetsEnabled,
    warmupsEnabled,
    lovedExerciseIds,
    avoidedExerciseIds,
    weightLog,
    nutritionProfile,
    growthFocus,
  } = useGym();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const pace = useMemo(() => learnPace(workouts), [workouts]);
  return {
    equipment: profile.active_equipment_ids,
    profile,
    history: workouts,
    knownLifts,
    pace,
    supersets: supersetsEnabled,
    warmups: warmupsEnabled,
    loved: lovedExerciseIds,
    avoided: avoidedExerciseIds,
    bodyKg: latestBodyKg(weightLog, nutritionProfile),
    growthFocus,
  };
}
