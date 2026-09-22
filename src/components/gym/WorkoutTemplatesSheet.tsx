import { useEffect, useState } from "react";
import { Check, Play, Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { estimateMinutes } from "../../lib/gym/generator";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic, useGym } from "../../lib/gym/store";
import type { Muscle, PlannedExercise } from "../../lib/gym/types";

interface Draft {
  plan: PlannedExercise[];
  duration_minutes: number;
  target_muscles: Muscle[];
}

/**
 * Two modes in one sheet, mirroring WeeklyPlanSheet's mode-switching pattern:
 * with `draft` set (opened via "Save" on an already-generated plan) it shows
 * a name-and-save form pre-filled from that plan; otherwise it lists already
 * saved templates to start or delete. Saving and starting both close the
 * sheet — same as WeeklyPlanSheet's `save()`.
 */
export function WorkoutTemplatesSheet({
  open,
  onClose,
  draft,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  draft?: Draft | null;
  onStart: (plan: PlannedExercise[], duration_minutes: number, target_muscles: Muscle[]) => void;
}) {
  const { workoutTemplates, saveWorkoutTemplate, deleteWorkoutTemplate } = useGym();
  const t = useTranslation();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const save = () => {
    if (!draft || !name.trim()) return;
    haptic([20, 30]);
    saveWorkoutTemplate(name.trim(), draft.plan, draft.duration_minutes, draft.target_muscles);
    onClose();
  };

  if (draft) {
    return (
      <BottomSheet open={open} onClose={onClose} title={t.workoutTemplates.saveAsTemplate}>
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {t.workoutTemplates.exerciseSummary(draft.plan.length, estimateMinutes(draft.plan))}
          </p>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder={t.workoutTemplates.namePlaceholder}
            className="h-12 w-full rounded-2xl bg-muted px-4 text-[16px] font-semibold outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={save}
            disabled={!name.trim()}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            <Check className="size-5" /> {t.workoutTemplates.saveTemplate}
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t.workoutTemplates.title}>
      {workoutTemplates.length ? (
        <div className="space-y-2">
          {workoutTemplates.map((tpl) => (
            <div key={tpl.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{tpl.name}</p>
                <p className="text-[13px] text-muted-foreground">
                  {t.workoutTemplates.exerciseSummary(tpl.plan.length, estimateMinutes(tpl.plan))}
                </p>
              </div>
              <button
                onClick={() => {
                  haptic(15);
                  deleteWorkoutTemplate(tpl.id);
                }}
                aria-label={t.workoutTemplates.deleteTemplate(tpl.name)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive active:scale-95"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                onClick={() => {
                  haptic([20, 40, 20]);
                  onStart(tpl.plan, tpl.duration_minutes, tpl.target_muscles);
                }}
                aria-label={t.workoutTemplates.startTemplate(tpl.name)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95"
              >
                <Play className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-[14px] text-muted-foreground">
          {t.workoutTemplates.empty}
        </p>
      )}
    </BottomSheet>
  );
}
