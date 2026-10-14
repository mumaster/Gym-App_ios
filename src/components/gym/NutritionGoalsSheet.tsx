import { useEffect, useState } from "react";
import { Dumbbell, Moon, Sparkles } from "lucide-react";
import { SwitchRow } from "./SwitchRow";
import { InfoHeading } from "./InfoTip";
import { BottomSheet } from "./BottomSheet";
import { NutritionQuestionnaireSheet } from "./NutritionQuestionnaireSheet";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import {
  NUTRIENT_ORDER,
  NUTRIENT_UNITS,
  SUGAR_GOAL_SHARES,
  DEFAULT_WEEKEND_BUDGET,
  WEEKEND_SHARES,
  calorieFloor,
  weekendOffsets,
  sugarGoalGrams,
  deriveRestDayGoals,
  sessionEnergyKcal,
  trainingDayGoalsFromAverage,
  weeklyAverageCalories,
  type NutritionGoals,
  type WeekendBudget,
} from "../../lib/gym/nutrition";
import { useSessionEnergy, useSessionShape } from "../../lib/gym/dayNutrition";
import { plannedWeeklyCardioKcal } from "../../lib/gym/cardio";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";
import { chip } from "./ui";

type Draft = Record<keyof NutritionGoals, string>;

const emptyDraft = Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, ""])) as Draft;

const toDraft = (goals: NutritionGoals): Draft => ({
  ...emptyDraft,
  ...Object.fromEntries(
    NUTRIENT_ORDER.filter((k) => goals[k] != null).map((k) => [k, String(goals[k])]),
  ),
});

const fromDraft = (draft: Draft): NutritionGoals => {
  const goals: NutritionGoals = {};
  for (const key of NUTRIENT_ORDER) {
    const n = parseDecimal(draft[key]);
    if (draft[key].trim() !== "" && Number.isFinite(n) && n > 0) goals[key] = n;
  }
  return goals;
};

