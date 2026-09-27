import { Flame, HeartPulse, Timer, Watch } from "lucide-react";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import type { WatchData } from "../../lib/gym/types";
import { formatDuration } from "../../lib/gym/watch";

/** A watch's own record of one session, as read from its app's screenshots:
 *  headline numbers, minutes per heart-rate zone, training-effect scores,
 *  recovery, and anything else it printed. Every figure is the watch's —
 *  Forge computes nothing here. */
export function WatchDataCard({ data }: { data: WatchData }) {
  const t = useTranslation();
  const locale = useLocale();
  const fmt = (n: number) => n.toLocaleString(locale);
  const stats = [
    data.durationSeconds != null
      ? {
          icon: Timer,
          label: t.watch.duration,
          value: formatDuration(data.durationSeconds),
          sub: null,
        }
      : null,
    data.activeKcal != null || data.totalKcal != null
      ? {
          icon: Flame,
          label: t.watch.activeKcal,
          value: fmt(data.activeKcal ?? data.totalKcal!),
          sub:
            data.activeKcal != null && data.totalKcal != null
              ? t.watch.totalKcal(data.totalKcal)
              : null,
        }
      : null,
    data.avgHr != null
      ? { icon: HeartPulse, label: t.watch.avgHr, value: `${data.avgHr}`, sub: t.watch.bpm }
      : null,
    data.maxHr != null
      ? {
          icon: HeartPulse,
          label: t.watch.maxHr,
          value: `${data.maxHr}`,
          sub: data.minHr != null ? t.watch.minHr(data.minHr) : t.watch.bpm,
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
  const maxZone = Math.max(1, ...data.hrZones.map((z) => z.minutes));

  return (
    <div className="space-y-4">
      {data.device || data.activity ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <Watch className="size-3.5 shrink-0" />
          <span className="truncate">
            {[data.device, data.activity].filter(Boolean).join(" · ")}
          </span>
        </p>
      ) : null}

      {stats.length ? (
        <div className="grid grid-cols-2 gap-2">
          {stats.map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="rounded-xl bg-muted/60 px-3 py-2.5">
              <p className="flex items-center gap-1 text-[11.5px] font-semibold text-muted-foreground">
                <Icon className="size-3.5" /> {label}
              </p>
              <p className="tabular mt-0.5 text-[20px] font-bold leading-tight">
                {value}
                {sub ? (
                  <span className="ml-1 text-[11.5px] font-medium text-muted-foreground">
                    {sub}
                  </span>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {data.hrZones.length ? (
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t.watch.zones}
          </p>
          {/* Minutes are a magnitude, so one hue and bar length — the zones'
              own brand colours differ per watch app. */}
          {/* Name and minutes above the bar: zone names run long ("Geavanceerd
              anaeroob") and truncated beside a bar at 390pt. */}
          <div className="space-y-2">
            {data.hrZones.map((z) => (
              <div key={z.name}>
                <p className="flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span className="min-w-0 truncate">{z.name}</span>
                  <span
                    className={`tabular shrink-0 ${z.minutes ? "font-semibold" : "text-muted-foreground"}`}
                  >
                    {t.watch.minutes(z.minutes)}
                  </span>
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(z.minutes / maxZone) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.trainingEffects.length ||
      data.recoveryHours != null ||
      data.hrRecovery?.drop != null ? (
        <div className="space-y-1.5 text-[13.5px]">
          {data.trainingEffects.map((e) => (
            <p key={e.label} className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">{e.label}</span>
              <span className="tabular shrink-0 font-semibold">
                {e.value.toLocaleString(locale)}
                {e.rating ? (
                  <span className="font-normal text-muted-foreground"> · {e.rating}</span>
                ) : null}
              </span>
            </p>
          ))}
          {data.recoveryHours != null ? <p>{t.watch.recovery(data.recoveryHours)}</p> : null}
          {data.hrRecovery?.drop != null ? (
            <p>
              {t.watch.hrRecovery(
                data.hrRecovery.drop,
                data.hrRecovery.startBpm,
                data.hrRecovery.endBpm,
                data.hrRecovery.minutes,
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      {data.otherMetrics.length ? (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t.watch.more}
          </p>
          <div className="space-y-1">
            {data.otherMetrics.map((m) => (
              <p key={m.label} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="tabular shrink-0 font-semibold">
                  {m.value}
                  {m.unit ? ` ${m.unit}` : ""}
                </span>
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {data.activeKcal != null || data.totalKcal != null ? (
        <p className="text-[11.5px] leading-snug text-muted-foreground">{t.watch.caloriesNote}</p>
      ) : null}
    </div>
  );
}
