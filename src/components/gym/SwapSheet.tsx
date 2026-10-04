import { useEffect, useState } from "react";
import { AlertTriangle, Repeat } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { EQUIPMENT, exerciseById } from "../../lib/gym/data";
import { alternativesFor, availableExercises } from "../../lib/gym/generator";
import { antagonistAlternatives, isAntagonistPair, opposingLabel } from "../../lib/gym/antagonist";
import { sharesLoadStation } from "../../lib/gym/stations";
import { useTranslation } from "../../lib/gym/i18n";
import { useGym } from "../../lib/gym/store";
import type { Exercise } from "../../lib/gym/types";

function Row({
  e,
  onPick,
  clash,
}: {
  e: Exercise;
  onPick: (e: Exercise) => void;
  /** Shown when this exercise shares its superset partner's equipment. */
  clash?: string;
}) {
  return (
    <button
      onClick={() => onPick(e)}
      className="glass flex min-h-[56px] w-full items-center justify-between rounded-2xl p-4 text-left active:scale-[0.985]"
    >
      <div className="min-w-0">
        <p className="truncate text-[17px] font-semibold">{e.name}</p>
        <p data-cut-ok className="truncate text-[13px] text-muted-foreground">
          {e.equipment_required.map((id) => EQUIPMENT.find((q) => q.id === id)?.label).join(" · ")}
        </p>
        {clash ? <p className="text-[13px] text-warning-text">{clash}</p> : null}
      </div>
      <Repeat className="ml-3 size-5 shrink-0 text-primary-text" />
    </button>
  );
}

export function SwapSheet({
  exerciseId,
  partnerExerciseId,
  pairedExerciseId,
  onClose,
  onPick,
}: {
  exerciseId: string | null;
  /** The other half of an antagonist superset, when swapping inside a pair. */
  partnerExerciseId?: string | null;
  /** The other half of a superset, where the list should stay same-muscle
   *  (a generated plan): only used to keep its equipment out of the
   *  suggestions. `partnerExerciseId` does this too. */
  pairedExerciseId?: string | null;
  onClose: () => void;
  onPick: (e: Exercise) => void;
}) {
  const { profiles, activeProfileId, avoidedExerciseIds } = useGym();
  const t = useTranslation();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const current = exerciseId ? exerciseById(exerciseId) : undefined;
  const partner = partnerExerciseId ? exerciseById(partnerExerciseId) : undefined;
  const pool = availableExercises(profile.active_equipment_ids, avoidedExerciseIds);

  // In a superset, an exercise on the partner's equipment (the same barbell,
  // dumbbells, cable stack…) would mean changing the weight every round
  // (stations.ts), so it's never suggested: it's left out of the
  // recommendations, listed last with a note, and asks before it's used.
  const pairWith = partner ?? (pairedExerciseId ? exerciseById(pairedExerciseId) : undefined);
  const clashes = (e: Exercise) => !!pairWith && sharesLoadStation(pairWith, e);

  const [pending, setPending] = useState<{ e: Exercise; reason: "station" | "antagonist" } | null>(
    null,
  );
  useEffect(() => {
    if (!exerciseId) setPending(null);
  }, [exerciseId]);

  const sameMuscle = current
    ? alternativesFor(current, profile.active_equipment_ids, avoidedExerciseIds)
    : [];
  const recommended = partner
    ? antagonistAlternatives(partner, pool).filter((e) => !clashes(e))
    : [];
  const recommendedIds = new Set(recommended.map((e) => e.id));
  // Never the partner itself: both halves would be the same exercise.
  const listed = (partner ? pool : sameMuscle).filter(
    (e) => e.id !== current?.id && e.id !== pairWith?.id && !recommendedIds.has(e.id),
  );
  const others = [...listed.filter((e) => !clashes(e)), ...listed.filter(clashes)];
  // What to offer instead of a pick that clashes or breaks the pattern.
  const better = (partner ? recommended : others.filter((e) => !clashes(e))).slice(0, 3);

  const choose = (e: Exercise) => {
    if (clashes(e)) {
      setPending({ e, reason: "station" });
      return;
    }
    if (partner && !isAntagonistPair(partner, e)) {
      setPending({ e, reason: "antagonist" });
      return;
    }
    onPick(e);
  };

  return (
    <BottomSheet open={!!exerciseId} onClose={onClose} title={t.swapSheet.title}>
      {pending && pairWith ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-warning/50 bg-warning/10 p-4">
            <p className="flex items-center gap-2 text-[15px] font-bold text-warning-text">
              <AlertTriangle className="size-5" />{" "}
              {pending.reason === "station"
                ? t.swapSheet.sameEquipment
                : t.swapSheet.antagonistMismatch}
            </p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              {pending.reason === "station"
                ? t.swapSheet.sameEquipmentBody(pending.e.name, pairWith.name)
                : t.swapSheet.antagonistMismatchBody(
                    pending.e.name,
                    pairWith.primary_muscle,
                    opposingLabel(pairWith).toLowerCase(),
                  )}
            </p>
          </div>

          {better.length ? (
            <div className="space-y-2">
              <p className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                {partner ? t.swapSheet.recommendedSwaps : t.swapSheet.otherEquipment}
              </p>
              {better.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onPick(e)}
                  className="glass flex min-h-[52px] w-full items-center justify-between rounded-2xl px-4 text-left text-[16px] font-semibold active:scale-[0.985]"
                >
                  {t.swapSheet.swapTo(e.name)}
                  <Repeat className="ml-3 size-5 shrink-0 text-primary-text" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            {pending.reason === "antagonist" && recommended[0] ? (
              <button
                onClick={() => onPick(recommended[0]!)}
                className="min-h-[52px] w-full rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95"
              >
                {t.swapSheet.applyRecommended}
              </button>
            ) : null}
            <button
              onClick={() => onPick(pending.e)}
              className="glass min-h-[52px] w-full rounded-2xl text-[16px] font-semibold active:scale-95"
            >
              {pending.reason === "station"
                ? t.swapSheet.keepSameEquipment
                : t.swapSheet.keepAnyway}
            </button>
            <button
              onClick={() => setPending(null)}
              className="min-h-[44px] w-full text-[15px] font-semibold text-muted-foreground active:scale-95"
            >
              {t.swapSheet.backToList}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {partner ? (
            <>
              <p className="mb-1 text-[13px] text-muted-foreground">
                {t.swapSheet.pairedWith(partner.name)}
              </p>
              <p className="pt-1 text-[12px] font-bold uppercase tracking-widest text-primary-text">
                {t.swapSheet.recommendedAlternatives}
              </p>
              {recommended.length ? (
                recommended.map((e) => <Row key={e.id} e={e} onPick={choose} />)
              ) : (
                <p className="text-[14px] text-muted-foreground">{t.swapSheet.noOpposingOptions}</p>
              )}
              <p className="pt-3 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                {t.swapSheet.otherExercises}
              </p>
            </>
          ) : (
            <p className="mb-3 text-[13px] text-muted-foreground">
              {t.swapSheet.sameMuscleOnly(current?.primary_muscle ?? "", profile.name)}
            </p>
          )}
          {others.length === 0 && !partner ? (
            <p className="text-[14px] text-muted-foreground">{t.swapSheet.noAlternatives}</p>
          ) : null}
          {others.map((e) => (
            <Row
              key={e.id}
              e={e}
              onPick={choose}
              {...(clashes(e) && pairWith
                ? { clash: t.swapSheet.sameEquipmentAs(pairWith.name) }
                : {})}
            />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
