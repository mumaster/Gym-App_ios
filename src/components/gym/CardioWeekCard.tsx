import { Check, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import {
  WHO_WEEKLY_MINUTES,
  cardioSessionsOn,
  remainingCardioOn,
  weekWhoMinutes,
} from "../../lib/gym/cardio";
import { addDays, dayKeyFromDate } from "../../lib/gym/date";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { daysBetween, mondayOf } from "../../lib/gym/schedule";
import { useGym } from "../../lib/gym/store";
import { CardioPlanSheet } from "./CardioPlanSheet";
import { CARDIO_ICONS } from "./cardioDisplay";
import { LogCardioSheet } from "./LogCardioSheet";
import { Card } from "./Screen";

/**
 * This week's cardio: moderate-equivalent minutes against the WHO minimum,
 * a Monday–Sunday strip (a filled mark for a day with cardio logged, a ring
 * for planned cardio still to do), and the Log / plan buttons. Shown on the
 * Workout tab and on History. `compact` (the Workout tab) leaves out the
 * explanation lines; History → Activity keeps them.
 */
export function CardioWeekCard({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const { cardioSessions, cardioPlan, hydrated } = useGym();
  const [logOpen, setLogOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const today = new Date();
  const monday = mondayOf(today);
  const minutes = hydrated ? weekWhoMinutes(cardioSessions, today) : 0;
  const pct = Math.min(1, minutes / WHO_WEEKLY_MINUTES);
  const todayPlan = hydrated ? remainingCardioOn(cardioPlan, cardioSessions, today, today) : [];
  const next = todayPlan[0] ?? null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const done = cardioSessionsOn(cardioSessions, dayKeyFromDate(date));
    const planned = remainingCardioOn(cardioPlan, cardioSessions, date, today);
    const activity = done[0]?.activity ?? planned[0]?.activity ?? null;
    return {
      date,
      isToday: daysBetween(today, date) === 0,
      state: done.length ? ("done" as const) : planned.length ? ("planned" as const) : null,
      activity,
    };
  });

  return (
    <>
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-widest text-primary-text">
              {t.cardio.thisWeek}
            </p>
            <p className="tabular mt-1 text-[18px] font-bold">
              {t.cardio.progress(minutes, WHO_WEEKLY_MINUTES)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            aria-label={cardioPlan.length ? t.cardio.editPlan : t.cardio.plan}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <Settings2 className="size-4" />
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct * 100}%` }} />
        </div>
        {compact ? null : (
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {minutes >= WHO_WEEKLY_MINUTES ? t.cardio.reached : t.cardio.explain}
          </p>
        )}

        <div className="mt-3 grid grid-cols-7">
          {days.map((d) => {
            const Icon = d.activity ? CARDIO_ICONS[d.activity] : null;
            const weekday = d.date.toLocaleDateString(locale, { weekday: "long" });
            return (
              <span
                key={d.date.toISOString()}
                role="img"
                aria-label={d.state ? `${weekday}: ${t.cardio.dayAria(d.state)}` : weekday}
                className={`flex flex-col items-center gap-1 rounded-xl py-1 ${
                  d.isToday ? "bg-foreground/[0.06]" : ""
                }`}
              >
                <span
                  className={`text-[10px] font-bold leading-none ${
                    d.isToday ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {(t.common.dow[d.date.getDay()] ?? "").charAt(0).toUpperCase()}
                </span>
                <span className="flex size-6 items-center justify-center">
                  {d.state === "done" ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      {Icon ? <Icon className="size-3.5" /> : <Check className="size-3.5" />}
                    </span>
                  ) : d.state === "planned" && Icon ? (
                    <span className="flex size-6 items-center justify-center rounded-full border-2 border-primary text-primary-text">
                      <Icon className="size-3" />
                    </span>
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                  )}
                </span>
              </span>
            );
          })}
        </div>

        {!compact && !cardioPlan.length && !cardioSessions.length ? (
          <p className="mt-3 text-[13px] text-muted-foreground">{t.cardio.noPlan}</p>
        ) : null}

        {next ? (
          <p className="mt-3 text-[13.5px] font-semibold">
            {t.cardio.plannedToday}:{" "}
            <span className="font-normal text-muted-foreground">
              {t.cardio.session(t.cardio.activities[next.activity], next.minutes)} ·{" "}
              {t.cardio.efforts[next.effort].toLowerCase()}
            </span>
          </p>
        ) : null}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-2xl text-[14px] font-bold active:scale-95 ${
              next ? "bg-primary text-primary-foreground" : "bg-muted text-secondary-foreground"
            }`}
          >
            <Plus className="size-4" /> {t.cardio.log}
          </button>
          {!cardioPlan.length ? (
            <button
              type="button"
              onClick={() => setPlanOpen(true)}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-muted text-[14px] font-bold text-secondary-foreground active:scale-95"
            >
              {t.cardio.plan}
            </button>
          ) : null}
        </div>
      </Card>
      <LogCardioSheet open={logOpen} onClose={() => setLogOpen(false)} preset={next} />
      <CardioPlanSheet open={planOpen} onClose={() => setPlanOpen(false)} />
    </>
  );
}
