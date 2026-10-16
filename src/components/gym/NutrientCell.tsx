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
 *  and fat bars, with its own "value / goal" under the bar. Shared by the day
 *  card and a meal's overview. */
export function NutrientCell({
  label,
  value,
  amount,
  goal,
  overIsAccent,
  part,
}: {
  label: string;
  value: string;
  amount: number;
  goal: number | undefined;
  /** Sugars: over the goal is the accent colour, not the red used for limits. */
  overIsAccent?: boolean;
  /** The "of which" part drawn inside this bar (sugars in carbs, saturated
   *  in fat). `value` is the text ("~29", or "–" when unknown). */
  part?: { label: string; value: string; amount: number; goal: number | undefined };
}) {
  const status = nutrientStatus(amount, goal);
  const over = status === "over";
  const partOver = part ? nutrientStatus(part.amount, part.goal) === "over" : false;
  // Over the goal the bar's scale grows with the total, so the part keeps
  // its share of what was eaten.
  const scale = goal != null ? Math.max(goal, amount) : 0;
  const fill = (n: number) => (scale > 0 ? (n / scale) * 100 : 0);
  return (
    <div className="min-w-0">
      <p className="truncate text-[12px] font-semibold text-muted-foreground">{label}</p>
      <p className="tabular truncate leading-tight">
        <span
          className={`text-[16px] font-bold ${
            over ? (overIsAccent ? "text-primary-text" : "text-destructive-text") : ""
          }`}
        >
          {value}
        </span>
        <span className="text-[12px] text-muted-foreground">
          {goal != null ? ` / ${goal}` : ""} g
        </span>
      </p>
      {goal != null ? (
        <div className={`mt-1 ${part ? "h-2" : "h-1.5"} bar-track bg-muted`}>
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
      {part ? (
        <p className="mt-1 flex min-w-0 items-center gap-1 leading-tight">
          <span aria-hidden className="size-2.5 shrink-0 rounded-sm bg-primary" />
          <span className="truncate text-[11px] font-semibold text-muted-foreground">
            {part.label}
          </span>
        </p>
      ) : null}
      {part ? (
        <p className="tabular truncate leading-tight">
          <span className={`text-[13px] font-bold ${partOver ? "text-primary-text" : ""}`}>
            {part.value}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {part.goal != null ? ` / ${part.goal}` : ""} g
          </span>
        </p>
      ) : null}
    </div>
  );
}
