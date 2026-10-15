import { useMemo } from "react";
import { Gauge, Wrench } from "lucide-react";
import { CardHead } from "./CardHead";
import { Card } from "./Screen";
import { useInfoTip } from "./InfoTip";
import { barFill } from "./bar";
import { chip } from "./ui";
import { exerciseById } from "../../lib/gym/data";
import { planBlocks } from "../../lib/gym/planBlocks";
import {
  TIME_FIT_HIGH,
  TIME_FIT_LOW,
  fixOrder,
  fixedReps,
  fixedRest,
  generatedReference,
  scoreWorkout,
  updateExercise,
  type MuscleStatus,
  type ScorePartId,
} from "../../lib/gym/diyWorkout";
import { estimateMinutes } from "../../lib/gym/generator";
import { useTranslation } from "../../lib/gym/i18n";
import { latestBodyKg } from "../../lib/gym/load";
import { learnPace } from "../../lib/gym/pace";
import { haptic, useGym } from "../../lib/gym/store";
import { weeklySets } from "../../lib/gym/volume";
import type { PlannedExercise } from "../../lib/gym/types";

const STATUS_PILL: Record<MuscleStatus, string> = {
  low: "bg-muted text-muted-foreground",
  good: "bg-primary/10 text-primary-text",
  high: "bg-warning/10 text-warning-text",
  done: "bg-muted text-muted-foreground",
};

/** The score of a hand-built plan against the generator's workout for the
 *  same muscles, the planned length and this week's training, plus that
 *  generated workout's own score. Shared by the score card and the live
 *  score pill next to Add exercise. */
export function useWorkoutScore(plan: PlannedExercise[], minutes: number, targetMinutes: number) {
  const {
    growthFocus,
    workouts,
    profiles,
    activeProfileId,
    avoidedExerciseIds,
    warmupsEnabled,
    knownLifts,
    weightLog,
    nutritionProfile,
  } = useGym();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const pace = useMemo(() => learnPace(workouts), [workouts]);
  // What this Monday-Sunday week already did (finished workouts only).
  const weekDone = useMemo(() => weeklySets(workouts, null), [workouts]);
  // The generator's workout for the same muscles and length: the yardstick.
  const reference = useMemo(
    () =>
      generatedReference(plan, targetMinutes, {
        equipment: profile?.active_equipment_ids ?? [],
        avoided: avoidedExerciseIds,
        warmups: warmupsEnabled,
        focusMuscles: growthFocus,
        weekDone,
        history: workouts,
        knownLifts,
        ...(profile ? { profile } : {}),
        bodyKg: latestBodyKg(weightLog, nutritionProfile),
        pace,
      }),
    [
      plan,
      targetMinutes,
      profile,
      avoidedExerciseIds,
      warmupsEnabled,
      growthFocus,
      weekDone,
      workouts,
      knownLifts,
      weightLog,
      nutritionProfile,
      pace,
    ],
  );
  const refMinutes = useMemo(() => estimateMinutes(reference, pace), [reference, pace]);
  const result = useMemo(
    () =>
      scoreWorkout(plan, {
        minutes,
        targetMinutes,
        reference,
        referenceMinutes: refMinutes,
        focus: growthFocus,
        weekDone: weekDone as Record<string, number>,
      }),
    [plan, minutes, targetMinutes, reference, refMinutes, growthFocus, weekDone],
  );
  const refScore = useMemo(
    () =>
      reference.length
        ? scoreWorkout(reference, {
            minutes: refMinutes,
            targetMinutes,
            reference,
            referenceMinutes: refMinutes,
            focus: growthFocus,
            weekDone: weekDone as Record<string, number>,
          }).score
        : null,
    [reference, refMinutes, targetMinutes, growthFocus, weekDone],
  );
  return { result, refScore };
}

/**
 * The DIY builder's summary: a 0-100 score for the workout, the parts it is
 * made of with a plain line on what lost points (and a one-tap fix where
 * the fix is a setting of an exercise already in the plan), and how well
 * each trained muscle is covered this week. The bars are the app's shared
 * bar style (DESIGN.md).
 */
