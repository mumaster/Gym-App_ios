import { useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";
import { REGIONS, regionById, type RegionId } from "../../lib/gym/anatomy";
import { chip as chipStyle } from "./ui";

/** Distinct hue used for pairing suggestions (map highlight + popup border). */
export const SUGGESTED_COLOR = "oklch(0.85 0.18 90)";

/*
 * The figure is drawn once for the viewer's left half (x < 100) and mirrored
 * for the right, so every muscle is a pair of panels that select together.
 * The viewBox is 200 × 430: about 7.5 heads tall with the legs at half the
 * height and the arms held away from the body, so each limb is its own shape.
 * Panels follow the muscles and are separated by thin gaps, like frosted
 * tiles, instead of floating ellipses on a block.
 */
type Paths = Partial<Record<RegionId, string[]>>;

const SHOULDER =
  "M76 63 C66 60 55 63 49 72 C45 80 45 92 48 101 C55 100 61 95 65 88 C69 80 73 71 76 63 Z";
const ARM_UPPER =
  "M47 104 C43 116 39 128 37 141 L50 144 C54 130 58 118 62 104 C56 105 51 105 47 104 Z";
const FOREARM = "M36 148 C33 164 30 182 28 199 L39 201 C43 186 48 168 51 150 Z";
const CALF_FRONT = "M72 300 C68 326 69 358 75 392 L88 392 C92 358 94 326 92 300 Z";

const FRONT: Paths = {
  shoulders: [SHOULDER],
  chest: ["M99 73 C91 69 80 69 72 75 C68 84 68 98 74 107 C82 113 93 113 99 108 Z"],
  biceps: [ARM_UPPER],
  forearms: [FOREARM],
  core: ["M99 114 C90 114 82 116 77 122 C75 138 77 154 81 168 C87 172 93 173 99 173 Z"],
  hips: ["M99 178 C90 178 80 176 73 171 C70 180 70 192 76 203 C84 208 92 210 99 211 Z"],
  quads: ["M73 209 C68 234 66 264 71 293 L93 293 C98 264 99 236 99 217 C90 216 80 214 73 209 Z"],
  calves: [CALF_FRONT],
};

// Rear delts and forearms exist on the back too. They map to the same muscle
// groups as on the front, so they toggle the same region.
const BACK: Paths = {
  shoulders: [SHOULDER],
  lats: ["M99 60 C89 60 78 64 68 72 C64 90 68 116 78 134 C86 142 94 144 99 144 Z"],
  triceps: [ARM_UPPER],
  forearms: [FOREARM],
  lower_back: ["M99 149 C90 149 83 150 79 154 C79 164 84 173 99 176 Z"],
  glutes: ["M99 181 C88 179 76 181 72 193 C69 207 75 219 87 221 C95 221 99 217 99 210 Z"],
  hamstrings: [
    "M73 227 C68 248 67 272 71 293 L93 293 C98 272 99 248 99 228 C90 230 80 230 73 227 Z",
  ],
  calves: ["M72 300 C67 322 69 354 76 390 L88 390 C93 354 95 322 92 300 Z"],
};

const PATHS = { front: FRONT, back: BACK } as const;

/** Trapezius at the base of the neck: drawn, not selectable. */
const TRAPS = "M99 60 C90 60 80 63 72 68 C74 74 84 72 99 74 Z";

/** Body silhouette pieces for the left half (torso, arm, leg). */
const SILHOUETTE_HALF = [
  "M100 57 C86 57 70 61 60 70 C52 75 47 85 47 99 L51 126 C55 146 60 158 65 170 C63 182 65 196 69 205 L100 214 Z",
  "M60 70 C50 72 43 82 43 98 C41 116 37 130 35 143 C32 161 28 181 25 201 C24 209 27 215 32 215 C38 215 41 209 43 201 C47 183 53 163 56 147 C59 131 63 115 65 100 Z",
  "M68 203 C63 234 61 264 67 293 C63 322 63 358 69 394 L67 413 C74 419 88 419 92 411 L90 394 C96 358 98 322 94 293 C99 264 99 238 99 214 Z",
];

/** Faint ab lines, drawn on top of the core panel (front only). */
const AB_LINES = [
  "M88 130 C92 130 96 131 99 131",
  "M86 145 C91 145 96 146 99 146",
  "M84 159 C90 159 95 160 99 160",
];

/** A path for the left half plus its mirror image for the right half. */
function Pair({ d, ...rest }: { d: string } & React.SVGProps<SVGPathElement>) {
  return (
    <>
      <path d={d} {...rest} />
      <path d={d} transform="translate(200 0) scale(-1 1)" {...rest} />
    </>
  );
}

/** Body silhouette: a rim pass, then a fill pass that covers the seams. */
function Silhouette() {
  const parts = (
    <>
      {SILHOUETTE_HALF.map((d) => (
        <Pair key={d} d={d} />
      ))}
      <ellipse cx={100} cy={27} rx={13} ry={16.5} />
      <rect x={92.5} y={40} width={15} height={22} rx={6} />
    </>
  );
  return (
    <g className="pointer-events-none">
      <g
        fill="var(--map-rim)"
        stroke="var(--map-rim)"
        strokeWidth={3.2}
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 5px 8px oklch(0 0 0 / 28%))" }}
      >
        {parts}
      </g>
      <g fill="var(--map-body)">{parts}</g>
    </g>
  );
}

