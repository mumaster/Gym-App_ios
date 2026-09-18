import { useEffect, useState } from "react";
import { DumbbellLoader } from "./DumbbellLoader";
import { useGym } from "../../lib/gym/store";

/** However fast hydration actually finishes, keep the splash up at least
 *  this long — long enough to register as a deliberate brand moment,
 *  short enough not to feel like a stall. */
const MIN_VISIBLE_MS = 1300;
/** Must match the fade-out transition duration below. */
const EXIT_MS = 400;

/**
 * Full-screen brand splash shown once per cold app open (mounted at the
 * route root, so client-side navigation never re-triggers it). Stays up
 * until the store has hydrated from localStorage AND at least
 * MIN_VISIBLE_MS has passed, then fades out and unmounts for good.
 */
export function SplashScreen() {
  const { hydrated } = useGym();
  const [mountedAt] = useState(() => Date.now());
  const [dismissing, setDismissing] = useState(false);
  const [hidden, setHidden] = useState(false);

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
      <div className="glow animate-in zoom-in-90 fade-in flex size-24 items-center justify-center rounded-[2rem] bg-primary/10 duration-700">
        <DumbbellLoader size={60} className="text-primary" />
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center gap-1.5 duration-700 delay-150 fill-mode-both">
        <p className="text-[30px] font-black tracking-[0.16em] text-foreground">FORGE</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Workout Generator &amp; Tracker
        </p>
      </div>
    </div>
  );
}
