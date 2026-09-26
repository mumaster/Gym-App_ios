import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ChevronRight, Flame, Trophy } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ExerciseProgressChart } from "../components/gym/ExerciseProgressChart";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { StreakCalendar } from "../components/gym/StreakCalendar";
import { TrainingLoadCard } from "../components/gym/TrainingLoadCard";
import { WeeklySetsCard } from "../components/gym/WeeklyVolume";
import { exerciseById } from "../lib/gym/data";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import { formatLoad, isBodyweightExercise } from "../lib/gym/load";
import { personalRecords } from "../lib/gym/progress";
import { mondayOf } from "../lib/gym/schedule";
import { sessionLoad, sessionMinutes } from "../lib/gym/trainingLoad";
import { bestWeekStreak, currentWeekStreak, recentCalendar } from "../lib/gym/streak";
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

  const streak = useMemo(() => currentWeekStreak(workouts), [workouts]);
  const longestStreak = useMemo(() => bestWeekStreak(workouts), [workouts]);
  const calendarColumns = useMemo(() => recentCalendar(workouts, 12), [workouts]);

  /** Exercises done in at least two sessions (a trend needs two points),
   *  most recently trained first — the progress chart's picker. */
  const trackable = useMemo(() => {
    const seen = new Map<string, { sessions: number; last: number }>();
    for (const w of workouts) {
      const ids = new Set(
        w.completed_sets.filter((s) => s.set_type === "working").map((s) => s.exercise_id),
      );
      for (const id of ids) {
        const cur = seen.get(id) ?? { sessions: 0, last: 0 };
        seen.set(id, { sessions: cur.sessions + 1, last: Math.max(cur.last, Date.parse(w.date)) });
      }
    }
    return [...seen.entries()]
      .filter(([, v]) => v.sessions >= 2)
      .sort((a, b) => b[1].last - a[1].last)
      .map(([id]) => ({ id, name: exerciseById(id)?.name ?? id }));
  }, [workouts]);
  // It used to always chart your heaviest lift; now any exercise, defaulting
  // to your top record when it's trackable, else the most recent one.
  const [chartId, setChartId] = useState<string | null>(null);
  const shownId =
    chartId && trackable.some((x) => x.id === chartId)
      ? chartId
      : ((trackable.find((x) => x.id === prs[0]?.exercise_id) ?? trackable[0])?.id ?? null);
  const chartRef = useRef<HTMLDivElement>(null);

  /** Sessions grouped by Monday–Sunday week, newest first. */
  const weeks = useMemo(() => {
    const groups = new Map<number, typeof workouts>();
    for (const w of workouts) {
      const key = mondayOf(new Date(w.date)).getTime();
      groups.set(key, [...(groups.get(key) ?? []), w]);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([monday, list]) => ({
        monday: new Date(monday),
        list: list.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
      }));
  }, [workouts]);
  const [weeksShown, setWeeksShown] = useState(4);

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
                    {t.history.weekStreak}
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
            <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
              {t.history.streakSource}
            </p>
          </Card>
        </>
      ) : null}

      {workouts.length ? (
        <>
          <SectionLabel>{t.trainingLoad.title}</SectionLabel>
          <TrainingLoadCard />
        </>
      ) : null}

      {workouts.length ? (
        <>
          <SectionLabel>{t.volume.thisWeek}</SectionLabel>
          <WeeklySetsCard />
        </>
      ) : null}

      {workouts.length ? (
        <>
          <SectionLabel>{t.history.progress}</SectionLabel>
          <div ref={chartRef} className="scroll-mt-28">
            <Card className="p-4">
              {shownId ? (
                <>
                  <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
                    {trackable.map((x) => (
                      <button
                        key={x.id}
                        onClick={() => setChartId(x.id)}
                        aria-pressed={x.id === shownId}
                        className={`min-h-[34px] shrink-0 rounded-full px-3 text-[13px] font-semibold ${
                          x.id === shownId
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {x.name}
                      </button>
                    ))}
                  </div>
                  <ExerciseProgressChart exerciseId={shownId} />
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground">{t.history.progressEmpty}</p>
              )}
            </Card>
          </div>
        </>
      ) : null}

      {prs.length ? (
        <>
          <SectionLabel>{t.history.personalRecords}</SectionLabel>
          <div className="space-y-2">
            {prs.map((p) => {
              const bw = isBodyweightExercise(exerciseById(p.exercise_id));
              const canChart = trackable.some((x) => x.id === p.exercise_id);
              return (
                <Card
                  key={p.exercise_id}
                  className="flex items-center justify-between gap-3 p-4"
                  {...(canChart
                    ? {
                        onClick: () => {
                          setChartId(p.exercise_id);
                          chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        },
                      }
                    : {})}
                >
                  <div className="min-w-0">
                    <span className="text-[16px] font-semibold">{p.name}</span>
                    <p className="tabular text-[12px] text-muted-foreground">
                      {formatLoad(p.weight, bw, t.session.bw)} × {p.reps}
                    </p>
                  </div>
                  {/* An estimate from the external load alone means nothing
                      for a bodyweight exercise, so it gets no pill. */}
                  {bw ? null : (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[14px] font-bold text-primary">
                      <Trophy className="size-4" />
                      {p.e1rm} kg
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
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

      {workouts.length ? <SectionLabel>{t.history.sessions}</SectionLabel> : null}
      {/* Grouped by week: an ever-growing list of identical cards was the
          longest thing in the app (20 sessions ≈ 1,700px). */}
      <div className="space-y-4">
        {weeks.slice(0, weeksShown).map(({ monday, list }) => {
          const loads = list.map(sessionLoad).filter((l): l is number => l != null);
          const load = loads.length ? loads.reduce((a, b) => a + b, 0) : null;
          return (
            <div key={monday.getTime()}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                <p className="text-[13px] font-semibold text-foreground">
                  {t.history.weekOf(
                    monday.toLocaleDateString(locale, { day: "numeric", month: "short" }),
                  )}
                </p>
                <p className="tabular text-[12px] text-muted-foreground">
                  {t.history.weekSummary(
                    list.length,
                    load != null ? load.toLocaleString(locale) : null,
                  )}
                </p>
              </div>
              <Card className="overflow-hidden p-0">
                {list.map((w, i) => {
                  const volume = w.completed_sets.reduce(
                    (v, s) => v + Math.max(0, s.weight) * s.reps,
                    0,
                  );
                  return (
                    <Link
                      key={w.id}
                      to="/history/$workoutId"
                      params={{ workoutId: w.id }}
                      className={`flex items-center gap-3 px-4 py-3 active:bg-foreground/5 ${
                        i > 0 ? "border-t border-border" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold">
                          {new Date(w.date).toLocaleDateString(locale, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                          <span className="font-normal text-muted-foreground">
                            {" · "}
                            {w.target_muscles.join(" · ") || t.generate.fullBody}
                          </span>
                        </p>
                        <p className="tabular mt-0.5 truncate text-[12.5px] text-muted-foreground">
                          {t.history.setsAndVolume(
                            w.completed_sets.length,
                            volume.toLocaleString(locale),
                          )}
                        </p>
                      </div>
                      <p className="tabular shrink-0 text-[13px] text-muted-foreground">
                        {t.history.minutesShort(sessionMinutes(w))}
                      </p>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  );
                })}
              </Card>
            </div>
          );
        })}
      </div>
      {weeks.length > weeksShown ? (
        <button
          onClick={() => setWeeksShown((n) => n + 8)}
          className="glass mt-3 min-h-[48px] w-full rounded-2xl text-[15px] font-semibold text-primary active:scale-[0.985]"
        >
          {t.history.showMore}
        </button>
      ) : null}
    </Screen>
  );
}
