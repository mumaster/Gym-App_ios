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

/**
 * A custom accent has to be seen against the page in two ways: as text
 * (labels, active tab names, small icons) and as a shape (progress bars, the
 * fill of buttons and badges, rings, chart lines, the map). A dark green
 * vanishes on the dark theme's black, and a pale yellow on the light theme's
 * off-white. `adjustAccent` blends the colour towards white (dark theme) or
 * black (light theme) in 4% steps until it reaches the wanted contrast ratio
 * (WCAG 2.x), and leaves it untouched if it already does:
 *
 *  - TEXT_CONTRAST 4.5:1, SC 1.4.3 (AA, normal-size text);
 *  - GRAPHIC_CONTRAST 3:1, SC 1.4.11 (AA, non-text contrast: the parts of a
 *    control or chart needed to see it).
 *
 * Measured against the palest/darkest surface things sit on rather than the
 * page itself: cards are a little lighter than the black page in the dark
 * theme, and muted chips/tracks a little darker than the off-white one in the
 * light theme (styles.css: --chart-surface ≈ #1a1b1d, --muted over the page ≈
 * #e6e7ea), so it stays visible on those too.
 */
export const TEXT_CONTRAST = 4.5;
export const GRAPHIC_CONTRAST = 3;
const DARK_SURFACE = luminance(26, 27, 29);
const LIGHT_SURFACE = luminance(230, 231, 234);

type Theme = "dark" | "light";

function adjustAccent(hex: string, theme: Theme, ratio: number): string {
  const m = hex.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const rgb = [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
  const surface = theme === "dark" ? DARK_SURFACE : LIGHT_SURFACE;
  const target = theme === "dark" ? 255 : 0;
  for (let step = 0; step <= 25; step++) {
    const t = step * 0.04;
    const mixed = rgb.map((v) => Math.round(v + (target - v) * t));
    if (contrast(luminance(mixed[0]!, mixed[1]!, mixed[2]!), surface) >= ratio) {
      return `#${mixed.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return theme === "dark" ? "#ffffff" : "#000000";
}

/** The accent as text on the page (4.5:1). */
export const readableAccentText = (hex: string, theme: Theme) =>
  adjustAccent(hex, theme, TEXT_CONTRAST);

/** The accent as a shape on the page (3:1) — what `--primary` is for a custom
 *  accent, so bars, rings, fills and chart lines all stay visible. */
export const visibleAccentFill = (hex: string, theme: Theme) =>
  adjustAccent(hex, theme, GRAPHIC_CONTRAST);
