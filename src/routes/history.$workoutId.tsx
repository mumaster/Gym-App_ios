import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, ChevronLeft, Watch } from "lucide-react";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { CardHead } from "../components/gym/CardHead";
import { SessionRpePicker } from "../components/gym/SessionRpePicker";
import { HistoryExerciseCard } from "../components/gym/HistoryExerciseCard";
import { RecapShare } from "../components/gym/RecapShare";
import { WatchDataCard } from "../components/gym/WatchDataCard";
import { WatchImportSheet } from "../components/gym/WatchImportSheet";
import { sessionMinutes } from "../lib/gym/trainingLoad";
import { exerciseById } from "../lib/gym/data";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import { exerciseBreakdown } from "../lib/gym/exerciseBreakdown";
import { useGym } from "../lib/gym/store";

export const Route = createFileRoute("/history/$workoutId")({
  head: () => ({
    meta: [
      { title: "Session Details — Forge" },
      {
        name: "description",
        content:
          "Every logged set, weight, rep count and personal record from a single completed training session.",
      },
      { property: "og:title", content: "Session Details — Forge" },
      {
        property: "og:description",
        content: "Full set-by-set breakdown of one completed Forge workout.",
      },
    ],
  }),
  component: SessionDetailScreen,
});

function SessionDetailScreen() {
  const { workoutId } = useParams({ from: "/history/$workoutId" });
  const { workouts, hydrated, rateWorkout, setWorkoutWatch } = useGym();
  const [watchOpen, setWatchOpen] = useState(false);
  const t = useTranslation();
  const locale = useLocale();
  const workout = workouts.find((w) => w.id === workoutId);

  if (!hydrated) return <Screen title={t.historyDetail.title}>{null}</Screen>;

  if (!workout) {
    return (
      <Screen title={t.historyDetail.title}>
        <Card className="p-6 text-center">
          <p className="text-[17px] font-semibold">{t.historyDetail.sessionNotFound}</p>
          <Link
            to="/history"
            className="mt-3 inline-block text-[15px] font-semibold text-primary-text"
          >
            {t.historyDetail.backToHistory}
          </Link>
        </Card>
      </Screen>
    );
  }

  const sets = workout.completed_sets;
  const working = sets.filter((s) => s.set_type === "working");
  // Assistance (a negative load on a bodyweight exercise) isn't volume.
  const volume = sets.reduce((v, s) => v + Math.max(0, s.weight) * s.reps, 0);

  // PRs are judged against every *other* session (see exerciseBreakdown),
  // so a set badged "PR" here agrees with the History tab's PR list.
  const byExercise = exerciseBreakdown(workout, workouts).map((entry) => ({
    ...entry,
    name: exerciseById(entry.id)?.name ?? entry.id,
    muscle: exerciseById(entry.id)?.primary_muscle ?? "",
  }));

  const date = new Date(workout.date);

  return (
    <Screen
      title={date.toLocaleDateString(locale, { day: "numeric", month: "long" })}
      subtitle={date.toLocaleString(locale, {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      })}
      action={
        <Link
          to="/history"
          aria-label={t.historyDetail.backToHistory}
          className="glass flex size-11 items-center justify-center rounded-full"
        >
          <ChevronLeft className="size-5" />
        </Link>
      }
    >
      <Card className="grid grid-cols-3 gap-2 p-4 text-center">
        {[
          [t.historyDetail.duration, `${sessionMinutes(workout)} min`],
          [t.session.statSets, t.historyDetail.workingSets(working.length)],
          [t.historyDetail.volume, `${volume.toLocaleString(locale)} kg`],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="tabular text-[20px] font-bold">{value}</p>
            <p className="text-[12px] uppercase tracking-widest text-muted-foreground">{label}</p>
          </div>
        ))}
      </Card>

      <p className="mt-3 px-1 text-[13px] text-muted-foreground">
        {workout.target_muscles.join(" · ") || t.generate.fullBody}
      </p>

      <Card className="mt-4 overflow-hidden p-4">
        <CardHead
          icon={Activity}
          title={t.trainingLoad.sessionEffort}
          subtitle={t.trainingLoad.question}
          filled={workout.session_rpe != null}
        />
        <div className="space-y-2">
          <SessionRpePicker
            value={workout.session_rpe}
            onChange={(n) => rateWorkout(workout.id, n)}
          />
          {workout.session_rpe != null ? (
            <p className="text-[12px] text-muted-foreground">
              {t.trainingLoad.sessionLoadLine(
                workout.session_rpe,
                sessionMinutes(workout),
                workout.session_rpe * sessionMinutes(workout),
              )}
            </p>
          ) : null}
        </div>
      </Card>

      <SectionLabel>{t.watch.title}</SectionLabel>
      {workout.watch ? (
        <Card className="space-y-4 p-4">
          <WatchDataCard data={workout.watch} />
          <div className="flex gap-2">
            <button
              onClick={() => setWatchOpen(true)}
              className="glass min-h-[44px] flex-1 rounded-2xl text-[14px] font-semibold"
            >
              {t.watch.replace}
            </button>
            <button
              onClick={() => setWorkoutWatch(workout.id, null)}
              className="min-h-[44px] flex-1 rounded-2xl bg-destructive/10 text-[14px] font-semibold text-destructive-text"
            >
              {t.watch.remove}
            </button>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setWatchOpen(true)}
          className="glass flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold active:scale-[0.985]"
        >
          <Watch className="size-5 text-primary-text" /> {t.watch.add}
        </button>
      )}
      <WatchImportSheet
        open={watchOpen}
        onClose={() => setWatchOpen(false)}
        workoutId={workout.id}
      />

      <SectionLabel>{t.historyDetail.exercises}</SectionLabel>
      {byExercise.length === 0 ? (
        <Card className="p-6 text-center text-[15px] text-muted-foreground">
          {t.historyDetail.noSetsLogged}
        </Card>
      ) : null}

      <div className="space-y-3">
        {byExercise.map((ex) => (
          <HistoryExerciseCard
            key={ex.id}
            exerciseId={ex.id}
            name={ex.name}
            muscle={ex.muscle}
            rows={ex.rows}
            isPR={ex.isPR}
            bestE1rm={ex.bestE1rm}
          />
        ))}
      </div>
      <SectionLabel>{t.recap.title}</SectionLabel>
      <RecapShare workout={workout} />
    </Screen>
  );
}
