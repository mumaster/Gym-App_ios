import { useEffect, useState } from "react";
import { AlertTriangle, Repeat } from "lucide-react";
import { badge, button } from "./ui";
import { ListCard } from "./ListCard";
import { BottomSheet } from "./BottomSheet";
import { EQUIPMENT, exerciseById } from "../../lib/gym/data";
import { alternativesFor, availableExercises } from "../../lib/gym/generator";
import {
  antagonistAlternatives,
  isAntagonistPair,
  muscleLabel,
  opposingLabel,
  sameMuscleSwaps,
} from "../../lib/gym/antagonist";
import { muscleIcon } from "../../lib/gym/muscleIcons";
import { sharesLoadStation } from "../../lib/gym/stations";
import { useTranslation } from "../../lib/gym/i18n";
import { useGym } from "../../lib/gym/store";
import type { Exercise } from "../../lib/gym/types";

/** "Chest · Barbell · Bench": the muscle first, then the gear needed. */
const subtitleOf = (e: Exercise) =>
  [muscleLabel(e), ...e.equipment_required.map((id) => EQUIPMENT.find((q) => q.id === id)?.label)]
    .filter(Boolean)
    .join(" · ");

function MuscleTile({ e }: { e: Exercise }) {
  const Icon = muscleIcon(e.primary_muscle);
  return (
    <span aria-hidden className={`${badge.tonal} size-9`}>
      <Icon className="size-[18px]" />
    </span>
  );
}

function Row({
  e,
  onPick,
  clash,
  variant = "glass",
}: {
  e: Exercise;
  onPick: (e: Exercise) => void;
  /** Shown when this exercise shares its superset partner's equipment. */
  clash?: string;
  /** "card" is a row inside a ListCard: no surface of its own, a hairline
   *  above it (like the Exercises tab). */
  variant?: "glass" | "card";
}) {
  return (
    <button
      onClick={() => onPick(e)}
      className={`flex min-h-[56px] w-full items-center gap-3 text-left active:scale-[0.985] ${
        variant === "card" ? "border-t border-border px-4 py-2" : "glass rounded-2xl p-4"
      }`}
    >
      <MuscleTile e={e} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold">{e.name}</p>
        <p data-cut-ok className="truncate text-[13px] text-muted-foreground">
          {subtitleOf(e)}
        </p>
        {clash ? <p className="text-[13px] text-warning-text">{clash}</p> : null}
      </div>
      <Repeat className="size-5 shrink-0 text-primary-text" />
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
  // Shown first in a superset: the swaps that keep the muscle and still pair
  // with the partner. They're taken out of the lists below, so nothing shows
  // twice.
  const keepMuscle =
    current && partner
      ? sameMuscleSwaps(current, partner, sameMuscle).filter((e) => !clashes(e))
      : [];
  const keepMuscleIds = new Set(keepMuscle.map((e) => e.id));
  const recommendedShown = recommended.filter((e) => !keepMuscleIds.has(e.id));
  // Never the partner itself: both halves would be the same exercise.
  const listed = (partner ? pool : sameMuscle).filter(
    (e) => e.id !== current?.id && e.id !== pairWith?.id && !recommendedIds.has(e.id),
  );
  const others = [...listed.filter((e) => !clashes(e)), ...listed.filter(clashes)];
  // Without a partner the whole list is the same muscle: the card holds the
  // ones that fit, the clashing ones follow it with their note.
  const cardRows = partner ? keepMuscle : others.filter((e) => !clashes(e));
  const afterCard = partner ? others : others.filter(clashes);
  // Arms is one group in the data; the card names the exercise's own muscle
  // when it's a partner swap (Triceps), the group otherwise (it holds both).
  const cardTitle = current ? (partner ? muscleLabel(current) : current.primary_muscle) : "";
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
                  className="glass flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 py-2 text-left active:scale-[0.985]"
                >
                  <MuscleTile e={e} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">
                      {t.swapSheet.swapTo(e.name)}
                    </span>
                    <span data-cut-ok className="block truncate text-[13px] text-muted-foreground">
                      {muscleLabel(e)}
                    </span>
                  </span>
                  <Repeat className="size-5 shrink-0 text-primary-text" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            {pending.reason === "antagonist" && recommended[0] ? (
              <button
                onClick={() => onPick(recommended[0]!)}
                className={`${button.primary} w-full`}
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
            <p className="mb-1 text-[13px] text-muted-foreground">
              {t.swapSheet.pairedWith(partner.name)}
            </p>
          ) : (
            <p className="mb-3 text-[13px] text-muted-foreground">
              {t.swapSheet.sameMuscleOnly(current?.primary_muscle ?? "", profile.name)}
            </p>
          )}
          {current && cardRows.length ? (
            <ListCard
              icon={muscleIcon(current.primary_muscle)}
              title={cardTitle}
              subtitle={t.swapSheet.sameMuscleAs(current.name)}
              filled
            >
              {cardRows.map((e) => (
                <Row key={e.id} e={e} onPick={choose} variant="card" />
              ))}
            </ListCard>
          ) : null}
          {partner ? (
            <>
              {recommendedShown.length || !keepMuscle.length ? (
                <p className="pt-1 text-[12px] font-bold uppercase tracking-widest text-primary-text">
                  {t.swapSheet.recommendedAlternatives}
                </p>
              ) : null}
              {recommendedShown.map((e) => (
                <Row key={e.id} e={e} onPick={choose} />
              ))}
              {!recommended.length ? (
                <p className="text-[14px] text-muted-foreground">{t.swapSheet.noOpposingOptions}</p>
              ) : null}
              <p className="pt-3 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                {t.swapSheet.otherExercises}
              </p>
            </>
          ) : null}
          {others.length === 0 && !partner ? (
            <p className="text-[14px] text-muted-foreground">{t.swapSheet.noAlternatives}</p>
          ) : null}
          {afterCard.map((e) => (
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
