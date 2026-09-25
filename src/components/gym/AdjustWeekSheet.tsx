import { CalendarPlus, RotateCcw, SkipForward } from "lucide-react";
import { dayKeyFromDate } from "../../lib/gym/date";
import { useTranslation } from "../../lib/gym/i18n";
import {
  allowedDatesFor,
  daysBetween,
  plannedDate,
  slotOffset,
  weekIndex,
} from "../../lib/gym/schedule";
import { splitDayLabel } from "../../lib/gym/splits";
import { haptic, useGym, type RotationKind } from "../../lib/gym/store";
import { BottomSheet } from "./BottomSheet";

/** This-cycle-only rescheduling for the active weekly plan or program:
 *  move any remaining session to another day (never past its neighbours),
 *  shift everything a day later, skip the next session, or reset. Changes
 *  are applied immediately, so Done just closes. */
export function AdjustWeekSheet({
  open,
  onClose,
  kind,
  onEditUsualDays,
}: {
  open: boolean;
  onClose: () => void;
  kind: RotationKind;
  onEditUsualDays: () => void;
}) {
  const t = useTranslation();
  const gym = useGym();
  const rotation = kind === "program" ? gym.program : gym.weeklyScheme;
  if (!rotation) return null;

  const today = new Date();
  const dateLabel = (d: Date) => {
    const diff = daysBetween(today, d);
    if (diff === 0) return t.schedule.today;
    if (diff === 1) return t.schedule.tomorrow;
    return `${t.common.dow[d.getDay()]} ${d.getDate()}`;
  };
  const remaining = rotation.schedule
    .map((slot, i) => ({ slot, i }))
    .filter(({ i }) => i >= rotation.cyclePosition);
  const hasOverrides = Object.keys(rotation.dayOverrides ?? {}).length > 0;
  const next = rotation.schedule[rotation.cyclePosition];

  return (
    <BottomSheet open={open} onClose={onClose} title={t.schedule.adjustWeek}>
      <div className="space-y-4">
        <p className="text-[13px] text-muted-foreground">{t.schedule.adjustDesc}</p>

        {remaining.length ? (
          <div className="space-y-2">
            {remaining.map(({ slot, i }) => {
              const planned = plannedDate(rotation, i);
              const moved = slotOffset(rotation, i) !== weekIndex(slot.dow);
              const options = allowedDatesFor(rotation, i, today);
              const label = splitDayLabel(rotation.templateId, slot.dayId);
              return (
                <div
                  key={i}
                  className={`glass rounded-2xl p-3 ${
                    i === rotation.cyclePosition ? "border border-primary/60" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold">{label}</span>
                    <span className="shrink-0 text-[13px] text-muted-foreground">
                      {dateLabel(planned)}
                      {moved ? (
                        <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                          {t.schedule.moved}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {options.length > 1 ? (
                    <div
                      className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto"
                      aria-label={t.schedule.moveTo}
                    >
                      {options.map((d) => {
                        const selected = daysBetween(planned, d) === 0;
                        return (
                          <button
                            key={dayKeyFromDate(d)}
                            onClick={() => {
                              if (selected) return;
                              haptic(10);
                              gym.moveScheduledSession(kind, i, dayKeyFromDate(d));
                            }}
                            className={`flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center rounded-xl px-2 text-[11px] font-bold ${
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground"
                            }`}
                          >
                            <span className="uppercase">{t.common.dow[d.getDay()]}</span>
                            <span className="text-[14px]">{d.getDate()}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[14px] text-muted-foreground">{t.schedule.noneLeft}</p>
        )}

        <div className="flex flex-col gap-2">
          {remaining.length ? (
            <button
              onClick={() => {
                haptic(15);
                gym.shiftScheduledSessions(kind, 1);
              }}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-secondary text-[14px] font-bold text-secondary-foreground active:scale-95"
            >
              <CalendarPlus className="size-4" /> {t.schedule.shiftAll}
            </button>
          ) : null}
          {next ? (
            <button
              onClick={() => {
                haptic(15);
                gym.skipScheduledSession(kind);
              }}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-secondary text-[14px] font-bold text-secondary-foreground active:scale-95"
            >
              <SkipForward className="size-4" />
              {t.schedule.skipNext(splitDayLabel(rotation.templateId, next.dayId))}
            </button>
          ) : null}
          {hasOverrides ? (
            <button
              onClick={() => {
                haptic(15);
                gym.resetScheduledWeek(kind);
              }}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-secondary text-[14px] font-bold text-secondary-foreground active:scale-95"
            >
              <RotateCcw className="size-4" /> {t.schedule.resetWeek}
            </button>
          ) : null}
          <button
            onClick={onEditUsualDays}
            className="min-h-[40px] text-[13px] font-semibold text-primary"
          >
            {t.schedule.editUsualDays}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
