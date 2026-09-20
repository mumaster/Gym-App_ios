import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Apple,
  CalendarDays,
  ChevronRight,
  Flame,
  LayoutGrid,
  Play,
  Search,
  Settings2,
  Snowflake,
  Trophy,
  Zap,
} from "lucide-react";
import { ProfileAvatar } from "../components/gym/ProfileAvatar";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { StreakCalendar } from "../components/gym/StreakCalendar";
import { estimateMinutes } from "../lib/gym/generator";
import {
  NUTRIENT_ORDER,
  dailyTotals,
  dayKeyFromDate,
  entriesForDay,
  nutrientStatus,
} from "../lib/gym/nutrition";
import { currentProgramWeek } from "../lib/gym/programs";
import { personalRecords } from "../lib/gym/progress";
import { splitDayLabel, splitTemplateById } from "../lib/gym/splits";
import { bestStreak, currentStreak, recentCalendar } from "../lib/gym/streak";
import { haptic, useGym } from "../lib/gym/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home — Forge" },
      {
        name: "description",
        content:
          "Your training and nutrition at a glance: today's plan, streak, macros and quick links to everything else.",
      },
      { property: "og:title", content: "Home — Forge" },
      {
        property: "og:description",
        content: "An overview of your training plan, streak, nutrition and recent activity.",
      },
    ],
  }),
  component: HomeScreen,
});

const GREETINGS = [
  [4, "Late one"],
  [11, "Good morning"],
  [14, "Good midday"],
  [18, "Good afternoon"],
  [22, "Good evening"],
] as const;

function greeting(): string {
  const hour = new Date().getHours();
  return GREETINGS.find(([h]) => hour < h)?.[1] ?? "Good night";
}

const QUICK_LINKS = [
  { to: "/equipment" as const, label: "Equipment", icon: LayoutGrid },
  { to: "/exercises" as const, label: "Exercises", icon: Search },
  { to: "/history" as const, label: "History", icon: CalendarDays },
];

