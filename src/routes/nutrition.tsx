import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  RotateCcw,
  Coffee,
  Droplet,
  Plus,
  Settings2,
  X,
  Dumbbell,
  HeartPulse,
  Moon,
  Sunrise,
  Sun,
  Cookie,
} from "lucide-react";
import { AddFoodSheet } from "../components/gym/AddFoodSheet";
import { CreateMealSheet } from "../components/gym/CreateMealSheet";
import { MealOverviewSheet, PortionLine } from "../components/gym/MealOverviewSheet";
import { CreateRecipeSheet } from "../components/gym/CreateRecipeSheet";
import { NutritionGoalsSheet } from "../components/gym/NutritionGoalsSheet";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { SwipeToDelete } from "../components/gym/SwipeToDelete";
import {
  addDays,
  CAFFEINE_DAILY_LIMIT_MG,
  CAFFEINE_PREGNANCY_LIMIT_MG,
  caffeineMg,
  COFFEE_CAFFEINE_MG,
  COFFEE_KINDS,
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
  WATER_AMOUNT_MAX_ML,
  WATER_QUICK_ADD,
  formatWaterAmount,
  parseWaterMl,
  type FoodEntry,
  type Macros,
  type MealIngredient,
  type MealType,
  type NutrientStatus,
  type NutritionGoals,
} from "../lib/gym/nutrition";
import { BodyweightCard } from "../components/gym/BodyweightCard";
import { HapticSwitch } from "../components/gym/HapticSwitch";
import { useDayGoalsResolver, useDayNutrition } from "../lib/gym/dayNutrition";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import { latestBodyKg } from "../lib/gym/load";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../lib/gym/numericInput";
import { mondayOf, parseDayKey } from "../lib/gym/schedule";
import { haptic, useGym } from "../lib/gym/store";

