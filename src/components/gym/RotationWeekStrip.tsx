import { Check } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";
import {
  doneDate,
  plannedDate,
  slotOffset,
  weekIndex,
  type Rotation,
} from "../../lib/gym/schedule";
import { splitDayLabel, type SplitTemplateId } from "../../lib/gym/splits";

/** One cell per session in the current cycle. Remaining sessions show the
 *  weekday they're actually planned on this cycle (so a shifted week reads
 *  truthfully). Finished ones are dimmed with a check and show the weekday
 *  they were actually done on; skipped ones are dimmed and struck through. */
export function RotationWeekStrip({
  rotation,
  templateId,
  onDay,
}: {
  rotation: Rotation;
  templateId: SplitTemplateId;
  /** Opens a day's workout (what was logged, or what's planned); returns
   *  null for a day there is nothing to open, which then isn't a button. */
  onDay?: ((index: number) => (() => void) | null) | undefined;
}) {
  const t = useTranslation();
  return (
    <div className="mt-3 flex justify-between gap-1">
      {rotation.schedule.map((slot, i) => {
        const done = i < rotation.cyclePosition;
        const doneOn = doneDate(rotation, i);
        const skipped = done && !doneOn;
        const isNext = i === rotation.cyclePosition;
        const moved =
          !rotation.flexible && !done && slotOffset(rotation, i) !== weekIndex(slot.dow);
        const dow = (doneOn ?? plannedDate(rotation, i)).getDay();
        const open = onDay?.(i) ?? null;
        const Cell = open ? "button" : "div";
        const label = splitDayLabel(templateId, slot.dayId);
        return (
          <Cell
            key={i}
            {...(open
              ? {
                  type: "button" as const,
                  onClick: open,
                  "aria-label": t.dayWorkout.openDay(label, t.common.dow[dow] ?? ""),
                }
              : {})}
            className={`min-w-0 flex-1 rounded-xl py-2 text-center ${
              isNext ? "bg-primary/10" : done ? "border border-border" : "bg-muted"
            } ${open ? "active:scale-95 transition-transform" : ""}`}
          >
            <p
              className={`flex items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isNext ? "text-primary-text" : "text-muted-foreground"
              }`}
            >
              {doneOn ? <Check className="size-2.5" strokeWidth={3} /> : null}
              {rotation.flexible ? t.common.dayShort(i + 1) : t.common.dow[dow]}
              {moved ? <span className="size-1 rounded-full bg-primary" aria-hidden /> : null}
            </p>
            <p
              className={`truncate px-0.5 text-[11px] font-semibold ${skipped ? "line-through" : ""}`}
            >
              {label}
            </p>
          </Cell>
        );
      })}
    </div>
  );
}
