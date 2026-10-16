import { Check } from "lucide-react";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { barFill } from "./bar";
import { NutrientCell } from "./NutrientCell";

/** One nutrient for the panel. `part` is the "of which" share drawn inside
 *  its bar (sugars in carbs, saturated fat in fat). */
export type PanelItem = {
  label: string;
  value: string;
  amount: number;
  goal: number | undefined;
  part?: { label: string; value: string; amount: number; goal: number | undefined };
};

/** The day's macros, fiber and salt on the Today card and a meal's overview
 *  (Max picked this layout from three, 2026-10-16): protein on its own line
 *  at the top, bigger, with a solid accent bar, because it's the one to
 *  reach rather than stay under (asked for: protein should stand out more);
 *  then carbs and fat side by side, each one bar with its sugars or
 *  saturated fat inside and a line under it; then fiber and salt. */
export function NutrientPanel({
  carbs,
  fat,
  protein,
  fiber,
  salt,
  showLeft = true,
}: {
  /** "106 g to go": off in a meal's overview, where the goal is the day's. */
  showLeft?: boolean;
  carbs: PanelItem;
  fat: PanelItem;
  protein: PanelItem;
  fiber: PanelItem;
  salt: PanelItem;
}) {
  return (
    <div className="space-y-2.5">
      <Protein item={protein} showLeft={showLeft} />
      <div className="h-px bg-border" />
      <div className="grid grid-cols-2 gap-x-4">
        <NutrientCell partBelow {...carbs} />
        <NutrientCell partBelow {...fat} />
      </div>
      <div className="h-px bg-border" />
      <div className="grid grid-cols-2 gap-x-4">
        <NutrientCell compact {...fiber} />
        <NutrientCell compact {...salt} />
      </div>
    </div>
  );
}

/** Protein's full-width line: name and "74 / 180 g" larger, what's left to
 *  reach on the right, and a thicker bar in the solid accent. */
function Protein({ item, showLeft }: { item: PanelItem; showLeft: boolean }) {
  const t = useTranslation();
  const locale = useLocale();
  const { label, value, amount, goal } = item;
  const left = showLeft && goal != null ? Math.round(goal - amount) : null;
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-muted-foreground">{label}</p>
          <p className="tabular truncate leading-tight">
            <span className="text-[22px] font-bold">{value}</span>
            <span className="text-[13px] text-muted-foreground">
              {goal != null ? ` / ${goal}` : ""} g
            </span>
          </p>
        </div>
        {left != null ? (
          <p className="tabular flex shrink-0 items-center gap-1 pb-0.5 text-[13px] font-semibold text-muted-foreground">
            {left <= 0 ? (
              <>
                <Check className="size-3.5 text-primary-text" strokeWidth={3} />
                {t.nutrition.proteinReached}
              </>
            ) : (
              t.nutrition.proteinLeft(left.toLocaleString(locale))
            )}
          </p>
        ) : null}
      </div>
      {goal != null ? (
        <div className="mt-1.5 h-2.5 bar-track bg-muted">
          <div
            data-bar="protein"
            className="bar-grow bar-fill-x bg-primary"
            style={barFill((amount / goal) * 100)}
          />
        </div>
      ) : null}
    </div>
  );
}
