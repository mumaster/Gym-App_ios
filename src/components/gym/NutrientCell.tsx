import { nutrientStatus, type NutrientStatus } from "../../lib/gym/nutrition";
import { barFill } from "./bar";

/** Colour for a limit's bar — over is red, within 15% of it amber. */
export const barClass = (status: NutrientStatus) =>
  status === "over" ? "bg-destructive" : status === "near" ? "bg-warning" : "bg-primary";

/** One nutrient of the day card: label, "value / goal g" and a bar. Every
 *  cell of the two rows (protein, carbs, sugars; fat, fiber, salt) looks the
 *  same so the columns stay even (asked for, 2026-10-14). Shared by the day card and a meal's overview. */
export function NutrientCell({
  label,
  value,
  amount,
  goal,
  overIsAccent,
}: {
  label: string;
  value: string;
  amount: number;
  goal: number | undefined;
  /** Sugars: over the goal is the accent colour, not the red used for limits. */
  overIsAccent?: boolean;
}) {
  const status = nutrientStatus(amount, goal);
  const over = status === "over";
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
        <div className="mt-1 h-1.5 bar-track bg-muted">
          <div
            className={`bar-grow bar-fill-x ${overIsAccent ? "bg-primary" : barClass(status)}`}
            style={barFill((amount / goal) * 100)}
          />
        </div>
      ) : null}
    </div>
  );
}
