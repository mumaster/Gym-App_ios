import { Layers } from "lucide-react";
import { exerciseById } from "../../lib/gym/data";
import { formatPlates, solvePlates } from "../../lib/gym/plates";
import { useGym } from "../../lib/gym/store";

/** Shows how to load a barbell / smith bar / loadable dumbbell for a target weight. */
export function PlateHint({ exerciseId, target }: { exerciseId: string; target: number }) {
  const { profiles, activeProfileId } = useGym();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const exercise = exerciseById(exerciseId);
  if (!profile || !exercise) return null;

  const gear = exercise.equipment_required;
  const isBar = gear.includes("barbell") || gear.includes("smith");
  const isDumbbell = gear.includes("dumbbell");
  if (!isBar && !isDumbbell) return null;

  const bar = isBar ? profile.bar_weight : profile.dumbbell_bar_weight;
  if (!Number.isFinite(target) || target <= bar) return null;
  const solution = solvePlates(target, bar, profile.plates);
  if (!solution) return null;

  return (
    <div className="mt-2 flex items-start gap-2 rounded-2xl bg-muted px-4 py-3">
      <Layers className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="text-[13px] leading-snug text-muted-foreground">
        <span className="font-semibold text-foreground">
          {solution.total} kg {isDumbbell && !isBar ? "per dumbbell" : ""}
        </span>{" "}
        = {bar} kg bar + {formatPlates(solution.perSide)} per side
        {solution.exact ? "" : ` · closest loadable to ${target} kg with your plates`}
      </p>
    </div>
  );
}
