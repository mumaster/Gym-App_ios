import { exerciseById } from "./data";
import { isBodyweightExercise } from "./load";
import { estimated1RM } from "./progress";
import { sessionMinutes } from "./trainingLoad";
import type { LoggedSet, Workout } from "./types";

/** Everything the recap image shows, worked out from one finished workout
 *  and the history before it. Pure data — drawing is recapImage.ts. */
export interface RecapData {
  minutes: number;
  /** Working sets' weight × reps, in kg (bodyweight exercises count only
   *  added load, and assistance counts as none). */
  volumeKg: number;
  workingSets: number;
  exercises: RecapExercise[];
  prCount: number;
  sessionRpe?: number;
}

export interface RecapExercise {
  id: string;
  name: string;
  sets: number;
  best: LoggedSet;
  bodyweight: boolean;
  /** Best estimated-1RM set beat every earlier session's. */
  pr: boolean;
}

export function buildRecap(workout: Workout, allWorkouts: Workout[]): RecapData {
  const working = workout.completed_sets.filter((s) => s.set_type === "working");
  const earlier = allWorkouts.filter(
    (w) => w.id !== workout.id && new Date(w.date).getTime() < new Date(workout.date).getTime(),
  );
  const order: string[] = [];
  for (const s of working) if (!order.includes(s.exercise_id)) order.push(s.exercise_id);

  const exercises = order.map((id): RecapExercise => {
    const sets = working.filter((s) => s.exercise_id === id);
    const best = sets.reduce((a, b) =>
      estimated1RM(b) > estimated1RM(a) || (estimated1RM(b) === estimated1RM(a) && b.reps > a.reps)
        ? b
        : a,
    );
    const before = earlier.flatMap((w) =>
      w.completed_sets.filter((s) => s.exercise_id === id && s.set_type === "working"),
    );
    const bestBefore = before.length ? Math.max(...before.map(estimated1RM)) : null;
    const exercise = exerciseById(id);
    return {
      id,
      name: exercise?.name ?? id,
      sets: sets.length,
      best,
      bodyweight: isBodyweightExercise(exercise),
      // A first-ever session isn't a record — there's nothing to beat.
      pr: bestBefore != null && estimated1RM(best) > bestBefore,
    };
  });

  return {
    minutes: sessionMinutes(workout),
    volumeKg: Math.round(working.reduce((v, s) => v + Math.max(0, s.weight) * s.reps, 0)),
    workingSets: working.length,
    exercises,
    prCount: exercises.filter((e) => e.pr).length,
    ...(workout.session_rpe == null ? {} : { sessionRpe: workout.session_rpe }),
  };
}
