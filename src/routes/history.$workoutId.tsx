import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ChevronLeft, Trophy } from "lucide-react";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { exerciseById } from "../lib/gym/data";
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
  const { workouts, hydrated } = useGym();
  const workout = workouts.find((w) => w.id === workoutId);

  if (!hydrated) return <Screen title="Session">{null}</Screen>;

  if (!workout) {
    return (
      <Screen title="Session">
        <Card className="p-6 text-center">
          <p className="text-[17px] font-semibold">Session not found</p>
          <Link to="/history" className="mt-3 inline-block text-[15px] font-semibold text-primary">
            Back to history
          </Link>
        </Card>
      </Screen>
    );
  }

  const sets = workout.completed_sets;
  const working = sets.filter((s) => s.set_type === "working");
  const volume = sets.reduce((v, s) => v + s.weight * s.reps, 0);

  // Best weight per exercise across all *other* sessions, to flag PRs set here.
  const priorBest = new Map<string, number>();
  for (const w of workouts) {
    if (w.id === workout.id) continue;
    for (const s of w.completed_sets) {
      if (s.set_type === "warmup") continue;
      priorBest.set(s.exercise_id, Math.max(priorBest.get(s.exercise_id) ?? 0, s.weight));
    }
  }

  const byExercise = [...new Set(sets.map((s) => s.exercise_id))].map((id) => {
    const rows = sets.filter((s) => s.exercise_id === id);
    const heaviest = Math.max(
      ...rows.filter((s) => s.set_type === "working").map((s) => s.weight),
      0,
    );
    return {
      id,
      name: exerciseById(id)?.name ?? id,
      muscle: exerciseById(id)?.primary_muscle ?? "",
      rows,
      isPR: heaviest > 0 && heaviest > (priorBest.get(id) ?? 0),
      heaviest,
    };
  });

  const date = new Date(workout.date);

  return (
    <Screen
      title={date.toLocaleDateString(undefined, { day: "numeric", month: "long" })}
      subtitle={date.toLocaleString(undefined, {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      })}
      action={
        <Link
          to="/history"
          aria-label="Back to history"
          className="glass flex size-11 items-center justify-center rounded-full"
        >
          <ChevronLeft className="size-5" />
        </Link>
      }
    >
      <Card className="grid grid-cols-3 gap-2 p-4 text-center">
        {[
          ["Duration", `${workout.duration_minutes} min`],
          ["Sets", `${working.length} working`],
          ["Volume", `${volume.toLocaleString()} kg`],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="tabular text-[20px] font-bold">{value}</p>
            <p className="text-[12px] uppercase tracking-widest text-muted-foreground">{label}</p>
          </div>
        ))}
      </Card>

      <p className="mt-3 px-1 text-[13px] text-muted-foreground">
        {workout.target_muscles.join(" · ") || "Full body"}
      </p>

      <SectionLabel>Exercises</SectionLabel>
      {byExercise.length === 0 ? (
        <Card className="p-6 text-center text-[15px] text-muted-foreground">
          No sets were logged in this session.
        </Card>
      ) : null}

      <div className="space-y-3">
        {byExercise.map((ex) => (
          <Card key={ex.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[17px] font-semibold">{ex.name}</p>
                <p className="text-[13px] text-muted-foreground">{ex.muscle}</p>
              </div>
              {ex.isPR ? (
                <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[13px] font-bold text-primary">
                  <Trophy className="size-4" /> PR {ex.heaviest} kg
                </span>
              ) : null}
            </div>

            <div className="mt-3 space-y-1.5">
              {ex.rows.map((s, i) => (
                <div
                  key={`${s.set_number}-${i}`}
                  className="grid grid-cols-[44px_1fr_1fr] items-center gap-2 rounded-xl bg-muted px-3 py-2"
                >
                  <span className="tabular text-[13px] font-bold text-primary">
                    {s.set_type === "warmup" ? "W" : s.set_number}
                  </span>
                  <span className="tabular text-[15px] font-semibold">{s.weight} kg</span>
                  <span className="tabular text-right text-[15px] font-semibold">
                    {s.reps} reps{s.rpe ? <span className="text-primary"> @{s.rpe}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Screen>
  );
}
