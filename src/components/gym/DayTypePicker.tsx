import { distinctDays, type SplitTemplateId } from "../../lib/gym/splits";
import { haptic } from "../../lib/gym/store";
import { useTranslation } from "../../lib/gym/i18n";
import { chip } from "./ui";

/** Picks which of a split's day types (Upper, Lower…) one session trains.
 *  Renders nothing for a split with a single day type, like Full Body. */
export function DayTypePicker({
  templateId,
  value,
  onChange,
}: {
  templateId: SplitTemplateId;
  value: string;
  onChange: (dayId: string) => void;
}) {
  const t = useTranslation();
  const days = distinctDays(templateId);
  if (days.length < 2) return null;
  return (
    <div
      role="radiogroup"
      aria-label={t.programBuilder.sessionType}
      className="flex flex-wrap gap-1.5"
    >
      {days.map((d) => (
        <button
          key={d.id}
          role="radio"
          aria-checked={d.id === value}
          onClick={() => {
            haptic(10);
            onChange(d.id);
          }}
          className={`tap-target min-h-[36px] flex-1 rounded-xl px-2 text-[13px] font-semibold ${
            d.id === value ? chip.on : chip.off
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
