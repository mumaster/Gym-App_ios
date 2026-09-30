import { useTranslation } from "../../lib/gym/i18n";

/**
 * The app's loading indicator: a barbell doing a rep inside a spinning arc.
 *
 * - The barbell is drawn in the splash screen's language (solid plates, a
 *   smaller plate and a collar each side, a thin bar), not line art. It dips
 *   slightly, drives up, holds a beat at the top and lowers — one rep per
 *   cycle — while a soft shadow under it shrinks and fades as it rises.
 * - Around it, an indeterminate arc: it rotates steadily while its length
 *   grows and shrinks, over a faint full-circle track.
 *
 * Everything is `currentColor` (pass `text-primary-text`, or let it inherit,
 * e.g. a button's `text-primary-foreground`), so it follows the accent. The
 * motion lives in styles.css ("Loading indicator"); with Reduce Motion it
 * holds still and only pulses. It replaced lucide's dumbbell outline with its
 * plates sliding off and fading, which read as a glitching icon.
 */
export function DumbbellLoader({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const t = useTranslation();
  // Plates, collar: [x, y, width, height, radius] on the left; the right
  // side mirrors them around x = 24.
  const parts: [number, number, number, number, number][] = [
    [10, 18.5, 3.8, 15, 1.5],
    [14.4, 21, 2.6, 10, 1.1],
    [17.6, 23.6, 1.6, 4.8, 0.7],
  ];
  // Below ~40 px the shadow and the arc under the bar read as a face, and
  // the shadow is too small to see anyway.
  const small = size < 40;
  const showShadow = !small;
  // Small (in a button): a thicker ring and a bigger barbell, so it reads at
  // ~26 px instead of as fine detail.
  const ring = small ? 3.6 : 2.5;
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

      {showShadow ? (
        <ellipse
          className="forge-loader-shadow"
          cx="24"
          cy="36.4"
          rx="9"
          ry="1.3"
          fill="currentColor"
        />
      ) : null}
      {/* The scale sits on a wrapper: the lift's CSS transform would
          override a transform attribute on the same element. */}
      <g transform={small ? "translate(24 24.5) scale(1.1) translate(-24 -24.5)" : undefined}>
        <g className="forge-loader-lift" fill="currentColor">
          <rect x="9" y="25" width="30" height="2" rx="1" opacity="0.85" />
          {parts.map(([x, y, w, h, r]) => (
            <g key={x}>
              <rect x={x} y={y} width={w} height={h} rx={r} />
              <rect x={48 - x - w} y={y} width={w} height={h} rx={r} />
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
