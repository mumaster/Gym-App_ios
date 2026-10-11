import { useState } from "react";
import { Check, ClipboardList, Repeat, Shuffle, Trash2, X } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { SwapSheet } from "./SwapSheet";
import { useDayWorkoutContext } from "./useDayWorkoutContext";
import { exerciseById } from "../../lib/gym/data";
import {
  forWeek,
  generateDayWorkout,
  savedWorkoutFor,
  slotVariation,
  withAllDayWorkouts,
} from "../../lib/gym/dayWorkouts";
import { suggestionFor } from "../../lib/gym/generator";
import { useTranslation } from "../../lib/gym/i18n";
import { isCardioSlot } from "../../lib/gym/schedule";
import type { ScheduleSlot, SplitTemplateId } from "../../lib/gym/splits";
import { haptic, useGym, type RotationKind } from "../../lib/gym/store";
import type { DayWorkout, PlannedExercise } from "../../lib/gym/types";
import { button, chip } from "./ui";

const DURATIONS = [30, 45, 60, 75, 90] as const;
const DEFAULT_DURATION = 45;

/** Drops the superset link from whatever was paired with a removed exercise. */
const unpair = (plan: PlannedExercise[], group: number | undefined): PlannedExercise[] =>
  group === undefined
    ? plan
    : plan.map((p) => {
        if (p.superset_group !== group) return p;
        const { superset_group: _g, superset_slot: _s, ...rest } = p;
        return rest;
      });

/**
 * Create, view and edit ONE day's workout of the weekly plan or program: pick
 * the length, shuffle, swap or remove exercises, then save it. The draft is
 * local until "Save workout". With `week` (a pre-generated program) the
 * workout is that week's alone and carries the week's volume.
 */
