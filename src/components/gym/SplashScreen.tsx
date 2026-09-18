import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useGym } from "../../lib/gym/store";

/** However fast hydration actually finishes, keep the splash up at least
 *  this long — enough time for the full reveal choreography to play out
 *  and settle, so it reads as a deliberate brand moment rather than a
 *  flash cut short mid-animation. */
const MIN_VISIBLE_MS = 2000;
/** Must match the fade-out transition duration below. */
const EXIT_MS = 400;
/** When the weight-plate "assemble" animation (620ms, staggered up to
 *  260ms) has fully settled — the cue to reveal the wordmark, not before. */
const TEXT_DELAY_MS = 720;

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
