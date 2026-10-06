import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Dumbbell,
  HeartPulse,
  Moon,
  Sunrise,
  Sun,
  Cookie,
  Pencil,
} from "lucide-react";
import { AddFoodSheet, type ReadListRequest } from "../components/gym/AddFoodSheet";
import { CreateMealSheet } from "../components/gym/CreateMealSheet";
import { MealOverviewSheet, PortionLine } from "../components/gym/MealOverviewSheet";
import { CreateRecipeSheet, type RecipeSeed } from "../components/gym/CreateRecipeSheet";
import { FoodListSheet } from "../components/gym/FoodListSheet";
import { NutritionGoalsSheet } from "../components/gym/NutritionGoalsSheet";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { SegmentedTabs } from "../components/gym/SegmentedTabs";
import { SwipeToDelete } from "../components/gym/SwipeToDelete";
import { DrinksTab } from "../components/gym/DrinksTab";
import {
  addDays,
  dailyTotals,
  dayKeyFromDate,
  entriesForDay,
  ingredientsFromEntries,
  MEAL_ORDER,
  NUTRIENT_ORDER,
  nutrientStatus,
  proteinPerMealTarget,
  scaledMacros,
  formatLiters,
  weeklyAverage,
  type FoodEntry,
  type Macros,
  type MealIngredient,
  type MealType,
  type NutrientStatus,
  type NutritionGoals,
} from "../lib/gym/nutrition";
import { BodyweightCard } from "../components/gym/BodyweightCard";
import { HapticSwitch } from "../components/gym/HapticSwitch";
import { badge, button } from "../components/gym/ui";
import { useDayGoalsResolver, useDayNutrition } from "../lib/gym/dayNutrition";
import { drinkOf } from "../lib/gym/alcohol";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import { latestBodyKg } from "../lib/gym/load";
import { mondayOf, parseDayKey } from "../lib/gym/schedule";
import { haptic, useGym } from "../lib/gym/store";

/** Food, drinks (water and coffee) and bodyweight, as sub-tabs like
 *  History's. The week strip is on every tab and shows that tab's own
 *  data per day; the picked day is shared, so switching keeps it. */
const NUTRITION_TABS = ["food", "drinks", "weight"] as const;
export type NutritionTab = (typeof NUTRITION_TABS)[number];

export const Route = createFileRoute("/nutrition")({
  validateSearch: (search: Record<string, unknown>): { tab?: NutritionTab } =>
    NUTRITION_TABS.includes(search["tab"] as NutritionTab) && search["tab"] !== "food"
      ? { tab: search["tab"] as NutritionTab }
      : {},
  head: () => ({
    meta: [
      { title: "Nutrition — Forge" },
      {
        name: "description",
        content:
          "Log food by scanning a nutrition label or entering it manually, and track daily calories and macros.",
      },
      { property: "og:title", content: "Nutrition — Forge" },
      {
        property: "og:description",
        content: "Scan a nutrition label or log food manually and track daily calories and macros.",
      },
    ],
  }),
  component: NutritionScreen,
});

/** Colour for a limit's bar — over is red, within 15% of it amber. */
const barClass = (status: NutrientStatus) =>
  status === "over" ? "bg-destructive" : status === "near" ? "bg-warning" : "bg-primary";

/**
 * Three sub-tabs, each with the week strip on top: Food (the day's numbers,
 * Add food and what you've eaten), Drinks (water and coffee) and Weight
 * (bodyweight). Saved meals and recipes live in the Add food sheet, next to
 * Favourites and Recent — logging one is the same action as logging any food.
 */
