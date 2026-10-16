import { nutrientStatus, type NutrientStatus } from "../../lib/gym/nutrition";
import { barFill } from "./bar";

/** Colour for a limit's bar — over is red, within 15% of it amber. */
export const barClass = (status: NutrientStatus) =>
  status === "over" ? "bg-destructive" : status === "near" ? "bg-warning" : "bg-primary";

/** One nutrient of the day card: label, "value / goal g" and a bar, in the
 *  weekly recap's bar style (asked for, 2026-10-16): the goal is the grey
 *  track, the intake the card header's tint, amber near a limit and red over
 *  it. Carbs and fat carry their "of which" part (sugars, saturated fat) in
 *  the same bar, as a solid accent pill from the start, like the weekly carbs
 *  and fat bars; the part's name and "value / goal" sit on the right, across
 *  from the total, with a swatch in the accent. Those two take the wide left
 *  column of the card, protein, fiber and salt the narrow right one
 *  (`compact`). Shared by the day card and a meal's overview. */
export function NutrientCell({
  label,
  value,
  amount,
  goal,
  overIsAccent,
  compact,
  part,
  partBelow,
}: {
  label: string;
  value: string;
  amount: number;
  goal: number | undefined;
  /** Sugars: over the goal is the accent colour, not the red used for limits. */
  overIsAccent?: boolean;
  /** The narrow column (protein, fiber, salt): a step smaller. */
  compact?: boolean;
  /** The "of which" part drawn inside this bar (sugars in carbs, saturated
   *  in fat). `value` is the text ("~29", or "–" when unknown). */
  part?: { label: string; value: string; amount: number; goal: number | undefined };
  /** Put the part's line under the bar instead of across from the total
   *  (a half-width cell has no room beside it). */
  partBelow?: boolean;
}) {
  const status = nutrientStatus(amount, goal);
  const over = status === "over";
  const partOver = part ? nutrientStatus(part.amount, part.goal) === "over" : false;
  // Over the goal the bar's scale grows with the total, so the part keeps
  // its share of what was eaten.
  const scale = goal != null ? Math.max(goal, amount) : 0;
  const fill = (n: number) => (scale > 0 ? (n / scale) * 100 : 0);
  const total = (
    <div className="min-w-0">
      <p className="truncate text-[12px] font-semibold text-muted-foreground">{label}</p>
      <p className="tabular truncate leading-tight">
        <span
          className={`${compact ? "text-[15px]" : "text-[17px]"} font-bold ${
            over ? (overIsAccent ? "text-primary-text" : "text-destructive-text") : ""
          }`}
        >
          {value}
        </span>
        <span className="text-[12px] text-muted-foreground">
          {goal != null ? ` / ${goal}` : ""} g
        </span>
      </p>
    </div>
  );
  return (
    <div className="min-w-0">
      {part && !partBelow ? (
        <div className="flex items-end justify-between gap-2">
          {total}
          <div className="min-w-0 text-right">
            <p className="flex items-center justify-end gap-1 text-[12px] font-semibold text-muted-foreground">
              <span aria-hidden className="size-2.5 shrink-0 rounded-sm bg-primary" />
              <span className="truncate">{part.label}</span>
            </p>
            <p className="tabular truncate leading-tight">
              <span className={`text-[15px] font-bold ${partOver ? "text-primary-text" : ""}`}>
                {part.value}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {part.goal != null ? ` / ${part.goal}` : ""} g
              </span>
            </p>
          </div>
        </div>
      ) : (
        total
      )}
      {goal != null ? (
        <div className={`mt-1.5 ${part ? "h-2.5" : "h-1.5"} bar-track bg-muted`}>
          <div
            data-bar="total"
            className={`bar-grow bar-fill-x ${
              overIsAccent ? "bg-primary" : status === "ok" ? "intake-fill" : barClass(status)
            }`}
            style={barFill(fill(amount))}
          />
          {part && part.amount > 0 ? (
            <div
              data-bar="part"
              className="bar-grow bar-fill-x bg-primary"
              style={barFill(fill(Math.min(part.amount, amount)))}
            />
          ) : null}
        </div>
      ) : null}
      {part && partBelow ? (
        <p className="tabular mt-1.5 flex min-w-0 items-center gap-1.5 text-[12px] leading-tight">
          <span aria-hidden className="size-2.5 shrink-0 rounded-sm bg-primary" />
          <span className="truncate text-muted-foreground">{part.label}</span>
          <span className={`shrink-0 font-bold ${partOver ? "text-primary-text" : ""}`}>
            {part.value}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {part.goal != null ? `/ ${part.goal} ` : ""}g
          </span>
        </p>
      ) : null}
    </div>
  );
}
