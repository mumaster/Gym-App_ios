import { haptic } from "../../lib/gym/store";
import { useTranslation } from "../../lib/gym/i18n";
import { chip } from "./ui";

/** Fixed days / Flexible choice at the top of a plan's day editor. */
export function RotationModeSwitch({
  flexible,
  onChange,
}: {
  flexible: boolean;
  onChange: (flexible: boolean) => void;
}) {
  const t = useTranslation().common.scheduleMode;
  return (
    <div className="space-y-1.5">
      <div role="radiogroup" aria-label={t.label} className="flex gap-1.5">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            role="radio"
            aria-checked={flexible === value}
            onClick={() => {
              haptic(10);
              onChange(value);
            }}
            className={`tap-target min-h-[36px] flex-1 rounded-xl text-[13px] font-semibold ${
              flexible === value ? chip.on : chip.off
            }`}
          >
            {value ? t.flexible : t.fixed}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground">{flexible ? t.flexibleHint : t.fixedHint}</p>
    </div>
  );
}
