import { BookmarkPlus, Check, Plus } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import {
  dailyTotals,
  energySplit,
  scaledMacros,
  type FoodEntry,
  type Macros,
  type MealType,
  type NutritionGoals,
} from "../../lib/gym/nutrition";

/**
 * Tapping a meal heading in the food log: what that meal added up to on the
 * selected day — calories and their share of the day, each nutrient against
 * the day's limit, where the energy came from, the protein-per-meal check,
 * and the foods in it (tap one to edit it).
 */
export function MealOverviewSheet({
  meal,
  entries,
  dayTotals,
  goals,
  proteinTarget,
  dayLabel,
  canAdd,
  onClose,
  onAdd,
  onSaveAsMeal,
  onEdit,
}: {
  meal: MealType | null;
  entries: FoodEntry[];
  dayTotals: Macros;
  goals: NutritionGoals;
  proteinTarget: number | null;
  dayLabel: string;
  canAdd: boolean;
  onClose: () => void;
  onAdd: () => void;
  onSaveAsMeal: () => void;
  onEdit: (entry: FoodEntry) => void;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const totals = dailyTotals(entries);
  const kcal = Math.round(totals.calories);
  const dayKcal = Math.round(dayTotals.calories);
  const split = energySplit(totals);
  const protein = Math.round(totals.protein);
  const proteinOk = proteinTarget != null && protein >= proteinTarget;

  return (
    <BottomSheet
      open={meal != null}
      onClose={onClose}
      title={meal ? t.mealOverview.title(t.mealTypes[meal], dayLabel) : ""}
    >
      {meal ? (
        <div className="space-y-4">
          <div>
            <p className="tabular leading-none">
              <span className="text-[32px] font-bold">{kcal.toLocaleString(locale)}</span>
              <span className="text-[15px] font-medium text-muted-foreground"> kcal</span>
            </p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {t.mealOverview.foods(entries.length)}
              {dayKcal > 0 ? ` · ${t.mealOverview.ofDay(Math.round((kcal / dayKcal) * 100))}` : ""}
              {goals.calories
                ? ` · ${t.mealOverview.ofLimit(Math.round((kcal / goals.calories) * 100))}`
                : ""}
            </p>
            {dayKcal > 0 ? (
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, (kcal / dayKcal) * 100)}%` }}
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["protein", "carbs", "fat", "fiber", "salt"] as const).map((key) => {
              const digits = key === "salt" ? 1 : 0;
              const value = Number(totals[key].toFixed(digits));
              const goal = goals[key];
              const pct = goal ? Math.round((totals[key] / goal) * 100) : null;
              return (
                <div
                  key={key}
                  className={`rounded-2xl bg-muted/60 px-3.5 py-2.5 ${key === "protein" ? "col-span-2" : ""}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[12.5px] font-semibold text-muted-foreground">
                      {t.nutrients[key]}
                    </p>
                    <p className="tabular text-[16px] font-bold">
                      {value.toLocaleString(locale)}
                      <span className="text-[12px] font-medium text-muted-foreground"> g</span>
                    </p>
                  </div>
                  {pct != null ? (
                    <>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background/60">
                        <div
                          className={`h-full rounded-full ${pct > 100 ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <p className="tabular mt-1 text-[11.5px] text-muted-foreground">
                        {t.mealOverview.ofLimit(pct)}
                      </p>
                    </>
                  ) : null}
                  {key === "protein" && proteinTarget != null ? (
                    <p className="tabular mt-1 flex items-center gap-1.5 text-[12px]">
                      {proteinOk ? (
                        <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-2.5" strokeWidth={3.5} />
                        </span>
                      ) : null}
                      {t.mealOverview.proteinMeal(protein, proteinTarget)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {split ? (
            <p className="tabular px-1 text-[13px]">
              <span className="text-muted-foreground">{t.mealOverview.split} </span>
              <span className="font-semibold">
                {t.nutrients.protein} {split.protein}% · {t.nutrients.carbs} {split.carbs}% ·{" "}
                {t.nutrients.fat} {split.fat}%
              </span>
            </p>
          ) : null}

          {entries.length ? (
            <div className="overflow-hidden rounded-2xl bg-muted/50">
              {entries.map((entry, i) => {
                const m = scaledMacros(entry);
                return (
                  <button
                    key={entry.id}
                    onClick={() => onEdit(entry)}
                    aria-label={t.nutrition.editEntry(entry.name)}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left active:bg-foreground/5 ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold">
                        {entry.name}
                      </span>
                      <PortionLine grams={entry.grams} macros={m} className="text-[12px]" />
                    </span>
                    <span className="tabular shrink-0 text-[14px] font-semibold">
                      {t.nutrition.kcal(m.calories)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-1 text-[14px] text-muted-foreground">{t.nutrition.nothingInMeal}</p>
          )}

          <div className="flex gap-2">
            {canAdd ? (
              <button
                onClick={onAdd}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground active:scale-[0.985]"
              >
                <Plus className="size-4" /> {t.mealOverview.add}
              </button>
            ) : null}
            {entries.length ? (
              <button
                onClick={onSaveAsMeal}
                className="glass flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold active:scale-[0.985]"
              >
                <BookmarkPlus className="size-4" /> {t.mealOverview.save}
              </button>
            ) : null}
          </div>

          {entries.some((e) => e.nevo?.length) ? (
            <p className="px-1 text-[11px] leading-snug text-muted-foreground">
              {t.nutrition.nevoReference}
            </p>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}

/**
 * A logged food's second line: its portion in grams as a small pill, so it
 * stands out from the protein/carbs/fat that follow it (the two used to
 * read as one run of numbers), then the macros. Used in the food log and
 * a meal's overview.
 */
export function PortionLine({
  grams,
  macros,
  className = "",
}: {
  grams: number;
  macros: Pick<Macros, "protein" | "carbs" | "fat">;
  className?: string;
}) {
  const t = useTranslation();
  return (
    <span className={`tabular mt-0.5 flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="shrink-0 rounded-md bg-foreground/10 px-1.5 py-px font-semibold text-foreground">
        {grams} g
      </span>
      <span className="truncate text-muted-foreground">
        {t.nutrition.entryMacros(
          Math.round(macros.protein),
          Math.round(macros.carbs),
          Math.round(macros.fat),
        )}
      </span>
    </span>
  );
}
