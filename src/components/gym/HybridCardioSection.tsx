import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "../../lib/gym/i18n";
import { splitTemplateById, type SplitTemplateId } from "../../lib/gym/splits";
import { haptic } from "../../lib/gym/store";
import type { CardioFinisher } from "../../lib/gym/types";
import { ActivityPicker, EffortPicker } from "./CardioControls";
import { CARDIO_ICONS } from "./cardioDisplay";
import { chip } from "./ui";

/** Lengths offered for the cardio block. Up to 30: longer cardio is where
 *  the interference with strength grows (Wilson et al., see splits.ts). */
const MINUTES = [10, 15, 20, 25, 30];

/**
 * The cardio after the lifting on each day of a hybrid plan, in the plan
 * builders. `value` holds every cardio day (splits.ts's templateCardio).
 */
export function HybridCardioSection({
  templateId,
  value,
  onChange,
}: {
  templateId: SplitTemplateId;
  value: Record<string, CardioFinisher>;
  onChange: (next: Record<string, CardioFinisher>) => void;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const days = splitTemplateById(templateId).days.filter((d) => value[d.id]);
  if (!days.length) return null;
  return (
    <div>
      <p className="mb-1 text-[13px] font-semibold text-muted-foreground">{t.cardio.hybridTitle}</p>
      <p className="mb-2 text-[12.5px] text-muted-foreground">{t.cardio.hybridWhy}</p>
      <div className="space-y-2">
        {days.map((day) => {
          const c = value[day.id]!;
          const Icon = CARDIO_ICONS[c.activity];
          const isOpen = open === day.id;
          const set = (patch: Partial<CardioFinisher>) =>
            onChange({ ...value, [day.id]: { ...c, ...patch } });
          return (
            <div key={day.id} className="rounded-2xl bg-foreground/[0.05]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : day.id)}
                aria-expanded={isOpen}
                className="flex min-h-[56px] w-full items-center gap-3 px-3 text-left"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{day.label}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {t.cardio.activities[c.activity]} · {t.cardio.min(c.minutes)} ·{" "}
                    {t.cardio.efforts[c.effort]}
                  </span>
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen ? (
                <div className="space-y-4 px-3 pb-3 pt-1">
                  <ActivityPicker value={c.activity} onChange={(activity) => set({ activity })} />
                  <EffortPicker value={c.effort} onChange={(effort) => set({ effort })} />
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
                      {t.cardio.minutes}
                    </p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {MINUTES.map((m) => (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={c.minutes === m}
                          onClick={() => {
                            haptic(10);
                            set({ minutes: m });
                          }}
                          className={`tabular min-h-[40px] rounded-xl text-[13.5px] font-semibold active:scale-95 ${
                            c.minutes === m ? chip.on : chip.off
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
