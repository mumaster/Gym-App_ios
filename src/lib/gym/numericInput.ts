import type { FocusEvent } from "react";

/**
 * type="number" inputs don't support setSelectionRange in any major browser
 * (throws), so numeric fields in this app use type="text" + inputMode
 * instead — this places the cursor at the end on focus rather than the
 * browser default of the start, so backspace immediately deletes the last
 * digit instead of doing nothing.
 *
 * A tap/click both focuses the input AND positions the cursor at the click
 * point — but that positioning happens on mouseup, which fires *after*
 * this focus handler, so it silently wins if we set the selection here
 * synchronously. Deferring one frame runs after that native positioning
 * has already happened, so ours applies last and actually sticks.
 */
export function placeCursorAtEnd(e: FocusEvent<HTMLInputElement>) {
  const input = e.target;
  requestAnimationFrame(() => {
    const len = input.value.length;
    input.setSelectionRange(len, len);
  });
}

/** Only digits and a single decimal separator (comma or period). */
export const DECIMAL_INPUT_RE = /^\d*([.,]\d*)?$/;

/** Parses a DECIMAL_INPUT_RE-guarded string, comma or period alike. */
export function parseDecimal(s: string): number {
  return Number(s.replace(",", "."));
}
