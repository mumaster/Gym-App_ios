import { CalendarPlus, RotateCcw, SkipForward } from "lucide-react";
import { dayKeyFromDate } from "../../lib/gym/date";
import { useTranslation } from "../../lib/gym/i18n";
import {
  allowedDatesFor,
  cycleEnding,
  daysBetween,
  plannedDate,
  skipRestOfCycle,
  slotOffset,
  weekIndex,
  type Rotation,
} from "../../lib/gym/schedule";
import { splitDayLabel } from "../../lib/gym/splits";
import { haptic, useGym, type RotationKind } from "../../lib/gym/store";
import { BottomSheet } from "./BottomSheet";
import { chip } from "./ui";

/** This-cycle-only rescheduling for the active weekly plan or program:
 *  move any remaining session to another day (never past its neighbours),
 *  shift everything a day later, skip the next session, or reset. Once this
 *  week's last session is today or missed, next week's sessions are listed
 *  too: picking a day for one skips what's left of this week (asked for: on
 *  a Sunday with Friday's lower body missed, Monday could only go to that
 *  lower body, not to next week's upper body). Changes are applied
 *  immediately, so Done just closes. */
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
  // Next week, as it would be with this week's leftovers skipped.
  const nextWeek =
    remaining.length && cycleEnding(rotation, today) ? skipRestOfCycle(rotation, today) : null;
  const leftover = remaining
    .map(({ slot }) => splitDayLabel(rotation.templateId, slot.dayId))
    .join(", ");

  return (
    <BottomSheet open={open} onClose={onClose} title={t.schedule.adjustWeek}>
      <div className="space-y-4">
        <p className="text-[13px] text-muted-foreground">{t.schedule.adjustDesc}</p>

        {remaining.length ? (
          <div className="space-y-2">
            {remaining.map(({ slot, i }) => (
              <SessionCard
                key={i}
                rotation={rotation}
                index={i}
                label={splitDayLabel(rotation.templateId, slot.dayId)}
                highlight={i === rotation.cyclePosition}
                moved={slotOffset(rotation, i) !== weekIndex(slot.dow)}
                dateLabel={dateLabel}
                today={today}
                onPick={(d) => gym.moveScheduledSession(kind, i, dayKeyFromDate(d))}
              />
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-muted-foreground">{t.schedule.noneLeft}</p>
        )}

        {nextWeek ? (
          <div className="space-y-2">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                {t.schedule.nextWeek}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {t.schedule.nextWeekNote(leftover)}
              </p>
            </div>
            {nextWeek.schedule.map((slot, i) => (
              <SessionCard
                key={`next-${i}`}
                rotation={nextWeek}
                index={i}
                label={splitDayLabel(rotation.templateId, slot.dayId)}
                highlight={false}
                moved={false}
                preview
                dateLabel={dateLabel}
                today={today}
                onPick={(d) => gym.moveNextWeekSession(kind, i, dayKeyFromDate(d))}
              />
            ))}
          </div>
        ) : null}

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
            className="min-h-[40px] text-[13px] font-semibold text-primary-text"
          >
            {t.schedule.editUsualDays}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

/** One session with the days it can move to. In the next-week list
 *  (`preview`) no day is marked as picked, since picking any of them, the
 *  planned one included, is what skips this week's leftovers. */
function SessionCard({
  rotation,
  index,
  label,
  highlight,
  moved,
  preview = false,
  dateLabel,
  today,
  onPick,
}: {
  rotation: Rotation;
  index: number;
  label: string;
  highlight: boolean;
  moved: boolean;
  preview?: boolean;
  dateLabel: (d: Date) => string;
  today: Date;
  onPick: (d: Date) => void;
}) {
  const t = useTranslation();
  const planned = plannedDate(rotation, index);
  const options = allowedDatesFor(rotation, index, today);
  const showChips = preview ? options.length > 0 : options.length > 1;
  return (
    <div className={`glass rounded-2xl p-3 ${highlight ? "border border-primary/60" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[15px] font-semibold">{label}</span>
        <span className="shrink-0 text-[13px] text-muted-foreground">
          {dateLabel(planned)}
          {moved ? (
            <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold text-primary-text">
              {t.schedule.moved}
            </span>
          ) : null}
        </span>
      </div>
      {showChips ? (
        <div
          className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto"
          aria-label={t.schedule.moveTo}
        >
          {options.map((d) => {
            const selected = !preview && daysBetween(planned, d) === 0;
            return (
              <button
                key={dayKeyFromDate(d)}
                aria-pressed={selected}
                onClick={() => {
                  if (selected) return;
                  haptic(10);
                  onPick(d);
                }}
                className={`flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center rounded-xl px-2 text-[11px] font-bold ${
                  selected ? chip.on : "bg-secondary text-secondary-foreground"
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
}
