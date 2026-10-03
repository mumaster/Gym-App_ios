import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Trophy,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ExerciseProgressChart } from "../components/gym/ExerciseProgressChart";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { StreakCalendar } from "../components/gym/StreakCalendar";
import { TrainingLoadCard } from "../components/gym/TrainingLoadCard";
import { CardioWeekCard } from "../components/gym/CardioWeekCard";
import { CARDIO_ICONS, cardioName } from "../components/gym/cardioDisplay";
import { GrowthFocusCard, WeeklySetsCard } from "../components/gym/WeeklyVolume";
import { RouteThumb } from "../components/gym/RouteMapView";
import { WatchImportSheet } from "../components/gym/WatchImportSheet";
import { exerciseById } from "../lib/gym/data";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import { formatLoad, isBodyweightExercise } from "../lib/gym/load";
import { personalRecords } from "../lib/gym/progress";
import { mondayOf } from "../lib/gym/schedule";
import { sessionLoad, sessionMinutes } from "../lib/gym/trainingLoad";
import { useRouteMap } from "../lib/gym/routeMapStore";
import { cardioMinutes, formatPace } from "../lib/gym/watch";
import {
  bestWeekStreak,
  currentWeekStreak,
  recentCalendar,
  trainingDaysThisWeek,
} from "../lib/gym/streak";
import { useGym } from "../lib/gym/store";
import { SegmentedTabs } from "../components/gym/SegmentedTabs";
import type { CardioSession, Muscle, Workout } from "../lib/gym/types";
import { chip } from "../components/gym/ui";

/** A row in the sessions list: a Forge strength session or watch-only cardio. */
type SessionItem =
  | { kind: "workout"; date: string; workout: Workout }
  | { kind: "cardio"; date: string; cardio: CardioSession };

function itemLoad(item: SessionItem): number | null {
  if (item.kind === "workout") return sessionLoad(item.workout);
  const minutes = cardioMinutes(item.cardio);
  return item.cardio.session_rpe == null || minutes == null
    ? null
    : item.cardio.session_rpe * minutes;
}

/** History's sub-tabs. The past sessions come first, since looking one up
 *  is what the tab is mostly for; the charts and weekly cards sit behind
 *  the other two instead of above the list. */
const HISTORY_TABS = ["sessions", "progress", "activity"] as const;
export type HistoryTab = (typeof HISTORY_TABS)[number];

