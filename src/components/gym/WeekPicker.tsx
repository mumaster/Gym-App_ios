import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays } from "../../lib/gym/date";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { mondayOf } from "../../lib/gym/schedule";
import { button } from "./ui";

const weekRangeLabel = (monday: Date, locale: string) => {
  const short = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return `${short(monday)} – ${short(addDays(monday, 6))}`;
};

/** Steps the Activity tab's week cards back and forward; never past this week. */
export function WeekPicker({
  monday,
  canPrev,
  canNext,
  onPrev,
  onNext,
  className = "",
}: {
  monday: Date;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string | undefined;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const weeksAgo = Math.round(
    (mondayOf(new Date()).getTime() - monday.getTime()) / (7 * 86_400_000),
  );
  const title =
    weeksAgo === 0
      ? t.weekRecap.thisWeek
      : weeksAgo === 1
        ? t.weekRecap.lastWeek
        : t.weekRecap.weekOf(monday.toLocaleDateString(locale, { day: "numeric", month: "short" }));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label={t.weekRecap.prevWeek}
        className={`${button.icon} disabled:opacity-30`}
      >
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <div className="min-w-0 flex-1 text-center" aria-live="polite">
        <p className="text-[15px] font-bold leading-tight">{title}</p>
        <p className="tabular text-[12px] text-muted-foreground">
          {weekRangeLabel(monday, locale)}
        </p>
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label={t.weekRecap.nextWeek}
        className={`${button.icon} disabled:opacity-30`}
      >
        <ChevronRight aria-hidden className="size-5" />
      </button>
    </div>
  );
}
