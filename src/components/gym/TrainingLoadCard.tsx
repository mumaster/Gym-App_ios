import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays } from "../../lib/gym/date";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { mondayOf } from "../../lib/gym/schedule";
import { useGym } from "../../lib/gym/store";
import { LOAD_SPIKE_RATIO, dailyLoads, loadEntries, loadRatio } from "../../lib/gym/trainingLoad";
import { BarReadout, barColumn, usePickedBar } from "./BarReadout";
import { CardHead } from "./CardHead";
import { Card } from "./Screen";
import { SegmentedTabs } from "./SegmentedTabs";
import { button } from "./ui";

const PERIODS = ["week", "month"] as const;
type Period = (typeof PERIODS)[number];

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/** Session-RPE load for the picked week (a bar per day) or a calendar month,
 *  and, for a week with enough rated history, that week against the 4-week
 *  average. See trainingLoad.ts. */
export function TrainingLoadCard({ weekOf }: { weekOf?: Date | undefined }) {
  const { workouts, cardioSessions } = useGym();
  const t = useTranslation();
  const locale = useLocale();
  const entries = useMemo(() => loadEntries(workouts, cardioSessions), [workouts, cardioSessions]);
  const [period, setPeriod] = useState<Period>("week");

  const monday = mondayOf(weekOf ?? new Date());
  const weekKey = monday.getTime();
  const today = new Date();
  const thisMonth = firstOfMonth(today);
  // A month follows the picked week (the month its Thursday is in, as ISO
  // weeks do) until it is stepped on its own.
  const [monthDelta, setMonthDelta] = useState(0);
  useEffect(() => setMonthDelta(0), [weekKey]);
  const weekMonth = firstOfMonth(addDays(monday, 3));
  const month = new Date(weekMonth.getFullYear(), weekMonth.getMonth() + monthDelta, 1);
  const monthKey = month.getTime();
  const canNextMonth = month.getTime() < thisMonth.getTime();

  const days = useMemo(() => {
    if (period === "week") return dailyLoads(entries, monday, 7);
    const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return dailyLoads(entries, month, n);
  }, [entries, period, weekKey, monthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const ratio = useMemo(
    () =>
      period === "week"
        ? loadRatio(
            entries,
            monday < mondayOf(new Date())
              ? new Date(monday.getTime() + 7 * 86_400_000 - 1)
              : undefined,
          )
        : null,
    [entries, period, weekKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const total = days.reduce((n, d) => n + d.load, 0);
  const { picked, toggle, clear } = usePickedBar();
  // A different week, month or period is a different set of bars.
  useEffect(clear, [weekKey, monthKey, period]); // eslint-disable-line react-hooks/exhaustive-deps
  const sessions = days.reduce((n, d) => n + d.sessions, 0);
  const rated = days.reduce((n, d) => n + d.rated, 0);
  const max = Math.max(1, ...days.map((d) => d.load));
  const short = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  const label =
    period === "week"
      ? `${short(monday)} – ${short(addDays(monday, 6))}`
      : month.toLocaleDateString(locale, { month: "long", year: "numeric" });

  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={Activity}
        title={t.trainingLoad.title}
        subtitle={label}
        filled={rated > 0}
        actions={
          period === "month" ? (
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => setMonthDelta((d) => d - 1)}
                aria-label={t.trainingLoad.prevMonth}
                className={button.icon}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setMonthDelta((d) => d + 1)}
                disabled={!canNextMonth}
                aria-label={t.trainingLoad.nextMonth}
                className={`${button.icon} disabled:opacity-30`}
              >
                <ChevronRight aria-hidden className="size-4" />
              </button>
            </span>
          ) : undefined
        }
      />
      <div className="space-y-3">
        <SegmentedTabs
          tabs={PERIODS}
          value={period}
          onChange={setPeriod}
          labels={t.trainingLoad.periods}
        />
        <div>
          <p>
            <span className="tabular text-[26px] font-bold">{total.toLocaleString(locale)}</span>{" "}
            <span className="text-[13px] text-muted-foreground">{t.trainingLoad.units}</span>
          </p>
          <p className="tabular text-[13px] text-muted-foreground">
            {ratio && rated > 0
              ? t.trainingLoad.vsAverage(Math.round(ratio.ratio * 100))
              : t.trainingLoad.sessionsOf(sessions, rated)}
          </p>
        </div>

        {rated ? (
          <>
            <BarReadout
              text={
                picked != null && days[picked]
                  ? `${days[picked]!.date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} · ${days[picked]!.load.toLocaleString(locale)} ${t.trainingLoad.units}`
                  : null
              }
            />
            <div
              className={`flex h-24 items-end ${period === "week" ? "gap-2" : "gap-0.5"}`}
              role="group"
              aria-label={
                period === "week" ? t.trainingLoad.chartLabel : t.trainingLoad.chartLabelMonth
              }
            >
              {days.map((d, i) => {
                const label =
                  period === "week"
                    ? (t.common.dow[d.date.getDay()] ?? "").charAt(0).toUpperCase()
                    : i % 7 === 0
                      ? String(d.date.getDate())
                      : "";
                return (
                  <button
                    type="button"
                    key={d.date.toISOString()}
                    onClick={() => toggle(i)}
                    aria-pressed={picked === i}
                    aria-label={`${d.date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}: ${d.load} ${t.trainingLoad.units}`}
                    className={`${barColumn(picked === i)} flex h-full min-w-0 flex-1 flex-col justify-end gap-1`}
                  >
                    <div className="flex min-h-0 flex-1 items-end rounded-t-md bg-foreground/10">
                      <div
                        className="bar-in-y w-full rounded-t-md bg-primary"
                        style={{ height: `${d.load ? Math.max(6, (d.load / max) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="h-[14px] text-center text-[11px] leading-[14px] text-muted-foreground">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">{t.trainingLoad.empty}</p>
        )}

        {ratio && ratio.ratio > LOAD_SPIKE_RATIO ? (
          <div className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2">
            <Activity className="mt-0.5 size-4 shrink-0 text-primary-text" />
            <p className="text-[12.5px] leading-snug">{t.trainingLoad.spike}</p>
          </div>
        ) : null}
        <p className="text-[12px] text-muted-foreground">{t.trainingLoad.source}</p>
      </div>
    </Card>
  );
}
