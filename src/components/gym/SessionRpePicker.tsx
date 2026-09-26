import { useTranslation } from "../../lib/gym/i18n";
import { haptic } from "../../lib/gym/store";
import { SESSION_RPE_ANCHORS } from "../../lib/gym/trainingLoad";

/** 0–10 on Foster's modified CR-10 scale; the selected value's verbal anchor
 *  is shown underneath (6, 8 and 9 have none on the scale). */
export function SessionRpePicker({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (rpe: number) => void;
}) {
  const t = useTranslation();
  const anchor = value == null ? undefined : SESSION_RPE_ANCHORS[value];
  return (
    <div>
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            onClick={() => {
              haptic(10);
              onChange(n);
            }}
            aria-pressed={value === n}
            aria-label={t.trainingLoad.rateAria(n)}
            className={`tabular flex h-11 items-center justify-center rounded-lg text-[15px] font-bold active:scale-95 ${
              value === n
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-muted-foreground">
        <span>{t.trainingLoad.anchors.rest}</span>
        <span className="font-semibold text-foreground">
          {anchor ? t.trainingLoad.anchors[anchor as keyof typeof t.trainingLoad.anchors] : ""}
        </span>
        <span>{t.trainingLoad.anchors.maximal}</span>
      </div>
    </div>
  );
}
