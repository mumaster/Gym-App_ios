import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronRight, Flame, Trophy } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { StreakCalendar } from "../components/gym/StreakCalendar";
import { exerciseById } from "../lib/gym/data";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import { e1rmTrend, personalRecords } from "../lib/gym/progress";
import { bestStreak, currentStreak, recentCalendar } from "../lib/gym/streak";
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
  const t = useTranslation();
  const locale = useLocale();

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

  const prs = useMemo(() => personalRecords(workouts).slice(0, 6), [workouts]);

  const streak = useMemo(() => currentStreak(workouts), [workouts]);
  const longestStreak = useMemo(() => bestStreak(workouts), [workouts]);
  const calendarColumns = useMemo(() => recentCalendar(workouts, 12), [workouts]);

  /** Session-by-session estimated-1RM trend for your top lift, when there's enough data. */
  const topLiftTrend = useMemo(() => {
    const top = prs[0];
    if (!top) return null;
    const points = e1rmTrend(top.exercise_id, workouts);
    if (points.length < 2) return null;
    return {
      name: top.name,
      points: points.map((p, i) => ({ session: i + 1, e1rm: p.e1rm })),
    };
  }, [prs, workouts]);

  if (!hydrated) return <Screen title={t.history.title}>{null}</Screen>;

  return (
    <Screen title={t.history.title} subtitle={t.history.completedSessions(workouts.length)}>
      {workouts.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-[17px] font-semibold">{t.history.noSessionsYet}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">{t.history.noSessionsYetDesc}</p>
        </Card>
      ) : null}

      {workouts.length > 0 ? (
        <>
          <SectionLabel>{t.history.streak}</SectionLabel>
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Flame
                  className={`size-6 ${streak > 0 ? "text-primary" : "text-muted-foreground"}`}
                />
                <div>
                  <p className="tabular text-[20px] font-bold leading-none">{streak}</p>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t.history.dayStreak}
                  </p>
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="tabular text-[20px] font-bold leading-none">{longestStreak}</p>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {t.history.best}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <StreakCalendar columns={calendarColumns} />
            </div>
          </Card>
        </>
      ) : null}

      {volumeByMuscle.length ? (
        <>
          <SectionLabel>{t.history.volumePerMuscle}</SectionLabel>
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

      {topLiftTrend ? (
        <>
          <SectionLabel>{t.history.progressFor(topLiftTrend.name)}</SectionLabel>
          <Card className="p-4">
            <p className="mb-2 text-[12px] text-muted-foreground">{t.history.estimated1rm}</p>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={topLiftTrend.points}>
                  <XAxis dataKey="session" hide />
                  <YAxis
                    domain={["dataMin - 5", "dataMax + 5"]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    width={32}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} kg`, t.history.est1rm]}
                    labelFormatter={(label) => t.history.sessionN(label)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="e1rm"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--primary)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      ) : null}

      {prs.length ? (
        <>
          <SectionLabel>{t.history.personalRecords}</SectionLabel>
          <div className="space-y-2">
            {prs.map((p) => (
              <Card key={p.exercise_id} className="flex items-center justify-between p-4">
                <div>
                  <span className="text-[16px] font-semibold">{p.name}</span>
                  <p className="text-[12px] text-muted-foreground">
                    {p.weight}kg × {p.reps}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[14px] font-bold text-primary">
                  <Trophy className="size-4" />
                  {p.e1rm} kg
                </span>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {workouts.length ? <SectionLabel>{t.history.sessions}</SectionLabel> : null}
      <div className="space-y-2">
        {workouts.map((w) => {
          const volume = w.completed_sets.reduce((v, s) => v + s.weight * s.reps, 0);
          return (
            <Link key={w.id} to="/history/$workoutId" params={{ workoutId: w.id }}>
              <Card className="p-4 active:scale-[0.99]">
                <div className="flex items-center justify-between">
                  <p className="text-[17px] font-semibold">
                    {new Date(w.date).toLocaleDateString(locale, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="tabular text-[14px] text-muted-foreground">
                      {t.history.minutesShort(w.duration_minutes)}
                    </p>
                    <ChevronRight className="size-5 text-primary" />
                  </div>
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {w.target_muscles.join(" · ") || t.generate.fullBody}
                </p>
                <p className="tabular mt-2 text-[14px]">
                  {t.history.setsAndVolume(w.completed_sets.length, volume.toLocaleString(locale))}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </Screen>
  );
}
