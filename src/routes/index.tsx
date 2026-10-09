import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Apple,
  Check,
  Dumbbell,
  HeartPulse,
  Moon,
  ChevronRight,
  Coffee,
  Droplet,
  Flame,
  type LucideIcon,
  Play,
  Snowflake,
  Zap,
  CalendarClock,
} from "lucide-react";
import { Card, Screen } from "../components/gym/Screen";
import { CardHead } from "../components/gym/CardHead";
import { HapticSwitch } from "../components/gym/HapticSwitch";
import { button, chip } from "../components/gym/ui";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import {
  CAFFEINE_DAILY_LIMIT_MG,
  COFFEE_KINDS,
  caffeineMg,
  formatWaterAmount,
  dailyTotals,
  dayKeyFromDate,
  entriesForDay,
  formatLiters,
  nutrientStatus,
  type CoffeeKind,
  type Macros,
  type NutrientStatus,
  type NutritionGoals,
} from "../lib/gym/nutrition";
import { currentProgramWeek } from "../lib/gym/programs";
import { dayKey, dayKeyFromDate as keyOf } from "../lib/gym/date";
import { READINESS_EMOJI, todaysCheckIn, type ReadinessScore } from "../lib/gym/readiness";
import { useDayNutrition, type DayKind } from "../lib/gym/dayNutrition";
import {
  daysBetween,
  hasPlannedSession,
  mondayOf,
  overdueDays,
  plannedDate,
  type Rotation,
} from "../lib/gym/schedule";
import { splitDayLabel, splitTemplateById } from "../lib/gym/splits";
import { addDays } from "../lib/gym/date";
import { cardioSessionsOn, remainingCardioOn } from "../lib/gym/cardio";
import { CARDIO_ICONS } from "../components/gym/cardioDisplay";
import { LogCardioSheet } from "../components/gym/LogCardioSheet";
import type { CardioPlanDay, CardioSession } from "../lib/gym/types";
import { currentWeekStreak, trainingDaysThisWeek } from "../lib/gym/streak";
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
    logWater,
    coffeeEntries,
    logCoffee,
    readinessLog,
    setTodayReadiness,
    cardioPlan,
    plannedCardio,
    cardioSessions,
    firstName,
  } = useGym();
  const [readinessEditing, setReadinessEditing] = useState(false);
  const [cardioLogOpen, setCardioLogOpen] = useState(false);
  const todayCheckIn = todaysCheckIn(readinessLog);

  const streak = useMemo(() => currentWeekStreak(workouts), [workouts]);
  // Monday–Sunday, the same weeks the streak, the week strip and History's
  // training-load card use (it used to be a rolling 7 days).
  const daysThisWeek = useMemo(() => trainingDaysThisWeek(workouts), [workouts]);

  const todayKey = useMemo(() => dayKeyFromDate(new Date()), []);
  const todayEntries = useMemo(() => entriesForDay(foodEntries, todayKey), [foodEntries, todayKey]);
  const todayTotals = useMemo(() => dailyTotals(todayEntries), [todayEntries]);
  const todayWaterMl = useMemo(
    () => entriesForDay(waterEntries, todayKey).reduce((sum, e) => sum + e.ml, 0),
    [waterEntries, todayKey],
  );
  const todayCoffee = useMemo(
    () => entriesForDay(coffeeEntries, todayKey),
    [coffeeEntries, todayKey],
  );
  const today = useMemo(() => new Date(), []);
  const trainedKeys = useMemo(() => {
    const keys = new Set(workouts.map((w) => dayKey(w.date)));
    if (activeWorkout) keys.add(dayKey(activeWorkout.date));
    return keys;
  }, [workouts, activeWorkout]);
  const dayNutrition = useDayNutrition(today);
  const dayGoals = dayNutrition.goals;

  const programWeek = program ? currentProgramWeek(program) : null;
  const programSlot = program?.schedule[program.cyclePosition];
  const programDayLabel =
    program && programSlot ? splitDayLabel(program.templateId, programSlot.dayId) : "";
  const schemeSlot = weeklyScheme?.schedule[weeklyScheme.cyclePosition];
  const schemeDayLabel =
    weeklyScheme && schemeSlot ? splitDayLabel(weeklyScheme.templateId, schemeSlot.dayId) : "";

  const greeting = () => {
    const hour = new Date().getHours();
    const base =
      hour < 4
        ? t.home.greetingLate
        : hour < 11
          ? t.home.greetingMorning
          : hour < 14
            ? t.home.greetingMidday
            : hour < 18
              ? t.home.greetingAfternoon
              : hour < 22
                ? t.home.greetingEvening
                : t.home.greetingNight;
    return firstName ? t.name.greeting(base, firstName) : base;
  };

  const dateLabel = useMemo(() => {
    const label = new Date().toLocaleDateString(locale, t.home.dateFormat);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [locale, t]);

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
    heroTitle = programDayLabel;
    // The plan's name is left out here: the title already names the day, and
    // the Workout tab shows the plan.
    heroSub = null;
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
    heroTitle = schemeDayLabel;
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
  // A hybrid plan's cardio belongs to its strength session, so it only
  // shows next to one (plannedCardio), never as a hero of its own.
  const strengthDue =
    !!activeWorkout ||
    (rotation != null && overdueDays(rotation) > 0) ||
    whenLabel === t.home.today;
  const cardioToday =
    remainingCardioOn(strengthDue ? plannedCardio : cardioPlan, cardioSessions, today, today)[0] ??
    null;
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
  const readinessOpen = !todayCheckIn || readinessEditing;
  // Spare height below the cards, measured by Screen, as it would be with
  // no check-in picker and nothing optional shown (null until measured).
  // Answering the check-in then keeps the picker without a jump when it fits.
  // Taller phones use it for more content rather than leaving it empty
  // (asked for: an iPhone 17 Pro had 149 pt free once the check-in was
  // answered).
  const [room, setRoom] = useState<number | null>(null);
  const hasWaterGoal = waterGoalMl != null && waterGoalMl > 0;
  const extras = useMemo(
    () => homeExtras(room, readinessOpen, hasWaterGoal),
    [room, readinessOpen, hasWaterGoal],
  );
  const moodShown = readinessOpen || extras.mood;
  // The height the picker and extras add to what's on screen now, set after
  // each render: a measurement can arrive before a new set of extras is
  // drawn, so it must be read against what was drawn, not what's planned
  // (counting planned extras made the room grow on every measurement).
  const drawnCost = useRef(0);
  useLayoutEffect(() => {
    drawnCost.current = extrasCost(extras, readinessOpen, hasWaterGoal);
  });
  const onSpace = useCallback(
    (space: number) => setRoom(Math.round(space + drawnCost.current)),
    [],
  );

  if (!hydrated) return <div className="fixed inset-0 bg-background" />;

  return (
    <>
      {/* The same Screen as every other tab: the greeting as the title, the
          date under it, and cards with the shared header bands. It stays on
          one screen while the content fits (fitWhenShort) and scrolls when it
          doesn't, rather than squeezing the cards. */}
      <Screen
        title={greeting()}
        subtitle={dateLabel}
        fitWhenShort
        onSpace={onSpace}
        action={
          // Once answered, the check-in is this chip when there's no room to
          // keep the picker; tapping it brings the picker back.
          todayCheckIn && !moodShown ? (
            <button
              onClick={() => {
                haptic(10);
                setReadinessEditing(true);
              }}
              aria-label={t.home.readinessChipAria(t.readiness[todayCheckIn.score])}
              className={`${chip.base} ${chip.off} max-w-[9rem] px-3`}
            >
              <span aria-hidden className="text-[16px] leading-none">
                {READINESS_EMOJI[todayCheckIn.score]}
              </span>
              <span className="truncate">{t.readiness[todayCheckIn.score]}</span>
            </button>
          ) : null
        }
      >
        <div className="space-y-3">
          <Card className="overflow-hidden p-4">
            {/* What's next, with the screen's one solid action. */}
            <CardHead
              icon={heroIcon}
              title={heroTitle}
              // For the plan's next session the day comes first ("Thursday ·
              // Week 1 of 5"), so the title can be the session alone.
              subtitle={(heroTarget === "/generate" && whenLabel
                ? [heroSub, heroEyebrow]
                : [heroEyebrow, heroSub]
              )
                .filter(Boolean)
                .join(" · ")}
              actions={
                <button
                  onClick={() => {
                    haptic(12);
                    if (heroTarget === "cardio") setCardioLogOpen(true);
                    else navigate({ to: heroTarget });
                  }}
                  className="tap-target relative flex h-9 items-center gap-0.5 rounded-full bg-primary pl-3.5 pr-2.5 text-[14px] font-bold text-primary-foreground active:scale-95"
                >
                  <HapticSwitch />
                  {heroCta}
                  <ChevronRight className="size-4" />
                </button>
              }
            />
            <div className="space-y-3">
              {moodShown ? (
                <MoodPicker
                  current={todayCheckIn?.score ?? null}
                  onPick={(score) => {
                    haptic([15, 25]);
                    setTodayReadiness(score);
                    setReadinessEditing(false);
                  }}
                />
              ) : null}
              <WeekStrip
                today={today}
                rotation={rotation}
                trainedKeys={trainedKeys}
                cardioPlan={plannedCardio}
                cardioSessions={cardioSessions}
                streak={streak}
                daysThisWeek={daysThisWeek}
                dates={extras.dates}
                onClick={() => {
                  haptic(10);
                  navigate({ to: rotation ? "/generate" : "/history" });
                }}
              />
            </div>
          </Card>

          <NutritionCard
            active={todayEntries.length > 0}
            totals={todayTotals}
            goals={dayGoals}
            dayType={dayNutrition.byDayType ? dayNutrition.dayKind : null}
            waterMl={todayWaterMl}
            waterGoalMl={waterGoalMl}
            cups={todayCoffee.length}
            caffeine={caffeineMg(todayCoffee)}
            onWater={(ml) => {
              haptic(12);
              logWater(ml, { tap: true });
            }}
            onCoffee={(kind) => {
              haptic(12);
              logCoffee(kind);
            }}
            bars={extras.bars}
            onOpenFood={() => navigate({ to: "/nutrition" })}
            onOpenDrinks={() => navigate({ to: "/nutrition", search: { tab: "drinks" } })}
          />
        </div>
      </Screen>
      <LogCardioSheet
        open={cardioLogOpen}
        onClose={() => setCardioLogOpen(false)}
        preset={cardioToday}
      />
    </>
  );
}

