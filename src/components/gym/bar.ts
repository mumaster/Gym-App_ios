import type { CSSProperties } from "react";

/**
 * The style for a `bar-fill-x` / `bar-fill-y` (styles.css): how far along its
 * `bar-track` the fill reaches, as a percentage clamped to 0–100.
 */
export function barFill(pct: number): CSSProperties {
  const p = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  return { "--bar": `${Math.round(p * 100) / 100}%` } as CSSProperties;
}
