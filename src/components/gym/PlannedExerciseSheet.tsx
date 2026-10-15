import { Minus, Plus } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { exerciseById } from "../../lib/gym/data";
import { parseReps, updateExercise } from "../../lib/gym/diyWorkout";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic } from "../../lib/gym/store";
import type { PlannedExercise } from "../../lib/gym/types";

const MAX_SETS = 10;
const MAX_REPS = 50;
const MAX_REST = 300;
const REST_STEP = 15;
const MAX_WARMUPS = 3;

/** One labelled stepper: a minus, the value and a plus, each 44 pt. */
function Stepper({
  label,
  value,
  display,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  /** What to show in place of the bare number ("90s"). */
  display?: string;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const t = useTranslation();
  const go = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next === value) return;
    haptic(10);
    onChange(next);
  };
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 first:border-t-0">
      <p className="min-w-0 flex-1 text-[15px] font-semibold">{label}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => go(-step)}
          disabled={value <= min}
          aria-label={`${t.diy.less(label.toLowerCase())}`}
          className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-90 disabled:opacity-30"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="tabular w-14 text-center text-[17px] font-bold" aria-live="polite">
          {display ?? value}
        </span>
        <button
          type="button"
          onClick={() => go(step)}
          disabled={value >= max}
          aria-label={`${t.diy.more(label.toLowerCase())}`}
          className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-90 disabled:opacity-30"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

const repsText = (min: number, max: number) => (min === max ? String(min) : `${min}-${max}`);

/**
 * Sets, reps, rest and warm-ups of one exercise in the DIY builder. In a
 * superset the sets are the pair's rounds and the rest is the rest per round
 * (diyWorkout.updateExercise routes both to the pair). Every change is
 * written straight away, so Done only closes it.
 */
export function PlannedExerciseSheet({
  index,
  plan,
  onChange,
  onClose,
}: {
  /** The exercise being edited, or null while the sheet is closed. */
  index: number | null;
  plan: PlannedExercise[];
  onChange: (plan: PlannedExercise[]) => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  const p = index !== null ? plan[index] : undefined;
  if (!p || index === null) {
    return (
      <BottomSheet open={false} onClose={onClose} title="">
        {null}
      </BottomSheet>
    );
  }
  const name = exerciseById(p.exercise_id)?.name ?? p.exercise_id;
  const inSuperset = p.superset_group !== undefined;
  // The pair's round rest lives on B (A stays 0).
  const restOwner = inSuperset
    ? (plan.find((q) => q.superset_group === p.superset_group && q.superset_slot === "B") ?? p)
    : p;
  const reps = parseReps(p.target_reps) ?? { min: 10, max: 10 };
  const patch = (next: Parameters<typeof updateExercise>[2]) =>
    onChange(updateExercise(plan, index, next));

  return (
    <BottomSheet open onClose={onClose} title={name}>
      <div className="space-y-3">
        <div className="glass overflow-hidden rounded-2xl">
          <Stepper
            label={inSuperset ? t.diy.sheetRounds : t.diy.sheetSets}
            value={p.target_sets}
            min={1}
            max={MAX_SETS}
            onChange={(n) => patch({ target_sets: n })}
          />
          <Stepper
            label={t.diy.sheetRepsMin}
            value={reps.min}
            min={1}
            max={reps.max}
            onChange={(n) => patch({ target_reps: repsText(n, reps.max) })}
          />
          <Stepper
            label={t.diy.sheetRepsMax}
            value={reps.max}
            min={reps.min}
            max={MAX_REPS}
            onChange={(n) => patch({ target_reps: repsText(reps.min, n) })}
          />
          <Stepper
            label={inSuperset ? t.diy.sheetRestRound : t.diy.sheetRest}
            value={restOwner.rest_seconds}
            display={t.diy.seconds(restOwner.rest_seconds)}
            min={0}
            max={MAX_REST}
            step={REST_STEP}
            onChange={(n) => patch({ rest_seconds: n })}
          />
          <Stepper
            label={t.diy.sheetWarmups}
            value={p.warmup_sets}
            min={0}
            max={MAX_WARMUPS}
            onChange={(n) => patch({ warmup_sets: n })}
          />
        </div>
        {inSuperset ? (
          <p className="text-[12.5px] leading-snug text-muted-foreground">
            {t.diy.sheetSupersetNote}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