export const Route = createFileRoute("/history/")({
  // The sub-tab is in the URL, so Back from a session or a link from Home
  // lands on the right one.
  validateSearch: (search: Record<string, unknown>): { tab?: HistoryTab } =>
    HISTORY_TABS.includes(search["tab"] as HistoryTab) && search["tab"] !== "sessions"
      ? { tab: search["tab"] as HistoryTab }
      : {},
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
  const { workouts, cardioSessions, hydrated } = useGym();
  const t = useTranslation();
  const locale = useLocale();
  const { tab = "sessions" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setTab = (next: HistoryTab) => {
    void navigate({ search: next === "sessions" ? {} : { tab: next }, replace: true });
    window.scrollTo({ top: 0 });
  };

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
  const daysThisWeek = useMemo(() => trainingDaysThisWeek(workouts), [workouts]);
  // A rolling 30 days rather than this calendar month, which read 0 on the 1st.
  const last30 = useMemo(() => {
    const since = Date.now() - 30 * 86_400_000;
    return [...workouts, ...cardioSessions].filter((x) => Date.parse(x.date) >= since).length;
  }, [workouts, cardioSessions]);

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

  /** Sessions (strength and cardio) grouped by Monday–Sunday week, newest first. */
  const weeks = useMemo(() => {
    const groups = new Map<number, SessionItem[]>();
    const items: SessionItem[] = [
      ...workouts.map((w) => ({ kind: "workout" as const, date: w.date, workout: w })),
      ...cardioSessions.map((c) => ({ kind: "cardio" as const, date: c.date, cardio: c })),
    ];
    for (const item of items) {
      const key = mondayOf(new Date(item.date)).getTime();
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([monday, list]) => ({
        monday: new Date(monday),
        list: list.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
      }));
  }, [workouts, cardioSessions]);
  const [weeksShown, setWeeksShown] = useState(4);
  const [watchOpen, setWatchOpen] = useState(false);

  if (!hydrated) return <Screen title={t.history.title}>{null}</Screen>;

  return (
    <Screen
      title={t.history.title}
      subtitle={t.history.completedSessions(workouts.length + cardioSessions.length)}
      toolbar={
        <SegmentedTabs tabs={HISTORY_TABS} value={tab} onChange={setTab} labels={t.history.tabs} />
      }
    >
      {tab === "sessions" ? (
        <>
          {workouts.length === 0 && cardioSessions.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-[17px] font-semibold">{t.history.noSessionsYet}</p>
              <p className="mt-1 text-[14px] text-muted-foreground">
                {t.history.noSessionsYetDesc}
              </p>
            </Card>
          ) : null}

          {workouts.length || cardioSessions.length ? (
            <button
              onClick={() => setTab("activity")}
              className="glass mt-1 grid w-full grid-cols-3 rounded-2xl py-3 text-left active:scale-[0.99]"
              aria-label={t.history.overviewAria}
            >
              {[
                { value: streak, label: t.history.weekStreak, icon: true },
                { value: daysThisWeek, label: t.history.daysThisWeek, icon: false },
                { value: last30, label: t.history.last30Days, icon: false },
              ].map((stat, i) => (
                <div key={stat.label} className={`px-3 ${i ? "border-l border-border" : ""}`}>
                  <p className="tabular flex items-center gap-1 text-[20px] font-bold leading-none">
                    {stat.icon ? (
                      <Flame
                        className={`size-4 ${streak > 0 ? "text-primary-text" : "text-muted-foreground"}`}
                      />
                    ) : null}
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[12px] leading-tight text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </button>
          ) : null}

          {/* Always shown: someone who only does cardio imports their first
          session from here, before any Forge workout exists. A full-width
          button on its own row, in the secondary style the plan card's
          "Adjust this week" uses: squeezed onto the Recent label's line it
          looked out of place. */}
          <button
            onClick={() => setWatchOpen(true)}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl bg-muted text-[14px] font-bold text-secondary-foreground active:scale-[0.985]"
          >
            <Watch className="size-4" /> {t.watch.importFromWatch}
          </button>
          <SectionLabel>{t.history.recent}</SectionLabel>
          <WatchImportSheet open={watchOpen} onClose={() => setWatchOpen(false)} />
          {/* Grouped by week: an ever-growing list of identical cards was the
          longest thing in the app (20 sessions ≈ 1,700px). */}
          <div className="space-y-4">
            {weeks.slice(0, weeksShown).map(({ monday, list }) => {
              const loads = list.map(itemLoad).filter((l): l is number => l != null);
              const cardioCount = list.filter((x) => x.kind === "cardio").length;
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
                        list.length - cardioCount,
                        cardioCount,
                        load != null ? load.toLocaleString(locale) : null,
                      )}
                    </p>
                  </div>
                  <Card className="overflow-hidden p-0">
                    {list.map((item, i) => {
                      if (item.kind === "cardio") {
                        return (
                          <CardioRow key={item.cardio.id} cardio={item.cardio} first={i === 0} />
                        );
                      }
                      const w = item.workout;
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
                          <SessionIcon icon={Dumbbell} />
                          <div className="min-w-0 flex-1">
                            {/* Laid out like a cardio row: date · what, then the
                            numbers (minutes and heart rate included) on the
                            second line, so the muscles get the full width. */}
                            <p className="truncate text-[15px] font-semibold">
                              {new Date(w.date).toLocaleDateString(locale, {
                                day: "numeric",
                                month: "short",
                              })}
                              <span className="font-normal text-muted-foreground">
                                {" · "}
                                {w.target_muscles.join(" · ") || t.generate.fullBody}
                              </span>
                            </p>
                            <p className="tabular mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted-foreground">
                              {t.history.setsAndVolume(
                                w.completed_sets.length,
                                volume.toLocaleString(locale),
                              )}
                              {" · "}
                              {t.history.minutesShort(sessionMinutes(w))}
                              {w.watch?.avgHr != null ? (
                                <span
                                  className="flex items-center gap-0.5"
                                  aria-label={`${t.watch.avgHr} ${w.watch.avgHr} ${t.watch.bpm}`}
                                >
                                  <HeartPulse className="size-3.5 text-primary-text" />
                                  {w.watch.avgHr}
                                </span>
                              ) : null}
                            </p>
                          </div>
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
              className="glass mt-3 min-h-[48px] w-full rounded-2xl text-[15px] font-semibold text-primary-text active:scale-[0.985]"
            >
              {t.history.showMore}
            </button>
          ) : null}
        </>
      ) : null}

      {tab === "progress" ? (
        <>
          {workouts.length ? null : (
            <Card className="p-6 text-center">
              <p className="text-[14px] text-muted-foreground">{t.history.progressEmpty}</p>
            </Card>
          )}
          {workouts.length ? (
            <>
              <SectionLabel>{t.history.perExercise}</SectionLabel>
              <div ref={chartRef} className="scroll-mt-28">
                <Card className="p-4">
                  {shownId ? (
                    <>
                      <div className="no-scrollbar -mx-1 -my-1.5 mb-1.5 flex gap-1.5 overflow-x-auto px-1 py-1.5">
                        {trackable.map((x) => (
                          <button
                            key={x.id}
                            onClick={() => setChartId(x.id)}
                            aria-pressed={x.id === shownId}
                            className={`tap-target min-h-[34px] shrink-0 rounded-full px-3 text-[13px] font-semibold ${
                              x.id === shownId ? chip.on : "bg-secondary text-secondary-foreground"
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
                              chartRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
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
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[14px] font-bold text-primary-text">
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
        </>
      ) : null}

      {tab === "activity" ? (
        <>
          {workouts.length > 0 ? (
            <>
              <SectionLabel>{t.history.streak}</SectionLabel>
              <Card className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Flame
                      className={`size-6 ${streak > 0 ? "text-primary-text" : "text-muted-foreground"}`}
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
                <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
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

          {/* Cardio sits with the other "this week" cards; always shown, since
          someone who only does cardio logs it from here too. */}
          <div className="mt-4">
            <CardioWeekCard />
          </div>

          {workouts.length ? (
            <>
              <SectionLabel>{t.volume.thisWeek}</SectionLabel>
              <WeeklySetsCard />
              {/* Picking which muscles to grow lives next to the weekly sets it
              sets the targets for; on the Workout tab it sat in the middle
              of building today's session. */}
              <div className="mt-3">
                <GrowthFocusCard />
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

/** The leading tile every session row has, the same size as a route
 *  thumbnail, so strength and cardio rows line up. */
function SessionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"
    >
      <Icon className="size-5 text-primary-text" />
    </span>
  );
}

function CardioRow({ cardio, first }: { cardio: CardioSession; first: boolean }) {
  const t = useTranslation();
  const locale = useLocale();
  const { watch } = cardio;
  const minutes = cardioMinutes(cardio);
  const map = useRouteMap(cardio.hasRouteMap ? cardio.id : null);
  const detail = [
    watch.distanceKm != null
      ? `${watch.distanceKm.toLocaleString(locale, { maximumFractionDigits: 2 })} km`
      : null,
    watch.avgPaceSeconds != null ? `${formatPace(watch.avgPaceSeconds)}${t.watch.perKm}` : null,
    minutes != null ? t.history.minutesShort(minutes) : null,
  ].filter(Boolean);
  const Icon = cardio.activity ? CARDIO_ICONS[cardio.activity] : Footprints;
  return (
    <Link
      to="/history/cardio/$cardioId"
      params={{ cardioId: cardio.id }}
      className={`flex items-center gap-3 px-4 py-3 active:bg-foreground/5 ${
        first ? "" : "border-t border-border"
      }`}
    >
      {/* The route's shape, in the accent, when a map was imported. */}
      {map ? <RouteThumb map={map} className="size-10" /> : <SessionIcon icon={Icon} />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center text-[15px] font-semibold">
          <span className="truncate">
            {/* No weekday (strength rows too): with the icon or route
                thumbnail beside it, "Wed, Jun 10 · Buiten hardlopen" doesn't
                fit at 390pt. */}
            {new Date(cardio.date).toLocaleDateString(locale, {
              day: "numeric",
              month: "short",
            })}
            <span className="font-normal text-muted-foreground">
              {" · "}
              {cardioName(cardio, t)}
            </span>
          </span>
        </p>
        {/* Minutes and heart rate sit on this line rather than at the right,
            so the activity name ("Buiten hardlopen") fits on the first at
            390pt. Strength rows do the same. */}
        {detail.length || watch.avgHr != null ? (
          <p className="tabular mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted-foreground">
            {detail.join(" · ")}
            {watch.avgHr != null ? (
              <span
                className="flex items-center gap-0.5"
                aria-label={`${t.watch.avgHr} ${watch.avgHr} ${t.watch.bpm}`}
              >
                <HeartPulse className="size-3.5 text-primary-text" />
                {watch.avgHr}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
