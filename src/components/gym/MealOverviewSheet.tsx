import { BookmarkPlus, Check, CopyPlus, Plus, Share2 } from "lucide-react";
import { button } from "./ui";
import { BottomSheet } from "./BottomSheet";
import { drinkOf } from "../../lib/gym/alcohol";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import {
  dailyTotals,
  energySplit,
  scaledMacros,
  satFatComplete,
  sugarsComplete,
  type FoodEntry,
  type Macros,
  type MealType,
  type NutritionGoals,
} from "../../lib/gym/nutrition";
import { barFill } from "./bar";
import { useInfoTip } from "./InfoTip";
import { NutrientCell } from "./NutrientCell";

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
  onShare,
  onCopy,
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
  onShare: () => void;
  onCopy: () => void;
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
  const info = useInfoTip(
    t.mealOverview.moreInfo,
    <p className="tabular">
      {[
        dayKcal > 0 ? t.mealOverview.ofDay(Math.round((kcal / dayKcal) * 100)) : null,
        goals.calories ? t.mealOverview.ofLimit(Math.round((kcal / goals.calories) * 100)) : null,
        split
          ? `${t.mealOverview.split} ${t.nutrients.protein} ${split.protein}% · ${t.nutrients.carbs} ${split.carbs}% · ${t.nutrients.fat} ${split.fat}%`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    </p>,
    true,
  );

  return (
    <BottomSheet
      open={meal != null}
      onClose={onClose}
      title={meal ? t.mealOverview.title(t.mealTypes[meal], dayLabel) : ""}
    >
      {meal ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            {canAdd ? (
              <button
                onClick={onAdd}
                className={`${button.primary} w-0 min-w-0 flex-1 basis-0 whitespace-nowrap`}
              >
                <Plus className="size-4" /> {t.mealOverview.add}
              </button>
            ) : null}
            {entries.length ? (
              <button
                onClick={onCopy}
                aria-label={t.mealOverview.copyTo}
                className="glass flex min-h-[52px] w-0 min-w-0 flex-1 basis-0 items-center px-5 justify-center gap-1.5 whitespace-nowrap rounded-2xl text-[15px] font-semibold active:scale-[0.985]"
              >
                <CopyPlus className="size-4 shrink-0" /> {t.mealOverview.copyTo}
              </button>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="tabular min-w-0 leading-none">
                <span className="text-[30px] font-bold">{kcal.toLocaleString(locale)}</span>
                <span className="text-[15px] font-medium text-muted-foreground"> kcal</span>
              </p>
              {entries.length ? (
                <div className="flex shrink-0 items-center gap-2">
                  {info.button}
                  <button
                    onClick={onShare}
                    aria-label={t.mealShare.share}
                    className="tap-target flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-90"
                  >
                    <Share2 className="size-[18px]" />
                  </button>
                  <button
                    onClick={onSaveAsMeal}
                    aria-label={t.mealOverview.save}
                    className="tap-target flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-90"
                  >
                    <BookmarkPlus className="size-[18px]" />
                  </button>
                </div>
              ) : null}
            </div>
            {info.panel ? <div className="mt-1.5">{info.panel}</div> : null}
            {dayKcal > 0 ? (
              <div className="mt-2 h-2 bar-track bg-muted">
                <div
                  className="bar-grow bar-fill-x bg-primary"
                  style={barFill(Math.min(100, (kcal / dayKcal) * 100))}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2.5 rounded-2xl bg-foreground/[0.05] p-3">
            {/* Two columns (asked for, 2026-10-16): carbs and fat, each one bar with
                its sugars or saturated fat inside, stacked on the wide left; protein,
                fiber and salt stacked on the narrow right. */}
            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-x-4">
              <div className="flex flex-col justify-between gap-3">
                <NutrientCell
                  label={t.nutrients.carbs}
                  value={String(Math.round(totals.carbs))}
                  amount={totals.carbs}
                  goal={goals.carbs}
                  part={{
                    label: t.nutrients.sugars,
                    value:
                      totals.sugars == null
                        ? "–"
                        : `${sugarsComplete(entries) ? "" : "~"}${Number(totals.sugars.toFixed(0))}`,
                    amount: totals.sugars ?? 0,
                    goal: goals.sugars ?? undefined,
                  }}
                />
                <div aria-hidden className="h-px bg-border" />
                <NutrientCell
                  label={t.nutrients.fat}
                  value={Number(totals.fat.toFixed(0)).toLocaleString(locale)}
                  amount={totals.fat}
                  goal={goals.fat}
                  part={{
                    label: t.nutrients.satFatShort,
                    value:
                      totals.satFat == null
                        ? "–"
                        : `${satFatComplete(entries) ? "" : "~"}${Number(totals.satFat.toFixed(0))}`,
                    amount: totals.satFat ?? 0,
                    goal: goals.satFat ?? undefined,
                  }}
                />
              </div>
              <div className="flex flex-col gap-2 border-l border-border pl-4">
                <NutrientCell
                  compact
                  label={t.nutrients.protein}
                  value={String(Math.round(totals.protein))}
                  amount={totals.protein}
                  goal={goals.protein}
                />
                {(["fiber", "salt"] as const).map((key) => (
                  <NutrientCell
                    key={key}
                    compact
                    label={t.nutrients[key]}
                    value={Number(totals[key].toFixed(key === "salt" ? 1 : 0)).toLocaleString(
                      locale,
                    )}
                    amount={totals[key]}
                    goal={goals[key]}
                  />
                ))}
              </div>
            </div>
            {proteinTarget != null ? (
              <p className="tabular flex items-center gap-1.5 px-1 text-[12.5px]">
                {proteinOk ? (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-2.5" strokeWidth={3.5} />
                  </span>
                ) : null}
                {t.mealOverview.proteinMeal(protein, proteinTarget)}
              </p>
            ) : null}
          </div>
          {entries.length ? (
            <div>
              <div className="flex items-baseline justify-between px-1 pb-1.5">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.mealOverview.ingredients(entries.length)}
                </p>
                <p className="tabular text-[12px] text-muted-foreground">
                  {t.nutrition.kcal(totals.calories)}
                </p>
              </div>
              <div className="glass overflow-hidden rounded-2xl">
                {entries.map((entry, i) => {
                  const m = scaledMacros(entry);
                  return (
                    <button
                      key={entry.id}
                      onClick={() => onEdit(entry)}
                      aria-label={t.nutrition.editEntry(entry.name)}
                      className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left active:bg-foreground/5 ${i > 0 ? "border-t border-border" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold">
                          {entry.name}
                        </span>
                        <PortionLine
                          grams={entry.grams}
                          unit={drinkOf(entry) ? "ml" : "g"}
                          macros={m}
                          className="text-[12px]"
                        />
                      </span>
                      <span className="tabular shrink-0 text-[14px] font-semibold">
                        {t.nutrition.kcal(m.calories)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="px-1 text-[14px] text-muted-foreground">{t.nutrition.nothingInMeal}</p>
          )}

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
  unit = "g",
  macros,
  kcal,
  className = "",
}: {
  grams: number;
  /** Drinks are logged in ml (counted as g), everything else in g. */
  unit?: "g" | "ml";
  macros: Pick<Macros, "protein" | "carbs" | "fat">;
  /** Calories before the macros, for rows with no kcal column of their own
   *  (Add food's lists, where the right side holds the star and "+"). */
  kcal?: number;
  className?: string;
}) {
  const t = useTranslation();
  return (
    <span className={`tabular mt-0.5 flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="shrink-0 rounded-md bg-foreground/10 px-1.5 py-px font-semibold text-foreground">
        {grams} {unit}
      </span>
      <span className="truncate text-muted-foreground">
        {kcal != null ? `${t.nutrition.kcal(Math.round(kcal))} · ` : ""}
        {t.nutrition.entryMacros(
          Math.round(macros.protein),
          Math.round(macros.carbs),
          Math.round(macros.fat),
        )}
      </span>
    </span>
  );
}
