import { useMemo } from "react";
import { Gauge } from "lucide-react";
import { CardHead } from "./CardHead";
import { Card } from "./Screen";
import { useInfoTip } from "./InfoTip";
import { barFill } from "./bar";
import { scoreWorkout, type MuscleStatus, type ScorePartId } from "../../lib/gym/diyWorkout";
import { useTranslation } from "../../lib/gym/i18n";
import type { PlannedExercise } from "../../lib/gym/types";

const STATUS_PILL: Record<MuscleStatus, string> = {
  low: "bg-muted text-muted-foreground",
  good: "bg-primary/10 text-primary-text",
  high: "bg-warning/10 text-warning-text",
};

/**
 * The DIY builder's summary: a 0-100 score for the workout, the five parts it
 * is made of with a plain line on what lost points, and how well each trained
 * muscle is covered. The bars are the app's shared bar style (DESIGN.md).
 */
export function WorkoutScoreCard({
  plan,
  minutes,
}: {
  plan: PlannedExercise[];
  /** Estimated session length (generator.estimateMinutes). */
  minutes: number;
}) {
  const t = useTranslation();
  const result = useMemo(() => scoreWorkout(plan, { minutes }), [plan, minutes]);
  const tip = useInfoTip(
    t.workoutScore.infoLabel,
    t.workoutScore.info.map((line) => <p key={line}>{line}</p>),
  );

  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={Gauge}
        title={t.workoutScore.title}
        filled={plan.length > 0}
        actions={tip.button}
      />
      {tip.panel ? <div className="mb-3">{tip.panel}</div> : null}
      <div className="flex items-baseline gap-2">
        <span className="tabular text-[30px] font-bold leading-none" data-score>
          {result.score}
        </span>
        <span className="text-[13px] text-muted-foreground">{t.workoutScore.outOf}</span>
        <span className="ml-auto text-[15px] font-semibold text-primary-text">
          {t.workoutScore.grades[result.grade]}
        </span>
      </div>

      <div className="mt-3 divide-y divide-border">
        {result.parts.map((part) => {
          const lost = part.points < part.max;
          const names = part.issues.join(", ");
          const line =
            !lost || plan.length === 0
              ? ""
              : part.id === "length"
                ? t.workoutScore.issues.length
                : part.issues.length
                  ? t.workoutScore.issues[part.id as Exclude<ScorePartId, "length">](names)
                  : "";
          return (
            <div key={part.id} className="py-2 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold">{t.workoutScore.parts[part.id]}</p>
                <p className="tabular text-[14px] font-semibold text-muted-foreground">
                  {t.workoutScore.points(Math.round(part.points), part.max)}
                </p>
              </div>
              {line ? <p className="text-[12.5px] text-muted-foreground">{line}</p> : null}
            </div>
          );
        })}
      </div>

      <p className="mb-2 mt-3 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
        {t.workoutScore.muscles}
      </p>
      {result.muscles.length ? (
        <div className="space-y-3">
          {result.muscles.map((m) => {
            const pct = m.weeklyTarget > 0 ? (m.sets / m.weeklyTarget) * 100 : 0;
            return (
              <div key={m.muscle}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[15px] font-semibold">{m.muscle}</p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${STATUS_PILL[m.status]}`}
                  >
                    {t.workoutScore.statusShort[m.status]}
                  </span>
                </div>
                <div className="my-1.5 h-2 bar-track bg-foreground/10">
                  <div
                    className={`bar-grow bar-fill-x ${m.status === "low" ? "bg-primary/60" : "bg-primary"}`}
                    style={barFill(pct)}
                  />
                </div>
                <p className="tabular text-[12.5px] text-muted-foreground">
                  {t.workoutScore.muscleLine(
                    m.sets,
                    m.weeklyTarget > 0 ? Math.round(pct) : 0,
                    m.weeklyTarget,
                  )}
                  {m.status === "high" ? ` · ${t.workoutScore.status.high}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t.workoutScore.musclesEmpty}</p>
      )}
    </Card>
  );
}
