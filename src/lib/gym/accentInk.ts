/**
 * Text/icon colour for a solid surface in a custom accent. The six preset
 * accents each carry a hand-picked --primary-foreground, but the colour
 * wheel can produce anything: a dark green with the near-black ink the
 * bright presets use is unreadable.
 *
 * Picks whichever of the two inks has the higher WCAG 2.x contrast ratio
 * against the colour (W3C, "Understanding Success Criterion 1.4.3": relative
 * luminance, ratio = (L1 + 0.05) / (L2 + 0.05)), so no threshold is invented.
 */

/** The white the blue/purple/pink presets use (styles.css). */
export const LIGHT_INK = "oklch(0.98 0 0)";
/** The near-black the green/orange/yellow presets and .accent-custom use. */
export const DARK_INK = "oklch(0.16 0.02 145)";

// The same two inks as sRGB, for the contrast maths (oklch 0.98 0 0 ≈ #f8f8f8,
// oklch 0.16 0.02 145 ≈ #0b0f0a).
const LIGHT_LUMINANCE = luminance(248, 248, 248);
const DARK_LUMINANCE = luminance(11, 15, 10);

function luminance(r: number, g: number, b: number): number {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** `#rrggbb` (what <input type="color"> gives) → the ink to put on it. */
export function readableInk(hex: string): string {
  const m = hex.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return DARK_INK;
  const l = luminance(parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16));
  return contrast(l, LIGHT_LUMINANCE) > contrast(l, DARK_LUMINANCE) ? LIGHT_INK : DARK_INK;
}