function Body({
  view,
  selected,
  suggested,
  onToggle,
  showLabel = true,
}: {
  view: "front" | "back";
  selected: RegionId[];
  suggested?: RegionId | null;
  onToggle: (id: RegionId) => void;
  showLabel?: boolean;
}) {
  const t = useTranslation();
  const paths = PATHS[view];
  const ids = Object.keys(paths) as RegionId[];
  const label = view === "front" ? t.muscleMap.front : t.muscleMap.back;

  return (
    <div className="min-w-0 flex-1 rounded-3xl bg-gradient-to-b from-muted/45 to-muted/15 px-1.5 pb-2.5 pt-2 ring-1 ring-inset ring-border/60">
      {showLabel ? (
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </p>
      ) : null}
      <svg
        viewBox="0 0 200 430"
        role="group"
        aria-label={t.muscleMap.mapLabel(label)}
        className="mx-auto mt-1 block h-auto w-full max-w-[190px]"
      >
        <ellipse cx={100} cy={420} rx={64} ry={8} fill="url(#map-floor)" />
        {/* Bloom behind the selected panels. */}
        <g
          className="pointer-events-none"
          style={{ filter: "url(#map-bloom)" }}
          fill="var(--primary)"
          opacity={0.45}
        >
          {ids
            .filter((id) => selected.includes(id))
            .flatMap((id) => paths[id]!.map((d) => <Pair key={id + d} d={d} />))}
        </g>
        <Silhouette />
        {view === "front" ? (
          <g className="pointer-events-none" fill="var(--map-panel)" opacity={0.55}>
            <Pair d={TRAPS} />
          </g>
        ) : null}
        {/* Hit layer: a wide invisible stroke around every panel, drawn under
            all the panels so it only catches taps in the gaps and just outside
            the edges. A panel's own area always belongs to that panel. */}
        <g aria-hidden>
          {ids.map((id) => (
            <g key={id} className="cursor-pointer" onClick={() => onToggle(id)}>
              {paths[id]!.map((d) => (
                <Pair
                  key={d}
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={10}
                  style={{ pointerEvents: "stroke" }}
                />
              ))}
            </g>
          ))}
        </g>
        {ids.map((id) => {
          const active = selected.includes(id);
          const hinted = !active && suggested === id;
          return (
            <g
              key={id}
              role="checkbox"
              aria-checked={active}
              aria-label={regionById(id).label}
              tabIndex={0}
              onClick={() => onToggle(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(id);
                }
              }}
              className={`cursor-pointer outline-none transition-opacity duration-150 active:opacity-70 focus-visible:[filter:drop-shadow(0_0_3px_var(--primary))] ${
                active ? "muscle-pop" : ""
              } ${hinted ? "animate-pulse" : ""}`}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              {paths[id]!.map((d) => (
                <Pair
                  key={d}
                  d={d}
                  strokeLinejoin="round"
                  style={{
                    fill: active ? "url(#map-on)" : hinted ? "url(#map-hint)" : "url(#map-idle)",
                    stroke: active
                      ? "var(--map-on-rim)"
                      : hinted
                        ? SUGGESTED_COLOR
                        : "var(--map-rim)",
                    strokeWidth: active || hinted ? 1.6 : 0.8,
                    transition: "fill 200ms, stroke 200ms",
                  }}
                />
              ))}
            </g>
          );
        })}
        {view === "front" ? (
          <g
            className="pointer-events-none"
            fill="none"
            stroke="var(--foreground)"
            strokeOpacity={0.16}
            strokeWidth={0.9}
            strokeLinecap="round"
          >
            {AB_LINES.map((d) => (
              <Pair key={d} d={d} />
            ))}
            <path d="M99 116 L99 172" />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

/** Gradients, bloom and hatch the figures reference by id. */
function MapDefs() {
  return (
    <svg width={0} height={0} className="absolute" aria-hidden>
      <defs>
        <filter id="map-bloom" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <radialGradient id="map-floor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="map-idle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--map-panel-hi)" }} />
          <stop offset="100%" style={{ stopColor: "var(--map-panel)" }} />
        </linearGradient>
        <linearGradient id="map-on" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            style={{ stopColor: "color-mix(in oklch, var(--primary) 70%, white)" }}
          />
          <stop offset="100%" style={{ stopColor: "var(--primary)" }} />
        </linearGradient>
        <pattern
          id="map-hint"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill="var(--map-panel)" />
          <rect width="2.6" height="6" fill={SUGGESTED_COLOR} fillOpacity="0.85" />
        </pattern>
      </defs>
    </svg>
  );
}

/** Both figures with some regions lit, not interactive (used as an
 *  illustration, e.g. in the welcome tour). */
/** Both figures, lit and not interactive. `labels: false` drops the
 *  Front/Back captions for a preview too small to fit them. */
export function AnatomyPreview({
  selected,
  labels = true,
}: {
  selected: RegionId[];
  labels?: boolean;
}) {
  return (
    <div inert aria-hidden className="pointer-events-none">
      <MapDefs />
      <div className="flex gap-2">
        <Body view="front" selected={selected} onToggle={() => {}} showLabel={labels} />
        <Body view="back" selected={selected} onToggle={() => {}} showLabel={labels} />
      </div>
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
  const t = useTranslation();
  const [listOpen, setListOpen] = useState(false);
  const chosen = REGIONS.filter((r) => selected.includes(r.id));
  const suggestedHere =
    suggested && !selected.includes(suggested) && (suggested in FRONT || suggested in BACK);

  const chip = (r: (typeof REGIONS)[number]) => {
    const active = selected.includes(r.id);
    return (
      <button
        key={r.id}
        onClick={() => onToggle(r.id)}
        aria-pressed={active}
        className={`tap-target min-h-[34px] rounded-full px-3.5 text-[12.5px] font-semibold transition-colors active:scale-95 ${
          active ? chipStyle.on : "glass text-secondary-foreground"
        }`}
      >
        {r.label}
      </button>
    );
  };

  return (
    <div>
      <MapDefs />

      <div className="flex gap-3">
        <Body view="front" selected={selected} suggested={suggested ?? null} onToggle={onToggle} />
        <div
          className="w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-border to-transparent"
          aria-hidden
        />
        <Body view="back" selected={selected} suggested={suggested ?? null} onToggle={onToggle} />
      </div>

      {suggestedHere ? (
        <p className="mt-2 text-center text-[12px] text-muted-foreground">
          {t.muscleMap.suggestedLegend}
        </p>
      ) : null}

      {/* What's selected, as removable chips; the full list is one tap away. */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2.5">
        {chosen.length ? (
          chosen.map((r) => (
            <button
              key={r.id}
              onClick={() => onToggle(r.id)}
              aria-label={t.muscleMap.removeMuscle(r.label)}
              className={`tap-target flex min-h-[34px] items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold active:scale-95 ${chipStyle.on}`}
            >
              {r.label}
              <X className="size-3.5 opacity-70" strokeWidth={3} />
            </button>
          ))
        ) : (
          <p className="text-[12.5px] text-muted-foreground">{t.muscleMap.tapHint}</p>
        )}
        <button
          onClick={() => setListOpen((v) => !v)}
          aria-expanded={listOpen}
          className="tap-target min-h-[34px] rounded-full border border-dashed border-border px-3 text-[12.5px] font-semibold text-muted-foreground active:scale-95"
        >
          {listOpen ? t.muscleMap.hideList : `+ ${t.muscleMap.allMuscles}`}
        </button>
      </div>

      {listOpen ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2.5">
          {REGIONS.map(chip)}
        </div>
      ) : null}
    </div>
  );
}