function NutritionScreen() {
  const t = useTranslation();
  const locale = useLocale();
  const { tab = "food" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setTab = (next: NutritionTab) => {
    void navigate({ search: next === "food" ? {} : { tab: next }, replace: true });
    window.scrollTo({ top: 0 });
  };
  const resolveGoals = useDayGoalsResolver();
  const {
    foodEntries,
    waterEntries,
    waterGoalMl,
    hydrated,
    removeFoodEntry,
    weightLog,
    nutritionProfile,
  } = useGym();
  /** null = closed; "add" (optionally for one meal) or an entry to edit. */
  const [foodSheet, setFoodSheet] = useState<{ meal?: MealType } | FoodEntry | null>(null);
  const [goalsSheetOpen, setGoalsSheetOpen] = useState(false);
  const [createMealOpen, setCreateMealOpen] = useState(false);
  /** The meal whose nutrition overview is open. */
  const [overviewMeal, setOverviewMeal] = useState<MealType | null>(null);
  /** Foods pre-filled into the meal builder (a logged meal saved as a meal). */
  const [mealSeed, setMealSeed] = useState<{
    name: string;
    ingredients: MealIngredient[];
    meal: MealType;
  } | null>(null);
  const [createRecipeOpen, setCreateRecipeOpen] = useState(false);
  /** A recipe pre-filled from the list reader ("Save as a recipe"). */
  const [recipeSeed, setRecipeSeed] = useState<RecipeSeed | null>(null);
  /** The list reader (a note, a plate or typed words), opened from Add food. */
  const [listSheet, setListSheet] = useState<ReadListRequest | null>(null);
  const todayKey = dayKeyFromDate(new Date());
  /** The day shown. Only today allows adding. */
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const selectedDate = useMemo(() => parseDayKey(selectedKey), [selectedKey]);
  const selectedEntries = useMemo(
    () => entriesForDay(foodEntries, selectedKey),
    [foodEntries, selectedKey],
  );
  const totals = useMemo(() => dailyTotals(selectedEntries), [selectedEntries]);
  const dayNutrition = useDayNutrition(selectedDate);
  const dayGoals = dayNutrition.goals;
  const hasGoals = NUTRIENT_ORDER.some((k) => dayGoals[k] != null);
  const isToday = selectedKey === todayKey;
  const proteinTarget = proteinPerMealTarget(latestBodyKg(weightLog, nutritionProfile));

  const yesterdayKey = dayKeyFromDate(addDays(new Date(), -1));
  const dayLabel = isToday
    ? t.nutrition.today
    : selectedKey === yesterdayKey
      ? t.nutrition.yesterday
      : selectedDate.toLocaleDateString(locale, {
          weekday: "long",
          day: "numeric",
          month: "short",
        });

  const saveMealFrom = (meal: MealType) => {
    haptic(15);
    setMealSeed({
      name: t.mealTypes[meal],
      meal,
      ingredients: ingredientsFromEntries(selectedEntries.filter((e) => e.meal === meal)),
    });
    setCreateMealOpen(true);
  };

  const openAdd = (meal?: MealType) => {
    haptic(15);
    setFoodSheet(meal ? { meal } : {});
  };
  const meals = isToday
    ? MEAL_ORDER
    : MEAL_ORDER.filter((m) => selectedEntries.some((e) => e.meal === m));

  /** The week strip's mark under each day, per tab: calories against that
   *  day's limit, water against the goal, or the day's weigh-in. */
  const weighInOn = (key: string) =>
    [...weightLog].reverse().find((e) => dayKeyFromDate(new Date(e.date)) === key) ?? null;
  const kg = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 1 });
  const stripDay = (date: Date, key: string): StripDay => {
    const day = date.toLocaleDateString(locale, { weekday: "long", day: "numeric" });
    if (tab === "drinks") {
      const ml = entriesForDay(waterEntries, key).reduce((sum, e) => sum + e.ml, 0);
      return {
        pct: ml ? (waterGoalMl ? Math.min(100, (ml / waterGoalMl) * 100) : 100) : 0,
        aria: t.nutrition.waterDayAria(day, ml || null),
      };
    }
    if (tab === "weight") {
      const w = weighInOn(key);
      return {
        label: w ? kg(w.kg) : null,
        aria: t.nutrition.weightDayAria(day, w ? kg(w.kg) : null),
      };
    }
    const entries = entriesForDay(foodEntries, key);
    const calories = dailyTotals(entries).calories;
    const goal = resolveGoals(date).goals.calories;
    const pct = goal ? Math.min(100, (calories / goal) * 100) : entries.length ? 100 : 0;
    return {
      pct: entries.length ? pct : 0,
      // Accent unless over: landing near the limit is the aim here.
      over: entries.length > 0 && nutrientStatus(calories, goal) === "over",
      aria: t.nutrition.dayAria(day, entries.length ? calories : null),
    };
  };
  const stripFooter = (days: { date: Date; key: string }[]) => {
    if (tab === "drinks") {
      const avg = weeklyAverage(
        days.map(({ key }) => {
          const ml = entriesForDay(waterEntries, key).reduce((sum, e) => sum + e.ml, 0);
          return { key, calories: ml, goal: waterGoalMl ?? undefined, logged: ml > 0 };
        }),
        todayKey,
      );
      return avg
        ? t.nutrition.waterWeekAvg(
            formatLiters(avg.calories),
            avg.goal != null ? formatLiters(avg.goal) : null,
            avg.days,
          )
        : t.nutrition.weekAvgNone;
    }
    if (tab === "weight") {
      const weighed = days.map(({ key }) => weighInOn(key)).filter((w) => w != null);
      return weighed.length
        ? t.nutrition.weightWeekAvg(
            kg(weighed.reduce((sum, w) => sum + w.kg, 0) / weighed.length),
            weighed.length,
          )
        : t.nutrition.weightWeekAvgNone;
    }
    const avg = weeklyAverage(
      days.map(({ date, key }) => {
        const entries = entriesForDay(foodEntries, key);
        return {
          key,
          calories: dailyTotals(entries).calories,
          goal: resolveGoals(date).goals.calories,
          logged: entries.length > 0,
        };
      }),
      todayKey,
    );
    return avg
      ? t.nutrition.weekAvg(
          avg.calories.toLocaleString(locale),
          avg.goal != null ? avg.goal.toLocaleString(locale) : null,
          avg.days,
        )
      : t.nutrition.weekAvgNone;
  };
  const selectedWeighIn = weighInOn(selectedKey);

  if (!hydrated) return <Screen title={t.nutrition.title}>{null}</Screen>;

  return (
    <Screen
      title={t.nutrition.title}
      toolbar={
        <SegmentedTabs
          tabs={NUTRITION_TABS}
          value={tab}
          onChange={setTab}
          labels={t.nutrition.tabs}
        />
      }
    >
      <WeekStrip
        selectedKey={selectedKey}
        todayKey={todayKey}
        onSelect={setSelectedKey}
        day={stripDay}
        footer={stripFooter}
      />

      {tab === "food" ? (
        <>
          <DaySummary
            dayLabel={dayLabel}
            dayKind={dayNutrition.byDayType ? dayNutrition.dayKind : null}
            totals={totals}
            goals={dayGoals}
            hasGoals={hasGoals}
            onSetGoals={() => {
              haptic(12);
              setGoalsSheetOpen(true);
            }}
          />

          {isToday ? (
            <button
              onClick={() => openAdd()}
              className="glow mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-[0.985]"
            >
              <Plus className="size-5" /> {t.nutrition.addFood}
            </button>
          ) : null}

          <SectionLabel>{t.nutrition.log}</SectionLabel>
          {meals.length === 0 ? (
            <Card className="p-6 text-center text-[15px] text-muted-foreground">
              {t.nutrition.nothingLoggedDay}
            </Card>
          ) : (
            <div className="space-y-4">
              {proteinTarget && selectedEntries.length ? (
                <p className="-mt-1 px-1 text-[12px] leading-snug text-muted-foreground">
                  {t.nutrition.proteinLegend(proteinTarget)}
                </p>
              ) : null}
              {meals.map((meal) => (
                <MealGroup
                  key={meal}
                  meal={meal}
                  entries={selectedEntries.filter((e) => e.meal === meal)}
                  proteinTarget={proteinTarget}
                  canAdd={isToday}
                  onAdd={() => openAdd(meal)}
                  onOpen={() => {
                    haptic(12);
                    setOverviewMeal(meal);
                  }}
                  onSaveAsMeal={() => saveMealFrom(meal)}
                  onEdit={(entry) => {
                    haptic(12);
                    setFoodSheet(entry);
                  }}
                  onDelete={(entry) => {
                    haptic(15);
                    removeFoodEntry(entry.id);
                  }}
                />
              ))}
            </div>
          )}

          {/* RIVM's conditions of use require this reference on nutritional
          output based on NEVO data — shown whenever the day's figures
          include a NEVO food (see nevoFoods.ts). */}
          {selectedEntries.some((e) => e.nevo?.length) ? (
            <p className="mt-6 px-1 text-[11px] leading-snug text-muted-foreground">
              {t.nutrition.nevoReference}
            </p>
          ) : null}
        </>
      ) : null}

      {tab === "drinks" ? (
        <DrinksTab
          dayKey={selectedKey}
          isToday={isToday}
          onNeedProfile={() => setGoalsSheetOpen(true)}
        />
      ) : null}

      {/* Weight: the trend, chart and log are the same whichever day is
          picked; a past day shows its own weigh-in above them, and only
          today can be logged, like food and water. */}
      {tab === "weight" ? (
        <>
          <BodyweightCard
            canLog={isToday}
            dayLabel={dayLabel}
            weighIn={selectedWeighIn ? `${kg(selectedWeighIn.kg)} kg` : null}
          />
        </>
      ) : null}

      <AddFoodSheet
        open={foodSheet !== null}
        editEntry={foodSheet && "id" in foodSheet ? foodSheet : null}
        initialMeal={foodSheet && !("id" in foodSheet) ? foodSheet.meal : undefined}
        onClose={() => setFoodSheet(null)}
        onCreateMeal={() => {
          setFoodSheet(null);
          setMealSeed(null);
          setCreateMealOpen(true);
        }}
        onCreateRecipe={() => {
          setFoodSheet(null);
          setRecipeSeed(null);
          setCreateRecipeOpen(true);
        }}
        onReadList={(request) => {
          setFoodSheet(null);
          setListSheet(request);
        }}
      />
      <FoodListSheet
        open={listSheet !== null}
        start={listSheet?.start ?? "photo"}
        photo={listSheet?.start === "photo" ? listSheet : null}
        target="log"
        initialMeal={listSheet?.meal}
        onClose={() => setListSheet(null)}
        onSaveAsRecipe={(ingredients, meta) => {
          setListSheet(null);
          setRecipeSeed({ name: meta.title ?? "", servings: meta.servings, ingredients });
          setCreateRecipeOpen(true);
        }}
      />
      {/* One sheet at a time: each action closes the overview first. */}
      <MealOverviewSheet
        meal={overviewMeal}
        entries={overviewMeal ? selectedEntries.filter((e) => e.meal === overviewMeal) : []}
        dayTotals={totals}
        goals={dayGoals}
        proteinTarget={proteinTarget}
        dayLabel={dayLabel}
        canAdd={isToday}
        onClose={() => setOverviewMeal(null)}
        onAdd={() => {
          const meal = overviewMeal ?? undefined;
          setOverviewMeal(null);
          openAdd(meal);
        }}
        onSaveAsMeal={() => {
          const meal = overviewMeal;
          setOverviewMeal(null);
          if (meal) saveMealFrom(meal);
        }}
        onEdit={(entry) => {
          haptic(12);
          setOverviewMeal(null);
          setFoodSheet(entry);
        }}
      />
      <NutritionGoalsSheet open={goalsSheetOpen} onClose={() => setGoalsSheetOpen(false)} />
      <CreateMealSheet
        open={createMealOpen}
        seed={mealSeed}
        day={selectedKey}
        onClose={() => {
          setCreateMealOpen(false);
          setMealSeed(null);
        }}
      />
      <CreateRecipeSheet
        open={createRecipeOpen}
        seed={recipeSeed}
        onClose={() => {
          setCreateRecipeOpen(false);
          setRecipeSeed(null);
        }}
      />
    </Screen>
  );
}