/** What Home adds when the screen has room (see `room` in HomeScreen), in
 *  this order, each only while the content still ends FIT_GAP above the tab
 *  bar: the check-in picker kept after it's answered (instead of the header
 *  chip), the day's intake as a bar under the water and coffee lines (asked
 *  for instead of taller quick-adds), and dates in the week strip. Each costs a
 *  fixed height, so the choice can't flip back and forth. Layout choices. */
const FIT_GAP = 12; // Screen's FIT_GAP_PX
const MOOD_COST = 80; // label 20 + 8 + buttons 40 + the 12 gap above the week
const BAR_COST = 10; // a 6 pt bar and its 4 pt gap; water's only with a goal
const DATES_COST = 18; // a 14 pt date line plus its 4 pt gap

type HomeExtras = { mood: boolean; bars: boolean; dates: boolean };

const barsCost = (waterGoal: boolean) => BAR_COST * (waterGoal ? 2 : 1);

function homeExtras(room: number | null, moodOpen: boolean, waterGoal: boolean): HomeExtras {
  const out = { mood: false, bars: false, dates: false };
  if (room == null) return out;
  let left = room - (moodOpen ? MOOD_COST : 0);
  const take = (cost: number) => {
    if (left - cost < FIT_GAP) return false;
    left -= cost;
    return true;
  };
  out.mood = !moodOpen && take(MOOD_COST);
  out.bars = take(barsCost(waterGoal));
  out.dates = take(DATES_COST);
  return out;
}

