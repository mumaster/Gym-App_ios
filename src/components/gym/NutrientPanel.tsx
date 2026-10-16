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
 *  (Max picked this layout from three, 2026-10-16): carbs and fat side by
 *  side, each one bar with its sugars or saturated fat inside and a line
 *  under it; then protein, fiber and salt in a row of three. Every cell is
 *  filled, no blank space. */
export function NutrientPanel({
  carbs,
  fat,
  protein,
  fiber,
  salt,
}: {
  carbs: PanelItem;
  fat: PanelItem;
  protein: PanelItem;
  fiber: PanelItem;
  salt: PanelItem;
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-x-4">
        <NutrientCell partBelow {...carbs} />
        <NutrientCell partBelow {...fat} />
      </div>
      <div className="h-px bg-border" />
      <div className="grid grid-cols-3 gap-x-3">
        <NutrientCell compact {...protein} />
        <NutrientCell compact {...fiber} />
        <NutrientCell compact {...salt} />
      </div>
    </div>
  );
}
