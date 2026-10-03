import { CARDIO_ICONS } from "./cardioDisplay";
import { CARDIO_ACTIVITIES, CARDIO_EFFORTS } from "../../lib/gym/cardio";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic } from "../../lib/gym/store";
import type { CardioActivity, CardioEffort } from "../../lib/gym/types";
import { chip as chipStyle } from "./ui";

const chip = (on: boolean) =>
  `tap-target min-h-[40px] rounded-2xl px-3 text-[13.5px] font-semibold active:scale-95 ${
    on ? chipStyle.on : "bg-secondary text-secondary-foreground"
  }`;

export function ActivityPicker({
  value,
  onChange,
}: {
  value: CardioActivity | null;
  onChange: (a: CardioActivity) => void;
}) {
  const t = useTranslation();
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{t.cardio.activity}</p>
      <div className="flex flex-wrap gap-2">
        {CARDIO_ACTIVITIES.map((a) => {
          const Icon = CARDIO_ICONS[a];
          return (
            <button
              key={a}
              type="button"
              aria-pressed={value === a}
              onClick={() => {
                haptic(10);
                onChange(a);
              }}
              className={`flex items-center gap-1.5 ${chip(value === a)}`}
            >
              <Icon className="size-4" /> {t.cardio.activities[a]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EffortPicker({
  value,
  onChange,
}: {
  value: CardioEffort | null;
  onChange: (e: CardioEffort) => void;
}) {
  const t = useTranslation();
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{t.cardio.effort}</p>
      <div className="grid grid-cols-3 gap-2">
        {CARDIO_EFFORTS.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={value === e}
            onClick={() => {
              haptic(10);
              onChange(e);
            }}
            className={chip(value === e)}
          >
            {t.cardio.efforts[e]}
          </button>
        ))}
      </div>
    </div>
  );
}
