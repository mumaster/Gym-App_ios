import { Heart, Pencil, ShieldOff, Youtube } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { ExerciseProgressChart } from "./ExerciseProgressChart";
import { exerciseVideoUrl } from "../../lib/gym/exerciseVideo";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { formatLoad, isBodyweightExercise } from "../../lib/gym/load";
import { haptic, useGym } from "../../lib/gym/store";
import type { Exercise, LoggedSet, Workout } from "../../lib/gym/types";
import { chip } from "./ui";

/**
 * An exercise's page: love/avoid, your history with it, the technique video,
 * instructions, targets and cues. Opened from the Exercises tab, a generated
 * plan on the Workout tab, and an exercise's title during a session.
 * `onEdit` is only passed where the exercise editor lives (Exercises tab).
 */
export function ExerciseDetailSheet({
  exercise,
  onClose,
  onEdit,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  onEdit?: (exercise: Exercise) => void;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const {
    lovedExerciseIds,
    toggleLovedExercise,
    avoidedExerciseIds,
    toggleAvoidedExercise,
    workouts,
    bestSet,
    exerciseNotes,
  } = useGym();

  return (
    <BottomSheet open={!!exercise} onClose={onClose} title={exercise?.name ?? ""}>
      {exercise ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                haptic(12);
                toggleLovedExercise(exercise.id);
              }}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold ${
                lovedExerciseIds.includes(exercise.id) ? chip.on : "glass text-secondary-foreground"
              }`}
            >
              <Heart
                className={`size-4 ${lovedExerciseIds.includes(exercise.id) ? "fill-current" : ""}`}
              />
              {lovedExerciseIds.includes(exercise.id)
                ? t.exercises.lovedThis
                : t.exercises.loveThis}
            </button>
            <button
              onClick={() => {
                haptic(12);
                toggleAvoidedExercise(exercise.id);
              }}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold ${
                avoidedExerciseIds.includes(exercise.id)
                  ? "bg-destructive text-destructive-foreground"
                  : "glass text-secondary-foreground"
              }`}
            >
              <ShieldOff className="size-4" />
              {avoidedExerciseIds.includes(exercise.id)
                ? t.exercises.avoided
                : t.exercises.avoidThis}
            </button>
            {onEdit ? (
              <button
                onClick={() => onEdit(exercise)}
                aria-label={t.exercises.edit(exercise.name)}
                className="glass flex min-h-[44px] w-12 shrink-0 items-center justify-center rounded-2xl text-secondary-foreground"
              >
                <Pencil className="size-4" />
              </button>
            ) : null}
          </div>
          <a
            href={exerciseVideoUrl(exercise)}
            target="_blank"
            rel="noreferrer noopener"
            className="glass flex min-h-[48px] items-center gap-3 rounded-2xl px-4 active:scale-[0.985]"
          >
            <Youtube className="size-5 shrink-0 text-primary-text" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{t.exercises.watchVideo}</span>
              <span className="block text-[12px] text-muted-foreground">
                {t.exercises.videoSource}
              </span>
            </span>
          </a>
          <ExerciseHistory
            exerciseId={exercise.id}
            workouts={workouts}
            best={bestSet(exercise.id)}
            note={exerciseNotes[exercise.id]}
            bodyweight={isBodyweightExercise(exercise)}
            locale={locale}
          />
          <p className="text-[15px] text-muted-foreground">{exercise.instructions}</p>
          <div>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t.exercises.targets}
            </p>
            <div className="flex flex-wrap gap-2">
              {(exercise.muscle_targets.length
                ? exercise.muscle_targets
                : [exercise.primary_muscle]
              ).map((m, i) => (
                <span
                  key={m}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                    i === 0 ? chip.on : "bg-primary/15 text-primary-text"
                  }`}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[exercise.primary_muscle, ...exercise.secondary_muscles].map((m) => (
              <span
                key={m}
                className="rounded-full bg-secondary px-3 py-1.5 text-[13px] font-semibold text-secondary-foreground"
              >
                {m}
              </span>
            ))}
          </div>
          <ul className="space-y-1.5">
            {exercise.cues.map((c) => (
              <li key={c} className="text-[15px]">
                • {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </BottomSheet>
  );
}

/** The detail sheet's own history for one exercise: how often and when,
 *  the best set, the progress chart and your saved note. */
function ExerciseHistory({
  exerciseId,
  workouts,
  best,
  note,
  bodyweight,
  locale,
}: {
  exerciseId: string;
  workouts: Workout[];
  best: LoggedSet | undefined;
  note: string | undefined;
  bodyweight: boolean;
  locale: string;
}) {
  const t = useTranslation();
  const sessions = workouts.filter((w) =>
    w.completed_sets.some((s) => s.exercise_id === exerciseId && s.set_type === "working"),
  );
  return (
    <div className="rounded-2xl bg-muted/50 p-3.5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t.exercises.yourHistory}
      </p>
      {sessions.length ? (
        <div className="mt-1.5 space-y-2">
          <p className="text-[14px]">
            {t.exercises.historySummary(
              sessions.length,
              new Date(Math.max(...sessions.map((w) => Date.parse(w.date)))).toLocaleDateString(
                locale,
                { day: "numeric", month: "short" },
              ),
            )}
          </p>
          {best ? (
            <p className="tabular text-[14px] font-semibold">
              {t.exercises.bestSet(
                `${formatLoad(best.weight, bodyweight, t.session.bw)} × ${best.reps}`,
              )}
            </p>
          ) : null}
          <ExerciseProgressChart exerciseId={exerciseId} height={120} />
        </div>
      ) : (
        <p className="mt-1.5 text-[13px] text-muted-foreground">{t.exercises.noHistory}</p>
      )}
      {note ? (
        <div className="mt-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t.exercises.yourNote}
          </p>
          <p className="mt-1 text-[14px]">{note}</p>
        </div>
      ) : null}
    </div>
  );
}
