import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  Apple,
  Check,
  ChevronRight,
  Droplet,
  Dumbbell,
  HeartPulse,
  Flame,
  type LucideIcon,
  Play,
  Snowflake,
  Trophy,
  Zap,
  CalendarClock,
  Moon,
} from "lucide-react";
import { SETTINGS_BUTTON_GUTTER, SettingsButton } from "../components/gym/SettingsButton";
import { HapticSwitch } from "../components/gym/HapticSwitch";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import {
  NUTRIENT_ORDER,
  formatWaterAmount,
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
import { exerciseById } from "../lib/gym/data";
import { dayKey, dayKeyFromDate as keyOf } from "../lib/gym/date";
import { formatLoad, isBodyweightExercise, latestBodyKg } from "../lib/gym/load";
import { latestPr, type LatestPr } from "../lib/gym/progress";
import { READINESS_EMOJI, todaysCheckIn, type ReadinessScore } from "../lib/gym/readiness";
import { useDayNutrition, type DayKind } from "../lib/gym/dayNutrition";
import {
  daysBetween,
  hasPlannedSession,
  mondayOf,
  overdueDays,
  plannedDate,
  type DayType,
  type Rotation,
} from "../lib/gym/schedule";
import { splitDayLabel, splitTemplateById } from "../lib/gym/splits";
import { addDays } from "../lib/gym/date";
import { cardioSessionsOn, remainingCardioOn } from "../lib/gym/cardio";
import { CARDIO_ICONS } from "../components/gym/cardioDisplay";
import { LogCardioSheet } from "../components/gym/LogCardioSheet";
import type { CardioPlanDay, CardioSession } from "../lib/gym/types";
import { bestWeekStreak, currentWeekStreak, trainingDaysThisWeek } from "../lib/gym/streak";
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

function HomeScreen() {
  const navigate = useNavigate();
  const t = useTranslation();
  const locale = useLocale();
  const {
    hydrated,
    activeWorkout,
    workouts,
    weeklyScheme,
    program,
    foodEntries,
    waterEntries,
    waterGoalMl,
    avatarId,
    logWater,
    readinessLog,
    setTodayReadiness,
    weightLog,
    nutritionProfile,
    cardioPlan,
    cardioSessions,
  } = useGym();
  const [readinessEditing, setReadinessEditing] = useState(false);
  const [cardioLogOpen, setCardioLogOpen] = useState(false);
  const todayCheckIn = todaysCheckIn(readinessLog);

  const streak = useMemo(() => currentWeekStreak(workouts), [workouts]);
  const longestStreak = useMemo(() => bestWeekStreak(workouts), [workouts]);
  // Monday–Sunday, the same weeks the streak, the week strip and History's
  // training-load card use (it used to be a rolling 7 days).
  const daysThisWeek = useMemo(() => trainingDaysThisWeek(workouts), [workouts]);

  const bodyKg = latestBodyKg(weightLog, nutritionProfile);
  const pr = useMemo(
    () => latestPr(workouts, (id) => isBodyweightExercise(exerciseById(id)), bodyKg),
    [workouts, bodyKg],
  );

  const todayKey = useMemo(() => dayKeyFromDate(new Date()), []);
  const todayEntries = useMemo(() => entriesForDay(foodEntries, todayKey), [foodEntries, todayKey]);
  const todayTotals = useMemo(() => dailyTotals(todayEntries), [todayEntries]);
  const todayWaterMl = useMemo(
    () => entriesForDay(waterEntries, todayKey).reduce((sum, e) => sum + e.ml, 0),
    [waterEntries, todayKey],
  );
  const today = useMemo(() => new Date(), []);
  const trainedKeys = useMemo(() => {
    const keys = new Set(workouts.map((w) => dayKey(w.date)));
    if (activeWorkout) keys.add(dayKey(activeWorkout.date));
    return keys;
  }, [workouts, activeWorkout]);
  const dayNutrition = useDayNutrition(today);
  const dayGoals = dayNutrition.goals;
  const hasNutritionGoals = NUTRIENT_ORDER.some((k) => dayGoals[k] != null);
  const calorieGoal = dayGoals.calories;
  const calorieStatus = nutrientStatus(todayTotals.calories, calorieGoal);
  const caloriePct = calorieGoal ? Math.min(100, (todayTotals.calories / calorieGoal) * 100) : 0;

  const programWeek = program ? currentProgramWeek(program) : null;
  const programSlot = program?.schedule[program.cyclePosition];
  const programDayLabel =
    program && programSlot ? splitDayLabel(program.templateId, programSlot.dayId) : "";
  const schemeSlot = weeklyScheme?.schedule[weeklyScheme.cyclePosition];
  const schemeDayLabel =
    weeklyScheme && schemeSlot ? splitDayLabel(weeklyScheme.templateId, schemeSlot.dayId) : "";

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 4) return t.home.greetingLate;
    if (hour < 11) return t.home.greetingMorning;
    if (hour < 14) return t.home.greetingMidday;
    if (hour < 18) return t.home.greetingAfternoon;
    if (hour < 22) return t.home.greetingEvening;
    return t.home.greetingNight;
  };

  const dateLabel = useMemo(
    () => new Date().toLocaleDateString(locale, t.home.dateFormat).toUpperCase(),
    [locale, t],
  );

  /** A single hero at the top of the screen carries both "what's next" and its
   *  own CTA, replacing what would otherwise be a separate quick-actions row
   *  plus a separate training-plan card — there's only vertical room here for
   *  one dominant element, and this is the one thing the screen most wants to
   *  say. Priority: an in-progress session always wins (resuming it is more
   *  urgent than anything else); then an active Program; then a WeeklyScheme;
   *  otherwise a plain "generate" prompt. */
  let heroIcon: LucideIcon = Zap;
  let heroEyebrow = t.home.noPlanYet;
  let heroTitle = t.home.readyToTrain;
  let heroSub: string | null = null;
  let heroCta = t.home.generate;
  let heroTarget: "/session" | "/generate" | "cardio" = "/generate";

  if (activeWorkout) {
    heroIcon = Play;
    heroEyebrow = t.home.sessionInProgress;
    heroTitle = t.home.sessionProgressTitle(
      activeWorkout.plan.length,
      activeWorkout.completed_sets.length,
    );
    heroSub = null;
    heroCta = t.home.resume;
    heroTarget = "/session";
  } else if (program && programWeek) {
    heroIcon = programWeek.type === "deload" ? Snowflake : Flame;
    heroEyebrow = t.home.weekOf(
      program.currentWeek + 1,
      program.weeks.length,
      programWeek.type === "deload",
    );
    heroTitle = t.home.nextDay(programDayLabel);
    const templateLabel = splitTemplateById(program.templateId).label;
    heroSub = program.name === templateLabel ? templateLabel : `${program.name} · ${templateLabel}`;
    heroCta = t.home.continueCta;
    heroTarget = "/generate";
    if (overdueDays(program) > 0) {
      heroIcon = CalendarClock;
      heroEyebrow = t.schedule.homeMissed(programDayLabel);
      heroCta = t.schedule.catchUp;
    }
  } else if (weeklyScheme && schemeSlot) {
    heroIcon = Flame;
    heroEyebrow = splitTemplateById(weeklyScheme.templateId).label;
    heroTitle = t.home.nextDay(schemeDayLabel);
    heroSub = null;
    heroCta = t.home.continueCta;
    heroTarget = "/generate";
    if (overdueDays(weeklyScheme) > 0) {
      heroIcon = CalendarClock;
      heroEyebrow = t.schedule.homeMissed(schemeDayLabel);
      heroCta = t.schedule.catchUp;
    }
  }
  // When the next scheduled session is planned — the hero said "Next: Push"
  // without saying whether that's today or on Monday.
  const rotation: Rotation | null = program ?? weeklyScheme ?? null;
  const whenLabel = (() => {
    if (!rotation || activeWorkout || overdueDays(rotation) > 0) return null;
    if (!rotation.schedule[rotation.cyclePosition]) return null;
    const date = plannedDate(rotation, rotation.cyclePosition);
    const days = daysBetween(today, date);
    if (days <= 0) return t.home.today;
    if (days === 1) return t.home.tomorrow;
    const name = date.toLocaleDateString(locale, { weekday: "long" });
    return name.charAt(0).toUpperCase() + name.slice(1);
  })();
  if (whenLabel) heroSub = heroSub ? `${whenLabel} · ${heroSub}` : whenLabel;

  // Planned cardio still to do today. On a day with no strength session due
  // (none planned today, none overdue, none running) it takes the hero, with
  // a Log button that opens the log sheet right here; on a strength day it's
  // added to the hero's sub-line instead, so strength stays the one CTA.
  const cardioToday = remainingCardioOn(cardioPlan, cardioSessions, today, today)[0] ?? null;
  const strengthDue =
    !!activeWorkout ||
    (rotation != null && overdueDays(rotation) > 0) ||
    whenLabel === t.home.today;
  if (cardioToday && !strengthDue) {
    heroIcon = CARDIO_ICONS[cardioToday.activity];
    heroEyebrow = t.cardio.heroEyebrow;
    heroTitle = t.cardio.session(t.cardio.activities[cardioToday.activity], cardioToday.minutes);
    // Still say when the next strength session is, after the effort.
    const nextStrength = whenLabel
      ? `${t.home.nextDay(program ? programDayLabel : schemeDayLabel)} · ${whenLabel}`
      : null;
    heroSub = [t.cardio.efforts[cardioToday.effort], nextStrength].filter(Boolean).join(" · ");
    heroCta = t.cardio.heroCta;
    heroTarget = "cardio";
  } else if (cardioToday && whenLabel === t.home.today) {
    const plus = t.cardio.plusCardio(t.cardio.activities[cardioToday.activity]);
    heroSub = heroSub ? `${heroSub} ${plus}` : plus;
  }
  const HeroIcon = heroIcon;
  const readinessOpen = !todayCheckIn || readinessEditing;

  if (!hydrated) return <div className="fixed inset-0 bg-background" />;

  return (
    <>
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
        <header className="safe-top shrink-0">
          <div className={`relative flex min-h-[42px] items-center px-4 ${SETTINGS_BUTTON_GUTTER}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">
                  {dateLabel}
                </p>
                {/* Once answered, the check-in shrinks to this chip so its tile
                gives its row back to the rest of the grid. Tapping it
                reopens the picker. */}
                {todayCheckIn && !readinessEditing ? (
                  <button
                    onClick={() => {
                      haptic(10);
                      setReadinessEditing(true);
                    }}
                    aria-label={t.home.readinessChipAria(t.readiness[todayCheckIn.score])}
                    className="-my-0.5 flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold leading-[16px] text-secondary-foreground active:scale-95"
                  >
                    <span aria-hidden>{READINESS_EMOJI[todayCheckIn.score]}</span>
                    {t.readiness[todayCheckIn.score]}
                  </button>
                ) : null}
              </div>
              <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">
                {greeting()}
              </h1>
            </div>
            <SettingsButton />
          </div>
        </header>

        {/* One gap (--home-gap) everywhere: under the header, between the
            hero, every tile and the week strip, and above the tab bar (the
            bottom padding is the pill plus its inset plus that gap). It
            used to be 12, 8, 10, 8 and 30 px. */}
        <main className="flex min-h-0 flex-1 flex-col gap-[var(--home-gap)] overflow-hidden px-4 pb-[calc(var(--tab-bar-height)+var(--tab-bar-clearance)+var(--home-gap))] pt-[var(--home-gap)]">
          <button
            onClick={() => {
              haptic(12);
              if (heroTarget === "cardio") setCardioLogOpen(true);
              else navigate({ to: heroTarget });
            }}
            className="glass glow shrink-0 rounded-[28px] p-[var(--home-hero-pad)] text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-text">
                  <HeroIcon className="size-3.5" /> {heroEyebrow}
                </p>
                <p className="mt-1.5 truncate text-[20px] font-bold leading-tight tracking-tight">
                  {heroTitle}
                </p>
                {heroSub ? (
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{heroSub}</p>
                ) : null}
              </div>
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary py-2.5 pl-3.5 pr-2.5 text-[14px] font-bold text-primary-foreground">
                {heroCta} <ChevronRight className="size-4" />
              </span>
            </div>
            {program && programWeek && heroTarget !== "cardio" ? (
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

          {/* Each row is at least as tall as its content (min-content), and
              only the height left over is shared out in these proportions,
              so a short screen squeezes the spare room, never a tile's
              content, and a tall one gives every tile a bit more. */}
          <div
            className="grid min-h-0 flex-1 grid-cols-2 gap-[var(--home-gap)]"
            style={{
              // ×100: once the bigger rows sit at their content height, the
              // flex factors left can add up to less than 1, and CSS grid
              // then hands out only that share of the spare room, leaving a
              // bigger gap under the tiles. Same proportions, scaled up.
              gridTemplateRows: (readinessOpen ? [0.84, 0.76, 0.64, 0.33, 0.38] : [1, 1, 0.38, 0.4])
                .map((fr) => `minmax(min-content, ${fr * 100}fr)`)
                .join(" "),
            }}
          >
            <NutritionTile
              active={todayEntries.length > 0}
              hasGoals={hasNutritionGoals}
              totals={todayTotals}
              goals={dayGoals}
              dayType={dayNutrition.byDayType ? dayNutrition.dayKind : null}
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
              onOpen={() => navigate({ to: "/nutrition", search: { tab: "drinks" } })}
            />

            {readinessOpen ? (
              <ReadinessTile
                current={todayCheckIn?.score ?? null}
                onPick={(score) => {
                  haptic([15, 25]);
                  setTodayReadiness(score);
                  setReadinessEditing(false);
                }}
              />
            ) : null}

            <ActivityTile
              streak={streak}
              longestStreak={longestStreak}
              daysThisWeek={daysThisWeek}
              totalWorkouts={workouts.length}
              onClick={() => navigate({ to: "/history", search: { tab: "activity" } })}
            />

            <LatestPrTile
              pr={pr}
              today={today}
              onClick={() => navigate({ to: "/history", search: { tab: "progress" } })}
            />
          </div>

          <WeekStrip
            today={today}
            rotation={rotation}
            trainedKeys={trainedKeys}
            cardioPlan={cardioPlan}
            cardioSessions={cardioSessions}
            onClick={() => {
              haptic(10);
              navigate({ to: rotation ? "/generate" : "/history" });
            }}
          />
        </main>
      </div>
      {/* Outside the fixed page: inside it the sheet would share its stacking
        context and sit under the tab bar. */}
      <LogCardioSheet
        open={cardioLogOpen}
        onClose={() => setCardioLogOpen(false)}
        preset={cardioToday}
      />
    </>
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
  dayType,
  onClick,
}: {
  active: boolean;
  hasGoals: boolean;
  totals: Macros;
  goals: NutritionGoals;
  calorieStatus: NutrientStatus;
  caloriePct: number;
  /** Shown as a small label when day-type limits are on; null hides it. */
  dayType: DayKind | null;
  onClick: () => void;
}) {
  const t = useTranslation();
  const barClass = (status: NutrientStatus) =>
    status === "over" ? "bg-destructive" : status === "near" ? "bg-warning" : "bg-primary";

  return (
    <button
      onClick={() => {
        haptic(10);
        onClick();
      }}
      aria-label={t.home.nutritionAriaLabel}
      className="glass relative col-span-2 flex min-h-0 flex-col gap-2 overflow-hidden rounded-3xl p-[var(--home-tile-pad)] text-left active:scale-[0.98]"
    >
      <div className="relative flex flex-col gap-2">
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <Apple className="size-3.5" />
            </span>
            <span className="tabular truncate text-[20px] font-bold leading-none">
              {Math.round(totals.calories)}
              <span className="text-[12px] font-medium text-muted-foreground">
                {goals.calories ? ` / ${goals.calories}` : ""} kcal
              </span>
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            {dayType ? (
              <>
                {dayType === "training" ? (
                  <Dumbbell className="size-3" />
                ) : dayType === "cardio" ? (
                  <HeartPulse className="size-3" />
                ) : (
                  <Moon className="size-3" />
                )}
                {dayType === "training"
                  ? t.nutrition.trainingDay
                  : dayType === "cardio"
                    ? t.nutrition.cardioDay
                    : t.nutrition.restDay}
              </>
            ) : null}
            <ChevronRight className="size-4" />
          </span>
        </div>

        {hasGoals && goals.calories ? (
          <div className="relative -mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${barClass(calorieStatus)}`}
              style={{ width: `${caloriePct}%` }}
            />
          </div>
        ) : null}
      </div>

      {/* The chips take whatever height the tile has left, and their
          numbers grow with it (fill-cell), so a tall tile reads as three
          stat cards rather than a short row floating in empty space. */}
      <div className="relative grid flex-1 grid-cols-3 gap-2">
        {(["protein", "carbs", "fat"] as const).map((key) => {
          const goal = goals[key];
          const status = nutrientStatus(totals[key], goal);
          const pct = goal ? Math.min(100, (totals[key] / goal) * 100) : 0;
          return (
            <div
              key={key}
              className="fill-cell flex min-h-[45px] min-w-0 flex-col justify-center rounded-2xl bg-muted/60 px-2.5 py-1"
            >
              {/* Whole grams: a food label's own precision, and 14.2 next
                  to 75 read as inconsistent. */}
              {/* Short chip: "75 / 160 g" on one line. Tall chip
                  (fill-stack): the number grows, so the limit moves to its
                  own line under it rather than being cut off. */}
              <p className="tabular truncate text-[length:clamp(15px,min(26cqh,24cqw),26px)] font-bold leading-none">
                {Math.round(totals[key])}
                <span className="fill-stack text-[length:clamp(10px,11cqh,13px)] font-medium text-muted-foreground">
                  {goal != null ? ` / ${Math.round(goal)} g` : " g"}
                </span>
              </p>
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                {key === "protein" ? t.home.protein : key === "carbs" ? t.home.carbs : t.home.fat}
              </p>
              {goal != null ? (
                <div className="mt-[clamp(4px,7cqh,10px)] h-1 overflow-hidden rounded-full bg-foreground/10">
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
  daysThisWeek,
  totalWorkouts,
  onClick,
}: {
  streak: number;
  longestStreak: number;
  daysThisWeek: number;
  totalWorkouts: number;
  onClick: () => void;
}) {
  const t = useTranslation();
  return (
    <button
      onClick={() => {
        haptic(10);
        onClick();
      }}
      className="glass col-span-2 flex min-h-0 items-center gap-3 rounded-3xl p-[var(--home-tile-pad)] text-left active:scale-[0.97]"
    >
      {/* Weeks, not days — see streak.ts for why and the WHO source. */}
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
            <span className="text-[11px] font-medium text-muted-foreground">
              {" "}
              {t.home.weekStreak(streak)}
            </span>
          </p>
          <p className="mt-1 truncate text-[11px] leading-tight text-muted-foreground">
            {longestStreak > streak ? t.home.best(longestStreak) : t.home.streakRule}
          </p>
        </div>
      </div>

      <div className="h-8 w-px shrink-0 bg-border" />

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
            daysThisWeek > 0
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Dumbbell className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="tabular truncate text-[17px] font-bold leading-none">
            {daysThisWeek}
            <span className="text-[11px] font-medium text-muted-foreground">
              {" "}
              {t.home.trainingDays(daysThisWeek)}
            </span>
          </p>
          <p className="mt-1 truncate text-[11px] leading-tight text-muted-foreground">
            {t.home.thisWeek} · {t.home.total(totalWorkouts)}
          </p>
        </div>
      </div>
    </button>
  );
}

/** The most recent personal record (see progress.ts's `latestPr`), shown as
 *  the set actually lifted. It used to show the all-time highest Epley
 *  estimate across every exercise, which was always the same heavy lift and
 *  read as a weight lifted when it was an estimate; the estimate is now a
 *  small, labelled caption. Single compact row: the exercise name is the one
 *  text here with unpredictable length (up to 35 characters in the catalog),
 *  so it gets the middle and may wrap to two lines rather than truncate. */
function LatestPrTile({
  pr,
  today,
  onClick,
}: {
  pr: LatestPr | null;
  today: Date;
  onClick: () => void;
}) {
  const t = useTranslation();
  const days = pr ? daysBetween(new Date(pr.date), today) : 0;
  return (
    <button
      onClick={() => {
        haptic(10);
        onClick();
      }}
      className="glass col-span-2 flex min-h-0 items-center gap-2.5 rounded-3xl p-[var(--home-tile-pad)] text-left active:scale-[0.97]"
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
          pr ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        <Trophy className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t.home.latestPr}
          {pr ? ` · ${t.home.prWhen(days)}` : ""}
        </p>
        {pr ? (
          <p className="line-clamp-2 text-[13px] font-bold leading-tight">{pr.name}</p>
        ) : (
          <p className="truncate text-[12px] text-muted-foreground">{t.home.noPrYet}</p>
        )}
      </div>
      {pr ? (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="tabular rounded-full bg-primary px-2.5 py-1 text-[13px] font-bold leading-none text-primary-foreground">
            {formatLoad(pr.weight, pr.bodyweight, t.session.bw)} × {pr.reps}
          </span>
          {pr.e1rm != null ? (
            <span className="tabular text-[10px] text-muted-foreground">
              {t.home.e1rm(Math.round(pr.e1rm))}
            </span>
          ) : null}
        </div>
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
  const t = useTranslation();
  const { waterQuickAdd } = useGym();
  const pct = goalMl ? Math.min(100, (totalMl / goalMl) * 100) : 0;
  const active = totalMl > 0;

  return (
    <div className="glass relative col-span-2 flex min-h-0 flex-col gap-1.5 overflow-hidden rounded-3xl p-[var(--home-tile-pad)]">
      <div className="relative flex flex-col gap-2">
        <button
          onClick={() => {
            haptic(10);
            onOpen();
          }}
          aria-label={t.home.waterAriaLabel}
          // The tile's padding leaves no room for 44 pt above this row in the
          // fixed Home layout; it spans the tile's full width instead.
          data-target-ok
          className="tap-target flex items-center justify-between gap-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                active ? "bg-sky-400/15 text-sky-400" : "bg-muted text-muted-foreground"
              }`}
            >
              <Droplet className="size-3.5" />
            </span>
            <span className="tabular truncate text-[20px] font-bold leading-none">
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
      </div>

      {/* Like the macro chips: the buttons fill the tile's spare height,
          with a drop above the amount once they're tall enough. */}
      <div className="relative grid flex-1 grid-cols-4 gap-1.5">
        {waterQuickAdd.map((ml, i) => (
          <button
            key={i}
            onClick={() => onAdd(ml)}
            aria-label={t.home.addWater(ml)}
            className="fill-cell tap-target flex min-h-[36px] flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-primary/60 text-[length:clamp(12px,16cqh,15px)] font-bold text-foreground active:scale-95 active:bg-primary/10"
          >
            <HapticSwitch />
            <Droplet className="fill-extra size-4 text-primary-text" aria-hidden />
            <span>+{formatWaterAmount(ml)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Moved here from `/generate` — "how are you feeling" is a whole-day
 *  question, and belongs on the app's daily landing point. It's a wellness
 *  log only: it used to scale suggested weights by fixed percentages, which
 *  no study supports, so load now autoregulates from logged RPE instead
 *  (see readiness.ts / progression.ts's `rpeAdjustedWeight`).
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
  current,
  onPick,
}: {
  /** Today's answer when reopened from the header chip, highlighted. */
  current: ReadinessScore | null;
  onPick: (score: ReadinessScore) => void;
}) {
  const t = useTranslation();
  return (
    <div className="glass relative col-span-2 flex min-h-0 flex-col gap-1.5 overflow-hidden rounded-3xl p-[var(--home-tile-pad)]">
      <div className="relative flex min-w-0 items-center gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Activity className="size-3.5" />
        </span>
        <span className="truncate text-[12.5px] font-semibold text-muted-foreground">
          {t.home.howAreYouFeeling}
        </span>
      </div>
      <div className="relative grid flex-1 grid-cols-5 gap-1.5">
        {([1, 2, 3, 4, 5] as ReadinessScore[]).map((score) => (
          <button
            key={score}
            onClick={() => onPick(score)}
            aria-label={t.readiness[score]}
            aria-pressed={current === score}
            className={`fill-cell tap-target flex min-h-[38px] items-center justify-center rounded-2xl text-[length:clamp(17px,40cqh,24px)] leading-none active:scale-95 ${
              current === score ? "bg-primary/25 ring-2 ring-primary" : "bg-muted"
            }`}
          >
            {READINESS_EMOJI[score]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** This Monday–Sunday week at a glance: a check on days trained, a ring on
 *  days a remaining session of the program/weekly plan is planned (from
 *  schedule.ts, so moved sessions show where they actually are), today's
 *  letter highlighted. Replaced a quick-links row whose Exercises and History
 *  links duplicated the tab bar. */
function WeekStrip({
  today,
  rotation,
  trainedKeys,
  cardioPlan,
  cardioSessions,
  onClick,
}: {
  today: Date;
  rotation: Rotation | null;
  trainedKeys: Set<string>;
  cardioPlan: CardioPlanDay[];
  cardioSessions: CardioSession[];
  onClick: () => void;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const monday = mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const key = keyOf(date);
    const trained = trainedKeys.has(key);
    const future = daysBetween(today, date) >= 0;
    const planned = !trained && future && rotation != null && hasPlannedSession(rotation, date);
    const cardioDone = cardioSessionsOn(cardioSessions, key);
    const cardioLeft = remainingCardioOn(cardioPlan, cardioSessions, date, today);
    return {
      date,
      key,
      isToday: daysBetween(today, date) === 0,
      state: trained ? ("trained" as const) : planned ? ("planned" as const) : ("rest" as const),
      cardio: cardioDone.length
        ? ("done" as const)
        : cardioLeft.length
          ? ("planned" as const)
          : null,
      cardioActivity: cardioDone[0]?.activity ?? cardioLeft[0]?.activity ?? null,
    };
  });

  return (
    <button
      onClick={onClick}
      aria-label={t.home.weekStripAria}
      className="glass grid shrink-0 grid-cols-7 rounded-2xl px-2 py-1 active:scale-[0.98]"
    >
      {days.map((d) => {
        const name = t.common.dow[d.date.getDay()] ?? "";
        return (
          <span
            key={d.key}
            role="img"
            aria-label={`${t.home.weekDayAria(
              d.date.toLocaleDateString(locale, { weekday: "long" }),
              d.state,
              d.isToday,
            )}${d.cardio ? `, ${t.cardio.dayAria(d.cardio)}` : ""}`}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-0.5 ${
              d.isToday ? "bg-foreground/[0.06]" : ""
            }`}
          >
            <span
              className={`text-[10px] font-bold leading-none ${
                d.isToday ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {name.charAt(0).toUpperCase()}
            </span>
            <span className="relative flex size-5 items-center justify-center">
              {d.state === "rest" && d.cardio ? (
                // A cardio-only day: its own mark, with the activity's icon.
                <CardioMark state={d.cardio} Icon={CARDIO_ICONS[d.cardioActivity ?? "run"]} />
              ) : d.state === "trained" ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" strokeWidth={3.2} />
                </span>
              ) : d.state === "planned" ? (
                <span className="size-[18px] rounded-full border-2 border-primary" />
              ) : (
                <span className="size-1.5 rounded-full bg-muted-foreground/30" />
              )}
              {d.state !== "rest" && d.cardio ? (
                // Strength and cardio on one day: a small corner dot, filled
                // once the cardio is done.
                <span
                  aria-hidden
                  className={`absolute -right-1 -top-1 size-2.5 rounded-full ring-2 ring-background ${
                    d.cardio === "done"
                      ? "bg-primary"
                      : "border-[1.5px] border-primary bg-background"
                  }`}
                />
              ) : null}
            </span>
          </span>
        );
      })}
    </button>
  );
}

function CardioMark({ state, Icon }: { state: "done" | "planned"; Icon: LucideIcon }) {
  return state === "done" ? (
    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Icon className="size-3" strokeWidth={2.6} />
    </span>
  ) : (
    <span className="flex size-[18px] items-center justify-center rounded-full border-2 border-primary text-primary-text">
      <Icon className="size-2.5" strokeWidth={2.6} />
    </span>
  );
}
