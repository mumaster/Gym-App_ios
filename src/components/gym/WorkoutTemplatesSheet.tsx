import { useEffect, useState } from "react";
import { Check, Play, Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { estimateMinutes } from "../../lib/gym/generator";
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
      <BottomSheet open={open} onClose={onClose} title="Save as template">
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {draft.plan.length} exercises · ~{estimateMinutes(draft.plan)} min
          </p>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="e.g. Push day A"
            className="h-12 w-full rounded-2xl bg-muted px-4 text-[16px] font-semibold outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={save}
            disabled={!name.trim()}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            <Check className="size-5" /> Save template
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Saved templates">
      {workoutTemplates.length ? (
        <div className="space-y-2">
          {workoutTemplates.map((t) => (
            <div key={t.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{t.name}</p>
                <p className="text-[13px] text-muted-foreground">
                  {t.plan.length} exercises · ~{estimateMinutes(t.plan)} min
                </p>
              </div>
              <button
                onClick={() => {
                  haptic(15);
                  deleteWorkoutTemplate(t.id);
                }}
                aria-label={`Delete ${t.name}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive active:scale-95"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                onClick={() => {
                  haptic([20, 40, 20]);
                  onStart(t.plan, t.duration_minutes, t.target_muscles);
                }}
                aria-label={`Start ${t.name}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95"
              >
                <Play className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-[14px] text-muted-foreground">
          No saved templates yet — generate a plan, then tap "Save" before starting it.
        </p>
      )}
    </BottomSheet>
  );
}
