import { useTranslation } from "../../lib/gym/i18n";

/**
 * The app's loading indicator: the splash screen's dumbbell inside a spinning
 * arc.
 *
 * - The dumbbell is the same glyph the splash assembles (the same paths, on
 *   the same diagonal, with the same round line caps), held still, so the
 *   loader reads as part of the app's brand.
 * - Around it, an indeterminate arc: it rotates steadily while its length
 *   grows and shrinks, over a faint full-circle track. That's the only motion.
 *
 * Everything is `currentColor` (pass `text-primary-text`, or let it inherit,
 * e.g. a button's `text-primary-foreground`), so it follows the accent. The
 * motion lives in styles.css ("Loading indicator"); with Reduce Motion the arc
 * holds still and the whole thing pulses.
 */
export function DumbbellLoader({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const t = useTranslation();
  // Small (in a button, ~26 px): a thicker ring and bolder lines, so it reads
  // at that size instead of as fine detail.
  const small = size < 40;
  const ring = small ? 3.6 : 2.5;
  const line = small ? 2.6 : 2;
  // The glyph is drawn in the splash's 24-unit box and centred in this 48-unit
  // one; at these scales its plate corners stay clear of the ring.
  const scale = small ? 1.25 : 1.1;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      className={`forge-loader ${className}`}
      role="img"
      aria-label={t.common.loading}
    >
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth={ring} opacity="0.16" />
      <g className="forge-loader-spin">
        <circle
          className="forge-loader-arc"
          cx="24"
          cy="24"
          r="21"
          stroke="currentColor"
          strokeWidth={ring}
          strokeLinecap="round"
          pathLength={100}
          transform="rotate(-90 24 24)"
        />
      </g>
      {/* Same paths as SplashScreen's dumbbell (bar, then each plate cluster
          and its end). */}
      <g
        transform={`translate(24 24) scale(${scale}) translate(-12 -12)`}
        stroke="currentColor"
        strokeWidth={line}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9.6 14.4 4.8-4.8" />
        <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" />
        <path d="m20.1 3.9 1.4-1.4" />
        <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" />
        <path d="m2.5 21.5 1.4-1.4" />
      </g>
    </svg>
  );
}
