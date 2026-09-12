import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronRight, Trophy } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { exerciseById } from "../lib/gym/data";
import { useGym } from "../lib/gym/store";
import type { Muscle } from "../lib/gym/types";

export const Route = createFileRoute("/history/")({
  head: () => ({
    meta: [
      { title: "History & Progress — Forge" },
      {
        name: "description",
        content:
          "Review completed sessions, personal records and training volume per muscle group over time.",
      },
      { property: "og:title", content: "History & Progress — Forge" },
      {
        property: "og:description",
        content: "Completed sessions, PR badges and volume charts per muscle group.",
      },
    ],
  }),
  component: HistoryScreen,
});

function HistoryScreen() {
  const { workouts, hydrated } = useGym();

  const volumeByMuscle = useMemo(() => {
    const map = new Map<Muscle, number>();
    for (const w of workouts) {
      for (const s of w.completed_sets) {
        const ex = exerciseById(s.exercise_id);
        if (!ex || s.set_type === "warmup") continue;
        map.set(ex.primary_muscle, (map.get(ex.primary_muscle) ?? 0) + s.weight * s.reps);
      }
    }
    return [...map.entries()]
      .map(([muscle, volume]) => ({ muscle, volume }))
      .sort((a, b) => b.volume - a.volume);
  }, [workouts]);

  const prs = useMemo(() => {
    const best = new Map<string, number>();
    for (const w of workouts) {
      for (const s of w.completed_sets) {
        if (s.set_type === "warmup") continue;
        best.set(s.exercise_id, Math.max(best.get(s.exercise_id) ?? 0, s.weight));
      }
    }
    return [...best.entries()]
      .map(([id, weight]) => ({ name: exerciseById(id)?.name ?? id, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
  }, [workouts]);

  if (!hydrated) return <Screen title="History">{null}</Screen>;

  return (
    <Screen title="History" subtitle={`${workouts.length} completed sessions`}>
      {workouts.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-[17px] font-semibold">No sessions yet</p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Finish your first workout and it will show up here with PRs and volume charts.
          </p>
        </Card>
      ) : null}

      {volumeByMuscle.length ? (
        <>
          <SectionLabel>Volume per muscle (kg)</SectionLabel>
          <Card className="p-4">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeByMuscle}>
                  <XAxis
                    dataKey="muscle"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar dataKey="volume" radius={[8, 8, 0, 0]}>
                    {volumeByMuscle.map((d) => (
                      <Cell key={d.muscle} fill="var(--primary)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      ) : null}

      {prs.length ? (
        <>
          <SectionLabel>Personal records</SectionLabel>
          <div className="space-y-2">
            {prs.map((p) => (
              <Card key={p.name} className="flex items-center justify-between p-4">
                <span className="text-[16px] font-semibold">{p.name}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[14px] font-bold text-primary">
                  <Trophy className="size-4" />
                  {p.weight} kg
                </span>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {workouts.length ? <SectionLabel>Sessions</SectionLabel> : null}
      <div className="space-y-2">
        {workouts.map((w) => {
          const volume = w.completed_sets.reduce((v, s) => v + s.weight * s.reps, 0);
          return (
            <Link key={w.id} to="/history/$workoutId" params={{ workoutId: w.id }}>
              <Card className="p-4 active:scale-[0.99]">
                <div className="flex items-center justify-between">
                  <p className="text-[17px] font-semibold">
                    {new Date(w.date).toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="tabular text-[14px] text-muted-foreground">
                      {w.duration_minutes} min
                    </p>
                    <ChevronRight className="size-5 text-primary" />
                  </div>
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {w.target_muscles.join(" · ") || "Full body"}
                </p>
                <p className="tabular mt-2 text-[14px]">
                  {w.completed_sets.length} sets · {volume.toLocaleString()} kg volume
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

    </Screen>
  );
}
