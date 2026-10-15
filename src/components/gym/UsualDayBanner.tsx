import { CalendarCheck } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";
import { firstUsualDay, type Rotation } from "../../lib/gym/schedule";
import { splitDayLabel } from "../../lib/gym/splits";
import { haptic, useGym, type RotationKind } from "../../lib/gym/store";

/** Inside a plan card: when a session keeps getting done on the same other
 *  weekday, offers to make that its standard day. Renders nothing otherwise. */
export function UsualDayBanner({ kind, rotation }: { kind: RotationKind; rotation: Rotation }) {
  const t = useTranslation();
  const { activeWorkout, updateProgramSlotDow, updateScheduleSlotDow, dismissUsualDay } = useGym();
  const found = firstUsualDay(rotation);
  if (!found || activeWorkout) return null;

  const templateId = (rotation as Rotation & { templateId: Parameters<typeof splitDayLabel>[0] })
    .templateId;
  const slot = rotation.schedule[found.index]!;
  const weekday = t.common.dow[found.dow]!;
  return (
    <div className="mt-3 rounded-2xl bg-primary/10 p-3">
      <p className="flex items-center gap-1.5 text-[14px] font-semibold">
        <CalendarCheck className="size-4 shrink-0 text-primary-text" />
        <span className="min-w-0">
          {t.schedule.usualDayTitle(splitDayLabel(templateId, slot.dayId), weekday)}
        </span>
      </p>
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => {
            haptic([15, 25]);
            (kind === "program" ? updateProgramSlotDow : updateScheduleSlotDow)(
              found.index,
              found.dow,
            );
          }}
          className="min-h-[44px] flex-1 rounded-xl bg-background text-[13px] font-bold text-primary-text ring-1 ring-inset ring-primary/50 active:scale-95"
        >
          {t.schedule.usualDayChange(weekday)}
        </button>
        <button
          onClick={() => {
            haptic(15);
            dismissUsualDay(kind, found.index);
          }}
          className="min-h-[44px] flex-1 rounded-xl bg-secondary text-[13px] font-bold text-secondary-foreground active:scale-95"
        >
          {t.schedule.usualDayNotNow}
        </button>
      </div>
    </div>
  );
}