/** The height the picker and the extras add to what's on screen. */
function extrasCost(e: HomeExtras, moodOpen: boolean, waterGoal: boolean) {
  return (
    (moodOpen || e.mood ? MOOD_COST : 0) +
    (e.bars ? barsCost(waterGoal) : 0) +
    (e.dates ? DATES_COST : 0)
  );
}

const barClass = (status: NutrientStatus) =>
  status === "over" ? "bg-destructive" : status === "near" ? "bg-warning" : "bg-primary";

/** Today's check-in ("how are you feeling?"), a whole-day question asked on
 *  the screen the day starts on. A wellness log only: load autoregulates
 *  from logged RPE (see readiness.ts / progression.ts). Shown in the Today
 *  card until answered, then stays (answer highlighted) if Home has room, or
 *  becomes the header chip. Like the drink
 *  quick-adds it calls the store straight from the tap, since a trip to
 *  another screen for one tap would be worse. */
function MoodPicker({
  current,
  onPick,
}: {
  /** Today's answer when reopened from the header chip, shown picked. */
  current: ReadinessScore | null;
  onPick: (score: ReadinessScore) => void;
}) {
  const t = useTranslation();
  return (
    <div>
      <p className="text-[13px] font-semibold leading-5 text-foreground/75">
        {t.home.howAreYouFeeling}
      </p>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {([1, 2, 3, 4, 5] as ReadinessScore[]).map((score) => (
          <button
            key={score}
            onClick={() => onPick(score)}
            aria-label={t.readiness[score]}
            aria-pressed={current === score}
            className={`tap-target flex h-10 items-center justify-center rounded-xl text-[21px] leading-none active:scale-95 ${
              current === score ? chip.on : chip.off
            }`}
          >
            {READINESS_EMOJI[score]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Today's nutrition in one card, the Nutrition tab's Food and Drinks in
 *  brief. Food on top, laid out like the Food tab's day summary: calories in
 *  the band, then the bar, then protein, carbs and fat in three columns; the
 *  band and macros are one button that opens the Food tab. Under a hairline,
 *  water and coffee, each with its total (a button to the Drinks tab) and
 *  the Drinks tab's outlined one-tap buttons (`button.add`), so a glass or a
 *  cup is logged without leaving Home. The card itself is a `<div>`, since a
 *  button can't hold buttons. Food and drinks share one card (they had a
 *  card each) so the screen fits with today's check-in still open. */
function NutritionCard({
  active,
  totals,
  goals,
  dayType,
  waterMl,
  waterGoalMl,
  cups,
  caffeine,
  onWater,
  onCoffee,
  bars,
  onOpenFood,
  onOpenDrinks,
}: {
  active: boolean;
  totals: Macros;
  goals: NutritionGoals;
  /** Shown in the band when day-type limits are on; null hides it. */
  dayType: DayKind | null;
  waterMl: number;
  waterGoalMl: number | null;
  cups: number;
  caffeine: number;
  onWater: (ml: number) => void;
  onCoffee: (kind: CoffeeKind) => void;
  /** The day's water and caffeine as bars under their lines, when Home has
   *  room for them. */
  bars: boolean;
  onOpenFood: () => void;
  onOpenDrinks: () => void;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const { waterQuickAdd } = useGym();
  const kcal = Math.round(totals.calories);
  const goal = goals.calories;
  const diff = goal != null ? goal - kcal : null;
  const calStatus = nutrientStatus(totals.calories, goal);
  const caffeineStatus = nutrientStatus(caffeine, CAFFEINE_DAILY_LIMIT_MG);
  const dayLabel =
    dayType === "training"
      ? t.nutrition.trainingDay
      : dayType === "cardio"
        ? t.nutrition.cardioDay
        : dayType === "rest"
          ? t.nutrition.restDay
          : null;
  // The day's kind shows as the badge's icon too, like the Food tab's card.
  const DayIcon =
    dayType === "training"
      ? Dumbbell
      : dayType === "cardio"
        ? HeartPulse
        : dayType === "rest"
          ? Moon
          : Apple;
  const openDrinks = () => {
    haptic(10);
    onOpenDrinks();
  };
  return (
    <Card className="overflow-hidden p-4">
      <button
        onClick={() => {
          haptic(10);
          onOpenFood();
        }}
        aria-label={t.home.nutritionAriaLabel}
        className="block w-full text-left active:opacity-70"
      >
        <CardHead
          icon={DayIcon}
          filled={active}
          // The card's name on top, like every other card (asked for: the
          // band used to lead with the calories), the day's kind after it;
          // today's calories and what's left underneath.
          title={
            <span className="block truncate">
              {t.tabbar.nutrition}
              {dayLabel ? (
                <span className="text-[14px] font-medium text-foreground/75">
                  {" · "}
                  {dayLabel}
                </span>
              ) : null}
            </span>
          }
          subtitle={
            <>
              <span className="font-semibold text-foreground">{kcal.toLocaleString(locale)}</span>
              {goal != null ? ` / ${goal.toLocaleString(locale)}` : ""} kcal
              {diff == null ? null : diff < 0 ? (
                <span className="font-semibold text-destructive-text">
                  {" · "}
                  {t.nutrition.kcalOver(Math.abs(diff).toLocaleString(locale))}
                </span>
              ) : (
                <>
                  {" · "}
                  {t.nutrition.kcalLeft(diff.toLocaleString(locale))}
                </>
              )}
            </>
          }
          actions={<ChevronRight aria-hidden className="size-5 text-muted-foreground" />}
        />
        {goal != null ? (
          <span className="mb-3 block h-2 overflow-hidden rounded-full bg-muted">
            <span
              className={`block h-full rounded-full ${barClass(calStatus)}`}
              style={{ width: `${Math.min(100, (totals.calories / goal) * 100)}%` }}
            />
          </span>
        ) : null}
        <span className="grid grid-cols-3 gap-3">
          {(["protein", "carbs", "fat"] as const).map((key) => {
            const value = Math.round(totals[key]);
            const limit = goals[key];
            const status = nutrientStatus(totals[key], limit);
            return (
              <span key={key} className="block min-w-0">
                <span className="block truncate text-[12px] font-semibold text-muted-foreground">
                  {t.nutrients[key]}
                </span>
                <span className="tabular mt-0.5 block truncate leading-tight">
                  <span
                    className={`text-[16px] font-bold ${status === "over" ? "text-destructive-text" : ""}`}
                  >
                    {value}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {limit != null ? ` / ${Math.round(limit)}` : ""} g
                  </span>
                </span>
                {limit != null ? (
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className={`block h-full rounded-full ${barClass(status)}`}
                      style={{ width: `${Math.min(100, (totals[key] / limit) * 100)}%` }}
                    />
                  </span>
                ) : null}
              </span>
            );
          })}
        </span>
      </button>

      <div className="mt-3 border-t border-border pt-2">
        <DrinkLine
          icon={Droplet}
          label={t.nutrition.water}
          onOpen={openDrinks}
          value={
            <>
              <span className="font-semibold text-foreground">{formatLiters(waterMl)}</span>
              {waterGoalMl ? ` / ${formatLiters(waterGoalMl)}` : ""}
            </>
          }
        />
        {bars && waterGoalMl ? <IntakeBar pct={(waterMl / waterGoalMl) * 100} /> : null}
        <div className="mt-2 grid grid-cols-4 gap-2">
          {waterQuickAdd.map((ml, i) => (
            <button
              key={i}
              onClick={() => onWater(ml)}
              aria-label={t.home.addWater(ml)}
              className={`${button.add} tap-target h-10 text-[13px] font-bold tracking-tight`}
            >
              <HapticSwitch />+{formatWaterAmount(ml)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-2">
        <DrinkLine
          icon={Coffee}
          label={t.coffee.title}
          onOpen={openDrinks}
          tone={
            caffeineStatus === "over"
              ? "text-destructive-text"
              : caffeineStatus === "near"
                ? "text-warning-text"
                : "text-muted-foreground"
          }
          value={
            <>
              <span className="font-semibold text-foreground">{t.coffee.cups(cups)}</span>
              {" · "}
              {t.coffee.caffeineShort(caffeine, CAFFEINE_DAILY_LIMIT_MG)}
            </>
          }
        />
        {bars ? (
          <IntakeBar
            pct={(caffeine / CAFFEINE_DAILY_LIMIT_MG) * 100}
            className={barClass(caffeineStatus)}
          />
        ) : null}
        <div className="mt-2 grid grid-cols-3 gap-2">
          {COFFEE_KINDS.map((kind) => (
            <button
              key={kind}
              onClick={() => onCoffee(kind)}
              aria-label={t.coffee.add(t.coffee.kinds[kind])}
              className={`${button.add} tap-target h-10 px-1 text-[13px] font-bold tracking-tight`}
            >
              <HapticSwitch />
              <span className="truncate">+{t.coffee.kinds[kind]}</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** The day's intake against its goal or limit under a drink's line, like the
 *  Drinks tab's bars (accent, or amber/red for caffeine near or over). */
function IntakeBar({ pct, className = "bg-primary" }: { pct: number; className?: string }) {
  return (
    <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${className}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

/** A drink's line in the Nutrition card: a small icon and its name, the
 *  day's total on the right and a chevron. The whole line opens the Drinks
 *  tab. */
function DrinkLine({
  icon: Icon,
  label,
  value,
  tone = "text-muted-foreground",
  onOpen,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: string;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="tap-target flex min-h-8 w-full items-center gap-2 text-left active:opacity-70"
    >
      <Icon aria-hidden className="size-4 shrink-0 text-primary-text" />
      <span className="text-[13px] font-semibold">{label}</span>
      <span className={`tabular ml-auto min-w-0 truncate text-[13px] ${tone}`}>{value}</span>
      <ChevronRight aria-hidden className="-mr-1 size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/** This Monday–Sunday week at a glance, inside the Today card: a check on
 *  days trained, a ring on days a remaining session of the program/weekly
 *  plan is planned (from schedule.ts, so moved sessions show where they
 *  actually are), cardio marks, today's cell highlighted. A line above it
 *  carries this week's training days and the week streak (weeks, not days:
 *  see streak.ts). The whole strip opens the plan (or History without one). */
function WeekStrip({
  today,
  rotation,
  trainedKeys,
  cardioPlan,
  cardioSessions,
  streak,
  daysThisWeek,
  dates,
  onClick,
}: {
  today: Date;
  rotation: Rotation | null;
  trainedKeys: Set<string>;
  cardioPlan: CardioPlanDay[];
  cardioSessions: CardioSession[];
  streak: number;
  daysThisWeek: number;
  /** Day numbers under the initials, when Home has room. */
  dates: boolean;
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
    const planned =
      !trained && future && rotation != null && hasPlannedSession(rotation, date, today);
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
      className="block w-full rounded-xl text-left active:opacity-70"
    >
      <span className="flex items-stretch">
        <span className="grid flex-1 grid-cols-7">
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
                className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${
                  d.isToday ? "bg-foreground/[0.06]" : ""
                }`}
              >
                <span
                  className={`text-[11px] font-bold leading-none ${
                    d.isToday ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {name.charAt(0).toUpperCase()}
                </span>
                {dates ? (
                  <span
                    className={`tabular h-3.5 text-[11px] leading-[14px] ${
                      d.isToday ? "font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {d.date.getDate()}
                  </span>
                ) : null}
                <span className="relative flex size-6 items-center justify-center">
                  {d.state === "rest" && d.cardio ? (
                    // A cardio-only day: its own mark, with the activity's icon.
                    <CardioMark state={d.cardio} Icon={CARDIO_ICONS[d.cardioActivity ?? "run"]} />
                  ) : d.state === "trained" ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" strokeWidth={3.2} />
                    </span>
                  ) : d.state === "planned" ? (
                    <span className="size-[22px] rounded-full border-2 border-primary" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                  )}
                  {d.state !== "rest" && d.cardio ? (
                    // Strength and cardio on one day: a small corner dot, filled
                    // once the cardio is done.
                    <span
                      aria-hidden
                      className={`absolute -right-1 -top-1 size-2.5 rounded-full ring-2 ring-[var(--chart-surface)] ${
                        d.cardio === "done"
                          ? "bg-primary"
                          : "border-[1.5px] border-primary bg-[var(--chart-surface)]"
                      }`}
                    />
                  ) : null}
                </span>
              </span>
            );
          })}
        </span>
        {/* The week streak (weeks with 2+ training days, see streak.ts),
            like the day cells: a flame over the count. */}
        <span
          role="img"
          aria-label={t.home.streakAria(streak, daysThisWeek)}
          className="ml-1 flex w-11 flex-col items-center justify-end gap-1 border-l border-border py-1.5 pl-1"
        >
          <Flame
            aria-hidden
            className={`size-[11px] ${streak > 0 ? "text-primary-text" : "text-muted-foreground"}`}
            strokeWidth={2.6}
          />
          <span
            className={`tabular flex h-6 items-center text-[17px] font-bold leading-none ${
              streak > 0 ? "" : "text-muted-foreground"
            }`}
          >
            {streak}
          </span>
        </span>
      </span>
    </button>
  );
}

function CardioMark({ state, Icon }: { state: "done" | "planned"; Icon: LucideIcon }) {
  return state === "done" ? (
    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Icon className="size-3.5" strokeWidth={2.6} />
    </span>
  ) : (
    <span className="flex size-[22px] items-center justify-center rounded-full border-2 border-primary text-primary-text">
      <Icon className="size-3" strokeWidth={2.6} />
    </span>
  );
}
