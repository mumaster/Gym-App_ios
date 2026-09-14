import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import {
  NUTRIENT_LABELS,
  NUTRIENT_ORDER,
  NUTRIENT_UNITS,
  type NutritionGoals,
} from "../../lib/gym/nutrition";
import { haptic, useGym } from "../../lib/gym/store";

const emptyDraft = Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, ""])) as Record<
  keyof NutritionGoals,
  string
>;

export function NutritionGoalsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { nutritionGoals, setNutritionGoals } = useGym();
  const [draft, setDraft] = useState<Record<keyof NutritionGoals, string>>(emptyDraft);

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

  const save = () => {
    haptic([20, 30]);
    const goals: NutritionGoals = {};
    for (const key of NUTRIENT_ORDER) {
      const n = Number(draft[key]);
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
    <BottomSheet open={open} onClose={onClose} title="Daily nutrition limits">
      <div className="space-y-4">
        <p className="text-[13px] text-muted-foreground">
          Set a daily limit for whichever nutrients you want to keep an eye on. Leave the rest blank
          — the overview only tracks progress for the ones you set.
        </p>

        <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="size-3.5" /> Coming later
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            A future version will suggest these limits for you based on a few quick questions,
            instead of typing in raw numbers.
          </p>
        </div>

        <div className="space-y-2">
          {NUTRIENT_ORDER.map((key) => (
            <label key={key} className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
              <span className="w-20 shrink-0 text-[14px] font-semibold text-muted-foreground">
                {NUTRIENT_LABELS[key]}
              </span>
              <input
                inputMode="decimal"
                type="number"
                value={draft[key]}
                onChange={(e) => setDraft((cur) => ({ ...cur, [key]: e.target.value }))}
                placeholder="No limit"
                className="h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[16px] font-bold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
              />
              <span className="w-9 shrink-0 text-[12px] text-muted-foreground">
                {NUTRIENT_UNITS[key]}
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            className="flex min-h-[52px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95"
          >
            <Check className="size-5" /> Save limits
          </button>
          <button
            onClick={clearAll}
            className="glass flex min-h-[52px] flex-1 items-center justify-center rounded-2xl text-[15px] font-semibold text-muted-foreground active:scale-95"
          >
            Clear all
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
