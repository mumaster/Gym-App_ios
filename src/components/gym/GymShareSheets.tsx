import { useMemo } from "react";
import { button } from "./ui";
import { BottomSheet } from "./BottomSheet";
import { ShareQrSheet } from "./MealShareSheets";
import { EQUIPMENT } from "../../lib/gym/data";
import { decodeGym, gymShareUrl, type SharedGym } from "../../lib/gym/equipmentShare";
import { availableExercises } from "../../lib/gym/generator";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic, useGym } from "../../lib/gym/store";

/** A gym's QR plus the iOS share sheet (Equipment → share). */
export function ShareGymSheet({ gym, onClose }: { gym: SharedGym | null; onClose: () => void }) {
  const t = useTranslation();
  return (
    <ShareQrSheet
      open={gym != null}
      title={gym ? t.gymShare.title(gym.name) : ""}
      label={gym?.name ?? ""}
      url={gym ? gymShareUrl(gym, window.location.origin) : ""}
      hint={t.gymShare.hint}
      shareText={gym ? t.gymShare.shareText(gym.name) : ""}
      onClose={onClose}
    />
  );
}

/** Opens on a scanned or tapped gym link: shows what's in it and adds it as
 *  a new equipment profile (never replacing one of yours). */
export function ImportGymSheet({
  code,
  onClose,
  onAdded,
}: {
  code: string | null;
  onClose: () => void;
  /** The new profile's id, so the screen can switch to it. */
  onAdded: (id: string) => void;
}) {
  const t = useTranslation();
  const { profiles, update } = useGym();
  const gym = useMemo(() => (code ? decodeGym(code) : null), [code]);
  const unlocked = useMemo(
    () => (gym ? availableExercises(gym.active_equipment_ids, []).length : 0),
    [gym],
  );

  const add = (use: boolean) => {
    if (!gym) return;
    haptic(15);
    const id = crypto.randomUUID();
    update({
      profiles: [...profiles, { id, ...gym }],
      ...(use ? { activeProfileId: id } : {}),
    });
    onAdded(id);
    onClose();
  };

  return (
    <BottomSheet open={code != null} onClose={onClose} title={gym?.name ?? t.gymShare.importTitle}>
      {gym ? (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {t.gymShare.items(gym.active_equipment_ids.length)} · {t.gymShare.unlocks(unlocked)}
          </p>
          <div className="overflow-hidden rounded-2xl bg-muted/50">
            {gym.active_equipment_ids.map((id, i) => (
              <div
                key={id}
                className={`px-3.5 py-2.5 text-[15px] font-semibold ${i > 0 ? "border-t border-border" : ""}`}
              >
                {EQUIPMENT.find((e) => e.id === id)?.label ?? id}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <button onClick={() => add(true)} className={`${button.primary} w-full`}>
              {t.gymShare.addAndUse}
            </button>
            <button onClick={() => add(false)} className={`${button.secondary} w-full`}>
              {t.gymShare.add}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[14px] text-muted-foreground">{t.mealShare.invalid}</p>
      )}
    </BottomSheet>
  );
}
