import { useMemo, useState } from "react";
import { Scale, X } from "lucide-react";
import {
  calorieAdjustment,
  targetKgPerWeek,
  weightTrend,
  MIN_TREND_DAYS,
  MIN_TREND_ENTRIES,
} from "../../lib/gym/bodyweight";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";
import { Card } from "./Screen";
import { HapticSwitch } from "./HapticSwitch";
import { WeightChart } from "./WeightChart";

const fmt = (n: number, digits: number, locale: string) =>
  n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Weigh-ins, the fitted trend, and — once there's enough data and a goal —
 *  a calorie change that would bring the real rate onto the target. The
 *  change is only a suggestion: nothing is applied without a tap. */
export function BodyweightCard() {
  const t = useTranslation();
  const locale = useLocale();
  const {
    weightLog,
    logWeight,
    removeWeightEntry,
    nutritionProfile,
    nutritionGoals,
    setNutritionGoals,
  } = useGym();
  const [draft, setDraft] = useState("");
  const latest = weightLog.at(-1);
  const trend = useMemo(() => weightTrend(weightLog), [weightLog]);

  const target =
    trend && nutritionProfile ? targetKgPerWeek(nutritionProfile, trend.latestKg) : null;
  const adjustment = trend && target !== null ? calorieAdjustment(trend, target) : null;
  const calories = nutritionGoals.calories;

  const submit = () => {
    const kg = parseDecimal(draft === "" && latest ? String(latest.kg) : draft);
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) return;
    haptic([15, 25]);
    logWeight(Math.round(kg * 10) / 10);
    setDraft("");
  };

  const apply = () => {
    if (adjustment == null || calories == null) return;
    haptic([20, 30]);
    setNutritionGoals({
      ...nutritionGoals,
      calories: calories + adjustment,
      ...(nutritionGoals.carbs != null
        ? { carbs: Math.max(0, Math.round(nutritionGoals.carbs + adjustment / 4)) }
        : {}),
    });
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-muted px-3">
          <Scale className="size-4 shrink-0 text-primary" />
          <input
            inputMode="decimal"
            type="text"
            value={draft}
            onFocus={selectOnFocus}
            onChange={(e) => DECIMAL_INPUT_RE.test(e.target.value) && setDraft(e.target.value)}
            placeholder={latest ? fmt(latest.kg, 1, locale) : "75"}
            aria-label={t.bodyweight.inputLabel}
            className="min-w-0 flex-1 bg-transparent text-[16px] font-bold outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
          <span className="text-[12px] text-muted-foreground">kg</span>
        </label>
        <button
          onClick={submit}
          className="relative min-h-[44px] shrink-0 rounded-xl bg-primary px-4 text-[14px] font-bold text-primary-foreground active:scale-95"
        >
          <HapticSwitch />
          {t.bodyweight.log}
        </button>
      </div>

      {trend ? (
        <p className="text-[14px]">
          <span className="font-semibold">{t.bodyweight.trend}</span>{" "}
          {t.bodyweight.perWeek(
            `${trend.kgPerWeek > 0 ? "+" : ""}${fmt(trend.kgPerWeek, 2, locale)}`,
            `${trend.pctPerWeek > 0 ? "+" : ""}${fmt(trend.pctPerWeek * 100, 2, locale)}`,
          )}
        </p>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          {t.bodyweight.needMore(MIN_TREND_ENTRIES, MIN_TREND_DAYS, weightLog.length)}
        </p>
      )}

      <WeightChart entries={weightLog} trend={trend} />

      {trend && target !== null && adjustment !== null && calories != null ? (
        <div className="rounded-2xl bg-primary/10 p-3">
          <p className="text-[13px]">
            {t.bodyweight.target(`${target > 0 ? "+" : ""}${fmt(target, 2, locale)}`)}{" "}
            {adjustment === 0
              ? t.bodyweight.onTrack
              : t.bodyweight.suggest(
                  (calories + adjustment).toLocaleString(locale),
                  `${adjustment > 0 ? "+" : ""}${adjustment}`,
                )}
          </p>
          {adjustment !== 0 ? (
            <button
              onClick={apply}
              className="mt-2 min-h-[40px] w-full rounded-xl bg-primary text-[13px] font-bold text-primary-foreground active:scale-95"
            >
              {t.bodyweight.apply}
            </button>
          ) : null}
        </div>
      ) : trend && !nutritionProfile ? (
        <p className="text-[12.5px] text-muted-foreground">{t.bodyweight.needProfile}</p>
      ) : null}

      {weightLog.length ? (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {[...weightLog]
            .reverse()
            .slice(0, 8)
            .map((e) => (
              <span
                key={e.id}
                className="flex shrink-0 items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-[12px] font-semibold text-secondary-foreground"
              >
                {new Date(e.date).toLocaleDateString(locale, { day: "numeric", month: "short" })} ·{" "}
                {fmt(e.kg, 1, locale)}
                <button
                  onClick={() => {
                    haptic(10);
                    removeWeightEntry(e.id);
                  }}
                  aria-label={t.bodyweight.remove}
                  className="flex size-6 items-center justify-center rounded-full active:scale-90"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
        </div>
      ) : null}
      <p className="text-[11.5px] text-muted-foreground">{t.bodyweight.source}</p>
    </Card>
  );
}
