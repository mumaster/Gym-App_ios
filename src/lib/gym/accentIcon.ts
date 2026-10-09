import type { AccentId } from "./types";

const BASE = "/pwa/icon-180.png";

/** Preset accents ship as prebuilt PNGs (scripts/build-accent-icons.py). */
export function presetIconHref(accent: Exclude<AccentId, "custom">): string {
  return `/pwa/icon-180-${accent}.png`;
}

/** Recolors the base icon (stroke coverage lives in its green channel) to `hex`. */
async function customIconHref(hex: string): Promise<string | null> {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1] ?? "", 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const img = new Image();
  img.src = BASE;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const k = Math.min(1, (data.data[i + 1] ?? 0) / 211);
    data.data[i] = r * k;
    data.data[i + 1] = g * k;
    data.data[i + 2] = b * k;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Points <link rel="apple-touch-icon"> at an icon in the current accent. iOS
 * reads that link only when "Add to Home Screen" is tapped, so this affects
 * future installs, not an icon already on the home screen.
 */
export async function applyAccentIcon(accent: AccentId, customAccent: string): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!link) return;
  try {
    const href = accent === "custom" ? await customIconHref(customAccent) : presetIconHref(accent);
    if (href) link.href = href;
  } catch {
    // Keep whatever icon is already there.
  }
}
