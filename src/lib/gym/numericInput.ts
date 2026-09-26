import type { FocusEvent } from "react";

/**
 * Selects the whole value on focus, so tapping into a field that already
 * holds a value (a prefilled weight, reps, calorie goal, duration, …) lets
 * the user immediately start typing to replace it, rather than needing to
 * delete the old digits first. The selection itself is styled to the app's
 * accent color via the global `::selection` rule in styles.css, so it reads
 * as an intentional "this is about to be overwritten" highlight rather than
 * the browser's default (and on iOS, easy-to-miss) selection color.
 *
 * A tap/click both focuses the input AND positions the cursor at the click
 * point — but that positioning happens on mouseup, which fires *after*
 * this focus handler, so it silently wins if we set the selection here
 * synchronously. Deferring one frame runs after that native positioning
 * has already happened, so ours applies last and actually sticks.
 */
export function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  const input = e.target;
  requestAnimationFrame(() => {
    input.select();
  });
}

/** Only digits and a single decimal separator (comma or period). */
export const DECIMAL_INPUT_RE = /^\d*([.,]\d*)?$/;

/** DECIMAL_INPUT_RE plus an optional leading minus — for a bodyweight
 *  exercise's assistance, logged as negative load. */
export const SIGNED_DECIMAL_INPUT_RE = /^-?\d*([.,]\d*)?$/;

/** Parses a DECIMAL_INPUT_RE-guarded string, comma or period alike. */
export function parseDecimal(s: string): number {
  return Number(s.replace(",", "."));
}
