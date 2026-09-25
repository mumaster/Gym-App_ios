import { REGIONS, type RegionId } from "../../lib/gym/anatomy";

/** Distinct hue used for pairing suggestions (map highlight + popup border). */
export const SUGGESTED_COLOR = "oklch(0.85 0.18 90)";

type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; rotate?: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; r: number }
  | { kind: "path"; d: string };

const SHAPES: Record<RegionId, Shape[]> = {
  shoulders: [
    { kind: "ellipse", cx: 63, cy: 74, rx: 15, ry: 12, rotate: -20 },
    { kind: "ellipse", cx: 137, cy: 74, rx: 15, ry: 12, rotate: 20 },
  ],
  chest: [
    { kind: "path", d: "M98 80 h-14 q-8 2 -7 12 q2 10 12 12 q7 1 9 -4 z" },
    { kind: "path", d: "M102 80 h14 q8 2 7 12 q-2 10 -12 12 q-7 1 -9 -4 z" },
  ],
  biceps: [
    { kind: "ellipse", cx: 57, cy: 105, rx: 10, ry: 19, rotate: -8 },
    { kind: "ellipse", cx: 143, cy: 105, rx: 10, ry: 19, rotate: 8 },
  ],
  forearms: [
    { kind: "ellipse", cx: 50, cy: 148, rx: 8, ry: 22, rotate: -6 },
    { kind: "ellipse", cx: 150, cy: 148, rx: 8, ry: 22, rotate: 6 },
  ],
  core: [{ kind: "rect", x: 86, y: 110, w: 28, h: 44, r: 11 }],
  hips: [{ kind: "path", d: "M80 158 q20 12 40 0 v8 q-20 14 -40 0 z" }],
  quads: [
    { kind: "ellipse", cx: 88, cy: 202, rx: 13, ry: 30 },
    { kind: "ellipse", cx: 112, cy: 202, rx: 13, ry: 30 },
  ],
  lats: [{ kind: "path", d: "M80 78 q20 6 40 0 l6 30 q-6 12 -26 14 q-20 -2 -26 -14 z" }],
  lower_back: [{ kind: "rect", x: 87, y: 126, w: 26, h: 26, r: 9 }],
  triceps: [
    { kind: "ellipse", cx: 57, cy: 105, rx: 10, ry: 19, rotate: -8 },
    { kind: "ellipse", cx: 143, cy: 105, rx: 10, ry: 19, rotate: 8 },
  ],
  glutes: [
    { kind: "ellipse", cx: 89, cy: 165, rx: 14, ry: 13 },
    { kind: "ellipse", cx: 111, cy: 165, rx: 14, ry: 13 },
  ],
  hamstrings: [
    { kind: "ellipse", cx: 88, cy: 206, rx: 13, ry: 28 },
    { kind: "ellipse", cx: 112, cy: 206, rx: 13, ry: 28 },
  ],
  calves: [
    { kind: "ellipse", cx: 88, cy: 268, rx: 10, ry: 22 },
    { kind: "ellipse", cx: 112, cy: 268, rx: 10, ry: 22 },
  ],
};

function ShapeNode({ shape }: { shape: Shape }) {
  if (shape.kind === "ellipse") {
    return (
      <ellipse
        cx={shape.cx}
        cy={shape.cy}
        rx={shape.rx}
        ry={shape.ry}
        transform={shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : undefined}
      />
    );
  }
  if (shape.kind === "rect") {
    return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} />;
  }
  return <path d={shape.d} />;
}

/** Non-interactive body silhouette drawn under the muscle regions. */
function Silhouette() {
  return (
    <g
      className="pointer-events-none stroke-border"
      fill="url(#body-fill)"
      strokeWidth={1.25}
      style={{ filter: "drop-shadow(0 6px 10px oklch(0 0 0 / 35%))" }}
    >
      <circle cx={100} cy={34} r={19} />
      <rect x={92} y={50} width={16} height={14} rx={6} />
      <path d="M100 60 q26 2 34 20 l6 26 q4 26 -2 44 l-8 6 l-4 40 q-26 12 -52 0 l-4 -40 l-8 -6 q-6 -18 -2 -44 l6 -26 q8 -18 34 -20 z" />
      <path d="M66 84 q-12 6 -14 22 l-6 44 q-2 12 4 16 q8 2 10 -10 l8 -40 z" />
      <path d="M134 84 q12 6 14 22 l6 44 q2 12 -4 16 q-8 2 -10 -10 l-8 -40 z" />
      <path d="M78 168 q22 16 44 0 l2 42 q-2 46 -8 76 l-2 24 q-10 4 -18 0 l-2 -78 l-2 78 q-8 4 -18 0 l-2 -24 q-6 -30 -8 -76 z" />
    </g>
  );
}