/** One day's mark in the week strip: a bar (`pct` of the day's limit or
 *  goal, red when `over`) or a short `label` (the weigh-in). */
type StripDay = { pct?: number; over?: boolean; label?: string | null; aria: string };

/**
 * The week the selected day falls in, Monday first, on every tab: each
 * day's mark comes from the tab (`day`) — calories against that day's
 * limit, water against the goal, or the weigh-in — and the line under it
 * is the tab's weekly summary (`footer`). Arrows move a week at a time;
 * days after today can't be picked.
 */
function WeekStrip({
  selectedKey,
  todayKey,
  onSelect,
  day,
  footer,
}: {
  selectedKey: string;
  todayKey: string;
  onSelect: (key: string) => void;
  day: (date: Date, key: string) => StripDay;
  footer: (days: { date: Date; key: string }[]) => string;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const monday = mondayOf(parseDayKey(selectedKey));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, key: dayKeyFromDate(date) };
  });
  const thisMonday = mondayOf(parseDayKey(todayKey)).getTime();
  const weeksBack = Math.round((thisMonday - monday.getTime()) / (7 * 864e5));
  const title =
    weeksBack === 0
      ? t.nutrition.thisWeek
      : weeksBack === 1
        ? t.nutrition.lastWeek
        : `${monday.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${addDays(
            monday,
            6,
          ).toLocaleDateString(locale, { day: "numeric", month: "short" })}`;
  const move = (weeks: number) => {
    haptic(10);
    const target = dayKeyFromDate(addDays(parseDayKey(selectedKey), weeks * 7));
    onSelect(target > todayKey ? todayKey : target);
  };

  return (
    <Card className="mt-1 p-2">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => move(-1)}
          aria-label={t.nutrition.previousWeek}
          className="tap-target flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-[14px] font-semibold">{title}</p>
        <button
          onClick={() => move(1)}
          disabled={weeksBack === 0}
          aria-label={t.nutrition.nextWeek}
          className="tap-target flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-0.5">
        {days.map(({ date, key }) => {
          const future = key > todayKey;
          const selected = key === selectedKey;
          const mark = day(date, key);
          const name = t.common.dow[date.getDay()] ?? "";
          return (
            <button
              key={key}
              disabled={future}
              onClick={() => {
                haptic(10);
                onSelect(key);
              }}
              aria-pressed={selected}
              aria-label={mark.aria}
              className={`flex flex-col items-center gap-1 rounded-xl py-1.5 disabled:opacity-35 ${
                selected ? "bg-primary/15 ring-1 ring-primary" : ""
              }`}
            >
              <span
                className={`text-[11px] font-semibold leading-none ${
                  key === todayKey ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {name.charAt(0).toUpperCase()}
              </span>
              <span className="tabular text-[15px] font-bold leading-none">{date.getDate()}</span>
              {mark.label !== undefined ? (
                // Same height as the bar row would take with its gap, so
                // switching tabs doesn't make the strip jump.
                <span
                  className={`tabular flex h-1 items-center text-[10px] font-semibold leading-none ${
                    mark.label ? "text-primary-text" : "text-muted-foreground"
                  }`}
                >
                  {mark.label ?? "·"}
                </span>
              ) : (
                <span className="h-1 w-6 overflow-hidden rounded-full bg-muted">
                  <span
                    className={`block h-full rounded-full ${mark.over ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${mark.pct ?? 0}%` }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="tabular mt-1.5 text-center text-[12px] text-muted-foreground">{footer(days)}</p>
    </Card>
  );
}

/** Calories as the headline, protein/carbs/fat side by side, fiber and
 *  salt on one line — whole grams (salt keeps one decimal on its 5 g
 *  scale), matching Home. */
function DaySummary({
  dayLabel,
  dayKind,
  totals,
  goals,
  hasGoals,
  onSetGoals,
}: {
  dayLabel: string;
  /** Training, cardio or rest day, while day-type limits are on. */
  dayKind: "training" | "cardio" | "rest" | null;
  totals: Macros;
  goals: NutritionGoals;
  hasGoals: boolean;
  onSetGoals: () => void;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const kcal = Math.round(totals.calories);
  const calStatus = nutrientStatus(kcal, goals.calories);
  const calPct = goals.calories ? Math.min(100, (kcal / goals.calories) * 100) : 0;
  const diff = goals.calories != null ? goals.calories - kcal : null;
  const minor = (["fiber", "salt"] as const).map((key) => {
    const digits = key === "salt" ? 1 : 0;
    const value = Number(totals[key].toFixed(digits));
    const goal = goals[key];
    return {
      key,
      text: `${t.nutrients[key]} ${value.toLocaleString(locale)}${goal != null ? ` / ${goal}` : ""} g`,
      over: nutrientStatus(totals[key], goal) === "over",
    };
  });

  const DayIcon =
    dayKind === "training"
      ? Dumbbell
      : dayKind === "cardio"
        ? HeartPulse
        : dayKind === "rest"
          ? Moon
          : CalendarDays;
  return (
    <Card className="mt-4 space-y-4 overflow-hidden p-4">
      {/* The day and its kind ("Today · Training day") in the card's own
          header band, like a meal's and a drink's card (asked for: it sat
          above the card as a small grey label). */}
      <div className="card-head -mx-4 -mt-4 flex items-center gap-3 px-4 py-2.5">
        <span aria-hidden className={`${badge.tonal} size-9`}>
          <DayIcon className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-bold leading-tight">{dayLabel}</span>
          {dayKind ? (
            <span className="mt-0.5 block truncate text-[12.5px] text-foreground/75">
              {dayKind === "training"
                ? t.nutrition.trainingDay
                : dayKind === "cardio"
                  ? t.nutrition.cardioDay
                  : t.nutrition.restDay}
            </span>
          ) : null}
        </span>
        <button
          onClick={onSetGoals}
          aria-label={t.nutrition.setDailyLimits}
          className={button.icon}
        >
          <Pencil className="size-4" />
        </button>
      </div>
      <div>
        <div className="flex items-end justify-between gap-3">
          <p className="tabular leading-none">
            <span className="text-[30px] font-bold">{kcal.toLocaleString(locale)}</span>
            <span className="text-[14px] font-medium text-muted-foreground">
              {goals.calories != null ? ` / ${goals.calories.toLocaleString(locale)}` : ""} kcal
            </span>
          </p>
          {diff != null ? (
            <p
              className={`tabular flex items-center gap-1 text-[13px] font-semibold ${
                diff < 0 ? "text-destructive-text" : "text-muted-foreground"
              }`}
            >
              {diff < 0 ? <AlertTriangle className="size-3.5" /> : null}
              {diff < 0
                ? t.nutrition.kcalOver(Math.abs(diff).toLocaleString(locale))
                : t.nutrition.kcalLeft(diff.toLocaleString(locale))}
            </p>
          ) : null}
        </div>
        {goals.calories != null ? (
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${barClass(calStatus)}`}
              style={{ width: `${calPct}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["protein", "carbs", "fat"] as const).map((key) => {
          const value = Math.round(totals[key]);
          const goal = goals[key];
          const status = nutrientStatus(totals[key], goal);
          return (
            <div key={key} className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-muted-foreground">
                {t.nutrients[key]}
              </p>
              <p className="tabular mt-0.5 truncate leading-tight">
                <span
                  className={`text-[16px] font-bold ${status === "over" ? "text-destructive-text" : ""}`}
                >
                  {value}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {goal != null ? ` / ${goal}` : ""} g
                </span>
              </p>
              {goal != null ? (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${barClass(status)}`}
                    style={{ width: `${Math.min(100, (totals[key] / goal) * 100)}%` }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="tabular text-[12.5px] text-muted-foreground">
        {minor.map((m, i) => (
          <span key={m.key}>
            {i > 0 ? " · " : ""}
            <span className={m.over ? "font-semibold text-destructive-text" : ""}>{m.text}</span>
          </span>
        ))}
      </p>

      {!hasGoals ? (
        <button
          onClick={onSetGoals}
          className="w-full text-center text-[13px] font-semibold text-primary-text"
        >
          {t.nutrition.setDailyLimitsToTrack}
        </button>
      ) : null}
    </Card>
  );
}

/** A meal's icon, so the four sections tell apart at a glance. */
const MEAL_ICONS: Record<MealType, typeof Sun> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
};

/** One meal as one card: a header (icon, name, the meal's kcal and protein,
 *  save and "+") with its foods listed under it — name and P/C/F on the
 *  left, calories on the right; swipe a row left to delete it (also possible
 *  from its edit sheet). The header opens the meal's overview, or Add food
 *  when the meal is empty. A check marks a meal that reached the
 *  protein-per-meal amount. The icon is solid once the meal has food and
 *  muted while it's empty, like Home's badges. */
function MealGroup({
  meal,
  entries,
  proteinTarget,
  canAdd,
  onAdd,
  onOpen,
  onSaveAsMeal,
  onEdit,
  onDelete,
}: {
  meal: MealType;
  entries: FoodEntry[];
  proteinTarget: number | null;
  canAdd: boolean;
  onAdd: () => void;
  onOpen: () => void;
  onSaveAsMeal: () => void;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (entry: FoodEntry) => void;
}) {
  const t = useTranslation();
  const mealTotals = dailyTotals(entries);
  const protein = Math.round(mealTotals.protein);
  const proteinOk = proteinTarget != null && entries.length > 0 && protein >= proteinTarget;
  const Icon = MEAL_ICONS[meal];
  const hasFood = entries.length > 0;
  return (
    <Card className="overflow-hidden p-0">
      <div className="card-head flex items-center gap-2 px-3 py-2.5">
        {/* The header opens the meal's overview; an empty meal's adds food, like "+". */}
        <button
          onClick={hasFood ? onOpen : onAdd}
          disabled={!hasFood && !canAdd}
          aria-label={
            hasFood
              ? t.mealOverview.open(t.mealTypes[meal])
              : t.nutrition.addToMeal(t.mealTypes[meal])
          }
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-left active:bg-foreground/5 disabled:active:bg-transparent"
        >
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
              hasFood ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-[17px] font-bold leading-tight">
              <span className="truncate">{t.mealTypes[meal]}</span>
              {hasFood ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
            </span>
            <span className="tabular mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <span className="truncate">
                {hasFood
                  ? `${t.nutrition.kcal(Math.round(mealTotals.calories))} · P ${protein}`
                  : t.nutrition.nothingInMeal}
              </span>
              {proteinOk ? (
                <span
                  role="img"
                  aria-label={t.nutrition.proteinOk(protein, proteinTarget!)}
                  title={t.nutrition.proteinOk(protein, proteinTarget!)}
                  className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <Check className="size-2.5" strokeWidth={3.5} />
                </span>
              ) : null}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-3">
          {hasFood ? (
            <button
              onClick={onSaveAsMeal}
              aria-label={t.nutrition.saveAsMeal(t.mealTypes[meal])}
              className="tap-target flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-90"
            >
              <HapticSwitch />
              <BookmarkPlus className="size-4" />
            </button>
          ) : null}
          {canAdd ? (
            <button
              onClick={onAdd}
              aria-label={t.nutrition.addToMeal(t.mealTypes[meal])}
              className="tap-target flex size-8 items-center justify-center rounded-full bg-primary/25 text-foreground active:scale-90"
            >
              <HapticSwitch />
              <Plus className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      {entries.map((entry) => {
        const m = scaledMacros(entry);
        return (
          <div key={entry.id} className="border-t border-border">
            <SwipeToDelete
              onDelete={() => onDelete(entry)}
              deleteLabel={t.nutrition.removeEntry(entry.name)}
            >
              <button
                onClick={() => onEdit(entry)}
                aria-label={t.nutrition.editEntry(entry.name)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-foreground/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{entry.name}</p>
                  <PortionLine
                    grams={entry.grams}
                    unit={drinkOf(entry) ? "ml" : "g"}
                    macros={m}
                    className="text-[12.5px]"
                  />
                </div>
                <p className="tabular shrink-0 text-[14px] font-semibold">
                  {t.nutrition.kcal(m.calories)}
                </p>
              </button>
            </SwipeToDelete>
          </div>
        );
      })}
    </Card>
  );
}
