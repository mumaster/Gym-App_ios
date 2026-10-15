import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Check,
  ChevronLeft,
  Link2,
  Link2Off,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ExercisePickerSheet } from "./ExercisePickerSheet";
import { ListCard } from "./ListCard";
import { PlannedExerciseSheet } from "./PlannedExerciseSheet";
import { WorkoutScoreCard, useWorkoutScore } from "./WorkoutScoreCard";
import { button, chip } from "./ui";
import { readyToStart } from "../../lib/gym/dayWorkouts";
import { exerciseById } from "../../lib/gym/data";
import {
  DEFAULT_PLANNED_MINUTES,
  addExercise,
  linkSuperset,
  planMuscles,
  removeExercise,
  unlinkSuperset,
} from "../../lib/gym/diyWorkout";
import { estimateMinutes } from "../../lib/gym/generator";
import { useTranslation } from "../../lib/gym/i18n";
import { latestBodyKg } from "../../lib/gym/load";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { learnPace } from "../../lib/gym/pace";
import { moveBlock, planBlocks } from "../../lib/gym/planBlocks";
import { haptic, useGym } from "../../lib/gym/store";
import type { Muscle, PlannedExercise } from "../../lib/gym/types";

/** The unsaved draft, kept for the browser session so leaving the tab (or the
 *  Workout screen) and coming back doesn't lose it. */
export interface DiyDraft {
  name: string;
  plan: PlannedExercise[];
  /** The saved workout being edited, if any. */
  editingId: string | null;
  /** How long the workout is meant to take, in minutes. */
  duration?: number;
}

const DRAFT_KEY = "forge.diy.draft.v1";

/** The planned-length chips, the same as the generator's. */
const SHORTCUTS = [30, 45, 60];

function readDraft(): DiyDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<DiyDraft>;
    if (typeof d.name !== "string" || !Array.isArray(d.plan)) return null;
    return {
      name: d.name,
      plan: d.plan,
      editingId: d.editingId ?? null,
      duration: typeof d.duration === "number" ? d.duration : DEFAULT_PLANNED_MINUTES,
    };
  } catch {
    return null;
  }
}

function writeDraft(draft: DiyDraft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage can be blocked (private window); the draft just isn't kept.
  }
}

/**
 * Workout tab → Build your own: make a workout from scratch (loose exercises
 * and supersets), score it, save it as a workout template and start it. The
 * list of saved workouts is the home view; a template is also what the week
 * plan's "Use a saved workout" offers (DayWorkoutSheet).
 *
 * `initialDraft` opens the editor straight away (tests, and the restored
 * session draft); `onStarted` runs after a session starts, to leave for it.
 */