export function WorkoutScoreCard({
  plan,
  scored,
  targetMinutes,
  onChange,
}: {
  plan: PlannedExercise[];
  scored: ReturnType<typeof useWorkoutScore>;
  /** The length the user plans the workout for. */
  targetMinutes: number;
  /** Applies a fix the user tapped. Without it no fixes are offered. */
  onChange?: (plan: PlannedExercise[]) => void;
}) {
  const t = useTranslation();
  const { result, refScore } = scored;

  /** One chip per finding that has a fix in the plan's own settings: move
   *  an isolation exercise after its big lift, or set a rest or rep range
   *  that scores full. The user taps each; nothing changes on its own. */
  const fixesFor = (id: ScorePartId, items: number[]) => {
    if (!onChange || !items.length) return null;
    const seenBlocks = new Set<number>();
    const blocks = planBlocks(plan);
    const chips = items.flatMap((i) => {
      const p = plan[i];
      if (!p) return [];
      const name = exerciseById(p.exercise_id)?.name ?? p.exercise_id;
      if (id === "order") {
        return [
          { key: `o${i}`, label: t.workoutScore.fix.order(name), apply: () => fixOrder(plan, i) },
        ];
      }
      if (id === "reps") {
        const reps = fixedReps(plan, i);
        return [
          {
            key: `p${i}`,
            label: t.workoutScore.fix.reps(name, reps),
            apply: () => updateExercise(plan, i, { target_reps: reps }),
          },
        ];
      }
      if (id === "rest") {
        // A superset's round rest is one setting: one chip for the pair.
        const b = blocks.findIndex((bl) => bl.includes(i));
        if (seenBlocks.has(b)) return [];
        seenBlocks.add(b);
        const rest = fixedRest(plan, i);
        const label =
          blocks[b]!.length === 2
            ? t.workoutScore.fix.restSuperset(rest)
            : t.workoutScore.fix.rest(name, rest);
        return [
          { key: `r${i}`, label, apply: () => updateExercise(plan, i, { rest_seconds: rest }) },
        ];
      }
      return [];
    });
    if (!chips.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2" data-score-fixes>
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => {
              haptic(12);
              onChange(c.apply());
            }}
            className={`${chip.base} ${chip.on} h-auto min-h-9 max-w-full py-1.5 text-left`}
          >
            <Wrench className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0">{c.label}</span>
          </button>
        ))}
      </div>
    );
  };
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

      {refScore !== null && plan.length ? (
        <div className="mt-3 rounded-xl bg-foreground/5 px-3 py-2" data-score-compare>
          <p className="text-[13px] font-semibold">
            {t.workoutScore.compare(targetMinutes, refScore)}
          </p>
          <p className="tabular text-[12.5px] text-muted-foreground">
            {t.workoutScore.compareSets(result.usefulSets, result.referenceSets ?? 0)}
          </p>
          {/* Only when it changes what counts as full (the time part's own band). */}
          {result.referenceMinutes !== null &&
          result.referenceMinutes < targetMinutes * TIME_FIT_LOW ? (
            <p className="text-[12.5px] text-muted-foreground">
              {t.workoutScore.compareShort(result.referenceMinutes, targetMinutes)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 divide-y divide-border">
        {result.parts.map((part) => {
          const lost = part.points < part.max;
          const names = part.issues.join(", ");
          const fewerSets = (result.referenceSets ?? 0) > result.usefulSets;
          const timeOff =
            result.minutes < targetMinutes * TIME_FIT_LOW ||
            result.minutes > targetMinutes * TIME_FIT_HIGH;
          const line =
            !lost || plan.length === 0
              ? ""
              : part.id === "volume" && fewerSets
                ? t.workoutScore.issues.volume(result.usefulSets, result.referenceSets ?? 0)
                : part.id === "time" && timeOff
                  ? t.workoutScore.issues.time(result.minutes, targetMinutes)
                  : part.issues.length
                    ? t.workoutScore.issues[part.id as Exclude<ScorePartId, "volume" | "time">](
                        names,
                      )
                    : t.workoutScore.issues.fill;
          return (
            <div key={part.id} className="py-2 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold">{t.workoutScore.parts[part.id]}</p>
                <p className="tabular text-[14px] font-semibold text-muted-foreground">
                  {t.workoutScore.points(Math.round(part.points), part.max)}
                </p>
              </div>
              {line ? <p className="text-[12.5px] text-muted-foreground">{line}</p> : null}
              {onChange && lost ? fixesFor(part.id, part.items) : null}
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
            // The week so far plus this workout, against the weekly target.
            const pct = m.weeklyTarget > 0 ? ((m.weekDone + m.sets) / m.weeklyTarget) * 100 : 0;
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
                    className={`bar-grow bar-fill-x ${m.status === "low" || m.status === "done" ? "bg-primary/60" : "bg-primary"}`}
                    style={barFill(pct)}
                  />
                </div>
                <p className="tabular text-[12.5px] text-muted-foreground">
                  {t.workoutScore.muscleLine(
                    m.sets,
                    m.weekDone,
                    m.weeklyTarget > 0 ? Math.round(pct) : 0,
                    m.weeklyTarget,
                  )}
                  {m.status === "high" || m.status === "done"
                    ? ` · ${t.workoutScore.status[m.status]}`
                    : ""}
                  {m.referenceSets !== undefined
                    ? ` · ${t.workoutScore.generatedSets(m.referenceSets)}`
                    : ""}
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
