import { Info } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";

/** A pill under the weekday chips while fewer days are picked than the split
 *  needs to reach each of its day types once (`minDaysPerWeek`). */
export function MinDaysNotice({
  picked,
  min,
  label,
}: {
  picked: number;
  min: number;
  label: string;
}) {
  const t = useTranslation();
  if (picked >= min) return null;
  return (
    <p
      role="status"
      className="mt-2.5 flex items-start gap-1.5 rounded-2xl bg-primary/10 px-3 py-2 text-[12.5px] font-medium text-primary-text"
    >
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {t.weeklyPlan.minDaysNotice(label, min)}
    </p>
  );
}
