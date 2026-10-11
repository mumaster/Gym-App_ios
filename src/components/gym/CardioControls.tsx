import { CARDIO_ICONS } from "./cardioDisplay";
import { CARDIO_ACTIVITIES, CARDIO_EFFORTS } from "../../lib/gym/cardio";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic } from "../../lib/gym/store";
import type { CardioActivity, CardioEffort, CardioFinisher } from "../../lib/gym/types";
import { chip as chipStyle } from "./ui";

const chip = (on: boolean) =>
  `tap-target min-h-[40px] rounded-2xl px-3 text-[13.5px] font-semibold active:scale-95 ${
    on ? chipStyle.on : chipStyle.off
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

/** Lengths offered for a cardio day: longer than the cardio block after
 *  lifting (HybridCardioSection), since the day is only cardio. */
const CARDIO_DAY_MINUTES = [20, 30, 45, 60, 90];

/** A row of minute lengths to pick from. */
export function MinutesPicker({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (minutes: number) => void;
}) {
  const t = useTranslation();
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{t.cardio.minutes}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {options.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={value === m}
            onClick={() => {
              haptic(10);
              onChange(m);
            }}
            className={`tabular tap-target min-h-[40px] rounded-xl text-[13.5px] font-semibold active:scale-95 ${
              value === m ? chipStyle.on : chipStyle.off
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

/** What a cardio day plans: activity, effort and minutes, changed in place. */
export function CardioDayControls({
  value,
  onChange,
}: {
  value: CardioFinisher;
  onChange: (next: CardioFinisher) => void;
}) {
  const t = useTranslation();
  return (
    <div className="space-y-4 rounded-xl bg-foreground/[0.05] p-3">
      <p className="text-[13px] font-semibold">{t.cardio.dayPlanTitle}</p>
      <ActivityPicker
        value={value.activity}
        onChange={(activity) => onChange({ ...value, activity })}
      />
      <EffortPicker value={value.effort} onChange={(effort) => onChange({ ...value, effort })} />
      <MinutesPicker
        value={value.minutes}
        options={CARDIO_DAY_MINUTES}
        onChange={(minutes) => onChange({ ...value, minutes })}
      />
    </div>
  );
}
