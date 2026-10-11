import { CARDIO_DAY_ID } from "../../lib/gym/schedule";
import {
  DEFAULT_CARDIO_DAY,
  dayTypeOptions,
  distinctDays,
  type SplitDay,
  type SplitTemplateId,
} from "../../lib/gym/splits";
import { haptic } from "../../lib/gym/store";
import { useTranslation } from "../../lib/gym/i18n";
import type { CardioFinisher } from "../../lib/gym/types";
import { CardioDayControls } from "./CardioControls";
import { chip } from "./ui";

/** Picks which kind of day one session is: first the split's own day types
 *  (Upper, Lower…), then every other kind (Push, Cardio…) under their own
 *  label, so any day of any plan can be changed to any type. Pass `cardio`
 *  and `onCardioChange` where the day already exists and a picked cardio day
 *  should show what it plans (activity, effort, minutes) to change in place. */
export function DayTypePicker({
  templateId,
  value,
  onChange,
  cardio,
  onCardioChange,
}: {
  templateId: SplitTemplateId;
  value: string;
  onChange: (dayId: string) => void;
  cardio?: CardioFinisher | undefined;
  onCardioChange?: ((cardio: CardioFinisher) => void) | undefined;
}) {
  const t = useTranslation();
  const options = dayTypeOptions(templateId);
  const ownCount = distinctDays(templateId).length;
  const chips = (days: SplitDay[]) => (
    <div className="grid grid-cols-2 gap-x-1.5 gap-y-2">
      {days.map((d) => (
        <button
          key={d.id}
          role="radio"
          aria-checked={d.id === value}
          onClick={() => {
            haptic(10);
            onChange(d.id);
          }}
          className={`tap-target min-h-[36px] rounded-xl px-2 text-[13px] font-semibold ${
            d.id === value ? chip.on : chip.off
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={t.programBuilder.sessionType} className="space-y-2">
        {chips(options.slice(0, ownCount))}
        <p className="pt-1 text-[12.5px] font-semibold text-muted-foreground">
          {t.programBuilder.otherDayTypes}
        </p>
        {chips(options.slice(ownCount))}
      </div>
      {value === CARDIO_DAY_ID && onCardioChange ? (
        <CardioDayControls value={cardio ?? DEFAULT_CARDIO_DAY} onChange={onCardioChange} />
      ) : null}
    </div>
  );
}
