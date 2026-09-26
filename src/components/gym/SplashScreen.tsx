import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useGym } from "../../lib/gym/store";

/** Warm "hot metal" tones for the spark burst — deliberately not tied to
 *  the user's accent color (like Confetti's own fixed palette), since a
 *  forge spark reads as orange/gold/white-hot regardless of theme. */
const SPARK_COLORS = ["oklch(0.85 0.19 70)", "oklch(0.92 0.14 85)", "oklch(0.97 0.05 90)"];
/** The flash/ring at the impact point itself uses the brightest, most
 *  white-hot tone — the sparks flying out of it are the cooling embers. */
const FLASH_COLOR = "oklch(0.97 0.06 85)";
/** dumbbell-flight's own declared duration in styles.css — the real travel,
 *  ending exactly at contact (see the comment on it there). A cluster's
 *  spark burst fires at its own --dumbbell-cluster-delay + this, which is
 *  the true, exact impact instant (not an approximation of one) since
 *  that's what dumbbell-flight's 100% keyframe IS by construction. This has
 *  to be a plain CSS animation-delay rather than firing off the CSS
 *  animation's own onAnimationEnd event: this splash paints from SSR'd
 *  markup, so the CSS animation can (and often does) finish playing before
 *  React finishes hydrating and attaching that listener, silently dropping
 *  the event for whichever cluster lands first — a real, reproduced bug,
 *  not a theoretical one. */
const FLIGHT_MS = 200;
/** The badge (the glowing rounded square) finishes its own entrance at
 *  BADGE_MS — the bar and weight clusters don't start moving until after
 *  that, so the square reads as appearing on its own first, and the
 *  barbell as a distinct second beat flying into it, rather than
 *  everything arriving in one blur. */
const BADGE_MS = 500;
const CLUSTER1_DELAY_MS = BADGE_MS + 150;
const CLUSTER2_DELAY_MS = CLUSTER1_DELAY_MS + 130;
/** The exact contact instants (see FLIGHT_MS): sparks fire and the badge
 *  thuds here. */
const IMPACT1_MS = CLUSTER1_DELAY_MS + FLIGHT_MS;
const IMPACT2_MS = CLUSTER2_DELAY_MS + FLIGHT_MS;

/** A small spray of metal-on-metal sparks from (x, y) — the point where a
 *  weight-plate cluster lands on the bar — along the given angles (degrees,
 *  SVG convention: 0 = +x, 90 = +y/down), plus a tiny contact glint. Kept
 *  deliberately small (a few thin, short, fast streaks that drop slightly
 *  as they cool): an earlier version with 8 thick sparks, a large flash and
 *  a shockwave ring read as an explosion rather than a strike. Fires once, delayMs after
 *  mount — see the FLIGHT_MS comment above for why this is a CSS delay
 *  rather than a React-side animation-end listener. The flash/spark
 *  keyframes themselves pop to full brightness within a couple of ms of
 *  firing (see spark-flash/spark-fly in styles.css) rather than easing in,
 *  so there's no perceptible gap between "plate lands" and "spark is
 *  visible" on top of that sync. Per-spark reach/length/width vary with
 *  index using a fixed formula (not Math.random(), which would mismatch
 *  between SSR and hydration) so the burst reads as an organic scatter
 *  rather than a uniform starburst. */
function SparkBurst({
  x,
  y,
  angles,
  delayMs,
}: {
  x: number;
  y: number;
  angles: number[];
  delayMs: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* A small, brief contact glint — metal striking metal, not a blast. */}
      <circle
        r={1.1}
        fill={FLASH_COLOR}
        className="animate-spark-flash"
        style={{ animationDelay: `${delayMs}ms` } as CSSProperties}
      />
      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const color = SPARK_COLORS[i % SPARK_COLORS.length];
        // Long enough to clear the plate outline (so the sparks are seen
        // against the dark badge, not lost on the green plates), still
        // short of reaching the badge's edge.
        const reach = 8 + ((i * 3) % 5);
        const length = 1.3 + ((i * 3) % 4) * 0.3;
        const width = 0.6 + (i % 3) * 0.2;
        return (
          <line
            key={angle}
            x1={0}
            y1={0}
            x2={cos * length}
            y2={sin * length}
            stroke={color}
            strokeWidth={width}
            strokeLinecap="round"
            className="animate-spark"
            style={
              {
                "--spark-dx": `${cos * reach}px`,
                "--spark-dy": `${sin * reach}px`,
                animationDelay: `${delayMs + i * 12}ms`,
                filter: `drop-shadow(0 0 1px ${color})`,
              } as CSSProperties
            }
          />
        );
      })}
    </g>
  );
}