function HomeScreen() {
  const navigate = useNavigate();
  const {
    hydrated,
    activeWorkout,
    workouts,
    workoutTemplates,
    weeklyScheme,
    program,
    foodEntries,
    nutritionGoals,
    avatarId,
    startWorkout,
  } = useGym();

  const streak = useMemo(() => currentStreak(workouts), [workouts]);
  const longestStreak = useMemo(() => bestStreak(workouts), [workouts]);
  const calendarColumns = useMemo(() => recentCalendar(workouts, 8), [workouts]);
  const sessionsThisWeek = useMemo(() => {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - weekMs;
    return workouts.filter((w) => new Date(w.date).getTime() >= cutoff).length;
  }, [workouts]);

  const topPr = useMemo(() => personalRecords(workouts)[0] ?? null, [workouts]);

  const todayKey = useMemo(() => dayKeyFromDate(new Date()), []);
  const todayEntries = useMemo(() => entriesForDay(foodEntries, todayKey), [foodEntries, todayKey]);
  const todayTotals = useMemo(() => dailyTotals(todayEntries), [todayEntries]);
  const hasNutritionGoals = NUTRIENT_ORDER.some((k) => nutritionGoals[k] != null);
  const calorieGoal = nutritionGoals.calories;
  const calorieStatus = nutrientStatus(todayTotals.calories, calorieGoal);
  const caloriePct = calorieGoal ? Math.min(100, (todayTotals.calories / calorieGoal) * 100) : 0;

  const programWeek = program ? currentProgramWeek(program) : null;
  const programSlot = program?.schedule[program.cyclePosition];
  const programDayLabel =
    program && programSlot ? splitDayLabel(program.templateId, programSlot.dayId) : "";
  const schemeSlot = weeklyScheme?.schedule[weeklyScheme.cyclePosition];
  const schemeDayLabel =
    weeklyScheme && schemeSlot ? splitDayLabel(weeklyScheme.templateId, schemeSlot.dayId) : "";

  const lastWorkout = workouts[0];

  const startTemplate = (
    plan: (typeof workoutTemplates)[number]["plan"],
    duration_minutes: number,
    target_muscles: (typeof workoutTemplates)[number]["target_muscles"],
  ) => {
    haptic([20, 40, 20]);
    startWorkout({ plan, duration_minutes, target_muscles });
    navigate({ to: "/session" });
  };

  if (!hydrated) return <Screen title="Home">{null}</Screen>;

  return (
    <Screen
      title="Home"
      subtitle={`${greeting()} — here's where things stand`}
      action={
        <button
          onClick={() => {
            haptic(12);
            navigate({ to: "/settings" });
          }}
          aria-label="Settings"
          className="flex items-center justify-center rounded-full"
        >
          <ProfileAvatar avatarId={avatarId} size={40} />
        </button>
      }
    >
      {activeWorkout ? (
        <Card className="mb-4 p-4 glow" onClick={() => navigate({ to: "/session" })}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-widest text-primary">
                Session in progress
              </p>
              <p className="mt-1 text-lg font-bold">
                {activeWorkout.plan.length} exercises · {activeWorkout.completed_sets.length} sets
                logged
              </p>
            </div>
            <ChevronRight className="size-6 text-primary" />
          </div>
        </Card>
      ) : null}

      <div className="flex gap-2">
        <button
          onClick={() => {
            haptic(12);
            navigate({ to: "/generate" });
          }}
          className="glow flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground active:scale-[0.985]"
        >
          <Zap className="size-4" /> Generate workout
        </button>
        <button
          onClick={() => {
            haptic(12);
            navigate({ to: "/nutrition" });
          }}
          className="glass flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-bold active:scale-[0.985]"
        >
          <Apple className="size-4" /> Log food
        </button>
      </div>

      <SectionLabel>Training plan</SectionLabel>
      {program && programWeek ? (
        <Card className="p-4" onClick={() => navigate({ to: "/generate" })}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-widest text-primary">
                {programWeek.type === "deload" ? (
                  <Snowflake className="size-3.5" />
                ) : (
                  <Flame className="size-3.5" />
                )}
                Week {program.currentWeek + 1} of {program.weeks.length}
                {programWeek.type === "deload" ? " · Deload" : ""}
              </p>
              <p className="mt-1 truncate text-[18px] font-bold">Next: {programDayLabel}</p>
              <p className="text-[13px] text-muted-foreground">
                {program.name} · {splitTemplateById(program.templateId).label}
              </p>
            </div>
            <ChevronRight className="size-6 shrink-0 text-primary" />
          </div>
          <div className="mt-3 flex gap-1">
            {program.weeks.map((w, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < program.currentWeek
                    ? "bg-primary/40"
                    : i === program.currentWeek
                      ? "bg-primary"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>
        </Card>
      ) : weeklyScheme && schemeSlot ? (
        <Card className="p-4" onClick={() => navigate({ to: "/generate" })}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold uppercase tracking-widest text-primary">
                {splitTemplateById(weeklyScheme.templateId).label}
              </p>
              <p className="mt-1 truncate text-[18px] font-bold">Next: {schemeDayLabel}</p>
              <p className="text-[13px] text-muted-foreground">
                {weeklyScheme.schedule.length} day{weeklyScheme.schedule.length === 1 ? "" : "s"} a
                week
              </p>
            </div>
            <ChevronRight className="size-6 shrink-0 text-primary" />
          </div>
        </Card>
      ) : (
        <Card className="p-4" onClick={() => navigate({ to: "/generate" })}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-semibold">No training plan yet</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Set up a weekly split or a multi-week program from the generator.
              </p>
            </div>
            <Settings2 className="size-5 shrink-0 text-primary" />
          </div>
        </Card>
      )}

      <SectionLabel>Activity</SectionLabel>
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Flame className={`size-6 ${streak > 0 ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <p className="tabular text-[20px] font-bold leading-none">{streak}</p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Day streak
              </p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="tabular text-[20px] font-bold leading-none">{sessionsThisWeek}</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">This week</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="tabular text-[20px] font-bold leading-none">{workouts.length}</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Total sessions
            </p>
          </div>
          {longestStreak > streak ? (
            <>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="tabular text-[20px] font-bold leading-none">{longestStreak}</p>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Best</p>
              </div>
            </>
          ) : null}
        </div>
        {workouts.length ? (
          <div className="mt-3">
            <StreakCalendar columns={calendarColumns} />
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-muted-foreground">
            Finish your first workout to start a streak.
          </p>
        )}
      </Card>

      <SectionLabel>Nutrition today</SectionLabel>
      <Card className="p-4" onClick={() => navigate({ to: "/nutrition" })}>
        {hasNutritionGoals && calorieGoal ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-semibold">Calories</span>
              <span className="tabular text-[13px] text-muted-foreground">
                {todayTotals.calories} / {calorieGoal} kcal
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  calorieStatus === "over"
                    ? "bg-destructive"
                    : calorieStatus === "near"
                      ? "bg-chart-3"
                      : "bg-primary"
                }`}
                style={{ width: `${caloriePct}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["protein", "carbs", "fat"] as const).map((key) => (
                <div key={key} className="rounded-xl bg-muted px-2 py-2 text-center">
                  <p className="tabular text-[14px] font-bold leading-none">
                    {todayTotals[key]}
                    <span className="text-[11px] font-medium text-muted-foreground">g</span>
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {key === "protein" ? "Protein" : key === "carbs" ? "Carbs" : "Fat"}
                    {nutritionGoals[key] != null ? ` / ${nutritionGoals[key]}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-semibold">
                {todayEntries.length
                  ? `${todayTotals.calories} kcal logged today`
                  : "Nothing logged today"}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Set daily limits to track progress toward a goal.
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-primary" />
          </div>
        )}
      </Card>

      {workoutTemplates.length > 0 ? (
        <>
          <SectionLabel>Saved templates</SectionLabel>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {workoutTemplates.slice(0, 6).map((t) => (
              <button
                key={t.id}
                onClick={() => startTemplate(t.plan, t.duration_minutes, t.target_muscles)}
                className="glass flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-left active:scale-[0.985]"
              >
                <div>
                  <p className="text-[13px] font-semibold">{t.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {t.plan.length} exercises · ~{estimateMinutes(t.plan)} min
                  </p>
                </div>
                <Play className="size-4 shrink-0 text-primary" />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {lastWorkout ? (
        <>
          <SectionLabel>Last session</SectionLabel>
          <Card
            className="p-4"
            onClick={() =>
              navigate({ to: "/history/$workoutId", params: { workoutId: lastWorkout.id } })
            }
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[16px] font-semibold">
                  {new Date(lastWorkout.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {lastWorkout.target_muscles.join(" · ") || "Full body"} ·{" "}
                  {lastWorkout.completed_sets.length} sets
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-primary" />
            </div>
          </Card>
        </>
      ) : null}

      {topPr ? (
        <>
          <SectionLabel>Best lift</SectionLabel>
          <Card
            className="flex items-center justify-between p-4"
            onClick={() => navigate({ to: "/history" })}
          >
            <div>
              <span className="text-[16px] font-semibold">{topPr.name}</span>
              <p className="text-[12px] text-muted-foreground">
                {topPr.weight}kg × {topPr.reps}
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[14px] font-bold text-primary">
              <Trophy className="size-4" />
              {topPr.e1rm} kg
            </span>
          </Card>
        </>
      ) : null}

      <SectionLabel>More</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
          <button
            key={to}
            onClick={() => {
              haptic(10);
              navigate({ to });
            }}
            className="glass flex flex-col items-center justify-center gap-1.5 rounded-2xl py-4 active:scale-95"
          >
            <Icon className="size-5 text-primary" />
            <span className="text-[12px] font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}
