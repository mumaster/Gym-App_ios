import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AddFoodSheet } from "../components/gym/AddFoodSheet";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import {
  dailyTotals,
  dayKey,
  entriesForDay,
  MEAL_LABELS,
  MEAL_ORDER,
  scaledMacros,
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
  const { foodEntries, hydrated, removeFoodEntry } = useGym();
  const [sheetOpen, setSheetOpen] = useState(false);

  const today = useMemo(() => dayKey(new Date().toISOString()), []);
  const todaysEntries = useMemo(() => entriesForDay(foodEntries, today), [foodEntries, today]);
  const totals = useMemo(() => dailyTotals(todaysEntries), [todaysEntries]);

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
      <Card className="grid grid-cols-4 gap-2 p-4 text-center">
        {[
          ["Calories", `${totals.calories}`],
          ["Protein", `${totals.protein}g`],
          ["Carbs", `${totals.carbs}g`],
          ["Fat", `${totals.fat}g`],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="tabular text-[18px] font-bold">{value}</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
          </div>
        ))}
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
                            {m.fat}g F
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
    </Screen>
  );
}