/** Must match the fade-out transition duration below. */
const EXIT_MS = 400;
/** The wordmark starts striking in while the second burst is still flying
 *  — just after its flash peaks — rather than waiting for the sparks to
 *  finish, which left a dead half-second of a static icon. */
const TEXT_DELAY_MS = IMPACT2_MS + 120;
/** Per-letter stagger, and forge-letter's duration in styles.css. */
const LETTER_STAGGER_MS = 45;
const LETTER_MS = 420;
const WORDMARK = "FORGE";
const TAGLINE_DELAY_MS = TEXT_DELAY_MS + WORDMARK.length * LETTER_STAGGER_MS;
/** A beat after the tagline settles before the splash may dismiss. */
const HOLD_MS = 250;
/** However fast hydration finishes, keep the splash up at least this long —
 *  derived from the choreography above (badge → barbell strikes → wordmark
 *  → hold), never hand-tuned separately, so it can't drift out of sync.
 *  ~2.0 s, ~2.4 s with the exit. */
const MIN_VISIBLE_MS = TAGLINE_DELAY_MS + LETTER_MS + HOLD_MS;
/** With "Reduce Motion" everything shows at once; just a short hold. */
const REDUCED_MIN_VISIBLE_MS = 600;

/**
 * Full-screen brand splash shown once per cold app open (mounted at the
 * route root, so client-side navigation never re-triggers it): the bar
 * fades in, the two weight-plate clusters snap onto it (a one-shot reveal,
 * not the looping DumbbellLoader used elsewhere), and only once that's
 * settled does the "FORGE" wordmark fade in. Stays up until the store has
 * hydrated from localStorage AND at least MIN_VISIBLE_MS has passed, then
 * fades out and unmounts for good.
 */
