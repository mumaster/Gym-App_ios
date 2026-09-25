import { useEffect, useState } from "react";
import { Dumbbell, Moon, Sparkles } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { NutritionQuestionnaireSheet } from "./NutritionQuestionnaireSheet";
import { useTranslation } from "../../lib/gym/i18n";
import {
  NUTRIENT_ORDER,
  NUTRIENT_UNITS,
  deriveRestDayGoals,
  sessionEnergyKcal,
  trainingDayGoalsFromAverage,
  type NutritionGoals,
} from "../../lib/gym/nutrition";
import { useSessionEnergy, useSessionShape } from "../../lib/gym/dayNutrition";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";

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

/** Training days a questionnaire suggestion is balanced around when the
 *  user has no weekly plan/program to count sessions from. */
const DEFAULT_TRAINING_DAYS = 4;

export function NutritionGoalsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    nutritionGoals,
    nutritionByDayType,
    restDayGoalOverrides,
    program,
    weeklyScheme,
    setNutritionGoals,
    update,
  } = useGym();
  const t = useTranslation();
  const session = useSessionEnergy();
  const sessionShape = useSessionShape();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [restDraft, setRestDraft] = useState<Draft>(emptyDraft);
  const [byDayType, setByDayType] = useState(false);
  const [tab, setTab] = useState<"training" | "rest">("training");
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(toDraft(nutritionGoals));
    setRestDraft(toDraft(restDayGoalOverrides));
    setByDayType(nutritionByDayType);
    setTab("training");
  }, [open, nutritionGoals, restDayGoalOverrides, nutritionByDayType]);

  // Done (and the backdrop) saves whatever's currently filled in — there's
  // no separate save step to remember, same as editing an existing food.
  const close = () => {
    haptic([20, 30]);
    setNutritionGoals(fromDraft(draft));
    update({ nutritionByDayType: byDayType, restDayGoalOverrides: fromDraft(restDraft) });
    onClose();
  };

  const clearAll = () => {
    haptic(15);
    if (tab === "rest") setRestDraft(emptyDraft);
    else setDraft(emptyDraft);
  };

  const showingRest = byDayType && tab === "rest";
  const derivedRest = deriveRestDayGoals(fromDraft(draft), session?.kcal ?? 0);
  const activeDraft = showingRest ? restDraft : draft;
  const setActiveDraft = showingRest ? setRestDraft : setDraft;

  return (
    <>
      {/* Hidden (not unmounted) while the questionnaire is up, mirroring
          CreateMealSheet/AddFoodSheet — two fixed inset-0 overlays stacked
          at once looks broken. */}
      <BottomSheet open={open && !questionnaireOpen} onClose={close} title={t.nutritionGoals.title}>
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">{t.nutritionGoals.desc}</p>

          <button
            onClick={() => {
              haptic(15);
              setQuestionnaireOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-left active:scale-[0.985]"
          >
            <Sparkles className="size-5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-primary">
                {t.nutritionGoals.suggestMyLimits}
              </span>
              <span className="block text-[12.5px] text-muted-foreground">
                {t.nutritionGoals.suggestMyLimitsDesc}
              </span>
            </span>
          </button>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">{t.nutritionGoals.byDayType}</p>
              <p className="text-[12.5px] text-muted-foreground">
                {session
                  ? t.nutritionGoals.byDayTypeDesc(
                      session.kcal,
                      session.minutes,
                      session.met,
                      session.weightKg,
                    )
                  : t.nutritionGoals.byDayTypeNeedsWeight}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={byDayType}
              aria-label={t.nutritionGoals.byDayType}
              onClick={() => {
                haptic(12);
                setByDayType((v) => !v);
                setTab("training");
              }}
              className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
                byDayType ? "bg-primary" : "bg-secondary"
              }`}
            >
              <span
                className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_1px_3px_oklch(0_0_0/35%)] transition-all ${
                  byDayType ? "left-[22px]" : "left-[2px]"
                }`}
              />
            </button>
          </div>

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
                      tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                    {id === "training" ? t.nutritionGoals.trainingDay : t.nutritionGoals.restDay}
                  </button>
                );
              })}
            </div>
          ) : null}

          {showingRest ? (
            <p className="text-[12.5px] text-muted-foreground">{t.nutritionGoals.restHint}</p>
          ) : null}
          {byDayType ? (
            <p className="text-[11.5px] text-muted-foreground">
              {t.nutritionGoals.byDayTypeSource}
            </p>
          ) : null}

          <div className="space-y-2">
            {NUTRIENT_ORDER.map((key) => (
              <label key={key} className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
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
        </div>
      </BottomSheet>

      <NutritionQuestionnaireSheet
        open={questionnaireOpen}
        onClose={() => setQuestionnaireOpen(false)}
        onApply={(goals, weightKg) => {
          // With day-type limits on, the suggestion is an average day: raise
          // training days just enough that derived rest days keep the weekly
          // average on target, and let every rest field auto-derive again.
          const trainingDays = (program ?? weeklyScheme)?.schedule.length ?? DEFAULT_TRAINING_DAYS;
          const kcal = sessionEnergyKcal(weightKg, sessionShape.minutes, sessionShape.met);
          setDraft(
            toDraft(byDayType ? trainingDayGoalsFromAverage(goals, trainingDays, kcal) : goals),
          );
          if (byDayType) setRestDraft(emptyDraft);
          setTab("training");
          setQuestionnaireOpen(false);
        }}
      />
    </>
  );
}