/** A soft blurred duplicate of a region's shapes, sitting behind it for a bloom effect. */
function Glow({ regionIds, color }: { regionIds: RegionId[]; color: string }) {
  if (!regionIds.length) return null;
  return (
    <g
      className="pointer-events-none"
      style={{ filter: "url(#soft-blur)" }}
      fill={color}
      opacity={0.4}
    >
      {regionIds.map((id) => (
        <g key={id}>
          {SHAPES[id]!.map((s, i) => (
            <ShapeNode key={i} shape={s} />
          ))}
        </g>
      ))}
    </g>
  );
}

function Body({
  view,
  selected,
  suggested,
  onToggle,
}: {
  view: "front" | "back";
  selected: RegionId[];
  suggested?: RegionId | null;
  onToggle: (id: RegionId) => void;
}) {
  const regions = REGIONS.filter((r) => r.view === view);
  const activeIds = regions.filter((r) => selected.includes(r.id)).map((r) => r.id);
  const hintedId = regions.find((r) => !selected.includes(r.id) && suggested === r.id)?.id;

  return (
    <div className="min-w-0 flex-1 rounded-3xl bg-gradient-to-b from-muted/45 to-muted/15 px-1.5 pb-2.5 pt-2 ring-1 ring-inset ring-border/60">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground/80">
        {view}
      </p>
      <svg
        viewBox="0 0 200 320"
        role="group"
        aria-label={`Muscle map, ${view} view`}
        className="mx-auto mt-1 block h-auto w-full max-w-[190px]"
      >
        <ellipse cx={100} cy={300} rx={62} ry={12} fill="url(#figure-glow)" />
        <Glow regionIds={activeIds} color="var(--primary)" />
        {hintedId ? <Glow regionIds={[hintedId]} color={SUGGESTED_COLOR} /> : null}
        <Silhouette />
        {regions.map((r) => {
          const active = selected.includes(r.id);
          const hinted = !active && suggested === r.id;
          return (
            <g
              key={r.id}
              role="checkbox"
              aria-checked={active}
              aria-label={r.label}
              tabIndex={0}
              onClick={() => onToggle(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(r.id);
                }
              }}
              className={`origin-center cursor-pointer outline-none transition-[fill,stroke,filter,opacity] duration-200 ease-out active:scale-[0.94] ${hinted ? "animate-pulse" : ""}`}
              style={{
                fill: active
                  ? "url(#muscle-active)"
                  : hinted
                    ? "url(#muscle-hint)"
                    : "color-mix(in oklch, var(--foreground) 7%, transparent)",
                stroke: active
                  ? "var(--primary)"
                  : hinted
                    ? SUGGESTED_COLOR
                    : "color-mix(in oklch, var(--foreground) 18%, transparent)",
                strokeWidth: active || hinted ? 2.4 : 1,
              }}
            >
              {SHAPES[r.id]!.map((s, i) => (
                <ShapeNode key={i} shape={s} />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AnatomyMap({
  selected,
  suggested,
  onToggle,
}: {
  selected: RegionId[];
  /** Region currently highlighted as a pairing suggestion. */
  suggested?: RegionId | null;
  onToggle: (id: RegionId) => void;
}) {
  const frontRegions = REGIONS.filter((r) => r.view === "front");
  const backRegions = REGIONS.filter((r) => r.view === "back");

  const chip = (r: (typeof REGIONS)[number]) => {
    const active = selected.includes(r.id);
    return (
      <button
        key={r.id}
        onClick={() => onToggle(r.id)}
        className={`min-h-[34px] rounded-full px-3.5 text-[12.5px] font-semibold transition-colors active:scale-95 ${
          active
            ? "bg-primary text-primary-foreground shadow-[0_0_14px_-3px_var(--primary)]"
            : "glass text-secondary-foreground"
        }`}
      >
        {r.label}
      </button>
    );
  };

  return (
    <div>
      <svg width={0} height={0} className="absolute" aria-hidden>
        <defs>
          <filter id="soft-blur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <linearGradient id="body-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0.06" />
          </linearGradient>
          <radialGradient id="figure-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="muscle-active" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.55" />
          </linearGradient>
          <pattern
            id="muscle-hint"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="7" height="7" fill="var(--secondary)" />
            <rect width="3" height="7" fill={SUGGESTED_COLOR} fillOpacity="0.75" />
          </pattern>
        </defs>
      </svg>

      <div className="flex gap-3">
        <Body view="front" selected={selected} suggested={suggested ?? null} onToggle={onToggle} />
        <div
          className="w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-border to-transparent"
          aria-hidden
        />
        <Body view="back" selected={selected} suggested={suggested ?? null} onToggle={onToggle} />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {frontRegions.map(chip)}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {backRegions.map(chip)}
        </div>
      </div>
    </div>
  );
}
