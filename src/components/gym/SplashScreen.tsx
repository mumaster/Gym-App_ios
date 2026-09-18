import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useGym } from "../../lib/gym/store";

/** Warm "hot metal" tones for the spark burst — deliberately not tied to
 *  the user's accent color (like Confetti's own fixed palette), since a
 *  forge spark reads as orange/gold regardless of theme. */
const SPARK_COLORS = ["oklch(0.85 0.19 70)", "oklch(0.92 0.14 85)"];

/** A short burst of sparks flying outward from (x, y) — the point where a
 *  weight-plate cluster lands on the bar — along the given angles
 *  (degrees, SVG convention: 0 = +x, 90 = +y/down). Fires once, delayMs
 *  after mount, timed to land exactly as that cluster's own
 *  dumbbell-assemble animation finishes. */
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
      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const color = SPARK_COLORS[i % SPARK_COLORS.length];
        return (
          <line
            key={angle}
            x1={0}
            y1={0}
            x2={cos * 1.7}
            y2={sin * 1.7}
            stroke={color}
            strokeWidth={1.4}
            strokeLinecap="round"
            className="animate-spark"
            style={
              {
                "--spark-dx": `${cos * (4 + (i % 2) * 1.4)}px`,
                "--spark-dy": `${sin * (4 + (i % 2) * 1.4)}px`,
                animationDelay: `${delayMs + i * 12}ms`,
                filter: `drop-shadow(0 0 2px ${color})`,
              } as CSSProperties
            }
          />
        );
      })}
    </g>
  );
}

/** However fast hydration actually finishes, keep the splash up at least
 *  this long — enough time for the full reveal choreography to play out
 *  and settle, so it reads as a deliberate brand moment rather than a
 *  flash cut short mid-animation. */
const MIN_VISIBLE_MS = 2400;
/** Must match the fade-out transition duration below. */
const EXIT_MS = 400;
/** The last spark burst fires at 880ms and flies for 420ms (see the
 *  SparkBurst calls below) — the wordmark waits for that strike to finish
 *  landing before it appears, so it reads as forged by it. */
const TEXT_DELAY_MS = 880 + 420;

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
      <div className="glow animate-in zoom-in-90 fade-in flex size-24 items-center justify-center rounded-[2rem] bg-primary/10 duration-500">
        <svg
          viewBox="0 0 24 24"
          width={60}
          height={60}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
          role="img"
          aria-label="Forge"
        >
          <path
            d="m9.6 14.4 4.8-4.8"
            className="animate-in fade-in duration-300 delay-150 fill-mode-both"
          />
          <g
            className="animate-dumbbell-assemble"
            style={
              {
                "--dumbbell-slide-x": "9px",
                "--dumbbell-slide-y": "-9px",
                animationDelay: "180ms",
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
                animationDelay: "260ms",
              } as CSSProperties
            }
          >
            <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" />
            <path d="m2.5 21.5 1.4-1.4" />
          </g>

          {/* Sparks fire the instant each cluster lands — 180ms/260ms delay
              + the 620ms assemble animation above. */}
          <SparkBurst x={14.4} y={9.6} angles={[-75, -45, -18, 8, 35]} delayMs={800} />
          <SparkBurst x={9.6} y={14.4} angles={[105, 135, 162, 188, 215]} delayMs={880} />
        </svg>
      </div>

      <div
        className={`flex flex-col items-center gap-1.5 transition-all duration-500 ease-out ${
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
