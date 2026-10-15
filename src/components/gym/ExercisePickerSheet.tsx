import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { SearchField } from "./SearchField";
import { SwitchRow } from "./SwitchRow";
import { badge, chip } from "./ui";
import { EQUIPMENT, MUSCLES } from "../../lib/gym/data";
import { muscleLabel } from "../../lib/gym/antagonist";
import { availableExercises } from "../../lib/gym/generator";
import { useExerciseCatalog } from "../../lib/gym/catalog";
import { useTranslation } from "../../lib/gym/i18n";
import { muscleIcon } from "../../lib/gym/muscleIcons";
import { haptic, useGym } from "../../lib/gym/store";
import type { Exercise, Muscle } from "../../lib/gym/types";

/** Pick one exercise for the DIY builder: search, a muscle filter, and by
 *  default only what the active gear allows (a switch shows the rest). The
 *  ones already in the workout carry a check but stay pickable. Closes on a
 *  pick. */
export function ExercisePickerSheet({
  open,
  onClose,
  onPick,
  inWorkoutIds,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (e: Exercise) => void;
  inWorkoutIds: readonly string[];
}) {
  const { profiles, activeProfileId, avoidedExerciseIds } = useGym();
  const t = useTranslation();
  const catalog = useExerciseCatalog();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [showAll, setShowAll] = useState(false);
  const equipment = profile.active_equipment_ids;

  const rows = useMemo(() => {
    const pool = showAll
      ? catalog.filter((e) => !avoidedExerciseIds.includes(e.id))
      : availableExercises(equipment, avoidedExerciseIds);
    const q = query.trim().toLowerCase();
    return pool
      .filter((e) => (muscle ? e.primary_muscle === muscle : true))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true));
    // The catalog is patched in place, so its length stands in for a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, catalog.length, showAll, equipment, avoidedExerciseIds, query, muscle]);
  const used = new Set(inWorkoutIds);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.diy.pickerTitle}
      fullHeight
      scrollKey={`${muscle}-${showAll}`}
      toolbar={
        <div className="space-y-3 pb-3">
          <SearchField value={query} onChange={setQuery} placeholder={t.diy.pickerSearch} />
          <div className="no-scrollbar -mx-5 -my-1 flex gap-1.5 overflow-x-auto px-5 py-1">
            {[null, ...MUSCLES].map((m) => (
              <button
                key={m ?? "all"}
                onClick={() => {
                  haptic(10);
                  setMuscle(m);
                }}
                aria-pressed={muscle === m}
                className={`${chip.base} ${muscle === m ? chip.on : chip.off}`}
              >
                {m ?? t.diy.pickerAll}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="glass overflow-hidden rounded-2xl">
          <SwitchRow
            label={t.diy.pickerShowAll}
            desc={t.diy.pickerShowAllDesc}
            ariaLabel={t.diy.pickerShowAll}
            on={showAll}
            onToggle={() => {
              haptic(12);
              setShowAll(!showAll);
            }}
          />
        </div>
        {rows.length ? (
          <div className="glass overflow-hidden rounded-2xl">
            {rows.map((e, i) => {
              const Icon = muscleIcon(e.primary_muscle);
              const gear = e.equipment_required
                .map((id) => EQUIPMENT.find((q) => q.id === id)?.label)
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={e.id}
                  onClick={() => {
                    haptic(15);
                    setQuery("");
                    onPick(e);
                  }}
                  className={`flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left active:bg-foreground/5 ${
                    i ? "border-t border-border" : ""
                  }`}
                >
                  <span aria-hidden className={`${badge.tonal} size-9`}>
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{e.name}</span>
                    <span
                      data-cut-ok
                      className="block truncate text-[12.5px] text-muted-foreground"
                    >
                      {[muscleLabel(e), gear].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {used.has(e.id) ? (
                    <Check
                      className="size-5 shrink-0 text-primary-text"
                      aria-label={t.diy.pickerInWorkout}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-[14px] text-muted-foreground">{t.diy.pickerNone}</p>
        )}
      </div>
    </BottomSheet>
  );
}
