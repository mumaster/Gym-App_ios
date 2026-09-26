import { useMemo } from "react";
import { Activity } from "lucide-react";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { useGym } from "../../lib/gym/store";
import { LOAD_SPIKE_RATIO, loadRatio, weeklyLoads } from "../../lib/gym/trainingLoad";
import { Card } from "./Screen";

/** Weekly session-RPE load for the last 6 weeks, and this week against the
 *  4-week average once there's enough rated history. See trainingLoad.ts. */
export function TrainingLoadCard() {
  const { workouts } = useGym();
  const t = useTranslation();
  const locale = useLocale();
  const weeks = useMemo(() => weeklyLoads(workouts, 6), [workouts]);
  const ratio = useMemo(() => loadRatio(workouts), [workouts]);
  const rated = weeks.reduce((n, w) => n + w.rated, 0);
  const max = Math.max(1, ...weeks.map((w) => w.load));
  const current = weeks[weeks.length - 1]!;

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t.trainingLoad.thisWeek}
        </p>
        <p className="mt-0.5">
          <span className="tabular text-[24px] font-bold">
            {current.load.toLocaleString(locale)}
          </span>{" "}
          <span className="text-[13px] text-muted-foreground">{t.trainingLoad.units}</span>
        </p>
        {ratio ? (
          <p className="tabular text-[13px] text-muted-foreground">
            {t.trainingLoad.vsAverage(Math.round(ratio.ratio * 100))}
          </p>
        ) : null}
      </div>

      {rated ? (
        <div
          className="flex h-24 items-end gap-2"
          role="img"
          aria-label={t.trainingLoad.chartLabel}
        >
          {weeks.map((w, i) => {
            const last = i === weeks.length - 1;
            return (
              <div
                key={w.weekStart.toISOString()}
                className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
              >
                <div className="flex min-h-0 flex-1 items-end">
                  <div
                    className={`w-full rounded-t-md ${last ? "bg-primary" : "bg-muted-foreground/35"}`}
                    style={{ height: `${Math.max(w.load ? 4 : 0, (w.load / max) * 100)}%` }}
                    title={`${w.load}`}
                  />
                </div>
                <span className="text-center text-[10.5px] text-muted-foreground">
                  {w.weekStart.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t.trainingLoad.empty}</p>
      )}

      {ratio && ratio.ratio > LOAD_SPIKE_RATIO ? (
        <div className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2">
          <Activity className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-[12.5px] leading-snug">{t.trainingLoad.spike}</p>
        </div>
      ) : null}
      <p className="text-[11.5px] text-muted-foreground">{t.trainingLoad.source}</p>
    </Card>
  );
}
