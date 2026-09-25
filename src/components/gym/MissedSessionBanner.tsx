import { CalendarClock } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";
import { overdueDays, plannedDate, type Rotation } from "../../lib/gym/schedule";
import { haptic, useGym, type RotationKind } from "../../lib/gym/store";

/** Shown inside a plan card when the next session's planned date has
 *  passed. "Do it today" moves it (and everything after it) to today;
 *  "Skip" moves on to the next session. Renders nothing when on track. */
export function MissedSessionBanner({
  kind,
  rotation,
  dayLabel,
  onDoToday,
}: {
  kind: RotationKind;
  rotation: Rotation;
  dayLabel: string;
  /** Runs after the shift, e.g. to load that day into the generator. */
  onDoToday?: () => void;
}) {
  const t = useTranslation();
  const { activeWorkout, shiftScheduledSessions, skipScheduledSession } = useGym();
  const overdue = overdueDays(rotation);
  if (!overdue || activeWorkout) return null;

  const weekday = t.common.dow[plannedDate(rotation, rotation.cyclePosition).getDay()]!;
  return (
    <div className="mt-3 rounded-2xl bg-primary/10 p-3">
      <p className="flex items-center gap-1.5 text-[14px] font-semibold">
        <CalendarClock className="size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          {overdue < 7
            ? t.schedule.missedTitle(dayLabel, weekday)
            : t.schedule.behindTitle(dayLabel, overdue)}
        </span>
      </p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{t.schedule.missedDesc}</p>
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => {
            haptic([15, 25]);
            shiftScheduledSessions(kind, overdue);
            onDoToday?.();
          }}
          className="min-h-[40px] flex-1 rounded-xl bg-primary text-[13px] font-bold text-primary-foreground active:scale-95"
        >
          {t.schedule.doItToday}
        </button>
        <button
          onClick={() => {
            haptic(15);
            skipScheduledSession(kind);
          }}
          className="min-h-[40px] flex-1 rounded-xl bg-secondary text-[13px] font-bold text-secondary-foreground active:scale-95"
        >
          {t.schedule.skip}
        </button>
      </div>
    </div>
  );
}
