import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { NutritionQuestionnaireSheet } from "./NutritionQuestionnaireSheet";
import { useTranslation } from "../../lib/gym/i18n";
import { NUTRIENT_ORDER, NUTRIENT_UNITS, type NutritionGoals } from "../../lib/gym/nutrition";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";

const emptyDraft = Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, ""])) as Record<
  keyof NutritionGoals,
  string
>;

export function NutritionGoalsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { nutritionGoals, setNutritionGoals } = useGym();
  const t = useTranslation();
  const [draft, setDraft] = useState<Record<keyof NutritionGoals, string>>(emptyDraft);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft({
      ...emptyDraft,
      ...Object.fromEntries(
        NUTRIENT_ORDER.filter((k) => nutritionGoals[k] != null).map((k) => [
          k,
          String(nutritionGoals[k]),
        ]),
      ),
    });
  }, [open, nutritionGoals]);

  // Done (and the backdrop) saves whatever's currently filled in — there's
  // no separate save step to remember, same as editing an existing food.
  const close = () => {
    haptic([20, 30]);
    const goals: NutritionGoals = {};
    for (const key of NUTRIENT_ORDER) {
      const n = parseDecimal(draft[key]);
      if (draft[key].trim() !== "" && Number.isFinite(n) && n > 0) goals[key] = n;
    }
    setNutritionGoals(goals);
    onClose();
  };

  const clearAll = () => {
    haptic(15);
    setDraft(emptyDraft);
  };

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

          <div className="space-y-2">
            {NUTRIENT_ORDER.map((key) => (
              <label key={key} className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
                <span className="w-20 shrink-0 text-[14px] font-semibold text-muted-foreground">
                  {t.nutrients[key]}
                </span>
                <input
                  inputMode="decimal"
                  type="text"
                  value={draft[key]}
                  onFocus={selectOnFocus}
                  onChange={(e) => {
                    if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                    setDraft((cur) => ({ ...cur, [key]: e.target.value }));
                  }}
                  placeholder={t.nutritionGoals.noLimit}
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
        onApply={(goals) => {
          setDraft({
            ...emptyDraft,
            ...Object.fromEntries(
              NUTRIENT_ORDER.filter((k) => goals[k] != null).map((k) => [k, String(goals[k])]),
            ),
          });
          setQuestionnaireOpen(false);
        }}
      />
    </>
  );
}
