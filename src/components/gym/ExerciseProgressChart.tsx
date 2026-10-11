import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { exerciseById } from "../../lib/gym/data";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { isBodyweightExercise, latestBodyKg } from "../../lib/gym/load";
import { exerciseTrend } from "../../lib/gym/progress";
import { useGym } from "../../lib/gym/store";

/** The card header's tint (see `intake-solid` in styles.css) as an opaque stroke. */
const ACTUAL_STROKE = "color-mix(in oklab, var(--primary) 42%, var(--card))";

/** One exercise's best set per session — an Epley 1RM estimate, or best
 *  reps for a bodyweight exercise with no bodyweight on file (see
 *  progress.ts's exerciseTrend). Used on History and in the exercise
 *  detail sheet. Renders nothing with fewer than two sessions. */
export function ExerciseProgressChart({
  exerciseId,
  height = 160,
}: {
  exerciseId: string;
  height?: number;
}) {
  const { workouts, weightLog, nutritionProfile } = useGym();
  const t = useTranslation();
  const locale = useLocale();
  const bodyKg = latestBodyKg(weightLog, nutritionProfile);
  const trend = useMemo(
    () =>
      exerciseTrend(exerciseId, workouts, isBodyweightExercise(exerciseById(exerciseId)), bodyKg),
    [exerciseId, workouts, bodyKg],
  );
  if (trend.points.length < 2) return null;
  const unit = trend.kind === "reps" ? "" : " kg";
  const data = trend.points.map((p) => ({
    label: new Date(p.date).toLocaleDateString(locale, { day: "numeric", month: "short" }),
    value: p.value,
    heaviest: p.heaviest,
  }));

  const showActual = trend.kind === "e1rm";
  return (
    <div>
      <p className="mb-2 text-[12px] text-muted-foreground">
        {trend.kind === "reps" ? t.history.bestReps : t.history.estimated1rm}
      </p>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="label" hide />
            <YAxis
              domain={
                trend.kind === "reps"
                  ? ["dataMin - 1", "dataMax + 1"]
                  : ["dataMin - 5", "dataMax + 5"]
              }
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              width={32}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value}${unit}`,
                name === "heaviest"
                  ? t.history.heaviestSet
                  : trend.kind === "reps"
                    ? t.history.bestReps
                    : t.history.est1rm,
              ]}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--foreground)",
              }}
            />
            {showActual ? (
              <Line
                type="monotone"
                dataKey="heaviest"
                stroke={ACTUAL_STROKE}
                strokeWidth={2.5}
                dot={{ r: 3, fill: ACTUAL_STROKE, stroke: ACTUAL_STROKE }}
                isAnimationActive={false}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--primary)" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {showActual ? (
        <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-primary" />
            {t.history.est1rm}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: ACTUAL_STROKE }} />
            {t.history.heaviestSet}
          </span>
        </div>
      ) : null}
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{data[0]!.label}</span>
        <span>{data[data.length - 1]!.label}</span>
      </div>
    </div>
  );
}
