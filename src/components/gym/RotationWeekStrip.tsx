import { Check } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";
import { plannedDate, slotOffset, weekIndex, type Rotation } from "../../lib/gym/schedule";
import { splitDayLabel, type SplitTemplateId } from "../../lib/gym/splits";

/** One cell per session in the current cycle. Remaining sessions show the
 *  weekday they're actually planned on this cycle (so a shifted week reads
 *  truthfully); finished/skipped ones are dimmed with a check. */
export function RotationWeekStrip({
  rotation,
  templateId,
}: {
  rotation: Rotation;
  templateId: SplitTemplateId;
}) {
  const t = useTranslation();
  return (
    <div className="mt-3 flex justify-between gap-1">
      {rotation.schedule.map((slot, i) => {
        const done = i < rotation.cyclePosition;
        const isNext = i === rotation.cyclePosition;
        const moved = !done && slotOffset(rotation, i) !== weekIndex(slot.dow);
        const dow = done ? slot.dow : plannedDate(rotation, i).getDay();
        return (
          <div
            key={i}
            className={`min-w-0 flex-1 rounded-xl py-2 text-center ${
              isNext ? "bg-primary/20" : "bg-muted"
            } ${done ? "opacity-50" : ""}`}
          >
            <p
              className={`flex items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isNext ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {done ? <Check className="size-2.5" strokeWidth={3} /> : null}
              {t.common.dow[dow]}
              {moved ? <span className="size-1 rounded-full bg-primary" aria-hidden /> : null}
            </p>
            <p className="truncate px-0.5 text-[11px] font-semibold">
              {splitDayLabel(templateId, slot.dayId)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
