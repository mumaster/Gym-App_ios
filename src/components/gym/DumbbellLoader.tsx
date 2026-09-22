import type { CSSProperties } from "react";
import { useTranslation } from "../../lib/gym/i18n";

/**
 * Loading indicator: the app icon's own Dumbbell glyph (lucide's exact path
 * data — same stroke-only line art the tab bar's Workout icon uses, tilted
 * on its native diagonal, not redrawn as flat rectangles), with its two
 * weight-plate clusters sliding off along that diagonal while fading out,
 * then back, looping. Pure `currentColor`, no color baked in — it takes
 * whatever `color` the context gives it (pass `text-primary` etc. via
 * `className`, or just let it inherit, e.g. a button's own
 * `text-primary-foreground`), same as any lucide icon. See the
 * `dumbbell-plates` keyframes in styles.css.
 */
export function DumbbellLoader({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const t = useTranslation();
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={t.common.loading}
    >
      {/* The bar itself stays put. */}
      <path d="m9.6 14.4 4.8-4.8" />

      <g
        className="animate-dumbbell-plates"
        style={{ "--dumbbell-slide-x": "7px", "--dumbbell-slide-y": "-7px" } as CSSProperties}
      >
        <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" />
        <path d="m20.1 3.9 1.4-1.4" />
      </g>

      <g
        className="animate-dumbbell-plates"
        style={{ "--dumbbell-slide-x": "-7px", "--dumbbell-slide-y": "7px" } as CSSProperties}
      >
        <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" />
        <path d="m2.5 21.5 1.4-1.4" />
      </g>
    </svg>
  );
}
