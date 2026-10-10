import { Trophy } from "lucide-react";
import { Card } from "./Screen";
import { CardHead } from "./CardHead";
import { exerciseById } from "../../lib/gym/data";
import { useTranslation } from "../../lib/gym/i18n";
import { formatLoad, isBodyweightExercise } from "../../lib/gym/load";
import { muscleIcon } from "../../lib/gym/muscleIcons";
import type { LoggedSet } from "../../lib/gym/types";

/** One exercise's logged sets as shown in History: a card headed by the
 *  muscle-group icon, name and PR pill, then one row per set. Self-contained
 *  so a post-workout summary can reuse it. */
export function HistoryExerciseCard({
  exerciseId,
  name,
  muscle,
  rows,
  isPR,
  bestE1rm,
}: {
  exerciseId: string;
  name: string;
  muscle: string;
  rows: LoggedSet[];
  isPR: boolean;
  bestE1rm: number;
}) {
  const t = useTranslation();
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={muscleIcon(muscle)}
        title={name}
        subtitle={muscle}
        actions={
          isPR && !isBodyweightExercise(exerciseById(exerciseId)) ? (
            // On the band's accent tint a 15% accent pill left the text
            // at 4.17:1 in the light theme; the page colour behind it
            // gives the accent text its full contrast.
            <span className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-[13px] font-bold text-primary-text">
              <Trophy className="size-4" /> {t.historyDetail.pr(bestE1rm)}
            </span>
          ) : null
        }
      />

      <div className="space-y-1.5">
        {rows.map((s, i) => (
          <div
            key={`${s.set_number}-${i}`}
            className="grid grid-cols-[44px_1fr_1fr] items-center gap-2 rounded-xl bg-muted px-3 py-2"
          >
            <span className="tabular text-[13px] font-bold text-primary-text">
              {s.set_type === "warmup" ? "W" : s.set_number}
            </span>
            <span className="tabular text-[15px] font-semibold">
              {formatLoad(
                s.weight,
                isBodyweightExercise(exerciseById(s.exercise_id)),
                t.session.bw,
              )}
            </span>
            <span className="tabular text-right text-[15px] font-semibold">
              {t.historyDetail.reps(s.reps)}
              {s.rpe ? <span className="text-primary-text"> @{s.rpe}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
