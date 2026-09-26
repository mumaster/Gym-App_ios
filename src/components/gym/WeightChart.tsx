import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { WeightEntry, WeightTrend } from "../../lib/gym/bodyweight";
import { useLocale, useTranslation } from "../../lib/gym/i18n";

const DAY_MS = 86_400_000;
/** How far back the dots go — twice the 28-day trend window, so the line
 *  sits in context. A display choice, not a training number. */
const WINDOW_DAYS = 56;
const HEIGHT = 128;
const PAD = { top: 8, right: 8, bottom: 20, left: 32 };
const STEPS = [0.2, 0.5, 1, 2, 5, 10, 20];

/** Rounded kg gridlines covering [lo, hi]: 2–4 of them, whole steps only. */
function yTicks(
  lo: number,
  hi: number,
): { min: number; max: number; ticks: number[]; step: number } {
  const step = STEPS.find((s) => Math.ceil(hi / s) - Math.floor(lo / s) <= 3) ?? 50;
  let min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  if (max - min < step * 2) min -= step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 10) / 10);
  return { min, max, ticks, step };
}

/** Weigh-ins over the last 8 weeks as dots, with the fitted trend drawn
 *  as a line across the window it was fitted on. Tap or drag to read a
 *  weigh-in; the chips below the chart carry the same numbers as text. */
export function WeightChart({
  entries,
  trend,
}: {
  entries: WeightEntry[];
  trend: WeightTrend | null;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => e && setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = useMemo(() => {
    const cutoff = Date.now() - WINDOW_DAYS * DAY_MS;
    return entries
      .map((e) => ({ t: new Date(e.date).getTime(), kg: e.kg }))
      .filter((p) => p.t >= cutoff)
      .sort((a, b) => a.t - b.t);
  }, [entries]);

  if (pts.length < 2) return null;

  const t0 = pts[0]!.t;
  const t1 = pts[pts.length - 1]!.t;
  const span = Math.max(t1 - t0, DAY_MS);
  const kgs = pts.map((p) => p.kg);
  if (trend) kgs.push(trend.startKg, trend.endKg);
  const y = yTicks(Math.min(...kgs), Math.max(...kgs));

  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (ms: number) => PAD.left + ((ms - t0) / span) * plotW;
  const yy = (kg: number) => PAD.top + (1 - (kg - y.min) / (y.max - y.min)) * plotH;

  const fmtKg = (kg: number, digits: number) =>
    kg.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(locale, { day: "numeric", month: "short" });

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const left = e.currentTarget.getBoundingClientRect().left;
    const px = e.clientX - left;
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(x(p.t) - px) < Math.abs(x(pts[best]!.t) - px)) best = i;
    });
    setActive(best);
  };

  const shown = pts[active ?? pts.length - 1]!;

  return (
    <div>
      <p className="text-[13px] tabular-nums">
        <span className="text-muted-foreground">{fmtDate(shown.t)} · </span>
        <span className="font-bold">{fmtKg(shown.kg, 1)} kg</span>
      </p>
      <div ref={boxRef} className="mt-1">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t.bodyweight.chartLabel}
          className="block touch-pan-y select-none"
          onPointerDown={pick}
          onPointerMove={(e) =>
            (e.pointerType !== "mouse" || e.buttons || active !== null) && pick(e)
          }
          onPointerEnter={(e) => e.pointerType === "mouse" && pick(e)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        >
          {y.ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yy(v)}
                y2={yy(v)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={yy(v)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[10.5px] tabular-nums"
              >
                {fmtKg(v, y.step < 1 ? 1 : 0)}
              </text>
            </g>
          ))}
          <text
            x={PAD.left}
            y={HEIGHT - 4}
            textAnchor="start"
            className="fill-muted-foreground text-[10.5px]"
          >
            {fmtDate(t0)}
          </text>
          <text
            x={width - PAD.right}
            y={HEIGHT - 4}
            textAnchor="end"
            className="fill-muted-foreground text-[10.5px]"
          >
            {fmtDate(t1)}
          </text>

          {active !== null ? (
            <line
              x1={x(shown.t)}
              x2={x(shown.t)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          ) : null}

          {trend ? (
            <line
              x1={x(trend.startMs)}
              x2={x(trend.endMs)}
              y1={yy(trend.startKg)}
              y2={yy(trend.endKg)}
              stroke="var(--primary)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ) : null}

          {pts.map((p, i) => (
            <circle
              key={p.t}
              cx={x(p.t)}
              cy={yy(p.kg)}
              r={i === active ? 5.5 : 4}
              fill={i === active ? "var(--foreground)" : "var(--muted-foreground)"}
              stroke="var(--chart-surface)"
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex items-center gap-4 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground" />
          {t.bodyweight.chartWeighIns}
        </span>
        {trend ? (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full bg-primary" />
            {t.bodyweight.chartTrend}
          </span>
        ) : null}
      </div>
    </div>
  );
}
