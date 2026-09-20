import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import {
  Apple,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Flame,
  LayoutGrid,
  type LucideIcon,
  Play,
  Search,
  Snowflake,
  Trophy,
  Zap,
} from "lucide-react";
import { ProfileAvatar } from "../components/gym/ProfileAvatar";
import {
  NUTRIENT_ORDER,
  dailyTotals,
  dayKeyFromDate,
  entriesForDay,
  nutrientStatus,
  type Macros,
  type NutrientStatus,
  type NutritionGoals,
} from "../lib/gym/nutrition";
import { currentProgramWeek } from "../lib/gym/programs";
import { personalRecords } from "../lib/gym/progress";
import { splitDayLabel, splitTemplateById } from "../lib/gym/splits";
import { bestStreak, currentStreak } from "../lib/gym/streak";
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
    weeklyScheme,
    program,
    foodEntries,
    nutritionGoals,
    avatarId,
  } = useGym();

  const streak = useMemo(() => currentStreak(workouts), [workouts]);
  const longestStreak = useMemo(() => bestStreak(workouts), [workouts]);
  const sessionsThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
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

  const dateLabel = useMemo(
    () =>
      new Date()
        .toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
        .toUpperCase(),
    [],
  );

  /** A single hero at the top of the screen carries both "what's next" and its
   *  own CTA, replacing what would otherwise be a separate quick-actions row
   *  plus a separate training-plan card — there's only vertical room here for
   *  one dominant element, and this is the one thing the screen most wants to
   *  say. Priority: an in-progress session always wins (resuming it is more
   *  urgent than anything else); then an active Program; then a WeeklyScheme;
   *  otherwise a plain "generate" prompt. */
  let heroIcon: LucideIcon = Zap;
  let heroEyebrow = "No plan yet";
  let heroTitle = "Ready to train?";
  let heroSub: string | null = null;
  let heroCta = "Generate";
  let heroTarget: "/session" | "/generate" = "/generate";

  if (activeWorkout) {
    heroIcon = Play;
    heroEyebrow = "Session in progress";
    heroTitle = `${activeWorkout.plan.length} exercises · ${activeWorkout.completed_sets.length} sets logged`;
    heroSub = null;
    heroCta = "Resume";
    heroTarget = "/session";
  } else if (program && programWeek) {
    heroIcon = programWeek.type === "deload" ? Snowflake : Flame;
    heroEyebrow = `Week ${program.currentWeek + 1} of ${program.weeks.length}${
      programWeek.type === "deload" ? " · Deload" : ""
    }`;
    heroTitle = `Next: ${programDayLabel}`;
    const templateLabel = splitTemplateById(program.templateId).label;
    heroSub = program.name === templateLabel ? templateLabel : `${program.name} · ${templateLabel}`;
    heroCta = "Continue";
    heroTarget = "/generate";
  } else if (weeklyScheme && schemeSlot) {
    heroIcon = Flame;
    heroEyebrow = splitTemplateById(weeklyScheme.templateId).label;
    heroTitle = `Next: ${schemeDayLabel}`;
    heroSub = null;
    heroCta = "Continue";
    heroTarget = "/generate";
  }
  const HeroIcon = heroIcon;

  if (!hydrated) return <div className="fixed inset-0 bg-background" />;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <header className="safe-top shrink-0 flex items-center justify-between gap-3 px-5 pb-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">
            {dateLabel}
          </p>
          <h1 className="truncate text-[27px] font-bold leading-tight tracking-tight">
            {greeting()}
          </h1>
        </div>
        <button
          onClick={() => {
            haptic(12);
            navigate({ to: "/settings" });
          }}
          aria-label="Settings"
          className="flex shrink-0 items-center justify-center rounded-full active:scale-95"
        >
          <ProfileAvatar avatarId={avatarId} size={42} />
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-4 pb-[calc(5.625rem+var(--tab-bar-clearance))] pt-3">
        <button
          onClick={() => {
            haptic(12);
            navigate({ to: heroTarget });
          }}
          className="glass glow shrink-0 rounded-[28px] p-5 text-left transition-transform active:scale-[0.98]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                <HeroIcon className="size-3.5" /> {heroEyebrow}
              </p>
              <p className="mt-1.5 truncate text-[20px] font-bold leading-tight">{heroTitle}</p>
              {heroSub ? (
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{heroSub}</p>
              ) : null}
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary py-2.5 pl-4 pr-3 text-[14px] font-bold text-primary-foreground">
              {heroCta} <ChevronRight className="size-4" />
            </span>
          </div>
          {program && programWeek ? (
            <div className="mt-3.5 flex gap-1">
              {program.weeks.map((w, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i < program.currentWeek
                      ? "bg-primary/40"
                      : i === program.currentWeek
                        ? "bg-primary"
                        : "bg-white/10"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </button>

        <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-[1.3fr_1fr] gap-2.5">
          <NutritionTile
            active={todayEntries.length > 0}
            hasGoals={hasNutritionGoals}
            totals={todayTotals}
            goals={nutritionGoals}
            calorieStatus={calorieStatus}
            caloriePct={caloriePct}
            onClick={() => navigate({ to: "/nutrition" })}
          />

          <BentoTile
            icon={Flame}
            active={streak > 0}
            label="Streak"
            onClick={() => navigate({ to: "/history" })}
          >
            <p className="tabular text-[28px] font-bold leading-none">{streak}</p>
            {longestStreak > streak ? (
              <p className="mt-1 text-[11px] text-muted-foreground">Best {longestStreak}</p>
            ) : null}
          </BentoTile>

          <BentoTile
            icon={Dumbbell}
            active={sessionsThisWeek > 0}
            label="Week"
            onClick={() => navigate({ to: "/history" })}
          >
            <p className="tabular text-[28px] font-bold leading-none">{sessionsThisWeek}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{workouts.length} total</p>
          </BentoTile>

          <BentoTile
            icon={Trophy}
            active={!!topPr}
            label="Best PR"
            onClick={() => navigate({ to: "/history" })}
          >
            {topPr ? (
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold leading-tight">{topPr.name}</p>
                <p className="tabular text-[12px] text-muted-foreground">{topPr.e1rm} kg e1RM</p>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">No PR yet</p>
            )}
          </BentoTile>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2.5">
          {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              onClick={() => {
                haptic(10);
                navigate({ to });
              }}
              className="glass flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl active:scale-95"
            >
              <Icon className="size-[18px] text-primary" />
              <span className="text-[11px] font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

/** Same tile family as BentoTile but wider (spans all 3 grid columns) and
 *  taller (grid-rows-[1.3fr_1fr] gives it more of row 1) — nutrition is the
 *  one stat here with four separate numbers worth glancing at (calories plus
 *  all three macros), so it gets the room the single-number tiles don't need. */
function NutritionTile({
  active,
  hasGoals,
  totals,
  goals,
  calorieStatus,
  caloriePct,
  onClick,
}: {
  active: boolean;
  hasGoals: boolean;
  totals: Macros;
  goals: NutritionGoals;
  calorieStatus: NutrientStatus;
  caloriePct: number;
  onClick: () => void;
}) {
  const barClass = (status: NutrientStatus) =>
    status === "over" ? "bg-destructive" : status === "near" ? "bg-chart-3" : "bg-primary";

  return (
    <button
      onClick={() => {
        haptic(10);
        onClick();
      }}
      className="glass relative col-span-3 flex min-h-0 flex-col gap-3 overflow-hidden rounded-3xl p-4 text-left active:scale-[0.98]"
    >
      <Apple
        className={`pointer-events-none absolute -bottom-5 -right-5 size-24 ${
          active ? "text-primary/[0.06]" : "text-white/[0.03]"
        }`}
        strokeWidth={1.5}
      />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
              active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            <Apple className="size-3.5" />
          </span>
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Nutrition today
          </span>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="relative">
        <p className="tabular text-[28px] font-bold leading-none">
          {totals.calories}
          <span className="text-[13px] font-medium text-muted-foreground">
            {goals.calories ? ` /${goals.calories}` : ""} kcal
          </span>
        </p>
        {hasGoals && goals.calories ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${barClass(calorieStatus)}`}
              style={{ width: `${caloriePct}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="relative grid grid-cols-3 gap-2">
        {(["protein", "carbs", "fat"] as const).map((key) => {
          const goal = goals[key];
          const status = nutrientStatus(totals[key], goal);
          const pct = goal ? Math.min(100, (totals[key] / goal) * 100) : 0;
          return (
            <div key={key} className="min-w-0 rounded-xl bg-muted/60 px-2.5 py-2">
              <p className="tabular text-[15px] font-bold leading-none">
                {totals[key]}
                <span className="text-[10px] font-medium text-muted-foreground">g</span>
              </p>
              <p className="mt-1 truncate text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {key === "protein" ? "Protein" : key === "carbs" ? "Carbs" : "Fat"}
                {goal != null ? `/${goal}` : ""}
              </p>
              {goal != null ? (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-background/40">
                  <div
                    className={`h-full rounded-full ${barClass(status)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </button>
  );
}

function BentoTile({
  icon: Icon,
  active,
  label,
  onClick,
  children,
}: {
  icon: LucideIcon;
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={() => {
        haptic(10);
        onClick();
      }}
      className="glass relative flex min-h-0 flex-col gap-2 overflow-hidden rounded-3xl p-3.5 text-left active:scale-[0.97]"
    >
      <Icon
        className={`pointer-events-none absolute -bottom-2.5 -right-2.5 size-12 ${
          active ? "text-primary/10" : "text-white/[0.04]"
        }`}
        strokeWidth={1.5}
      />
      <div className="flex items-center gap-1.5">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
            active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="relative min-w-0">{children}</div>
    </button>
  );
}