export const Route = createFileRoute("/nutrition")({
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
  status === "over" ? "bg-destructive" : status === "near" ? "bg-chart-3" : "bg-primary";

/**
 * Order follows use: the week and today's numbers, then Add food and what
 * you've eaten, then water and bodyweight. Saved meals and recipes live in
 * the Add food sheet, next to Favourites and Recent — logging one is the
 * same action as logging any food.
 */
function NutritionScreen() {
  const t = useTranslation();
  const locale = useLocale();
  const {
    foodEntries,
    waterEntries,
    waterGoalMl,
    hydrated,
    removeFoodEntry,
    logWater,
    removeWaterEntry,
    update,
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
  const [waterGoalEditing, setWaterGoalEditing] = useState(false);
  const [waterGoalDraft, setWaterGoalDraft] = useState("");
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

  const selectedWaterEntries = useMemo(
    () => entriesForDay(waterEntries, selectedKey),
    [waterEntries, selectedKey],
  );
  const totalWaterMl = useMemo(
    () => selectedWaterEntries.reduce((sum, e) => sum + e.ml, 0),
    [selectedWaterEntries],
  );
  const waterPct = waterGoalMl ? Math.min(100, (totalWaterMl / waterGoalMl) * 100) : 0;

  const openWaterGoalEditor = () => {
    haptic(12);
    setWaterGoalDraft(waterGoalMl ? String(waterGoalMl) : "");
    setWaterGoalEditing(true);
  };
  const saveWaterGoal = () => {
    haptic(15);
    const n = Math.round(parseDecimal(waterGoalDraft));
    update({ waterGoalMl: n > 0 ? n : null });
    setWaterGoalEditing(false);
  };
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

  if (!hydrated) return <Screen title={t.nutrition.title}>{null}</Screen>;

  return (
    <Screen title={t.nutrition.title}>
      <WeekStrip selectedKey={selectedKey} todayKey={todayKey} onSelect={setSelectedKey} />

      <div className="mb-1.5 mt-4 flex items-center justify-between gap-2 px-1">
        <p className="flex min-w-0 items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span className="truncate">{dayLabel}</span>
          {dayNutrition.byDayType ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] normal-case tracking-normal text-foreground">
              {dayNutrition.dayKind === "training" ? (
                <Dumbbell className="size-3" />
              ) : dayNutrition.dayKind === "cardio" ? (
                <HeartPulse className="size-3" />
              ) : (
                <Moon className="size-3" />
              )}
              {dayNutrition.dayKind === "training"
                ? t.nutrition.trainingDay
                : dayNutrition.dayKind === "cardio"
                  ? t.nutrition.cardioDay
                  : t.nutrition.restDay}
            </span>
          ) : null}
        </p>
        <button
          onClick={() => {
            haptic(12);
            setGoalsSheetOpen(true);
          }}
          aria-label={t.nutrition.setDailyLimits}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <Settings2 className="size-4" />
        </button>
      </div>
      <DaySummary
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
          className="glow mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-[0.985]"
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
            <p className="-mt-1 px-1 text-[11.5px] leading-snug text-muted-foreground">
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

      <SectionLabel>{t.nutrition.water}</SectionLabel>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="tabular text-[26px] font-bold leading-none">
              {formatLiters(totalWaterMl)}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {waterGoalMl
                ? t.nutrition.ofGoal(formatLiters(waterGoalMl))
                : t.nutrition.loggedMl(totalWaterMl)}
            </p>
          </div>
          <button
            onClick={openWaterGoalEditor}
            aria-label={t.nutrition.setWaterGoal}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <Settings2 className="size-4" />
          </button>
        </div>

        {waterGoalEditing ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              inputMode="numeric"
              type="text"
              value={waterGoalDraft}
              onFocus={selectOnFocus}
              onChange={(e) => {
                if (DECIMAL_INPUT_RE.test(e.target.value)) setWaterGoalDraft(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && saveWaterGoal()}
              placeholder={t.nutrition.mlPlaceholder}
              className="tabular h-10 w-full min-w-0 flex-1 rounded-xl bg-muted px-3 text-[15px] font-semibold outline-none"
            />
            <span className="shrink-0 text-[13px] text-muted-foreground">ml</span>
            <button
              onClick={saveWaterGoal}
              aria-label={t.nutrition.saveWaterGoal}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="size-4" />
            </button>
          </div>
        ) : waterGoalMl ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${waterPct}%` }}
            />
          </div>
        ) : null}

        {isToday ? <WaterShortcuts onLog={logWater} /> : null}
      </Card>

      {selectedWaterEntries.length > 0 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
          {selectedWaterEntries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                haptic(10);
                removeWaterEntry(entry.id);
              }}
              aria-label={t.nutrition.removeWaterEntry(entry.ml)}
              className="glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-muted-foreground active:scale-95"
            >
              <Droplet className="size-3 text-primary-text" /> {entry.ml}ml <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}

      <SectionLabel>{t.coffee.title}</SectionLabel>
      <CoffeeCard dayKey={selectedKey} canAdd={isToday} />

      {isToday ? (
        <>
          <SectionLabel>{t.bodyweight.title}</SectionLabel>
          <BodyweightCard />
        </>
      ) : null}

      {/* RIVM's conditions of use require this reference on nutritional
          output based on NEVO data — shown whenever the day's figures
          include a NEVO food (see nevoFoods.ts). */}
      {selectedEntries.some((e) => e.nevo?.length) ? (
        <p className="mt-6 px-1 text-[11px] leading-snug text-muted-foreground">
          {t.nutrition.nevoReference}
        </p>
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
      <CreateRecipeSheet open={createRecipeOpen} onClose={() => setCreateRecipeOpen(false)} />
    </Screen>
  );
}

/**
 * The week the selected day falls in, Monday first: each day's calories as
 * a small bar against that day's limit (training/rest-day limits included),
 * and the week's average over finished, logged days — when cutting, the
 * week's average is what moves weight, not any single day. Arrows move a
 * week at a time; days after today can't be picked.
 */
function WeekStrip({
  selectedKey,
  todayKey,
  onSelect,
}: {
  selectedKey: string;
  todayKey: string;
  onSelect: (key: string) => void;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const { foodEntries } = useGym();
  const resolve = useDayGoalsResolver();
  const monday = mondayOf(parseDayKey(selectedKey));
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(monday, i);
        const key = dayKeyFromDate(date);
        const entries = entriesForDay(foodEntries, key);
        return {
          date,
          key,
          calories: dailyTotals(entries).calories,
          goal: resolve(date).goals.calories,
          logged: entries.length > 0,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monday.getTime(), foodEntries, resolve],
  );
  const avg = weeklyAverage(days, todayKey);
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
    <Card className="mt-1 p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => move(-1)}
          aria-label={t.nutrition.previousWeek}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-[14px] font-semibold">{title}</p>
        <button
          onClick={() => move(1)}
          disabled={weeksBack === 0}
          aria-label={t.nutrition.nextWeek}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const future = d.key > todayKey;
          const selected = d.key === selectedKey;
          const status = d.logged ? nutrientStatus(d.calories, d.goal) : "none";
          const pct = d.goal ? Math.min(100, (d.calories / d.goal) * 100) : d.logged ? 100 : 0;
          const name = t.common.dow[d.date.getDay()] ?? "";
          return (
            <button
              key={d.key}
              disabled={future}
              onClick={() => {
                haptic(10);
                onSelect(d.key);
              }}
              aria-pressed={selected}
              aria-label={t.nutrition.dayAria(
                d.date.toLocaleDateString(locale, { weekday: "long", day: "numeric" }),
                d.logged ? d.calories : null,
              )}
              className={`flex flex-col items-center gap-1 rounded-xl py-1.5 disabled:opacity-35 ${
                selected ? "bg-primary/15 ring-1 ring-primary" : ""
              }`}
            >
              <span
                className={`text-[10.5px] font-semibold leading-none ${
                  d.key === todayKey ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {name.charAt(0).toUpperCase()}
              </span>
              <span className="tabular text-[15px] font-bold leading-none">{d.date.getDate()}</span>
              <span className="h-1 w-6 overflow-hidden rounded-full bg-muted">
                <span
                  // Accent unless over: landing near the limit is the aim
                  // here, not a warning.
                  className={`block h-full rounded-full ${
                    status === "over" ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${d.logged ? pct : 0}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <p className="tabular mt-2 text-center text-[12px] text-muted-foreground">
        {avg
          ? t.nutrition.weekAvg(
              avg.calories.toLocaleString(locale),
              avg.goal != null ? avg.goal.toLocaleString(locale) : null,
              avg.days,
            )
          : t.nutrition.weekAvgNone}
      </p>
    </Card>
  );
}

/** Calories as the headline, protein/carbs/fat side by side, fiber and
 *  salt on one line — whole grams (salt keeps one decimal on its 5 g
 *  scale), matching Home. */
function DaySummary({
  totals,
  goals,
  hasGoals,
  onSetGoals,
}: {
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

  return (
    <Card className="space-y-4 p-4">
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
                diff < 0 ? "text-destructive" : "text-muted-foreground"
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
                  className={`text-[16px] font-bold ${status === "over" ? "text-destructive" : ""}`}
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
            <span className={m.over ? "font-semibold text-destructive" : ""}>{m.text}</span>
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
 *  from its edit sheet). The header opens the meal's overview. A check marks
 *  a meal that reached the protein-per-meal amount. The icon is solid once
 *  the meal has food and muted while it's empty, like Home's badges. */
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
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Tapping the header opens the meal's nutrition overview. */}
        <button
          onClick={onOpen}
          disabled={!hasFood}
          aria-label={t.mealOverview.open(t.mealTypes[meal])}
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
        <div className="flex shrink-0 items-center gap-2">
          {hasFood ? (
            <button
              onClick={onSaveAsMeal}
              aria-label={t.nutrition.saveAsMeal(t.mealTypes[meal])}
              className="relative flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-90"
            >
              <HapticSwitch />
              <BookmarkPlus className="size-4" />
            </button>
          ) : null}
          {canAdd ? (
            <button
              onClick={onAdd}
              aria-label={t.nutrition.addToMeal(t.mealTypes[meal])}
              className="relative flex size-8 items-center justify-center rounded-full bg-primary/15 text-foreground active:scale-90"
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
                  <PortionLine grams={entry.grams} macros={m} className="text-[12.5px]" />
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

/** Coffee, logged by the cup like water, with the day's caffeine against
 *  EFSA's daily limit (see nutrition.ts's COFFEE_CAFFEINE_MG). */
function CoffeeCard({ dayKey, canAdd }: { dayKey: string; canAdd: boolean }) {
  const t = useTranslation();
  const { coffeeEntries, logCoffee, removeCoffeeEntry } = useGym();
  const entries = useMemo(() => entriesForDay(coffeeEntries, dayKey), [coffeeEntries, dayKey]);
  const mg = caffeineMg(entries);
  const status = nutrientStatus(mg, CAFFEINE_DAILY_LIMIT_MG);
  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-text">
            <Coffee className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="tabular text-[22px] font-bold leading-none">
              {t.coffee.cups(entries.length)}
            </p>
            <p
              className={`tabular mt-1 text-[12.5px] ${status === "over" ? "font-semibold text-destructive" : "text-muted-foreground"}`}
            >
              {status === "over"
                ? t.coffee.over(mg - CAFFEINE_DAILY_LIMIT_MG)
                : t.coffee.caffeine(mg, CAFFEINE_DAILY_LIMIT_MG)}
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${barClass(status)}`}
            style={{ width: `${Math.min(100, (mg / CAFFEINE_DAILY_LIMIT_MG) * 100)}%` }}
          />
        </div>
        {canAdd ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {COFFEE_KINDS.map((kind) => (
              <button
                key={kind}
                onClick={() => {
                  haptic(15);
                  logCoffee(kind);
                }}
                aria-label={t.coffee.add(t.coffee.kinds[kind])}
                className="glass relative flex flex-col items-center gap-0.5 rounded-2xl py-2.5 active:scale-95"
              >
                <HapticSwitch />
                <Coffee className="size-4 text-primary-text" />
                <span className="text-[12.5px] font-semibold">+ {t.coffee.kinds[kind]}</span>
                <span className="tabular text-[11px] text-muted-foreground">
                  {COFFEE_CAFFEINE_MG[kind]} mg
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-3 text-[11.5px] leading-snug text-muted-foreground">
          {t.coffee.note(CAFFEINE_DAILY_LIMIT_MG, CAFFEINE_PREGNANCY_LIMIT_MG)}
        </p>
      </Card>
      {entries.length > 0 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                haptic(10);
                removeCoffeeEntry(entry.id);
              }}
              aria-label={t.coffee.remove(t.coffee.kinds[entry.kind])}
              className="glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-muted-foreground active:scale-95"
            >
              <Coffee className="size-3 text-primary-text" /> {t.coffee.kinds[entry.kind]}{" "}
              <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** The water quick-adds: four one-tap shortcuts (amounts the user can
 *  change, shared with Home's Water tile), plus a field for a one-off
 *  amount such as a 600 ml bottle. */
function WaterShortcuts({ onLog }: { onLog: (ml: number) => void }) {
  const t = useTranslation();
  const { waterQuickAdd, update } = useGym();
  const [custom, setCustom] = useState("");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<string[]>([]);
  const customMl = parseWaterMl(custom);
  const draftMl = drafts.map(parseWaterMl);
  const draftsValid = draftMl.every((ml) => ml != null);

  const logCustom = () => {
    if (customMl == null) return;
    haptic(15);
    onLog(customMl);
    setCustom("");
  };
  const startEditing = () => {
    haptic(12);
    setDrafts(waterQuickAdd.map(String));
    setEditing(true);
  };
  const saveShortcuts = () => {
    if (!draftsValid) return;
    haptic(15);
    update({ waterQuickAdd: draftMl as number[] });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-4">
        <p className="text-[12.5px] text-muted-foreground">{t.nutrition.waterShortcutsHint}</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {drafts.map((value, i) => (
            <label
              key={i}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-1.5 py-2 ${
                draftMl[i] == null ? "bg-destructive/10 ring-1 ring-destructive/50" : "bg-muted"
              }`}
            >
              <span className="sr-only">{t.nutrition.waterShortcut(i + 1)}</span>
              <input
                inputMode="numeric"
                type="text"
                value={value}
                onFocus={selectOnFocus}
                onChange={(e) => {
                  if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                  const next = [...drafts];
                  next[i] = e.target.value;
                  setDrafts(next);
                }}
                className="tabular h-8 w-full min-w-0 bg-transparent text-center text-[16px] font-bold outline-none"
              />
              <span className="text-[11px] text-muted-foreground">ml</span>
            </label>
          ))}
        </div>
        {!draftsValid ? (
          <p className="mt-1.5 text-[12px] text-destructive">
            {t.nutrition.waterInvalid(WATER_AMOUNT_MAX_ML)}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              haptic(10);
              setDrafts(WATER_QUICK_ADD.map(String));
            }}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-secondary px-4 text-[14px] font-semibold"
          >
            <RotateCcw className="size-4" /> {t.nutrition.waterResetShortcuts}
          </button>
          <button
            onClick={saveShortcuts}
            disabled={!draftsValid}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground disabled:opacity-40"
          >
            <Check className="size-4" /> {t.nutrition.waterSaveShortcuts}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {waterQuickAdd.map((ml, i) => (
          <button
            key={i}
            onClick={() => {
              haptic(15);
              onLog(ml);
            }}
            className="glass relative flex flex-col items-center gap-1 rounded-2xl py-3 active:scale-95"
          >
            <HapticSwitch />
            <Droplet className="size-4 text-primary-text" />
            <span className="text-[12px] font-semibold">+{formatWaterAmount(ml)}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-muted px-3">
          <span className="sr-only">{t.nutrition.waterOther}</span>
          <input
            inputMode="numeric"
            type="text"
            value={custom}
            onFocus={selectOnFocus}
            onChange={(e) => {
              if (DECIMAL_INPUT_RE.test(e.target.value)) setCustom(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && logCustom()}
            placeholder={t.nutrition.waterOther}
            className="tabular h-full w-full min-w-0 bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
          <span className="shrink-0 text-[13px] text-muted-foreground">ml</span>
        </label>
        <button
          onClick={logCustom}
          disabled={customMl == null}
          aria-label={t.nutrition.waterAddOtherAria}
          className="relative flex h-11 shrink-0 items-center gap-1 rounded-xl bg-primary px-3.5 text-[14px] font-bold text-primary-foreground disabled:opacity-40"
        >
          <Plus className="size-4" /> {t.nutrition.waterAddOther}
        </button>
        <button
          onClick={startEditing}
          aria-label={t.nutrition.waterEditShortcuts}
          title={t.nutrition.waterEditShortcuts}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </>
  );
}
