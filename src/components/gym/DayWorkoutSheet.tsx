import { useState } from "react";
import { Check, ChevronDown, ClipboardList, Repeat, Shuffle, Trash2, Wand2, X } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { DayTypePicker } from "./DayTypePicker";
import { SwapSheet } from "./SwapSheet";
import { SwitchRow } from "./SwitchRow";
import { useDayWorkoutContext } from "./useDayWorkoutContext";
import { exerciseById } from "../../lib/gym/data";
import {
  forWeek,
  generateDayWorkout,
  isPregenerated,
  pregenerateProgram,
  regenerateSaved,
  type DayWorkoutContext,
  savedWorkoutFor,
  slotVariation,
  withAllDayWorkouts,
} from "../../lib/gym/dayWorkouts";
import { suggestionFor } from "../../lib/gym/generator";
import { planBlocks } from "../../lib/gym/planBlocks";
import { useTranslation } from "../../lib/gym/i18n";
import { isCardioSlot } from "../../lib/gym/schedule";
import { splitDayLabel, type ScheduleSlot, type SplitTemplateId } from "../../lib/gym/splits";
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
  weekday,
  changeType = false,
}: {
  open: boolean;
  onClose: () => void;
  kind: RotationKind;
  slotIndex: number;
  /** The program week being edited (its own pre-generated workout). */
  week?: number | undefined;
  /** "Push · Monday". */
  title: string;
  /** With it the title is the day's current type and this weekday, so it
   *  follows a change of type ("Lower Body · Tue"). */
  weekday?: string | undefined;
  /** Offers changing the day's type (opened from the Workout tab's week strip). */
  changeType?: boolean;
}) {
  const {
    program,
    weeklyScheme,
    setSlotWorkout,
    update,
    updateProgramSlotDay,
    updateScheduleSlotDay,
    updateProgramSlotCardio,
    updateScheduleSlotCardio,
  } = useGym();
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
  /** The length picked before anything is generated. */
  const [pickedDuration, setPickedDuration] = useState(DEFAULT_DURATION);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  // A fresh draft each time the sheet opens (or is pointed at another day):
  // the day's saved workout, else nothing: a day without one opens on the
  // options to generate it (nothing is made until Generate is tapped). Set
  // while rendering, so the first frame already has it.
  const openKey = open ? `${kind}-${slotIndex}-${week ?? "all"}` : null;
  const [draftKey, setDraftKey] = useState<string | null>(null);
  if (openKey !== draftKey) {
    setDraftKey(openKey);
    // On closing the draft stays, so the sheet can slide away with its content.
    if (openKey) {
      setVariation(0);
      setSwapIndex(null);
      setTypeOpen(false);
      setPickedDuration(DEFAULT_DURATION);
      setDraft(savedWorkoutFor(slot, week));
    }
  }
  // Edits to a week's own workout are not "the day's saved workout".
  const hasSaved = week === undefined ? !!slot?.workout : !!slot?.weekWorkouts?.[week];
  if (!rotation || !slot || (isCardioSlot(slot) && !changeType)) {
    return (
      <BottomSheet open={false} onClose={onClose} title={title}>
        {null}
      </BottomSheet>
    );
  }
  const dayLabel = splitDayLabel(rotation.templateId, slot.dayId);
  const sheetTitle = weekday ? `${dayLabel} · ${weekday}` : title;
  // The day's type, and (opened) every type it can become. A change applies
  // at once, to this weekday in every week, like the plan's own day edits;
  // the saved workout belonged to the old type, so it goes and the sheet
  // shows the options to generate a new one.
  const typeSection = changeType ? (
    <div className="glass rounded-2xl p-3" data-day-type>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-muted-foreground">
            {t.programBuilder.sessionType}
          </p>
          <p className="truncate text-[15px] font-semibold">{dayLabel}</p>
        </div>
        <button
          onClick={() => setTypeOpen(!typeOpen)}
          aria-expanded={typeOpen}
          className={`${button.secondary} shrink-0`}
        >
          {t.dayWorkout.changeDayType}
          <ChevronDown
            className={`size-4 transition-transform ${typeOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>
      {typeOpen ? (
        <div className="mt-3 space-y-2">
          <DayTypePicker
            templateId={rotation.templateId}
            value={slot.dayId}
            onChange={(dayId) => {
              if (dayId === slot.dayId) return;
              if (kind === "program") updateProgramSlotDay(slotIndex, dayId);
              else updateScheduleSlotDay(slotIndex, dayId);
              setDraft(null);
              setVariation(0);
            }}
            cardio={slot.cardio}
            onCardioChange={(cardio) =>
              kind === "program"
                ? updateProgramSlotCardio(slotIndex, cardio)
                : updateScheduleSlotCardio(slotIndex, cardio)
            }
          />
          <p className="text-[12.5px] text-muted-foreground">{t.dayWorkout.changeDayTypeHint}</p>
        </div>
      ) : null}
    </div>
  ) : null;
  if (isCardioSlot(slot)) {
    // A cardio day has no workout to make here; it's logged on the day.
    return (
      <BottomSheet open={open} onClose={onClose} title={sheetTitle}>
        <div className="space-y-4">
          {typeSection}
          <p className="text-[14px] text-muted-foreground">{t.dayWorkout.cardioDayNote}</p>
        </div>
      </BottomSheet>
    );
  }
  const durationChips = (current: number, pick: (m: number) => void) => (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
        {t.dayWorkout.duration}
      </p>
      <div className="flex flex-wrap gap-2">
        {DURATIONS.map((m) => (
          <button
            key={m}
            onClick={() => pick(m)}
            aria-pressed={current === m}
            className={`min-h-[44px] rounded-2xl px-3.5 text-[14px] font-semibold ${
              current === m ? chip.on : chip.off
            }`}
          >
            {t.dayWorkout.minutes(m)}
          </button>
        ))}
      </div>
    </div>
  );
  if (!draft) {
    // Nothing saved for this day yet: the choices that shape the workout,
    // and Generate. Supersets and warm-ups are the app-wide switches.
    return (
      <BottomSheet open={open} onClose={onClose} title={sheetTitle}>
        <div className="space-y-4" data-day-options>
          {typeSection}
          <p className="text-[14px] text-muted-foreground">{t.dayWorkout.noWorkoutYet}</p>
          {durationChips(pickedDuration, (m) => {
            haptic(10);
            setPickedDuration(m);
          })}
          <div className="glass overflow-hidden rounded-2xl">
            <SwitchRow
              label={t.generate.supersets}
              desc={t.generate.supersetsDesc}
              ariaLabel={t.generate.supersets}
              on={!!ctx.supersets}
              onToggle={() => update({ supersetsEnabled: !ctx.supersets })}
            />
            <div className="border-t border-border" />
            <SwitchRow
              label={t.generate.warmups}
              desc={t.generate.warmupsDesc}
              ariaLabel={t.generate.warmups}
              on={ctx.warmups !== false}
              onToggle={() => update({ warmupsEnabled: ctx.warmups === false })}
            />
          </div>
          <button
            onClick={() => {
              haptic(20);
              setDraft(make(pickedDuration, variation));
            }}
            className={`${button.primary} w-full`}
          >
            <Wand2 className="size-5" /> {t.generate.generateWorkout}
          </button>
        </div>
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

  // One exercise: its name, warm-ups, sets × reps, and (outside a superset,
  // whose rest is per round) its rest; swap and remove on the right.
  const row = (i: number, slotLabel?: string) => {
    const p = plan[i]!;
    const name = exerciseById(p.exercise_id)?.name ?? p.exercise_id;
    return (
      <div className="flex items-center gap-2 p-3">
        {slotLabel ? (
          <span className="w-5 shrink-0 text-[15px] font-bold text-primary-text">{slotLabel}</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{name}</p>
          <p className="text-[13px] text-muted-foreground">
            {p.warmup_sets > 0 ? t.generate.warmupPrefix(p.warmup_sets) : ""}
            {t.generate.setsByReps(p.target_sets, p.target_reps)}
            {slotLabel ? "" : ` · ${p.rest_seconds}s`}
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
  };
  const swapGroup = swapIndex !== null ? plan[swapIndex]?.superset_group : undefined;
  const swapPartner =
    swapGroup === undefined
      ? null
      : (plan.find((p, j) => j !== swapIndex && p.superset_group === swapGroup)?.exercise_id ??
        null);

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={sheetTitle}>
        <div className="space-y-4">
          {typeSection}
          {durationChips(draft.duration_minutes, setDuration)}

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
              {planBlocks(plan).map((block) => {
                if (block.length === 2) {
                  // A superset: one card with its rounds and rest per round,
                  // the two halves under it, as on the Workout tab.
                  const [ia, ib] = block as [number, number];
                  const a = plan[ia]!;
                  return (
                    <section
                      key={`ss-${a.exercise_id}-${plan[ib]!.exercise_id}`}
                      className="glass overflow-hidden rounded-2xl"
                      data-day-superset
                    >
                      <div className="card-head px-3 py-2">
                        <p className="text-[15px] font-bold leading-tight">
                          {t.generate.supersetTitle}
                        </p>
                        <p className="tabular text-[12.5px] text-foreground/75">
                          {t.generate.supersetRounds(a.target_sets, plan[ib]!.rest_seconds)}
                        </p>
                      </div>
                      {block.map((i, k) => (
                        <div
                          key={`${plan[i]!.exercise_id}-${i}`}
                          className={k ? "border-t border-border" : ""}
                        >
                          {row(i, plan[i]!.superset_slot ?? (k ? "B" : "A"))}
                        </div>
                      ))}
                    </section>
                  );
                }
                const i = block[0]!;
                return (
                  <div key={`${plan[i]!.exercise_id}-${i}`} className="glass rounded-2xl">
                    {row(i)}
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
        pairedExerciseId={swapPartner}
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

/**
 * The settings that shape a plan's workouts, at the top of its manage view:
 * Supersets and Warm-up sets (the same app-wide switches as on the Workout
 * tab) and, for a program, "Same exercises every week" (off by default). Flipping one remakes
 * the saved and pre-generated workouts at once, so what's shown matches the
 * switch; days without a saved workout pick it up when they're generated.
 */
export function DayWorkoutSettings({ kind }: { kind: RotationKind }) {
  const { program, weeklyScheme, update, setProgram, setRotationSlots } = useGym();
  const ctx = useDayWorkoutContext();
  const t = useTranslation();
  const rotation = kind === "program" ? program : weeklyScheme;
  if (!rotation) return null;
  const hasSaved = rotation.schedule.some((s) => !!s.workout);

  const remake = (patch: Partial<Pick<DayWorkoutContext, "supersets" | "warmups">>) => {
    if (!hasSaved) return;
    // The store hasn't caught up with the switch yet, so the new value goes in directly.
    const next = { ...ctx, ...patch };
    const schedule = regenerateSaved(rotation.schedule, next, rotation.templateId);
    if (kind === "program" && program && isPregenerated(program)) {
      setProgram(pregenerateProgram({ ...program, schedule }, next, DEFAULT_DURATION));
    } else {
      setRotationSlots(kind, schedule);
    }
  };
  const same = program?.sameExercises === true;

  return (
    <div className="glass overflow-hidden rounded-2xl" data-day-settings>
      <SwitchRow
        label={t.generate.supersets}
        desc={t.generate.supersetsDesc}
        ariaLabel={t.generate.supersets}
        on={!!ctx.supersets}
        onToggle={() => {
          const supersets = !ctx.supersets;
          update({ supersetsEnabled: supersets });
          remake({ supersets });
        }}
      />
      <div className="border-t border-border" />
      <SwitchRow
        label={t.generate.warmups}
        desc={t.generate.warmupsDesc}
        ariaLabel={t.generate.warmups}
        on={ctx.warmups !== false}
        onToggle={() => {
          const warmups = ctx.warmups === false;
          update({ warmupsEnabled: warmups });
          remake({ warmups });
        }}
      />
      {kind === "program" && program ? (
        <>
          <div className="border-t border-border" />
          <SwitchRow
            label={t.dayWorkout.sameExercises}
            desc={t.dayWorkout.sameExercisesDesc}
            ariaLabel={t.dayWorkout.sameExercises}
            on={same}
            onToggle={() => {
              const next = { ...program, sameExercises: !same };
              setProgram(
                isPregenerated(next) ? pregenerateProgram(next, ctx, DEFAULT_DURATION) : next,
              );
            }}
          />
        </>
      ) : null}
      {hasSaved ? (
        <p className="border-t border-border px-4 py-2.5 text-[12.5px] text-muted-foreground">
          {t.dayWorkout.settingsRemake}
        </p>
      ) : null}
    </div>
  );
}
