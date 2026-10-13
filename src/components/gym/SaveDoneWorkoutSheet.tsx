import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { SegmentedTabs } from "./SegmentedTabs";
import { button, chip } from "./ui";
import { estimateMinutes } from "../../lib/gym/generator";
import { useTranslation } from "../../lib/gym/i18n";
import { guessDayType, LIFTING_DAY_TYPES, planFromDone } from "../../lib/gym/savedWorkout";
import { haptic, useGym } from "../../lib/gym/store";
import type { Workout } from "../../lib/gym/types";

type Mode = "workout" | "day";

/** Saves a finished workout for later, either as a named workout or as the
 *  template of a kind of day (Upper Body, Lower Body…). Both end up in the
 *  Workout tab's "Saved templates". */
export function SaveDoneWorkoutSheet({
  open,
  onClose,
  workout,
}: {
  open: boolean;
  onClose: () => void;
  workout: Workout;
}) {
  const { saveWorkoutTemplate } = useGym();
  const t = useTranslation();
  const [mode, setMode] = useState<Mode>("workout");
  const [name, setName] = useState("");
  const [dayId, setDayId] = useState("full");

  useEffect(() => {
    if (!open) return;
    setMode("workout");
    setName("");
    setDayId(guessDayType(workout));
  }, [open, workout]);

  const plan = planFromDone(workout);
  const day = LIFTING_DAY_TYPES.find((d) => d.id === dayId);
  const canSave = mode === "day" ? !!day : !!name.trim();

  const save = () => {
    if (!canSave) return;
    haptic([20, 30]);
    if (mode === "day" && day) {
      saveWorkoutTemplate(
        t.workoutTemplates.dayTemplate(day.label),
        plan,
        workout.duration_minutes,
        workout.target_muscles,
        day.id,
      );
    } else {
      saveWorkoutTemplate(name.trim(), plan, workout.duration_minutes, workout.target_muscles);
    }
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t.workoutTemplates.saveDoneTitle}>
      <div className="space-y-4">
        <SegmentedTabs
          value={mode}
          onChange={setMode}
          tabs={["workout", "day"] as const}
          labels={{ workout: t.workoutTemplates.asWorkout, day: t.workoutTemplates.asDayType }}
        />
        <p className="text-[13px] text-muted-foreground">
          {mode === "day"
            ? t.workoutTemplates.dayTypeHint
            : t.workoutTemplates.exerciseSummary(plan.length, estimateMinutes(plan))}
        </p>
        {mode === "workout" ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder={t.workoutTemplates.namePlaceholder}
            className="h-12 w-full rounded-2xl bg-muted px-4 text-[16px] font-semibold outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <div role="radiogroup" className="grid grid-cols-2 gap-x-1.5 gap-y-2">
            {LIFTING_DAY_TYPES.map((d) => (
              <button
                key={d.id}
                role="radio"
                aria-checked={d.id === dayId}
                onClick={() => {
                  haptic(10);
                  setDayId(d.id);
                }}
                className={`tap-target min-h-[36px] rounded-xl px-2 text-[13px] font-semibold ${
                  d.id === dayId ? chip.on : chip.off
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={save} disabled={!canSave} className={`${button.primary} w-full`}>
          <Check className="size-5" /> {t.workoutTemplates.saveTemplate}
        </button>
      </div>
    </BottomSheet>
  );
}