export function DiyBuilder({
  initialDraft,
  onStarted,
}: {
  initialDraft?: DiyDraft;
  onStarted: () => void;
}) {
  const {
    workouts,
    workoutTemplates,
    knownLifts,
    profiles,
    activeProfileId,
    weightLog,
    nutritionProfile,
    startWorkout,
    saveWorkoutTemplate,
    updateWorkoutTemplate,
    deleteWorkoutTemplate,
  } = useGym();
  const t = useTranslation();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const pace = useMemo(() => learnPace(workouts), [workouts]);

  const [editing, setEditing] = useState(!!initialDraft);
  const [name, setName] = useState(initialDraft?.name ?? "");
  const [plan, setPlan] = useState<PlannedExercise[]>(initialDraft?.plan ?? []);
  const [editingId, setEditingId] = useState<string | null>(initialDraft?.editingId ?? null);
  const [duration, setDuration] = useState(initialDraft?.duration ?? DEFAULT_PLANNED_MINUTES);
  const [customInput, setCustomInput] = useState(
    initialDraft?.duration && !SHORTCUTS.includes(initialDraft.duration)
      ? String(initialDraft.duration)
      : "",
  );
  /** Sets the planned length, showing it in the own-minutes field when it
   *  isn't one of the chips. */
  const setDurationTo = (min: number) => {
    setDuration(min);
    setCustomInput(SHORTCUTS.includes(min) ? "" : String(min));
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(savedTimer.current ?? undefined), []);

  // Restore the session's draft after mount (not while rendering, so the
  // server and first client render agree), then keep it up to date.
  const [restored, setRestored] = useState(!!initialDraft);
  useEffect(() => {
    if (restored) return;
    const d = readDraft();
    if (d) {
      setName(d.name);
      setPlan(d.plan);
      setEditingId(d.editingId);
      setDurationTo(d.duration ?? DEFAULT_PLANNED_MINUTES);
      setEditing(true);
    }
    setRestored(true);
  }, [restored]);
  useEffect(() => {
    if (!restored) return;
    writeDraft(editing ? { name, plan, editingId, duration } : null);
  }, [restored, editing, name, plan, editingId, duration]);

  const minutesOf = (p: PlannedExercise[]) => Math.round(estimateMinutes(p, pace));
  // One score for the card and the live pill beside Add exercise.
  const scored = useWorkoutScore(plan, minutesOf(plan), duration);
  const scoreRef = useRef<HTMLDivElement | null>(null);

  /** The plan as the session wants it: the suggested weights worked out again
   *  from the history, like a saved day's workout (dayWorkouts.readyToStart). */
  const start = (startPlan: PlannedExercise[], duration: number) => {
    if (!startPlan.length) return;
    haptic([20, 40, 20]);
    const muscles = planMuscles(startPlan);
    startWorkout({
      plan: readyToStart(
        {
          plan: startPlan,
          duration_minutes: duration,
          target_muscles: muscles,
          saved_at: new Date().toISOString(),
        },
        {
          history: workouts,
          knownLifts,
          profile,
          bodyKg: latestBodyKg(weightLog, nutritionProfile),
        },
      ),
      duration_minutes: duration,
      target_muscles: muscles,
    });
    onStarted();
  };

  const openNew = () => {
    haptic(12);
    setName("");
    setPlan([]);
    setEditingId(null);
    setDurationTo(DEFAULT_PLANNED_MINUTES);
    setConfirmDelete(false);
    setJustSaved(false);
    setEditing(true);
  };
  const openSaved = (id: string) => {
    const tpl = workoutTemplates.find((x) => x.id === id);
    if (!tpl) return;
    haptic(10);
    setName(tpl.name);
    setPlan(tpl.plan);
    setEditingId(tpl.id);
    setDurationTo(tpl.duration_minutes || DEFAULT_PLANNED_MINUTES);
    setConfirmDelete(false);
    setJustSaved(false);
    setEditing(true);
  };
  const close = () => {
    haptic(10);
    setEditing(false);
    setEditIndex(null);
    setPickerOpen(false);
  };
  const save = () => {
    if (!plan.length) return;
    haptic([20, 30]);
    const finalName = name.trim() || t.diy.defaultName;
    setName(finalName);
    const patch = {
      name: finalName,
      plan,
      duration_minutes: duration,
      target_muscles: planMuscles(plan) as Muscle[],
    };
    if (editingId && workoutTemplates.some((x) => x.id === editingId)) {
      updateWorkoutTemplate(editingId, patch);
    } else {
      setEditingId(
        saveWorkoutTemplate(patch.name, patch.plan, patch.duration_minutes, patch.target_muscles),
      );
    }
    setJustSaved(true);
    clearTimeout(savedTimer.current ?? undefined);
    savedTimer.current = setTimeout(() => setJustSaved(false), 2000);
  };
  const remove = () => {
    if (!editingId) return;
    if (!confirmDelete) {
      haptic(15);
      setConfirmDelete(true);
      return;
    }
    haptic([30, 40]);
    deleteWorkoutTemplate(editingId);
    close();
  };

  // Any edit to the plan undoes the "Saved" mark: what's on screen differs.
  const changePlan = (next: PlannedExercise[]) => {
    setJustSaved(false);
    setPlan(next);
  };
  const move = (block: number, delta: -1 | 1) => {
    haptic(12);
    changePlan(moveBlock(plan, block, delta));
  };

  if (!editing) {
    return (
      <div className="space-y-4" data-diy-list>
        <button onClick={openNew} className={`${button.primary} w-full`}>
          <Plus className="size-5" aria-hidden /> {t.diy.newWorkout}
        </button>
        <ListCard
          icon={Bookmark}
          title={t.diy.savedTitle}
          subtitle={t.diy.savedCount(workoutTemplates.length)}
          filled={workoutTemplates.length > 0}
        >
          {workoutTemplates.length ? (
            workoutTemplates.map((tpl) => (
              <div key={tpl.id} className="flex items-center gap-2 border-t border-border pr-3">
                <button
                  onClick={() => openSaved(tpl.id)}
                  aria-label={t.diy.editNamed(tpl.name)}
                  className="min-h-[60px] min-w-0 flex-1 px-4 py-2.5 text-left active:bg-foreground/5"
                >
                  <span className="block truncate text-[15px] font-semibold">{tpl.name}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {t.generate.exerciseCount(
                      tpl.plan.length,
                      tpl.duration_minutes || minutesOf(tpl.plan),
                    )}
                  </span>
                </button>
                <button
                  onClick={() => start(tpl.plan, tpl.duration_minutes || minutesOf(tpl.plan))}
                  aria-label={t.diy.startNamed(tpl.name)}
                  className={button.edit}
                >
                  <Play className="size-4" aria-hidden />
                </button>
              </div>
            ))
          ) : (
            <p className="border-t border-border px-4 py-3 text-[14px] text-muted-foreground">
              {t.diy.emptyList}
            </p>
          )}
        </ListCard>
      </div>
    );
  }

  const blocks = planBlocks(plan);

  /** One exercise: tap the name for its sets, reps and rest; remove on the
   *  right. A loose one also carries the arrows that move it. */
  const row = (i: number, opts: { slot?: string; arrows?: number }) => {
    const p = plan[i]!;
    const exName = exerciseById(p.exercise_id)?.name ?? p.exercise_id;
    const block = opts.arrows;
    return (
      <div className="flex items-center gap-2 py-1 pl-4 pr-3">
        {opts.slot ? (
          <span className="w-5 shrink-0 text-[15px] font-bold text-primary-text">{opts.slot}</span>
        ) : null}
        <button
          onClick={() => {
            haptic(10);
            setEditIndex(i);
          }}
          aria-label={t.diy.editExercise(exName)}
          className="min-h-[52px] min-w-0 flex-1 py-1.5 text-left active:opacity-70"
        >
          <span className="block truncate text-[15px] font-semibold">{exName}</span>
          <span className="tabular block truncate text-[13px] text-muted-foreground">
            {p.warmup_sets > 0 ? t.generate.warmupPrefix(p.warmup_sets) : ""}
            {t.generate.setsByReps(p.target_sets, p.target_reps)}
            {opts.slot ? "" : ` · ${p.rest_seconds}s`}
          </span>
        </button>
        {block !== undefined ? (
          <>
            <button
              onClick={() => move(block, -1)}
              disabled={block === 0}
              aria-label={t.generate.moveUp}
              className={`${button.icon} disabled:opacity-30`}
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button
              onClick={() => move(block, 1)}
              disabled={block === blocks.length - 1}
              aria-label={t.generate.moveDown}
              className={`${button.icon} disabled:opacity-30`}
            >
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </>
        ) : null}
        <button
          onClick={() => {
            haptic(10);
            changePlan(removeExercise(plan, i));
          }}
          aria-label={t.dayWorkout.removeExercise(exName)}
          className={button.icon}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4" data-diy-editor>
      <button
        onClick={close}
        className="tap-target -ml-1 flex min-h-[36px] items-center gap-1 text-[15px] font-semibold text-primary-text active:opacity-70"
      >
        <ChevronLeft className="size-5" aria-hidden /> {t.diy.back}
      </button>

      <input
        type="text"
        value={name}
        onChange={(e) => {
          setJustSaved(false);
          setName(e.target.value);
        }}
        placeholder={t.diy.defaultName}
        aria-label={t.diy.nameLabel}
        maxLength={60}
        enterKeyHint="done"
        className="glass-chip h-12 w-full rounded-2xl px-4 text-[16px] font-semibold text-foreground outline-none placeholder:text-muted-foreground"
      />

      <div className="space-y-2">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t.diy.duration}
        </p>
        <div className="flex items-center gap-2" data-diy-duration>
          {SHORTCUTS.map((d) => (
            <button
              key={d}
              onClick={() => {
                haptic(12);
                setJustSaved(false);
                setDurationTo(d);
              }}
              aria-pressed={duration === d}
              className={`tap-target min-h-[40px] flex-1 rounded-full text-[15px] font-semibold transition-colors ${
                duration === d ? chip.on : chip.off
              }`}
            >
              {d}m
            </button>
          ))}
          <label
            className={`tap-target flex min-h-[40px] w-[5.5rem] shrink-0 items-center gap-1 rounded-full px-3 ${
              SHORTCUTS.includes(duration) ? chip.off : chip.on
            }`}
          >
            <input
              type="text"
              inputMode="numeric"
              aria-label={t.generate.minutes}
              value={customInput}
              placeholder="–"
              onFocus={selectOnFocus}
              onChange={(e) => {
                const raw = e.target.value;
                if (!DECIMAL_INPUT_RE.test(raw)) return;
                setCustomInput(raw);
                const n = Math.round(parseDecimal(raw));
                if (raw !== "" && Number.isFinite(n) && n > 0) {
                  setJustSaved(false);
                  setDuration(Math.min(180, n));
                }
              }}
              onBlur={() => {
                if (customInput === "") return;
                const clamped = Math.max(
                  5,
                  Math.min(180, Math.round(parseDecimal(customInput) || DEFAULT_PLANNED_MINUTES)),
                );
                setDurationTo(clamped);
              }}
              className="tabular w-full min-w-0 bg-transparent text-center text-[16px] font-bold text-foreground outline-none"
            />
            <span className="text-[12px] font-semibold text-muted-foreground">min</span>
          </label>
        </div>
        {plan.length ? (
          <p className="tabular text-[13px] text-muted-foreground">
            {t.diy.durationEstimate(minutesOf(plan))}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={save} disabled={!plan.length} className={button.tonal}>
          {justSaved ? (
            <Check className="size-5" aria-hidden />
          ) : (
            <Bookmark className="size-5" aria-hidden />
          )}
          <span aria-live="polite">{justSaved ? t.diy.saved : t.diy.save}</span>
        </button>
        <button
          onClick={() => start(plan, duration)}
          disabled={!plan.length}
          className={button.secondary}
        >
          <Play className="size-5" aria-hidden /> {t.diy.start}
        </button>
      </div>

      {plan.length ? (
        <div className="space-y-2">
          {blocks.map((block, b) => {
            const next = blocks[b + 1];
            const canLink = block.length === 1 && next?.length === 1;
            const card =
              block.length === 2 ? (
                <section
                  key={`ss-${b}-${plan[block[0]!]!.exercise_id}`}
                  className="glass overflow-hidden rounded-2xl"
                  data-diy-superset
                >
                  <div className="card-head flex min-h-[56px] items-center gap-2 py-2 pl-4 pr-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold leading-tight">
                        {t.generate.supersetTitle}
                      </span>
                      <span className="tabular block truncate text-[12.5px] text-foreground/75">
                        {t.generate.supersetRounds(
                          plan[block[0]!]!.target_sets,
                          plan[block[1]!]!.rest_seconds,
                        )}
                      </span>
                    </span>
                    <button
                      onClick={() => {
                        haptic(12);
                        changePlan(unlinkSuperset(plan, b));
                      }}
                      aria-label={t.diy.unlinkAria}
                      className={button.icon}
                    >
                      <Link2Off className="size-4" aria-hidden />
                    </button>
                    <button
                      onClick={() => move(b, -1)}
                      disabled={b === 0}
                      aria-label={t.generate.moveSupersetUp}
                      className={`${button.icon} disabled:opacity-30`}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button
                      onClick={() => move(b, 1)}
                      disabled={b === blocks.length - 1}
                      aria-label={t.generate.moveSupersetDown}
                      className={`${button.icon} disabled:opacity-30`}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                  </div>
                  {block.map((i, k) => (
                    <div
                      key={`${plan[i]!.exercise_id}-${i}`}
                      className={k ? "border-t border-border" : ""}
                    >
                      {row(i, { slot: plan[i]!.superset_slot ?? (k ? "B" : "A") })}
                    </div>
                  ))}
                </section>
              ) : (
                <div key={`one-${b}-${plan[block[0]!]!.exercise_id}`} className="glass rounded-2xl">
                  {row(block[0]!, { arrows: b })}
                </div>
              );
            return (
              <div key={`b-${b}`} className="space-y-2">
                {card}
                {canLink ? (
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        haptic(12);
                        changePlan(linkSuperset(plan, b));
                      }}
                      aria-label={t.diy.linkAria}
                      className="tap-target flex min-h-[36px] items-center gap-1.5 rounded-full glass-chip px-3.5 text-[13px] font-semibold text-secondary-foreground active:scale-95"
                    >
                      <Link2 className="size-4" aria-hidden /> {t.diy.link}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[14px] text-muted-foreground">{t.diy.emptyPlan}</p>
      )}

      <div className="flex items-stretch gap-2">
        <button
          onClick={() => {
            haptic(10);
            setPickerOpen(true);
          }}
          className={`${button.primary} min-w-0 flex-1`}
          data-diy-add
        >
          <Plus className="size-5" aria-hidden /> {t.diy.addExercise}
        </button>
        {/* The score as it is now, so each change shows its effect; a tap
            goes to the card that explains it. */}
        <button
          onClick={() => {
            const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            scoreRef.current?.scrollIntoView({
              behavior: reduce ? "auto" : "smooth",
              block: "start",
            });
          }}
          className="flex shrink-0 flex-col items-center justify-center rounded-full bg-primary/10 px-4 text-primary-text ring-1 ring-inset ring-primary/40"
          aria-label={t.workoutScore.livePill(scored.result.score)}
          data-score-pill
        >
          <span className="tabular text-[20px] font-bold leading-none">{scored.result.score}</span>
          <span className="text-[11px] font-semibold leading-tight">
            {t.workoutScore.liveLabel}
          </span>
        </button>
      </div>

      <div ref={scoreRef} className="scroll-mt-28">
        <WorkoutScoreCard
          plan={plan}
          scored={scored}
          targetMinutes={duration}
          onChange={changePlan}
        />
      </div>

      {editingId ? (
        <div className="space-y-2">
          <button onClick={remove} className={`${button.destructive} w-full`}>
            <Trash2 className="size-4" aria-hidden />{" "}
            {confirmDelete ? t.diy.deleteConfirm : t.diy.deleteWorkout}
          </button>
          {confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(false)}
              className={`${button.secondary} w-full`}
            >
              {t.diy.deleteCancel}
            </button>
          ) : null}
        </div>
      ) : null}

      <ExercisePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        inWorkoutIds={plan.map((p) => p.exercise_id)}
        onPick={(ex) => {
          changePlan(addExercise(plan, ex));
          setPickerOpen(false);
        }}
      />
      <PlannedExerciseSheet
        index={editIndex}
        plan={plan}
        onChange={changePlan}
        onClose={() => setEditIndex(null)}
      />
    </div>
  );
}
