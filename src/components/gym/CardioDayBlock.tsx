import { useTranslation } from "../../lib/gym/i18n";
import type { CardioFinisher } from "../../lib/gym/types";
import { CARDIO_ICONS, cardioPlanLine } from "./cardioDisplay";
import { badge, button } from "./ui";

/** A plan card's body when its next session is a cardio day: what's planned
 *  ("Run · Moderate · 30 min") and the one action, which opens the cardio
 *  log on that plan. It stands in for the session length and the Build
 *  button, since nothing is generated for a cardio day. */
export function CardioDayBlock({ plan, onLog }: { plan: CardioFinisher; onLog: () => void }) {
  const t = useTranslation();
  const Icon = CARDIO_ICONS[plan.activity];
  return (
    <>
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-foreground/[0.05] p-3">
        <span className={`${badge.tonal} size-9`}>
          <Icon className="size-4" />
        </span>
        <p className="min-w-0 text-[15px] font-semibold">{cardioPlanLine(plan, t)}</p>
      </div>
      <button onClick={onLog} className={`${button.primary} mt-3 w-full`}>
        <Icon className="size-4" /> {t.cardio.log}
      </button>
    </>
  );
}
