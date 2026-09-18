import type { CSSProperties } from "react";

/**
 * Loading indicator: a dumbbell whose plates slide fully off the bar and
 * back on, looping — used in place of a plain spinner. Solid `currentColor`
 * shapes (set `text-*` on a wrapper, defaults to the accent color) rather
 * than a static asset, so it stays crisp at any size and follows whichever
 * accent the user has picked, the same way the tab bar's own Dumbbell icon
 * does. See the `dumbbell-plates` keyframes in styles.css.
 */
export function DumbbellLoader({
  size = 56,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 140 60"
      width={size}
      height={(size * 60) / 140}
      className={`text-primary ${className}`}
      role="img"
      aria-label="Loading"
    >
      <rect x="55" y="27" width="30" height="6" rx="3" fill="currentColor" />
      <g
        className="animate-dumbbell-plates"
        style={{ "--dumbbell-slide": "-90px" } as CSSProperties}
      >
        <rect x="37" y="10" width="10" height="40" rx="3" fill="currentColor" />
        <rect x="47" y="15" width="8" height="30" rx="3" fill="currentColor" />
      </g>
      <g
        className="animate-dumbbell-plates"
        style={{ "--dumbbell-slide": "90px" } as CSSProperties}
      >
        <rect x="85" y="15" width="8" height="30" rx="3" fill="currentColor" />
        <rect x="93" y="10" width="10" height="40" rx="3" fill="currentColor" />
      </g>
    </svg>
  );
}
