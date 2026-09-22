import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  Apple,
  CalendarDays,
  ChevronRight,
  Droplet,
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
  WATER_QUICK_ADD,
  dailyTotals,
  dayKeyFromDate,
  entriesForDay,
  formatLiters,
  nutrientStatus,
  type Macros,
  type NutrientStatus,
  type NutritionGoals,
} from "../lib/gym/nutrition";
import { currentProgramWeek } from "../lib/gym/programs";
import { personalRecords, type PersonalRecord } from "../lib/gym/progress";
import { READINESS_LABELS, todaysCheckIn, type ReadinessScore } from "../lib/gym/readiness";
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
    waterEntries,
    waterGoalMl,
    avatarId,
    logWater,
    readinessLog,
    setTodayReadiness,
  } = useGym();
  const [readinessEditing, setReadinessEditing] = useState(false);
  const todayCheckIn = todaysCheckIn(readinessLog);

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
  const todayWaterMl = useMemo(
    () => entriesForDay(waterEntries, todayKey).reduce((sum, e) => sum + e.ml, 0),
    [waterEntries, todayKey],
  );
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

      <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 pb-[calc(var(--tab-bar-content-clearance)+var(--tab-bar-clearance))] pt-2">
        <button
          onClick={() => {
            haptic(12);
            navigate({ to: heroTarget });
          }}
          className="glass glow shrink-0 rounded-[28px] p-4 text-left transition-transform active:scale-[0.98]"
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
            <div className="mt-2.5 flex gap-1">
              {program.weeks.map((w, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i < program.currentWeek
                      ? "bg-primary/40"
                      : i === program.currentWeek
                        ? "bg-primary"
                        : "bg-foreground/10"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </button>

        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[0.76fr_0.8fr_0.68fr_0.33fr_0.33fr] gap-2.5">
          <NutritionTile
            active={todayEntries.length > 0}
            hasGoals={hasNutritionGoals}
            totals={todayTotals}
            goals={nutritionGoals}
            calorieStatus={calorieStatus}
            caloriePct={caloriePct}
            onClick={() => navigate({ to: "/nutrition" })}
          />

          <WaterTile
            totalMl={todayWaterMl}
            goalMl={waterGoalMl}
            onAdd={(ml) => {
              haptic(12);
              logWater(ml);
            }}
            onOpen={() => navigate({ to: "/nutrition" })}
          />

          <ReadinessTile
            checkIn={todayCheckIn}
            editing={readinessEditing}
            onEdit={() => {
              haptic(12);
              setReadinessEditing(true);
            }}
            onPick={(score) => {
              haptic([15, 25]);
              setTodayReadiness(score);
              setReadinessEditing(false);
            }}
          />

          <ActivityTile
            streak={streak}
            longestStreak={longestStreak}
            sessionsThisWeek={sessionsThisWeek}
            totalWorkouts={workouts.length}
            onClick={() => navigate({ to: "/history" })}
          />

          <BestLiftTile pr={topPr} onClick={() => navigate({ to: "/history" })} />
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2.5">
          {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              onClick={() => {
                haptic(10);
                navigate({ to });
              }}
              className="glass flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl active:scale-95"
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
      aria-label="Nutrition today"
      className="glass relative col-span-2 flex min-h-0 flex-col gap-2 overflow-hidden rounded-3xl p-3.5 text-left active:scale-[0.98]"
    >
      <Apple
        className={`pointer-events-none absolute -bottom-5 -right-5 size-20 ${
          active ? "text-primary/[0.06]" : "text-foreground/[0.03]"
        }`}
        strokeWidth={1.5}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <Apple className="size-3.5" />
          </span>
          <span className="tabular truncate text-[19px] font-bold leading-none">
            {totals.calories}
            <span className="text-[12px] font-medium text-muted-foreground">
              {goals.calories ? ` /${goals.calories}` : ""} kcal
            </span>
          </span>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </div>

      {hasGoals && goals.calories ? (
        <div className="relative -mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${barClass(calorieStatus)}`}
            style={{ width: `${caloriePct}%` }}
          />
        </div>
      ) : null}

      <div className="relative grid grid-cols-3 gap-2">
        {(["protein", "carbs", "fat"] as const).map((key) => {
          const goal = goals[key];
          const status = nutrientStatus(totals[key], goal);
          const pct = goal ? Math.min(100, (totals[key] / goal) * 100) : 0;
          return (
            <div key={key} className="min-w-0 rounded-xl bg-muted/60 px-2.5 py-1.5">
              <p className="tabular text-[15px] font-bold leading-none">
                {totals[key]}
                <span className="text-[10px] font-medium text-muted-foreground">g</span>
              </p>
              <p className="mt-0.5 truncate text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {key === "protein" ? "Protein" : key === "carbs" ? "Carbs" : "Fat"}
                {goal != null ? `/${goal}` : ""}
              </p>
              {goal != null ? (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-background/40">
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

/** Full-width (col-span-2), replacing what used to be two separate square
 *  `BentoTile`s (Streak, This week) sharing one row as half-width cells.
 *  Reported as reading too cramped once the grid grew to five rows and
 *  every tile's padding got trimmed to fit real-device safe-area insets
 *  (see "A real-device screenshot caught genuine clipping" above) — the
 *  fix wasn't more padding on tiles already at their minimum, it was
 *  needing fewer distinct stat blocks in the first place. Streak and This
 *  week are both single-number, low-detail stats that read fine side by
 *  side in one slim row (icon + number + caption, twice, split by a
 *  vertical divider) instead of each getting its own icon badge, label
 *  row, big tabular number AND ghost-icon watermark stacked in a taller
 *  square cell — mirroring `BestLiftTile`'s own single-row shape below,
 *  including skipping the ghost watermark that only earns its keep on a
 *  tile tall enough to have real dead space to fill. Combining them this
 *  way is what actually freed the row height this grid's other tiles
 *  needed back — not a cosmetic merge, the mechanism the "less dense"
 *  pass ran on. */
function ActivityTile({
  streak,
  longestStreak,
  sessionsThisWeek,
  totalWorkouts,
  onClick,
}: {
  streak: number;
  longestStreak: number;
  sessionsThisWeek: number;
  totalWorkouts: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => {
        haptic(10);
        onClick();
      }}
      className="glass col-span-2 flex min-h-0 items-center gap-3 rounded-3xl p-3 text-left active:scale-[0.97]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
            streak > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Flame className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="tabular truncate text-[17px] font-bold leading-none">
            {streak}
            <span className="text-[11px] font-medium text-muted-foreground"> day streak</span>
          </p>
          <p className="mt-1 truncate text-[10.5px] text-muted-foreground">
            {longestStreak > streak ? `Best ${longestStreak}` : "Keep it going"}
          </p>
        </div>
      </div>

      <div className="h-8 w-px shrink-0 bg-border" />

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
            sessionsThisWeek > 0
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Dumbbell className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="tabular truncate text-[17px] font-bold leading-none">
            {sessionsThisWeek}
            <span className="text-[11px] font-medium text-muted-foreground"> this week</span>
          </p>
          <p className="mt-1 truncate text-[10.5px] text-muted-foreground">{totalWorkouts} total</p>
        </div>
      </div>
    </button>
  );
}

/** Full-width (col-span-2) like NutritionTile, but a single compact row
 *  rather than a stacked block — a PR's exercise name is the one piece of
 *  text on this whole screen with genuinely unpredictable length, and a
 *  horizontal layout gives it the full tile width to run into before
 *  `truncate` ever has to kick in, instead of the ~1/3-width column it had
 *  when this was a fourth cell in a square bento grid. Deliberately the
 *  lowest-emphasis tile on the screen now — smaller padding/icon/type than
 *  its own original size, trading its row's height to WaterTile below,
 *  since a PR is checked far less often day-to-day than water intake. Still
 *  sized against the catalog's longest exercise name (35 characters) at
 *  this smaller scale, not just at the old, larger one. */
function BestLiftTile({ pr, onClick }: { pr: PersonalRecord | null; onClick: () => void }) {
  return (
    <button
      onClick={() => {
        haptic(10);
        onClick();
      }}
      className="glass col-span-2 flex min-h-0 items-center gap-2.5 rounded-2xl p-2.5 text-left active:scale-[0.97]"
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
          pr ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        <Trophy className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Best lift
        </p>
        {pr ? (
          <p className="line-clamp-2 text-[13px] font-bold leading-tight">{pr.name}</p>
        ) : (
          <p className="truncate text-[12px] text-muted-foreground">
            No PR yet — finish a working set
          </p>
        )}
      </div>
      {pr ? (
        <span className="tabular shrink-0 rounded-full bg-primary px-2.5 py-1 text-[13px] font-bold text-primary-foreground">
          {pr.e1rm} kg
        </span>
      ) : null}
    </button>
  );
}

/** Full-width (col-span-2), the "bigger" sibling of the other stat tiles —
 *  water is the one Home tile whose whole point is letting you act on it
 *  without leaving the screen, so it deliberately breaks HomeScreen's own
 *  "read-mostly, never mutates state directly" rule (see the file's own
 *  header comment) for exactly this one case: `onAdd` calls `logWater`
 *  straight from the tap, no sheet, no navigation, no extra taps. A plain
 *  `<div>` rather than a `<button>` like the other tiles specifically so
 *  the quick-add buttons can nest inside it — a `<button>` can't legally
 *  contain another interactive element (the same HTML-content-model rule
 *  `ThemePicker`'s color swatch ran into). Tapping the header row (icon +
 *  total + chevron) still opens `/nutrition` like every other tile does;
 *  only that row is a real `<button>`, sitting as a sibling of the
 *  quick-add row rather than a wrapper around it. */
function WaterTile({
  totalMl,
  goalMl,
  onAdd,
  onOpen,
}: {
  totalMl: number;
  goalMl: number | null;
  onAdd: (ml: number) => void;
  onOpen: () => void;
}) {
  const pct = goalMl ? Math.min(100, (totalMl / goalMl) * 100) : 0;
  const active = totalMl > 0;

  return (
    <div className="glass relative col-span-2 flex min-h-0 flex-col justify-between gap-1.5 overflow-hidden rounded-3xl p-3.5">
      <Droplet
        className={`pointer-events-none absolute -bottom-5 -right-5 size-20 ${
          active ? "text-primary/[0.08]" : "text-foreground/[0.03]"
        }`}
        strokeWidth={1.5}
      />
      <button
        onClick={() => {
          haptic(10);
          onOpen();
        }}
        aria-label="Water intake today"
        className="relative flex items-center justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
              active ? "bg-sky-400/15 text-sky-400" : "bg-muted text-muted-foreground"
            }`}
          >
            <Droplet className="size-3.5" />
          </span>
          <span className="tabular truncate text-[19px] font-bold leading-none">
            {formatLiters(totalMl)}
            {goalMl ? (
              <span className="text-[12px] font-medium text-muted-foreground">
                {" "}
                / {formatLiters(goalMl)}
              </span>
            ) : null}
          </span>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {goalMl ? (
        <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      <div className="relative grid grid-cols-4 gap-1.5">
        {WATER_QUICK_ADD.map((ml) => (
          <button
            key={ml}
            onClick={() => onAdd(ml)}
            aria-label={`Add ${ml}ml of water`}
            className="flex min-h-[36px] items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground active:scale-95"
          >
            +{ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Moved here from `/generate` — the readiness check-in nudges suggested
 *  workout weights (see `progression.ts`'s `readinessWeightFactor`), but
 *  "how are you feeling" is a whole-day question, not a workout-generator
 *  one, and belongs on the screen that's actually the app's daily landing
 *  point. `/generate` still READS `readinessLog` for its own suggestion
 *  math (via `todaysCheckIn`) — only the check-in widget itself moved, not
 *  the data or its effect on generation.
 *
 *  Full-width like WaterTile, and for the same reason: this is the one
 *  other Home tile that calls a store action directly (`setTodayReadiness`)
 *  rather than only navigating, mirroring WaterTile's own break from
 *  HomeScreen's read-mostly rule — a same-screen tap beats a trip to
 *  Settings/`/generate` and back for something meant to be answered once,
 *  first thing. Two states, matching the original `/generate` card:
 *  answered-and-not-editing collapses to a single centered row (icon +
 *  emoji + label, tapping it re-opens the picker); anything else shows the
 *  5-wide emoji picker row instead. Both states share one fixed tile
 *  height (this is still a CSS Grid row, not a resizing card), so the
 *  picker's buttons are sized to fit within it rather than assumed to have
 *  the generator page's own unbounded vertical room. */
function ReadinessTile({
  checkIn,
  editing,
  onEdit,
  onPick,
}: {
  checkIn: { score: ReadinessScore } | undefined;
  editing: boolean;
  onEdit: () => void;
  onPick: (score: ReadinessScore) => void;
}) {
  const answered = checkIn && !editing;

  return (
    <div
      className={`glass relative col-span-2 flex min-h-0 flex-col overflow-hidden rounded-3xl p-3.5 ${
        answered ? "justify-center" : "justify-between gap-1.5"
      }`}
    >
      <Activity
        className={`pointer-events-none absolute -bottom-5 -right-5 size-20 ${
          checkIn ? "text-primary/[0.08]" : "text-foreground/[0.03]"
        }`}
        strokeWidth={1.5}
      />
      {answered ? (
        <button
          onClick={onEdit}
          aria-label="Today's readiness"
          className="relative flex items-center justify-between gap-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Activity className="size-3.5" />
            </span>
            <span className="truncate text-[14px] font-bold leading-none">
              {READINESS_LABELS[checkIn.score].emoji} {READINESS_LABELS[checkIn.score].label}
            </span>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-[11.5px] font-bold text-secondary-foreground">
            Change
          </span>
        </button>
      ) : (
        <>
          <div className="relative flex min-w-0 items-center gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Activity className="size-3.5" />
            </span>
            <span className="truncate text-[12.5px] font-semibold text-muted-foreground">
              How are you feeling today?
            </span>
          </div>
          <div className="relative grid grid-cols-5 gap-1.5">
            {([1, 2, 3, 4, 5] as ReadinessScore[]).map((score) => (
              <button
                key={score}
                onClick={() => onPick(score)}
                aria-label={READINESS_LABELS[score].label}
                className="flex min-h-[38px] items-center justify-center rounded-full bg-muted text-[17px] leading-none active:scale-95"
              >
                {READINESS_LABELS[score].emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
