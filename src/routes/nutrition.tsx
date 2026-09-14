import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Settings2, Trash2 } from "lucide-react";
import { AddFoodSheet } from "../components/gym/AddFoodSheet";
import { NutritionGoalsSheet } from "../components/gym/NutritionGoalsSheet";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import {
  dailyTotals,
  dayKey,
  entriesForDay,
  MEAL_LABELS,
  MEAL_ORDER,
  NUTRIENT_LABELS,
  NUTRIENT_ORDER,
  NUTRIENT_UNITS,
  nutrientStatus,
  scaledMacros,
  type NutrientKey,
} from "../lib/gym/nutrition";
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
  const { foodEntries, nutritionGoals, hydrated, removeFoodEntry } = useGym();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [goalsSheetOpen, setGoalsSheetOpen] = useState(false);

  const today = useMemo(() => dayKey(new Date().toISOString()), []);
  const todaysEntries = useMemo(() => entriesForDay(foodEntries, today), [foodEntries, today]);
  const totals = useMemo(() => dailyTotals(todaysEntries), [todaysEntries]);
  const hasGoals = NUTRIENT_ORDER.some((k) => nutritionGoals[k] != null);

  if (!hydrated) return <Screen title="Nutrition">{null}</Screen>;

  return (
    <Screen
      title="Nutrition"
      subtitle={new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    >
      <div className="mb-1.5 mt-4 flex items-center justify-between px-1">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          Today's overview
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

      <button
        onClick={() => {
          haptic(20);
          setSheetOpen(true);
        }}
        className="glow mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-[0.985]"
      >
        <Plus className="size-5" /> Add food
      </button>

      <SectionLabel>Today</SectionLabel>
      {todaysEntries.length === 0 ? (
        <Card className="p-6 text-center text-[15px] text-muted-foreground">
          Nothing logged yet today.
        </Card>
      ) : (
        <div className="space-y-4">
          {MEAL_ORDER.map((meal) => {
            const mealEntries = todaysEntries.filter((e) => e.meal === meal);
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
                        <div className="min-w-0">
                          <p className="truncate text-[16px] font-semibold">{entry.name}</p>
                          <p className="tabular text-[13px] text-muted-foreground">
                            {entry.grams}g · {m.calories} kcal · {m.protein}g P · {m.carbs}g C ·{" "}
                            {m.fat}g F · {m.fiber}g Fib · {m.salt}g Salt
                          </p>
                        </div>
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

      <AddFoodSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <NutritionGoalsSheet open={goalsSheetOpen} onClose={() => setGoalsSheetOpen(false)} />
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
