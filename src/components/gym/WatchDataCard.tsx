import { useMemo } from "react";
import {
  Activity,
  Droplets,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Mountain,
  Route,
  Ruler,
  Timer,
  Watch,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import type { WatchData } from "../../lib/gym/types";
import { formatDuration, formatPace, roundWatchNumbers, WATCH_DECIMALS } from "../../lib/gym/watch";

interface Stat {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Short unit right after the value ("km", "bpm"). */
  unit?: string | null;
  /** Secondary detail on its own line ("fastest 7'56"", "1,314 kcal total"). */
  note?: string | null;
}

/** A watch's own record of one session, as read from its app's screenshots:
 *  headline numbers (and, for cardio, distance, pace, cadence, elevation),
 *  minutes per heart-rate and pace zone, per-km splits, training-effect
 *  scores, recovery, and anything else it printed. Every figure is the
 *  watch's — Forge computes nothing here. */
export function WatchDataCard({ data: raw }: { data: WatchData }) {
  const t = useTranslation();
  // Rounded again here so a fresh scan under review reads the same as a
  // saved one (the store rounds on save; see watch.ts's roundWatchNumbers).
  const data = useMemo(() => roundWatchNumbers(raw), [raw]);
  const locale = useLocale();
  const fmt = (n: number, digits = 2) =>
    n.toLocaleString(locale, { maximumFractionDigits: digits });
  const range = (a: number | null | undefined, b: number | null | undefined, digits = 2) =>
    [...new Set([a, b].filter((x): x is number => x != null))].map((x) => fmt(x, digits)).join("–");
  const stats: (Stat | false)[] = [
    data.distanceKm != null && {
      icon: Route,
      label: t.watch.distance,
      value: fmt(data.distanceKm),
      unit: "km",
    },
    data.durationSeconds != null && {
      icon: Timer,
      label: t.watch.duration,
      value: formatDuration(data.durationSeconds),
    },
    data.avgPaceSeconds != null && {
      icon: Activity,
      label: t.watch.avgPace,
      value: formatPace(data.avgPaceSeconds),
      unit: t.watch.perKm,
      note: data.bestPaceSeconds != null ? t.watch.fastest(formatPace(data.bestPaceSeconds)) : null,
    },
    (data.activeKcal != null || data.totalKcal != null) && {
      icon: Flame,
      label: t.watch.activeKcal,
      value: fmt((data.activeKcal ?? data.totalKcal)!),
      note:
        data.activeKcal != null && data.totalKcal != null
          ? t.watch.totalKcal(fmt(data.totalKcal))
          : null,
    },
    data.avgHr != null && {
      icon: HeartPulse,
      label: t.watch.avgHr,
      value: fmt(data.avgHr),
      unit: t.watch.bpm,
    },
    data.maxHr != null && {
      icon: HeartPulse,
      label: t.watch.maxHr,
      value: fmt(data.maxHr),
      unit: t.watch.bpm,
      note: data.minHr != null ? t.watch.minHr(fmt(data.minHr)) : null,
    },
    data.avgSpeedKmh != null && {
      icon: Wind,
      label: t.watch.avgSpeed,
      value: fmt(data.avgSpeedKmh),
      unit: "km/h",
      note: data.maxSpeedKmh != null ? t.watch.max(fmt(data.maxSpeedKmh)) : null,
    },
    data.avgCadence != null && {
      icon: Footprints,
      label: t.watch.cadence,
      value: fmt(data.avgCadence),
      unit: t.watch.perMin,
      note: data.maxCadence != null ? t.watch.max(fmt(data.maxCadence)) : null,
    },
    data.avgStrideCm != null && {
      icon: Ruler,
      label: t.watch.stride,
      value: fmt(data.avgStrideCm),
      unit: "cm",
    },
    data.steps != null && { icon: Footprints, label: t.watch.steps, value: fmt(data.steps) },
    data.ascentM != null && {
      icon: Mountain,
      label: t.watch.climb,
      value: fmt(data.ascentM, 1),
      unit: "m",
      note: data.descentM != null ? t.watch.descent(fmt(data.descentM, 1)) : null,
    },
    // Whole metres so a four-digit range fits a half-width tile.
    (data.minElevationM != null || data.maxElevationM != null) && {
      icon: Mountain,
      label: t.watch.elevation,
      value: range(data.minElevationM, data.maxElevationM, 0),
      unit: "m",
    },
    data.vo2max != null && { icon: Gauge, label: "VO2max", value: fmt(data.vo2max) },
    (data.spo2Min != null || data.spo2Max != null) && {
      icon: Droplets,
      label: t.watch.spo2,
      value: range(data.spo2Min, data.spo2Max),
      unit: "%",
    },
  ];
  const shown = stats.filter((x): x is Stat => x !== false);
  const splits = data.splits ?? [];

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

      {shown.length ? (
        <div className="grid grid-cols-2 gap-2">
          {shown.map(({ icon: Icon, label, value, unit, note }) => (
            <div key={label} className="min-w-0 rounded-xl bg-muted/60 px-3 py-2.5">
              <p className="flex items-center gap-1 truncate text-[11.5px] font-semibold text-muted-foreground">
                <Icon className="size-3.5 shrink-0" /> {label}
              </p>
              <p className="tabular mt-0.5 whitespace-nowrap text-[20px] font-bold leading-tight">
                {value}
                {unit ? (
                  <span className="ml-1 text-[11.5px] font-medium text-muted-foreground">
                    {unit}
                  </span>
                ) : null}
              </p>
              {note ? (
                <p className="tabular truncate text-[11.5px] text-muted-foreground">{note}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <Zones title={t.watch.zones} zones={data.hrZones} />
      <Zones title={t.watch.paceZones} zones={data.paceZones ?? []} />

      {splits.length ? <Splits splits={splits} /> : null}

      {data.trainingEffects.length || data.otherMetrics.length ? (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t.watch.more}
          </p>
          {/* Label above value: labels and values alike run long ("Gemiddelde
              verticale oscillatie", "Linker 49,6 · Rechter 50,4 %"). */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {[
              ...data.trainingEffects.map((e) => ({
                label: e.label,
                value: fmt(e.value),
                rating: e.rating,
              })),
              ...data.otherMetrics.map((m) => ({
                label: m.label,
                value: m.unit ? `${m.value} ${m.unit}` : m.value,
                rating: m.rating ?? null,
              })),
            ].map((m, i) => (
              <div key={`${m.label}-${i}`} className="min-w-0">
                <p className="text-[11.5px] leading-snug text-muted-foreground">{m.label}</p>
                <p className="tabular break-words text-[14px] font-semibold leading-snug">
                  {m.value}
                </p>
                {m.rating ? (
                  <p className="text-[11.5px] leading-snug text-muted-foreground">{m.rating}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.recoveryHours != null || data.hrRecovery?.drop != null ? (
        <div className="space-y-1 text-[13.5px]">
          {data.recoveryHours != null ? <p>{t.watch.recovery(fmt(data.recoveryHours))}</p> : null}
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

      {(data.tables ?? []).map((table, i) => (
        <WatchTableView key={`${table.title}-${i}`} table={table} />
      ))}

      {data.activeKcal != null || data.totalKcal != null ? (
        <p className="text-[11.5px] leading-snug text-muted-foreground">{t.watch.caloriesNote}</p>
      ) : null}
    </div>
  );
}

function Zones({ title, zones }: { title: string; zones: { name: string; minutes: number }[] }) {
  const t = useTranslation();
  const locale = useLocale();
  if (!zones.length) return null;
  const max = Math.max(1, ...zones.map((z) => z.minutes));
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {/* Minutes are a magnitude, so one hue and bar length — the zones' own
          brand colours differ per watch app. Name and minutes sit above the
          bar: zone names run long ("Geavanceerd anaeroob"). */}
      <div className="space-y-2">
        {zones.map((z, i) => (
          <div key={`${z.name}-${i}`}>
            <p className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="min-w-0 truncate">{z.name}</span>
              <span
                className={`tabular shrink-0 ${z.minutes ? "font-semibold" : "text-muted-foreground"}`}
              >
                {t.watch.minutes(
                  z.minutes.toLocaleString(locale, { maximumFractionDigits: WATCH_DECIMALS }),
                )}
              </span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(z.minutes / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A whole km (or lap) split, labelled "1", "2"…. A shorter last split
 *  ("Minder dan 1 km") usually prints its time rather than a pace, so it
 *  gets no bar and doesn't set the scale. */
const isWholeSplit = (label: string) => /^\d+$/.test(label.trim());

/** Per-km splits: the table as printed, plus a bar for speed so the fastest
 *  and slowest km stand out (length ∝ 1 / pace, fastest = full width). */
function Splits({ splits }: { splits: NonNullable<WatchData["splits"]> }) {
  const t = useTranslation();
  const paces = splits
    .filter((s) => isWholeSplit(s.label))
    .map((s) => s.paceSeconds)
    .filter((p): p is number => p != null && p > 0);
  const fastest = paces.length ? Math.min(...paces) : 0;
  const hasHr = splits.some((s) => s.avgHr != null);
  const hasCadence = splits.some((s) => s.cadence != null);
  // Literal class names: Tailwind's scanner can't see an interpolated one.
  const cols =
    hasHr && hasCadence
      ? "grid-cols-[max-content_minmax(0,1fr)_3.25rem_2.5rem_2.5rem]"
      : hasHr || hasCadence
        ? "grid-cols-[max-content_minmax(0,1fr)_3.25rem_2.5rem]"
        : "grid-cols-[max-content_minmax(0,1fr)_3.25rem]";
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t.watch.splits}
      </p>
      <div className={`grid ${cols} items-center gap-x-2 gap-y-1.5 text-[12.5px]`}>
        <span className="text-[11px] text-muted-foreground">{t.watch.splitKm}</span>
        <span />
        <span className="text-right text-[11px] text-muted-foreground">{t.watch.splitPace}</span>
        {hasHr ? (
          <span className="text-right text-[11px] text-muted-foreground">{t.watch.splitHr}</span>
        ) : null}
        {hasCadence ? (
          <span className="text-right text-[11px] text-muted-foreground">
            {t.watch.splitCadence}
          </span>
        ) : null}
        {splits.map((s, i) => (
          <SplitRow
            key={`${s.label}-${i}`}
            split={s}
            fastest={fastest}
            hasHr={hasHr}
            hasCadence={hasCadence}
          />
        ))}
      </div>
    </div>
  );
}

function SplitRow({
  split,
  fastest,
  hasHr,
  hasCadence,
}: {
  split: NonNullable<WatchData["splits"]>[number];
  fastest: number;
  hasHr: boolean;
  hasCadence: boolean;
}) {
  const pace = split.paceSeconds;
  return (
    <>
      {/* Capped so a label like "Minder dan 1 km" wraps instead of
          squeezing every bar. */}
      <span className="tabular min-w-[1.5rem] max-w-[4.5rem] font-semibold leading-tight">
        {split.label}
      </span>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        {pace && fastest && isWholeSplit(split.label) ? (
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${(fastest / pace) * 100}%` }}
          />
        ) : null}
      </div>
      <span className="tabular text-right">{pace ? formatPace(pace) : "–"}</span>
      {hasHr ? <span className="tabular text-right">{split.avgHr ?? "–"}</span> : null}
      {hasCadence ? <span className="tabular text-right">{split.cadence ?? "–"}</span> : null}
    </>
  );
}

/** Any other table the screenshots printed, cell text as written. */
function WatchTableView({ table }: { table: NonNullable<WatchData["tables"]>[number] }) {
  if (!table.rows.length) return null;
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {table.title}
      </p>
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr>
              {table.columns.map((c, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap pb-1 pr-3 text-left text-[11px] font-medium text-muted-foreground last:pr-0"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r} className="border-t border-border">
                {row.map((cell, c) => (
                  <td key={c} className="tabular whitespace-nowrap py-1 pr-3 last:pr-0">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
