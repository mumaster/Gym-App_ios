import { nutrientStatus } from "../../lib/gym/nutrition";
import { barFill } from "./bar";
import { NutrientCell, barClass } from "./NutrientCell";

/** One nutrient for the panel. `part` is the "of which" share drawn inside
 *  its bar (sugars in carbs, saturated fat in fat). */
export type PanelItem = {
  label: string;
  value: string;
  amount: number;
  goal: number | undefined;
  part?: { label: string; value: string; amount: number; goal: number | undefined };
};

export type PanelLayout = "rows" | "pairs" | "columns";

/** Which layout to draw; a trial switch while Max picks one (2026-10-16). */
export function panelLayout(): PanelLayout {
  try {
    const v = localStorage.getItem("forge.nutrientLayout");
    if (v === "rows" || v === "pairs" || v === "columns") return v;
  } catch {
    // storage blocked: fall through to the default
  }
  return "pairs";
}

const fillClass = (amount: number, goal: number | undefined) => {
  const status = nutrientStatus(amount, goal);
  return status === "ok" ? "intake-fill" : barClass(status);
};

/** The day's macros, fiber and salt on the Today card and a meal's overview. */
export function NutrientPanel({
  carbs,
  fat,
  protein,
  fiber,
  salt,
  layout,
}: {
  carbs: PanelItem;
  fat: PanelItem;
  protein: PanelItem;
  fiber: PanelItem;
  salt: PanelItem;
  layout: PanelLayout;
}) {
  if (layout === "rows") {
    return (
      <div className="space-y-2.5">
        {[protein, carbs, fat, fiber, salt].map((item) => (
          <Row key={item.label} item={item} />
        ))}
      </div>
    );
  }
  if (layout === "columns") {
    const items = [protein, carbs, fat, fiber, salt];
    const parts = [carbs.part, fat.part].filter((p) => p != null);
    return (
      <div>
        <ul className="grid grid-cols-5 gap-1">
          {items.map((item) => (
            <Column key={item.label} item={item} />
          ))}
        </ul>
        {parts.length ? (
          <ul className="mt-2.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px]">
            {parts.map((p) => (
              <li key={p.label} className="tabular flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm bg-primary" />
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-bold">{p.value}</span>
                <span className="text-muted-foreground">
                  {p.goal != null ? `/ ${p.goal} ` : ""}g
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
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

/** A full-width line: name, bar, "value / goal g"; a part adds a second,
 *  smaller line with its swatch under the name and its value under the total. */
function Row({ item }: { item: PanelItem }) {
  const { label, value, amount, goal, part } = item;
  const scale = goal != null ? Math.max(goal, amount) : 0;
  const pct = (n: number) => (scale > 0 ? (n / scale) * 100 : 0);
  const over = nutrientStatus(amount, goal) === "over";
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_5.25rem] items-center gap-x-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold">{label}</p>
        {part ? (
          <p className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
            <span aria-hidden className="size-2 shrink-0 rounded-sm bg-primary" />
            <span className="truncate">{part.label}</span>
          </p>
        ) : null}
      </div>
      {goal != null ? (
        <div className={`${part ? "h-2.5" : "h-2"} bar-track bg-muted`}>
          <div
            className={`bar-grow bar-fill-x ${fillClass(amount, goal)}`}
            style={barFill(pct(amount))}
          />
          {part && part.amount > 0 ? (
            <div
              className="bar-grow bar-fill-x bg-primary"
              style={barFill(pct(Math.min(part.amount, amount)))}
            />
          ) : null}
        </div>
      ) : (
        <span />
      )}
      <div className="tabular text-right leading-tight">
        <p>
          <span className={`text-[14px] font-bold ${over ? "text-destructive-text" : ""}`}>
            {value}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {goal != null ? ` / ${goal}` : ""} g
          </span>
        </p>
        {part ? (
          <p className="text-[11.5px] text-muted-foreground">
            <span className="font-bold text-foreground">{part.value}</span>
            {part.goal != null ? ` / ${part.goal}` : ""} g
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** A vertical bar like the weekly recap's: the grey track is the goal, the
 *  tint what was eaten, the accent the part inside it. */
function Column({ item }: { item: PanelItem }) {
  const { label, value, amount, goal, part } = item;
  const scale = goal != null ? Math.max(goal, amount) : Math.max(1, amount);
  const pct = (n: number) => (scale > 0 ? (n / scale) * 100 : 0);
  const over = nutrientStatus(amount, goal) === "over";
  return (
    <li className="flex min-w-0 flex-col items-center">
      <div className="h-20 w-5 bar-track bg-muted" aria-hidden>
        <span
          className={`bar-in bar-fill-y ${fillClass(amount, goal)}`}
          style={barFill(pct(amount))}
        />
        {part && part.amount > 0 ? (
          <span
            className="bar-in bar-fill-y bg-primary"
            style={barFill(pct(Math.min(part.amount, amount)))}
          />
        ) : null}
      </div>
      <p className="tabular mt-1.5 leading-tight">
        <span className={`text-[14px] font-bold ${over ? "text-destructive-text" : ""}`}>
          {value}
        </span>
      </p>
      <p className="tabular text-[11px] leading-tight text-muted-foreground">
        {goal != null ? `/ ${goal} g` : "g"}
      </p>
      <p className="w-full truncate text-center text-[10px] font-semibold tracking-tight text-muted-foreground">
        {label}
      </p>
    </li>
  );
}