export function NutritionGoalsSheet({
  open,
  onClose,
  initialPage = "limits",
}: {
  open: boolean;
  onClose: () => void;
  /** Which sub tab opens first; the sheet always reopens on `initialPage`. */
  initialPage?: "limits" | "options";
}) {
  const {
    nutritionGoals,
    nutritionByDayType,
    nutritionProfile,
    restDayGoalOverrides,
    setNutritionGoals,
    sugarGoalShare,
    setSugarGoalShare,
    weekendBudget,
    update,
    plannedCardio: cardioPlan,
  } = useGym();
  const t = useTranslation();
  const locale = useLocale();
  const session = useSessionEnergy();
  const sessionShape = useSessionShape();
  const [draft, setDraft] = useState<Draft>(() => toDraft(nutritionGoals));
  const [restDraft, setRestDraft] = useState<Draft>(emptyDraft);
  const [byDayType, setByDayType] = useState(false);
  const [tab, setTab] = useState<"training" | "rest">("training");
  const [page, setPage] = useState<"limits" | "options">(initialPage);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  /** The optional sugar goal's share of calories; null is off. */
  const [sugarShare, setSugarShare] = useState<number | null>(sugarGoalShare);
  /** The weekend calorie budget; null is off. */
  const [weekend, setWeekend] = useState<WeekendBudget | null>(weekendBudget);

  useEffect(() => {
    if (!open) return;
    setDraft(toDraft(nutritionGoals));
    setRestDraft(toDraft(restDayGoalOverrides));
    setByDayType(nutritionByDayType);
    setSugarShare(sugarGoalShare);
    setWeekend(weekendBudget);
    setTab("training");
    setPage(initialPage);
  }, [
    open,
    initialPage,
    nutritionGoals,
    restDayGoalOverrides,
    nutritionByDayType,
    sugarGoalShare,
    weekendBudget,
  ]);

  // Done (and the backdrop) saves whatever's currently filled in — there's
  // no separate save step to remember, same as editing an existing food.
  const close = () => {
    haptic([20, 30]);
    setNutritionGoals(fromDraft(draft));
    setSugarGoalShare(sugarShare);
    update({
      nutritionByDayType: byDayType,
      restDayGoalOverrides: fromDraft(restDraft),
      weekendBudget: weekend,
    });
    onClose();
  };

  const clearAll = () => {
    haptic(15);
    if (tab === "rest") setRestDraft(emptyDraft);
    else setDraft(emptyDraft);
  };

  const calorieGoal = fromDraft(draft).calories ?? null;
  const showingRest = byDayType && tab === "rest";
  // What the budget does to a flat week of the calorie goal, for the preview.
  const weekendPreview =
    weekend && calorieGoal != null
      ? weekendOffsets(
          Array(7).fill(calorieGoal),
          Array(7).fill(false),
          weekend,
          calorieFloor(nutritionProfile?.sex),
        )
      : null;
  const weekendCapped =
    weekend && weekendPreview
      ? weekendPreview[5]! < Math.round(weekend.share * calorieGoal!) - 1
      : false;
  const derivedRest = deriveRestDayGoals(fromDraft(draft), session?.kcal ?? 0);
  const activeDraft = showingRest ? restDraft : draft;
  const setActiveDraft = showingRest ? setRestDraft : setDraft;
  // What the two day types average out to over the user's week, so a
  // training-day limit above the suggestion reads as intended, not a bug.
  const trainingDays = nutritionProfile?.sessionsPerWeek;
  const weekAverage =
    byDayType && session && trainingDays != null && trainingDays > 0 && trainingDays < 7
      ? weeklyAverageCalories(
          fromDraft(draft),
          fromDraft(restDraft),
          trainingDays,
          session.kcal,
          plannedWeeklyCardioKcal(cardioPlan, session.weightKg),
        )
      : null;

  return (
    <>
      {/* Hidden (not unmounted) while the questionnaire is up, mirroring
          CreateMealSheet/AddFoodSheet — two fixed inset-0 overlays stacked
          at once looks broken. */}
      <BottomSheet open={open && !questionnaireOpen} onClose={close} title={t.nutritionGoals.title}>
        <div className="space-y-4">
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {(["limits", "options"] as const).map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={page === id}
                onClick={() => {
                  haptic(10);
                  setPage(id);
                }}
                className={`flex min-h-[40px] items-center justify-center rounded-xl text-[13px] font-bold ${
                  page === id ? chip.on : "text-muted-foreground"
                }`}
              >
                {id === "limits" ? t.nutritionGoals.tabLimits : t.nutritionGoals.tabOptions}
              </button>
            ))}
          </div>

          {page === "limits" ? (
            <>
              <button
                onClick={() => {
                  haptic(15);
                  setQuestionnaireOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-left active:scale-[0.985]"
              >
                <Sparkles className="size-5 shrink-0 text-primary-text" />
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-primary-text">
                    {t.nutritionGoals.suggestMyLimits}
                  </span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {t.nutritionGoals.suggestMyLimitsDesc}
                  </span>
                </span>
              </button>

              {byDayType ? (
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
                  {(["training", "rest"] as const).map((id) => {
                    const Icon = id === "training" ? Dumbbell : Moon;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          haptic(10);
                          setTab(id);
                        }}
                        className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold ${
                          tab === id ? chip.on : "text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-4" />
                        {id === "training"
                          ? t.nutritionGoals.trainingDay
                          : t.nutritionGoals.restDay}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <InfoHeading
                title={t.nutritionGoals.tabLimits}
                ariaLabel={t.nutritionGoals.infoLimits}
              >
                <p>{t.nutritionGoals.desc}</p>
                {showingRest ? <p>{t.nutritionGoals.restHint}</p> : null}
                {byDayType && session ? <p>{t.nutritionGoals.cardioHint}</p> : null}
                {weekAverage != null && trainingDays != null ? (
                  <p>
                    {t.nutritionGoals.weeklyAverage(
                      weekAverage.toLocaleString(locale),
                      trainingDays,
                      cardioPlan.length,
                    )}
                  </p>
                ) : null}
              </InfoHeading>

              <div className="space-y-2">
                {NUTRIENT_ORDER.map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3"
                  >
                    <span className="w-20 shrink-0 text-[14px] font-semibold text-muted-foreground">
                      {t.nutrients[key]}
                    </span>
                    <input
                      inputMode="decimal"
                      type="text"
                      value={activeDraft[key]}
                      onFocus={selectOnFocus}
                      onChange={(e) => {
                        if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                        setActiveDraft((cur) => ({ ...cur, [key]: e.target.value }));
                      }}
                      placeholder={
                        showingRest && derivedRest[key] != null
                          ? String(derivedRest[key])
                          : t.nutritionGoals.noLimit
                      }
                      className="h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[16px] font-bold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
                    />
                    <span className="w-9 shrink-0 text-[12px] text-muted-foreground">
                      {NUTRIENT_UNITS[key]}
                    </span>
                  </label>
                ))}
              </div>

              <button
                onClick={clearAll}
                className="glass flex min-h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-semibold text-muted-foreground active:scale-95"
              >
                {t.nutritionGoals.clearAll}
              </button>
            </>
          ) : (
            <>
              <SwitchRow
                className="rounded-2xl bg-muted px-4 py-3"
                label={t.nutritionGoals.byDayType}
                info={
                  session
                    ? t.nutritionGoals.byDayTypeDesc(
                        session.kcal,
                        session.minutes,
                        session.met,
                        session.weightKg,
                      )
                    : t.nutritionGoals.byDayTypeNeedsWeight
                }
                infoLabel={t.nutritionGoals.infoDayTypes}
                ariaLabel={t.nutritionGoals.byDayType}
                on={byDayType}
                onToggle={() => {
                  haptic(12);
                  setByDayType((v) => !v);
                  setTab("training");
                }}
              />

              <div className="space-y-3 rounded-2xl bg-muted px-4 py-3">
                <SwitchRow
                  className=""
                  label={t.sugarsUi.goal}
                  info={
                    <>
                      <p>{t.sugarsUi.goalDesc}</p>
                      <p>{t.sugarsUi.caveat}</p>
                    </>
                  }
                  infoLabel={t.nutritionGoals.infoSugar}
                  ariaLabel={t.sugarsUi.goal}
                  on={sugarShare != null}
                  onToggle={() => {
                    haptic(12);
                    setSugarShare((v) => (v == null ? SUGAR_GOAL_SHARES[0] : null));
                  }}
                />
                {sugarShare != null ? (
                  <>
                    {calorieGoal == null ? (
                      <p className="text-[12.5px] text-muted-foreground">
                        {t.sugarsUi.goalNeedsCalories}
                      </p>
                    ) : null}
                    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-background/60 p-1">
                      {SUGAR_GOAL_SHARES.map((share) => (
                        <button
                          key={share}
                          role="radio"
                          aria-checked={sugarShare === share}
                          onClick={() => {
                            haptic(10);
                            setSugarShare(share);
                          }}
                          className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl px-1 text-center ${
                            sugarShare === share ? chip.on : "text-muted-foreground"
                          }`}
                        >
                          <span className="text-[14px] font-bold">
                            {share === SUGAR_GOAL_SHARES[0]
                              ? t.sugarsUi.share10
                              : t.sugarsUi.share5}
                          </span>
                          {calorieGoal != null ? (
                            <span className="tabular text-[12px]">
                              {t.sugarsUi.shareGrams(sugarGoalGrams(calorieGoal, share))}
                            </span>
                          ) : null}
                          {share === SUGAR_GOAL_SHARES[0] ? (
                            <span className="text-[11px] font-semibold opacity-80">
                              {t.sugarsUi.recommended}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="space-y-3 rounded-2xl bg-muted px-4 py-3">
                <SwitchRow
                  className=""
                  label={t.weekendUi.title}
                  info={
                    <>
                      <p>{t.weekendUi.desc}</p>
                      {weekend ? (
                        <p>
                          {weekend.from === "all"
                            ? t.weekendUi.fromAllDesc
                            : t.weekendUi.fromRestDesc}
                        </p>
                      ) : null}
                      <p>{t.weekendUi.note}</p>
                    </>
                  }
                  infoLabel={t.nutritionGoals.infoWeekend}
                  ariaLabel={t.weekendUi.title}
                  on={weekend != null}
                  onToggle={() => {
                    haptic(12);
                    setWeekend((v) => (v == null ? DEFAULT_WEEKEND_BUDGET : null));
                  }}
                />
                {weekend != null ? (
                  <>
                    {calorieGoal == null ? (
                      <p className="text-[12.5px] text-muted-foreground">
                        {t.weekendUi.needsCalories}
                      </p>
                    ) : null}
                    <p className="text-[13px] font-semibold text-muted-foreground">
                      {t.weekendUi.size}
                    </p>
                    <div
                      role="radiogroup"
                      aria-label={t.weekendUi.size}
                      className="grid grid-cols-4 gap-1 rounded-2xl bg-background/60 p-1"
                    >
                      {WEEKEND_SHARES.map((share) => (
                        <button
                          key={share}
                          role="radio"
                          aria-checked={weekend.share === share}
                          onClick={() => {
                            haptic(10);
                            setWeekend({ ...weekend, share });
                          }}
                          className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl text-center ${
                            weekend.share === share ? chip.on : "text-muted-foreground"
                          }`}
                        >
                          <span className="text-[14px] font-bold">
                            {t.weekendUi.pct(Math.round(share * 100))}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[13px] font-semibold text-muted-foreground">
                      {t.weekendUi.from}
                    </p>
                    <div
                      role="radiogroup"
                      aria-label={t.weekendUi.from}
                      className="grid grid-cols-2 gap-1 rounded-2xl bg-background/60 p-1"
                    >
                      {(["all", "rest"] as const).map((from) => (
                        <button
                          key={from}
                          role="radio"
                          aria-checked={weekend.from === from}
                          onClick={() => {
                            haptic(10);
                            setWeekend({ ...weekend, from });
                          }}
                          className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl px-1 text-center ${
                            weekend.from === from ? chip.on : "text-muted-foreground"
                          }`}
                        >
                          <span className="text-[14px] font-bold">
                            {from === "all" ? t.weekendUi.fromAll : t.weekendUi.fromRest}
                          </span>
                          {from === "all" ? (
                            <span className="text-[11px] font-semibold opacity-80">
                              {t.weekendUi.recommended}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                    {weekendPreview && calorieGoal != null ? (
                      <div className="tabular space-y-0.5 rounded-xl bg-background/60 px-3 py-2 text-[13px]">
                        <p className="font-semibold text-primary-text">
                          {t.weekendUi.previewWeekend(
                            (calorieGoal + weekendPreview[5]!).toLocaleString(locale),
                          )}
                        </p>
                        <p>
                          {t.weekendUi.previewFriday(
                            (calorieGoal + weekendPreview[4]!).toLocaleString(locale),
                          )}
                        </p>
                        {weekend.from === "all" ? (
                          <p>
                            {t.weekendUi.previewWeekdays(
                              (calorieGoal + weekendPreview[0]!).toLocaleString(locale),
                            )}
                          </p>
                        ) : null}
                        <p className="text-muted-foreground">
                          {t.weekendUi.previewAverage(calorieGoal.toLocaleString(locale))}
                        </p>
                      </div>
                    ) : null}
                    {weekendCapped ? (
                      <p className="text-[12px] leading-snug text-muted-foreground">
                        {t.weekendUi.capped}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      <NutritionQuestionnaireSheet
        open={questionnaireOpen}
        onClose={() => setQuestionnaireOpen(false)}
        onApply={(goals, profile) => {
          // With day-type limits on, the suggestion is an average day: raise
          // training days just enough that derived rest days keep the weekly
          // average on target, and let every rest field auto-derive again.
          const kcal = sessionEnergyKcal(profile.weightKg, sessionShape.minutes, sessionShape.met);
          const trainingDays = profile.sessionsPerWeek ?? 0;
          const cardioKcal = plannedWeeklyCardioKcal(cardioPlan, profile.weightKg);
          setDraft(
            toDraft(
              byDayType
                ? trainingDayGoalsFromAverage(goals, trainingDays, kcal, cardioKcal)
                : goals,
            ),
          );
          if (byDayType) setRestDraft(emptyDraft);
          setTab("training");
          setQuestionnaireOpen(false);
        }}
      />
    </>
  );
}