export function SplashScreen() {
  const { hydrated } = useGym();
  const [mountedAt] = useState(() => Date.now());
  const [dismissing, setDismissing] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!hydrated || dismissing) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const min = reduced ? REDUCED_MIN_VISIBLE_MS : MIN_VISIBLE_MS;
    const wait = Math.max(0, min - (Date.now() - mountedAt));
    const t = setTimeout(() => setDismissing(true), wait);
    return () => clearTimeout(t);
  }, [hydrated, dismissing, mountedAt]);

  useEffect(() => {
    if (!dismissing) return;
    const t = setTimeout(() => setHidden(true), EXIT_MS);
    return () => clearTimeout(t);
  }, [dismissing]);

  if (hidden) return null;

  return (
    <div
      // __root.tsx's inline critical CSS targets this id to paint a
      // full-screen black cover on the very first frame, before styles.css
      // has applied — see the comment there. Renaming it silently
      // reintroduces a white flash on a cold PWA launch.
      id="forge-boot"
      aria-hidden={dismissing}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-[400ms] ease-out ${
        dismissing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Exit: the logo zooms gently toward the viewer while the backdrop
          fades — reads as moving *into* the app rather than a flat fade.
          duration-[400ms] must match EXIT_MS. */}
      <div
        className={`flex flex-col items-center gap-6 transition-[transform,opacity] duration-[400ms] ease-in ${
          dismissing ? "scale-[1.08] opacity-0" : ""
        }`}
      >
        {/* Two nested thuds, one per plate strike (IMPACT1/2_MS) — nested so
          both transforms compose instead of the second overriding the
          first. */}
        <div
          className="animate-forge-thud"
          style={{ "--forge-thud-delay": `${IMPACT1_MS}ms` } as CSSProperties}
        >
          <div
            className="animate-forge-thud"
            style={{ "--forge-thud-delay": `${IMPACT2_MS}ms` } as CSSProperties}
          >
            {/* duration-[500ms] here must match BADGE_MS below — it's a literal
          Tailwind class rather than an interpolated one, since Tailwind's
          build-time scanner can't see through a template-literal-
          interpolated arbitrary value and would silently emit no CSS for
          one. fill-mode-both is required, not cosmetic: tw-animate-css's
          animate-in defaults to animation-fill-mode: none, and this splash
          paints from SSR'd markup — without "both" telling the browser to
          apply the "from" keyframe (opacity 0, 90% scale) before the
          animation's delay/start has actually been processed, the badge
          briefly renders at its normal resting state (fully opaque, full
          size) the instant the stylesheet applies, then snaps back to
          invisible/scaled-down to actually begin the animation — a visible
          flash right as the entrance animation starts. The bar <path>
          right below already carries fill-mode-both for the same reason. */}
            <div className="glow animate-in zoom-in-90 fade-in fill-mode-both flex size-24 items-center justify-center rounded-[2rem] bg-primary/10 duration-[500ms]">
              <svg
                viewBox="0 0 24 24"
                width={60}
                height={60}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="overflow-visible text-primary"
                role="img"
                aria-label="Forge"
              >
                {/* The bar doesn't start fading in until the badge (the empty
              glowing square) has finished its own entrance — see BADGE_MS —
              so the square reads as the first beat and the barbell flying
              into it as a clearly separate second one. The delay is set via
              inline style (not a Tailwind delay-[...] class, which can't be
              interpolated from BADGE_MS — see the comment above) so this
              stays tied to the actual constant instead of a copy of it. */}
                <path
                  d="m9.6 14.4 4.8-4.8"
                  className="animate-in fade-in duration-[300ms] fill-mode-both"
                  style={{ animationDelay: `${BADGE_MS}ms` } as CSSProperties}
                />
                <g
                  className="animate-dumbbell-assemble"
                  style={
                    {
                      "--dumbbell-slide-x": "9px",
                      "--dumbbell-slide-y": "-9px",
                      "--dumbbell-cluster-delay": `${CLUSTER1_DELAY_MS}ms`,
                    } as CSSProperties
                  }
                >
                  <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" />
                  <path d="m20.1 3.9 1.4-1.4" />
                </g>
                <g
                  className="animate-dumbbell-assemble"
                  style={
                    {
                      "--dumbbell-slide-x": "-9px",
                      "--dumbbell-slide-y": "9px",
                      "--dumbbell-cluster-delay": `${CLUSTER2_DELAY_MS}ms`,
                    } as CSSProperties
                  }
                >
                  <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" />
                  <path d="m2.5 21.5 1.4-1.4" />
                </g>

                {/* Each burst fires exactly at its cluster's own impact instant —
              --dumbbell-cluster-delay + FLIGHT_MS (dumbbell-flight's real
              travel time, whose 100% keyframe IS the contact point, not the
              cosmetic recoil bounce that plays after it). Five thin
              sparks in a cone pointing away from the icon's center — a
              metal strike, not a blast. */}
                <SparkBurst
                  x={14.4}
                  y={9.6}
                  angles={[-82, -61, -38, -17, 4]}
                  delayMs={IMPACT1_MS}
                />
                <SparkBurst
                  x={9.6}
                  y={14.4}
                  angles={[98, 119, 142, 163, 184]}
                  delayMs={IMPACT2_MS}
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Letters strike in one by one on the same CSS timeline as the
          sparks (see forge-letter in styles.css); aria-label keeps the
          word readable as one word. */}
        <div className="flex flex-col items-center gap-1.5">
          <p
            aria-label={WORDMARK}
            className="flex text-[30px] font-black tracking-[0.16em] text-foreground"
          >
            {WORDMARK.split("").map((letter, i) => (
              <span
                key={i}
                aria-hidden
                className="animate-forge-letter inline-block"
                style={
                  {
                    "--forge-letter-delay": `${TEXT_DELAY_MS + i * LETTER_STAGGER_MS}ms`,
                  } as CSSProperties
                }
              >
                {letter}
              </span>
            ))}
          </p>
          <p
            className="animate-forge-letter text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            style={{ "--forge-letter-delay": `${TAGLINE_DELAY_MS}ms` } as CSSProperties}
          >
            Workout Generator &amp; Tracker
          </p>
        </div>
      </div>
    </div>
  );
}
