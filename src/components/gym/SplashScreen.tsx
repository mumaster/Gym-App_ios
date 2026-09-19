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
/** spark-fly's own declared duration in styles.css — how long a burst takes
 *  to finish flying once it starts. Kept as one named constant here (rather
 *  than repeating the literal value at each call site) since the wordmark
 *  reveal needs it to know when the last burst has finished. */
const SPARK_FLIGHT_MS = 550;
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

/** A forceful burst of sparks flying outward from (x, y) — the point where a
 *  weight-plate cluster lands on the bar — along the given angles (degrees,
 *  SVG convention: 0 = +x, 90 = +y/down), plus a bright flash and expanding
 *  shockwave ring at the impact point itself. Fires once, delayMs after
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
      <circle
        r={2.4}
        fill={FLASH_COLOR}
        className="animate-spark-flash"
        style={{ animationDelay: `${delayMs}ms`, filter: "blur(0.3px)" } as CSSProperties}
      />
      <circle
        r={1.6}
        fill="none"
        stroke={FLASH_COLOR}
        strokeWidth={0.6}
        className="animate-spark-ring"
        style={{ animationDelay: `${delayMs}ms` } as CSSProperties}
      />
      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const color = SPARK_COLORS[i % SPARK_COLORS.length];
        const reach = 10 + ((i * 5) % 8);
        const length = 1.8 + ((i * 3) % 5) * 0.35;
        const width = 1.2 + (i % 3) * 0.45;
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
                animationDelay: `${delayMs + i * 9}ms`,
                filter: `drop-shadow(0 0 3px ${color})`,
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
/** The last spark burst fires at CLUSTER2_DELAY_MS+FLIGHT_MS and flies
 *  for SPARK_FLIGHT_MS — the wordmark waits for that strike to finish
 *  landing before it appears, so it reads as forged by it. */
const TEXT_DELAY_MS = CLUSTER2_DELAY_MS + FLIGHT_MS + SPARK_FLIGHT_MS;
/** Must match the wordmark's own transition-all duration below. */
const TEXT_TRANSITION_MS = 550;
/** A short beat after the wordmark finishes settling in before the splash
 *  becomes eligible to dismiss — long enough to read as a deliberate pause,
 *  not an abrupt cut. */
const HOLD_MS = 70;
/** However fast hydration actually finishes, keep the splash up at least
 *  this long — derived, not hand-tuned, from the actual choreography above
 *  (badge → barbell flies in and strikes → wordmark settles → a short hold)
 *  so it can't quietly drift out of sync with those stages the way a
 *  separately maintained constant did earlier. */
const MIN_VISIBLE_MS = TEXT_DELAY_MS + TEXT_TRANSITION_MS + HOLD_MS;

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
  const [textVisible, setTextVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTextVisible(true), TEXT_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated || dismissing) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt));
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
      aria-hidden={dismissing}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background transition-opacity duration-[400ms] ease-out ${
        dismissing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* duration-[500ms] here must match BADGE_MS below — it's a literal
          Tailwind class rather than an interpolated one, since Tailwind's
          build-time scanner can't see through a template-literal-
          interpolated arbitrary value and would silently emit no CSS for
          one. */}
      <div className="glow animate-in zoom-in-90 fade-in flex size-24 items-center justify-center rounded-[2rem] bg-primary/10 duration-[500ms]">
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
              cosmetic recoil bounce that plays after it). Wide 8-spark
              cones (each pointing away from the icon's center) for a
              forceful, full-blown strike rather than a light scatter. */}
          <SparkBurst
            x={14.4}
            y={9.6}
            angles={[-95, -74, -53, -32, -11, 10, 31, 50]}
            delayMs={CLUSTER1_DELAY_MS + FLIGHT_MS}
          />
          <SparkBurst
            x={9.6}
            y={14.4}
            angles={[85, 106, 127, 148, 169, 190, 211, 230]}
            delayMs={CLUSTER2_DELAY_MS + FLIGHT_MS}
          />
        </svg>
      </div>

      {/* duration-[550ms] here must match TEXT_TRANSITION_MS above (a
          literal Tailwind class for the same reason noted on the badge's
          duration-[500ms] above). */}
      <div
        className={`flex flex-col items-center gap-1.5 transition-all duration-[550ms] ease-out ${
          textVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <p className="text-[30px] font-black tracking-[0.16em] text-foreground">FORGE</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Workout Generator &amp; Tracker
        </p>
      </div>
    </div>
  );
}
