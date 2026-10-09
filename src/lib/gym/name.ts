/** Longest first name kept: enough for any real one, short enough that a
 *  greeting built around it can still shrink to fit a phone's title row. */
export const MAX_FIRST_NAME = 24;

/** A first name as typed, made safe to store and to put in a sentence:
 *  whitespace (and control characters) collapsed, ends trimmed, capped. */
export function cleanFirstName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // eslint-disable-next-line no-control-regex
  const flat = raw.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim();
  return Array.from(flat).slice(0, MAX_FIRST_NAME).join("").trim();
}

/** Largest font size (px) from `max` down to `min` at which `text` fits in
 *  `available` px, given a width-per-pixel-of-font measurement. Pure so the
 *  shrink rule can be tested; the title measures its own text to feed it. */
export function fitFontSize(
  textWidthAtOnePx: number,
  available: number,
  max: number,
  min: number,
): number {
  if (!(textWidthAtOnePx > 0) || !(available > 0)) return max;
  const size = Math.floor((available / textWidthAtOnePx) * 4) / 4;
  return Math.max(min, Math.min(max, size));
}
