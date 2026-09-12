import { useEffect, useState } from "react";
import { AlertTriangle, Repeat } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { EQUIPMENT, exerciseById } from "../../lib/gym/data";
import { alternativesFor, availableExercises } from "../../lib/gym/generator";
import {
  antagonistAlternatives,
  isAntagonistPair,
  opposingLabel,
} from "../../lib/gym/antagonist";
import { useGym } from "../../lib/gym/store";
import type { Exercise } from "../../lib/gym/types";

function Row({ e, onPick }: { e: Exercise; onPick: (e: Exercise) => void }) {
  return (
    <button
      onClick={() => onPick(e)}
      className="glass flex min-h-[56px] w-full items-center justify-between rounded-2xl p-4 text-left active:scale-[0.985]"
    >
      <div className="min-w-0">
        <p className="truncate text-[17px] font-semibold">{e.name}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          {e.equipment_required.map((id) => EQUIPMENT.find((q) => q.id === id)?.label).join(" · ")}
        </p>
      </div>
      <Repeat className="ml-3 size-5 shrink-0 text-primary" />
    </button>
  );
}

export function SwapSheet({
  exerciseId,
  partnerExerciseId,
  onClose,
  onPick,
}: {
  exerciseId: string | null;
  /** The other half of an antagonist superset, when swapping inside a pair. */
  partnerExerciseId?: string | null;
  onClose: () => void;
  onPick: (e: Exercise) => void;
}) {
  const { profiles, activeProfileId } = useGym();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const current = exerciseId ? exerciseById(exerciseId) : undefined;
  const partner = partnerExerciseId ? exerciseById(partnerExerciseId) : undefined;
  const pool = availableExercises(profile.active_equipment_ids);

  const [pending, setPending] = useState<Exercise | null>(null);
  useEffect(() => {
    if (!exerciseId) setPending(null);
  }, [exerciseId]);

  const sameMuscle = current ? alternativesFor(current, profile.active_equipment_ids) : [];
  const recommended = partner ? antagonistAlternatives(partner, pool) : [];
  const recommendedIds = new Set(recommended.map((e) => e.id));
  const others = (partner ? pool : sameMuscle).filter(
    (e) => e.id !== current?.id && !recommendedIds.has(e.id),
  );

  const choose = (e: Exercise) => {
    if (partner && !isAntagonistPair(partner, e)) {
      setPending(e);
      return;
    }
    onPick(e);
  };

  return (
    <BottomSheet open={!!exerciseId} onClose={onClose} title="Swap exercise">
      {pending && partner ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4">
            <p className="flex items-center gap-2 text-[15px] font-bold text-amber-300">
              <AlertTriangle className="size-5" /> Antagonist pattern mismatch
            </p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Selecting <span className="font-semibold text-foreground">{pending.name}</span> breaks
              the antagonist (push/pull) protocol for{" "}
              <span className="font-semibold text-foreground">{partner.primary_muscle}</span>. Pair
              it with a {opposingLabel(partner).toLowerCase()} exercise instead.
            </p>
          </div>

          {recommended.slice(0, 3).length ? (
            <div className="space-y-2">
              <p className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                Recommended antagonist swaps
              </p>
              {recommended.slice(0, 3).map((e) => (
                <button
                  key={e.id}
                  onClick={() => onPick(e)}
                  className="glass glow flex min-h-[52px] w-full items-center justify-between rounded-2xl px-4 text-left text-[16px] font-semibold active:scale-[0.985]"
                >
                  Swap to {e.name}
                  <Repeat className="ml-3 size-5 shrink-0 text-primary" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            {recommended[0] ? (
              <button
                onClick={() => onPick(recommended[0]!)}
                className="min-h-[52px] w-full rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95"
              >
                Apply recommended antagonist swap
              </button>
            ) : null}
            <button
              onClick={() => onPick(pending)}
              className="glass min-h-[52px] w-full rounded-2xl text-[16px] font-semibold active:scale-95"
            >
              Keep different muscle anyway
            </button>
            <button
              onClick={() => setPending(null)}
              className="min-h-[44px] w-full text-[15px] font-semibold text-muted-foreground active:scale-95"
            >
              Back to list
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {partner ? (
            <>
              <p className="mb-1 text-[13px] text-muted-foreground">
                Paired with{" "}
                <span className="font-semibold text-foreground">{partner.name}</span> — keep the
                push/pull balance.
              </p>
              <p className="pt-1 text-[12px] font-bold uppercase tracking-widest text-primary">
                Recommended antagonist alternatives
              </p>
              {recommended.length ? (
                recommended.map((e) => <Row key={e.id} e={e} onPick={choose} />)
              ) : (
                <p className="text-sm text-muted-foreground">
                  No opposing-muscle options with this equipment profile.
                </p>
              )}
              <p className="pt-3 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                Other exercises
              </p>
            </>
          ) : (
            <p className="mb-3 text-[13px] text-muted-foreground">
              Same primary muscle ({current?.primary_muscle}), only gear available in {profile.name}
              .
            </p>
          )}
          {others.length === 0 && !partner ? (
            <p className="text-sm text-muted-foreground">
              No alternatives with this equipment profile.
            </p>
          ) : null}
          {others.map((e) => (
            <Row key={e.id} e={e} onPick={choose} />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
