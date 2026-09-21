import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { AddFoodSheet } from "../components/gym/AddFoodSheet";
import { CreateMealSheet } from "../components/gym/CreateMealSheet";
import { CreateRecipeSheet } from "../components/gym/CreateRecipeSheet";
import { NutritionGoalsSheet } from "../components/gym/NutritionGoalsSheet";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import {
  addDays,
  dailyTotals,
  dayKeyFromDate,
  entriesForDay,
  MEAL_LABELS,
  MEAL_ORDER,
  mealForTime,
  NUTRIENT_LABELS,
  NUTRIENT_ORDER,
  NUTRIENT_UNITS,
  nutrientStatus,
  recipePerServing,
  scaledMacros,
  formatLiters,
  WATER_QUICK_ADD,
  type FoodEntry,
  type NutrientKey,
} from "../lib/gym/nutrition";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../lib/gym/numericInput";
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

function NutritionScreen() {
  const {
    foodEntries,
    nutritionGoals,
    mealTemplates,
    recipes,
    waterEntries,
    waterGoalMl,
    hydrated,
    removeFoodEntry,
    logMealTemplate,
    logRecipe,
    logWater,
    removeWaterEntry,
    update,
  } = useGym();
  /** null = closed, "add" = fresh entry, an entry = editing that one. */
  const [foodSheet, setFoodSheet] = useState<"add" | FoodEntry | null>(null);
  const [goalsSheetOpen, setGoalsSheetOpen] = useState(false);
  const [createMealOpen, setCreateMealOpen] = useState(false);
  const [createRecipeOpen, setCreateRecipeOpen] = useState(false);
  const [waterGoalEditing, setWaterGoalEditing] = useState(false);
  const [waterGoalDraft, setWaterGoalDraft] = useState("");
  /** 0 = today, -1 = yesterday, etc. Only today allows adding/logging. */
  const [dayOffset, setDayOffset] = useState(0);

  const selectedDate = useMemo(() => addDays(new Date(), dayOffset), [dayOffset]);
  const selectedKey = useMemo(() => dayKeyFromDate(selectedDate), [selectedDate]);
  const selectedEntries = useMemo(
    () => entriesForDay(foodEntries, selectedKey),
    [foodEntries, selectedKey],
  );
  const totals = useMemo(() => dailyTotals(selectedEntries), [selectedEntries]);
  const hasGoals = NUTRIENT_ORDER.some((k) => nutritionGoals[k] != null);
  const isToday = dayOffset === 0;

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
  const dayLabel = isToday
    ? "Today"
    : dayOffset === -1
      ? "Yesterday"
      : selectedDate.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
        });

  if (!hydrated) return <Screen title="Nutrition">{null}</Screen>;

  return (
    <Screen title="Nutrition">
      <div className="mt-1 flex items-center justify-between px-1">
        <button
          onClick={() => {
            haptic(10);
            setDayOffset((d) => d - 1);
          }}
          aria-label="Previous day"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-[15px] font-semibold">{dayLabel}</p>
        <button
          onClick={() => {
            haptic(10);
            setDayOffset((d) => Math.min(0, d + 1));
          }}
          aria-label="Next day"
          disabled={isToday}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mb-1.5 mt-4 flex items-center justify-between px-1">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          {isToday ? "Today's" : "That day's"} overview
        </p>
        <button
          onClick={() => {
            haptic(12);
            setGoalsSheetOpen(true);
          }}
          aria-label="Set daily nutrition limits"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <Settings2 className="size-4" />
        </button>
      </div>
      <Card className="space-y-4 p-4">
        {NUTRIENT_ORDER.map((key) => (
          <NutrientMeter
            key={key}
            nutrientKey={key}
            consumed={totals[key]}
            limit={nutritionGoals[key]}
          />
        ))}
        {!hasGoals ? (
          <button
            onClick={() => {
              haptic(12);
              setGoalsSheetOpen(true);
            }}
            className="w-full text-center text-[13px] font-semibold text-primary"
          >
            Set daily limits to track progress
          </button>
        ) : null}
      </Card>

      <SectionLabel>Water</SectionLabel>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="tabular text-[26px] font-bold leading-none">
              {formatLiters(totalWaterMl)}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {waterGoalMl ? `of ${formatLiters(waterGoalMl)} goal` : `${totalWaterMl}ml logged`}
            </p>
          </div>
          <button
            onClick={openWaterGoalEditor}
            aria-label="Set water goal"
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
              placeholder="e.g. 2500"
              className="tabular h-10 w-full min-w-0 flex-1 rounded-xl bg-muted px-3 text-[15px] font-semibold outline-none"
            />
            <span className="shrink-0 text-[13px] text-muted-foreground">ml</span>
            <button
              onClick={saveWaterGoal}
              aria-label="Save water goal"
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

        {isToday ? (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {WATER_QUICK_ADD.map((ml) => (
              <button
                key={ml}
                onClick={() => {
                  haptic(15);
                  logWater(ml);
                }}
                className="glass flex flex-col items-center gap-1 rounded-2xl py-3 active:scale-95"
              >
                <Droplet className="size-4 text-primary" />
                <span className="text-[12px] font-semibold">
                  +{ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
                </span>
              </button>
            ))}
          </div>
        ) : null}
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
              aria-label={`Remove ${entry.ml}ml water entry`}
              className="glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-muted-foreground active:scale-95"
            >
              <Droplet className="size-3 text-primary" /> {entry.ml}ml <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}

      {isToday ? (
        <>
          <button
            onClick={() => {
              haptic(20);
              setFoodSheet("add");
            }}
            className="glow mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-[0.985]"
          >
            <Plus className="size-5" /> Add food
          </button>

          <SectionLabel>Meals</SectionLabel>
          {mealTemplates.length === 0 ? (
            <Card className="p-4 text-[13px] text-muted-foreground">
              Save a combo of ingredients — like "Banana oatmeal" — to add it all in one tap next
              time.
            </Card>
          ) : (
            <div className="space-y-2">
              {mealTemplates.map((template) => {
                const templateTotals = dailyTotals(template.ingredients);
                return (
                  <Card key={template.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{template.name}</p>
                      <p className="tabular text-[12px] text-muted-foreground">
                        {template.ingredients.length} ingredient
                        {template.ingredients.length === 1 ? "" : "s"} · {templateTotals.calories}{" "}
                        kcal
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        haptic([20, 30]);
                        logMealTemplate(template.id, mealForTime(new Date().toISOString()));
                      }}
                      aria-label={`Log ${template.name}`}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Plus className="size-4" />
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
          <button
            onClick={() => {
              haptic(15);
              setCreateMealOpen(true);
            }}
            className="glass mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary active:scale-[0.985]"
          >
            <Plus className="size-4" /> New meal
          </button>

          <SectionLabel>Recipes</SectionLabel>
          {recipes.length === 0 ? (
            <Card className="p-4 text-[13px] text-muted-foreground">
              Save ingredients as a recipe with a serving count — log a single serving in one tap,
              scaled automatically from the whole batch.
            </Card>
          ) : (
            <div className="space-y-2">
              {recipes.map((recipe) => {
                const perServing = recipePerServing(recipe);
                return (
                  <Card key={recipe.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{recipe.name}</p>
                      <p className="tabular text-[12px] text-muted-foreground">
                        {recipe.servings} serving{recipe.servings === 1 ? "" : "s"} ·{" "}
                        {perServing.calories} kcal/serving
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        haptic([20, 30]);
                        logRecipe(recipe.id, 1, mealForTime(new Date().toISOString()));
                      }}
                      aria-label={`Log 1 serving of ${recipe.name}`}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Plus className="size-4" />
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
          <button
            onClick={() => {
              haptic(15);
              setCreateRecipeOpen(true);
            }}
            className="glass mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary active:scale-[0.985]"
          >
            <Plus className="size-4" /> New recipe
          </button>
        </>
      ) : null}

      <SectionLabel>Log</SectionLabel>
      {selectedEntries.length === 0 ? (
        <Card className="p-6 text-center text-[15px] text-muted-foreground">
          {isToday ? "Nothing logged yet today." : "Nothing logged that day."}
        </Card>
      ) : (
        <div className="space-y-4">
          {MEAL_ORDER.map((meal) => {
            const mealEntries = selectedEntries.filter((e) => e.meal === meal);
            if (!mealEntries.length) return null;
            const mealTotals = dailyTotals(mealEntries);
            return (
              <div key={meal}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {MEAL_LABELS[meal]}
                  </p>
                  <p className="tabular text-[13px] text-muted-foreground">
                    {mealTotals.calories} kcal
                  </p>
                </div>
                <div className="space-y-2">
                  {mealEntries.map((entry) => {
                    const m = scaledMacros(entry);
                    return (
                      <Card key={entry.id} className="flex items-center justify-between gap-3 p-4">
                        <button
                          onClick={() => {
                            haptic(12);
                            setFoodSheet(entry);
                          }}
                          aria-label={`Edit ${entry.name}`}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-[16px] font-semibold">{entry.name}</p>
                          <p className="tabular text-[13px] text-muted-foreground">
                            {entry.grams}g · {m.calories} kcal · {m.protein}g P · {m.carbs}g C ·{" "}
                            {m.fat}g F · {m.fiber}g Fib · {m.salt}g Salt
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            haptic(15);
                            removeFoodEntry(entry.id);
                          }}
                          aria-label={`Remove ${entry.name}`}
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddFoodSheet
        open={foodSheet !== null}
        editEntry={typeof foodSheet === "object" ? foodSheet : null}
        onClose={() => setFoodSheet(null)}
      />
      <NutritionGoalsSheet open={goalsSheetOpen} onClose={() => setGoalsSheetOpen(false)} />
      <CreateMealSheet open={createMealOpen} onClose={() => setCreateMealOpen(false)} />
      <CreateRecipeSheet open={createRecipeOpen} onClose={() => setCreateRecipeOpen(false)} />
    </Screen>
  );
}

function NutrientMeter({
  nutrientKey,
  consumed,
  limit,
}: {
  nutrientKey: NutrientKey;
  consumed: number;
  limit: number | undefined;
}) {
  const status = nutrientStatus(consumed, limit);
  const unit = NUTRIENT_UNITS[nutrientKey];
  const pct = limit ? Math.min(100, (consumed / limit) * 100) : 0;
  const remaining = limit != null ? Math.round((limit - consumed) * 100) / 100 : null;
  const fillClass =
    status === "over" ? "bg-destructive" : status === "near" ? "bg-chart-3" : "bg-primary";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold">{NUTRIENT_LABELS[nutrientKey]}</span>
        <span className="tabular text-[13px] text-muted-foreground">
          {limit != null ? `${consumed} / ${limit} ${unit}` : `${consumed} ${unit}`}
        </span>
      </div>
      {limit != null ? (
        <>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${fillClass}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {status === "over" ? (
            <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-destructive">
              <AlertTriangle className="size-3.5" /> {Math.abs(remaining!)} {unit} over
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {remaining} {unit} left
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