export function DayWorkoutSheet({
  open,
  onClose,
  kind,
  slotIndex,
  week,
  title,
}: {
  open: boolean;
  onClose: () => void;
  kind: RotationKind;
  slotIndex: number;
  /** The program week being edited (its own pre-generated workout). */
  week?: number | undefined;
  /** "Push · Monday". */
  title: string;
}) {
  const { program, weeklyScheme, setSlotWorkout } = useGym();
  const ctx = useDayWorkoutContext();
  const t = useTranslation();
  const rotation = kind === "program" ? program : weeklyScheme;
  const slot = rotation?.schedule[slotIndex];
  const weekDef = kind === "program" && week !== undefined ? program?.weeks[week] : undefined;

  const make = (duration: number, variation: number): DayWorkout | null => {
    if (!rotation || !slot || isCardioSlot(slot)) return null;
    const base = generateDayWorkout(
      ctx,
      rotation.templateId,
      slot,
      duration,
      slotVariation(rotation.schedule, slotIndex) + variation,
    );
    return base && weekDef ? forWeek(base, weekDef) : base;
  };

  const [variation, setVariation] = useState(0);
  const [draft, setDraft] = useState<DayWorkout | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  // A fresh draft each time the sheet opens (or is pointed at another day):
  // the day's saved workout, else a newly generated one. Set while rendering,
  // so the first frame already has it.
  const openKey = open ? `${kind}-${slotIndex}-${week ?? "all"}` : null;
  const [draftKey, setDraftKey] = useState<string | null>(null);
  if (openKey !== draftKey) {
    setDraftKey(openKey);
    // On closing the draft stays, so the sheet can slide away with its content.
    if (openKey) {
      setVariation(0);
      setSwapIndex(null);
      setDraft(savedWorkoutFor(slot, week) ?? make(DEFAULT_DURATION, 0));
    }
  }
  // Edits to a week's own workout are not "the day's saved workout".
  const hasSaved = week === undefined ? !!slot?.workout : !!slot?.weekWorkouts?.[week];
  if (!rotation || !slot || !draft) {
    return (
      <BottomSheet open={false} onClose={onClose} title={title}>
        {null}
      </BottomSheet>
    );
  }
  const plan = draft.plan;

  const regenerate = (duration: number, nextVariation: number) => {
    const next = make(duration, nextVariation);
    if (next) setDraft(next);
  };
  const setDuration = (minutes: number) => {
    haptic(10);
    regenerate(minutes, variation);
  };
  const shuffle = () => {
    haptic(15);
    setVariation(variation + 1);
    regenerate(draft.duration_minutes, variation + 1);
  };
  const removeAt = (i: number) => {
    haptic(10);
    const group = plan[i]?.superset_group;
    setDraft({
      ...draft,
      plan: unpair(
        plan.filter((_, j) => j !== i),
        group,
      ),
    });
  };
  const save = () => {
    if (!plan.length) return;
    haptic([20, 30]);
    setSlotWorkout(kind, slotIndex, { ...draft, saved_at: new Date().toISOString() }, week);
    onClose();
  };
  const removeSaved = () => {
    haptic([30, 40]);
    setSlotWorkout(kind, slotIndex, null, week);
    onClose();
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={title}>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
              {t.dayWorkout.duration}
            </p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setDuration(m)}
                  aria-pressed={draft.duration_minutes === m}
                  className={`min-h-[44px] rounded-2xl px-3.5 text-[14px] font-semibold ${
                    draft.duration_minutes === m ? chip.on : chip.off
                  }`}
                >
                  {t.dayWorkout.minutes(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">
              {t.dayWorkout.exerciseCount(plan.length)}
              {weekDef ? ` · ${t.dayWorkout.weekLabel((week ?? 0) + 1)}` : ""}
            </p>
            <button onClick={shuffle} className={button.secondary}>
              <Shuffle className="size-4" /> {t.dayWorkout.shuffle}
            </button>
          </div>

          {plan.length ? (
            <div className="space-y-2">
              {plan.map((p, i) => {
                const ex = exerciseById(p.exercise_id);
                const name = ex?.name ?? p.exercise_id;
                return (
                  <div
                    key={`${p.exercise_id}-${i}`}
                    className="glass flex items-center gap-2 rounded-2xl p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{name}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {t.generate.setsByReps(p.target_sets, p.target_reps)} · {p.rest_seconds}s
                      </p>
                    </div>
                    <button
                      onClick={() => setSwapIndex(i)}
                      aria-label={t.dayWorkout.swap(name)}
                      className={button.icon}
                    >
                      <Repeat className="size-4" />
                    </button>
                    <button
                      onClick={() => removeAt(i)}
                      aria-label={t.dayWorkout.removeExercise(name)}
                      className={button.icon}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[14px] text-muted-foreground">{t.dayWorkout.empty}</p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button onClick={save} disabled={!plan.length} className={`${button.primary} w-full`}>
              <Check className="size-5" /> {t.dayWorkout.save}
            </button>
            {hasSaved ? (
              <>
                <button onClick={removeSaved} className={`${button.destructive} w-full`}>
                  <Trash2 className="size-4" /> {t.dayWorkout.removeSaved}
                </button>
                <p className="text-center text-[12.5px] text-muted-foreground">
                  {t.dayWorkout.removeSavedHint}
                </p>
              </>
            ) : null}
          </div>
        </div>
      </BottomSheet>
      <SwapSheet
        exerciseId={swapIndex !== null ? (plan[swapIndex]?.exercise_id ?? null) : null}
        inWorkoutIds={plan.map((p) => p.exercise_id)}
        onClose={() => setSwapIndex(null)}
        onPick={(ex) => {
          const i = swapIndex;
          if (i === null) return;
          setDraft({
            ...draft,
            plan: plan.map((p, j) => {
              if (j !== i) return p;
              const { suggested_weight: _w, suggested_reps: _r, suggested_basis: _b, ...rest } = p;
              return { ...rest, exercise_id: ex.id, ...suggestionFor(ex, p.target_reps, ctx) };
            }),
          });
          setSwapIndex(null);
          haptic(20);
        }}
      />
    </>
  );
}

/** Under a lifting day's weekday in a plan's manage view: what is saved for
 *  the day, and the button that creates or edits it. */
export function DayWorkoutLine({
  workout,
  onEdit,
}: {
  workout: DayWorkout | null;
  onEdit: () => void;
}) {
  const t = useTranslation();
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
        <ClipboardList
          className={`size-4 shrink-0 ${workout ? "text-primary-text" : ""}`}
          aria-hidden
        />
        <span className="min-w-0">
          {workout
            ? t.dayWorkout.savedLine(workout.plan.length, workout.duration_minutes)
            : t.dayWorkout.generatedOnDay}
        </span>
      </p>
      <button onClick={onEdit} className={`${button.secondary} shrink-0`}>
        {workout ? t.dayWorkout.editWorkout : t.dayWorkout.createWorkout}
      </button>
    </div>
  );
}

/** "Create workouts for every day": a saved workout for each lifting day
 *  that has none (45 min). Shown only while some lifting day is missing one. */
export function CreateAllWorkoutsButton({
  schedule,
  templateId,
  onChange,
}: {
  schedule: ScheduleSlot[];
  templateId: SplitTemplateId;
  onChange: (schedule: ScheduleSlot[]) => void;
}) {
  const ctx = useDayWorkoutContext();
  const t = useTranslation();
  if (!schedule.some((s) => !isCardioSlot(s) && !s.workout)) return null;
  return (
    <div className="space-y-1.5">
      <button
        onClick={() => {
          haptic(20);
          onChange(
            withAllDayWorkouts(schedule, ctx, templateId, DEFAULT_DURATION, { replace: false }),
          );
        }}
        className={`${button.secondary} w-full`}
      >
        {t.dayWorkout.createAll}
      </button>
      <p className="text-center text-[12.5px] text-muted-foreground">
        {t.dayWorkout.createAllHint}
      </p>
    </div>
  );
}
