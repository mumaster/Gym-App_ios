import { formatLoad } from "./load";
import type { RecapData } from "./recap";

/**
 * Draws the shareable workout recap as a 1080 × 1350 PNG (Instagram's 4:5
 * portrait size) with the Canvas 2D API — no DOM screenshotting library, so
 * the result is pixel-identical on every device. The card is always dark,
 * like the splash screen: it's a branded image that leaves the app, not a
 * themed surface. Only the accent follows the user's choice.
 */

export const RECAP_W = 1080;
export const RECAP_H = 1350;

export interface RecapCopy {
  eyebrow: string;
  title: string;
  date: string;
  minutes: string;
  volume: string;
  sets: string;
  bw: string;
  pr: string;
  prs: (n: number) => string;
  effort: (rpe: number) => string;
  more: (n: number) => string;
  setsCount: (n: number) => string;
}

const FONT = `-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "Segoe UI", Roboto, system-ui, sans-serif`;
const INK = "#F5F6F7";
const MUTED = "rgba(245,246,247,0.56)";
const FAINT = "rgba(245,246,247,0.10)";

/** oklch()/hex/rgb string → something canvas understands. Canvas support
 *  for oklch varies by engine, so oklch is converted to sRGB here. */
export function toCanvasColor(value: string, fallback = "#4ADE80"): string {
  const v = value.trim();
  const m = v.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return v || fallback;
  const L = Number(m[1]) / (m[2] ? 100 : 1);
  const C = Number(m[3]);
  const h = (Number(m[4]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const [r, g, bl] = lin.map((x) => {
    const c = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(0, x) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
  });
  return `rgb(${r}, ${g}, ${bl})`;
}

const withAlpha = (rgb: string, a: number) =>
  rgb.startsWith("rgb(") ? rgb.replace("rgb(", "rgba(").replace(")", `, ${a})`) : rgb;

function font(weight: number, size: number) {
  return `${weight} ${size}px ${FONT}`;
}

/** Text with manual letter spacing (ctx.letterSpacing isn't everywhere). */
function spaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: "left" | "right" = "left",
) {
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = align === "right" ? x - total : x;
  ctx.textAlign = "left";
  [...text].forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i]! + spacing;
  });
  return total;
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A pill with text, returns its width. */
function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { bg: string; fg: string; size: number; align?: "left" | "right" },
) {
  ctx.font = font(700, opts.size);
  const padX = opts.size * 0.7;
  const h = opts.size * 1.9;
  const w = ctx.measureText(text).width + padX * 2;
  const left = opts.align === "right" ? x - w : x;
  roundRect(ctx, left, y - h / 2, w, h, h / 2);
  ctx.fillStyle = opts.bg;
  ctx.fill();
  ctx.fillStyle = opts.fg;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + padX, y + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

/** Dark text on bright accents (green, yellow, orange), light on the rest —
 *  the same pairing idea as the app's --primary-foreground. */
function inkOn(rgb: string): string {
  const m = rgb.match(/\d+/g)?.map(Number);
  if (!m || m.length < 3) return "#0B0B0C";
  const [r, g, b] = m as [number, number, number];
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#0B0B0C" : "#FFFFFF";
}

export function drawRecap(
  canvas: HTMLCanvasElement,
  data: RecapData,
  copy: RecapCopy,
  accentValue: string,
) {
  canvas.width = RECAP_W;
  canvas.height = RECAP_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const accent = toCanvasColor(accentValue);
  const PAD = 88;

  // Background: near-black, a soft accent glow top-right and a fainter one
  // bottom-left, then a fine vignette so the edges settle.
  const bg = ctx.createLinearGradient(0, 0, 0, RECAP_H);
  bg.addColorStop(0, "#111215");
  bg.addColorStop(1, "#060708");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, RECAP_W, RECAP_H);
  const glow = (x: number, y: number, r: number, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, withAlpha(accent, a));
    g.addColorStop(1, withAlpha(accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, RECAP_W, RECAP_H);
  };
  glow(RECAP_W - 60, 40, 760, 0.3);
  glow(-40, RECAP_H - 120, 620, 0.1);

  // Header: wordmark left, date right.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = font(800, 34);
  spaced(ctx, "FORGE", PAD, 132, 12);
  ctx.fillStyle = MUTED;
  ctx.font = font(500, 28);
  spaced(ctx, copy.date.toUpperCase(), RECAP_W - PAD, 130, 2, "right");

  // Title block.
  ctx.fillStyle = accent;
  ctx.font = font(700, 25);
  spaced(ctx, copy.eyebrow.toUpperCase(), PAD, 262, 5);
  // Title: one line at 76px, else two lines at 60px (then an ellipsis).
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  const maxW = RECAP_W - PAD * 2;
  ctx.font = font(800, 76);
  if (ctx.measureText(copy.title).width <= maxW) {
    ctx.fillText(copy.title, PAD, 348);
  } else {
    ctx.font = font(800, 60);
    const words = copy.title.split(" ");
    let line = "";
    let i = 0;
    for (; i < words.length; i++) {
      const next = line ? `${line} ${words[i]}` : words[i]!;
      if (ctx.measureText(next).width > maxW && line) break;
      line = next;
    }
    if (i >= words.length) {
      ctx.fillText(line, PAD, 344);
    } else {
      ctx.fillText(line, PAD, 326);
      ctx.fillText(fit(ctx, words.slice(i).join(" "), maxW), PAD, 396);
    }
  }

  // Stats: three big numbers split by hairlines.
  const stats: [string, string, string][] = [
    [String(data.minutes), "min", copy.minutes],
    [data.volumeKg.toLocaleString(), "kg", copy.volume],
    [String(data.workingSets), "", copy.sets],
  ];
  const colW = (RECAP_W - PAD * 2) / 3;
  stats.forEach(([value, unit, label], i) => {
    const x = PAD + colW * i + (i ? 36 : 0);
    const room = colW - (i ? 36 : 0) - 16;
    // Shrink a long number (a big volume) to fit its column.
    ctx.font = font(800, 84);
    const unitW = unit ? ((ctx.font = font(600, 32)), ctx.measureText(unit).width + 10) : 0;
    ctx.font = font(800, 84);
    const scale = Math.min(1, (room - unitW) / ctx.measureText(value).width);
    const size = Math.max(44, Math.floor(84 * scale));
    ctx.fillStyle = INK;
    ctx.font = font(800, size);
    ctx.textAlign = "left";
    ctx.fillText(value, x, 520);
    const vw = ctx.measureText(value).width;
    if (unit) {
      ctx.fillStyle = MUTED;
      ctx.font = font(600, 32);
      ctx.fillText(unit, x + vw + 10, 520);
    }
    ctx.fillStyle = MUTED;
    ctx.font = font(700, 22);
    spaced(ctx, label.toUpperCase(), x, 566, 4);
    if (i) {
      ctx.fillStyle = FAINT;
      ctx.fillRect(PAD + colW * i, 448, 2, 128);
    }
  });

  // Exercise list.
  ctx.fillStyle = FAINT;
  ctx.fillRect(PAD, 640, RECAP_W - PAD * 2, 2);
  const ROW = 96;
  const maxRows = data.exercises.length > 5 ? 4 : 5;
  const rows = data.exercises.slice(0, maxRows);
  rows.forEach((e, i) => {
    const y = 700 + i * ROW;
    const best = `${formatLoad(e.best.weight, e.bodyweight, copy.bw)} × ${e.best.reps}`;
    ctx.font = font(700, 34);
    const bestW = ctx.measureText(best).width;
    let right = RECAP_W - PAD;
    ctx.fillStyle = INK;
    ctx.textAlign = "right";
    ctx.fillText(best, right, y + 12);
    right -= bestW + 18;
    if (e.pr) {
      right -= pill(ctx, copy.pr, right, y + 1, {
        bg: accent,
        fg: inkOn(accent),
        size: 20,
        align: "right",
      });
      right -= 18;
    }
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = font(600, 34);
    ctx.fillText(fit(ctx, e.name, right - PAD), PAD, y + 12);
    ctx.fillStyle = MUTED;
    ctx.font = font(500, 24);
    ctx.fillText(copy.setsCount(e.sets), PAD, y + 48);
    if (i < rows.length - 1) {
      ctx.fillStyle = FAINT;
      ctx.fillRect(PAD, y + ROW - 22, RECAP_W - PAD * 2, 1);
    }
  });
  if (data.exercises.length > maxRows) {
    ctx.fillStyle = MUTED;
    ctx.font = font(600, 26);
    ctx.fillText(copy.more(data.exercises.length - maxRows), PAD, 700 + maxRows * ROW + 4);
  }

  // Footer chips: records and session effort.
  let fx = PAD;
  // Right under the list, so a short session doesn't leave a hole in the
  // middle of the card; a full list pushes it down to the bottom band.
  const listEnd = 700 + rows.length * ROW + (data.exercises.length > maxRows ? 50 : 0);
  const fy = Math.min(1212, listEnd + 24);
  if (data.prCount) {
    fx +=
      pill(ctx, copy.prs(data.prCount), fx, fy, {
        bg: withAlpha(accent, 0.18),
        fg: accent,
        size: 26,
      }) + 16;
  }
  if (data.sessionRpe != null) {
    pill(ctx, copy.effort(data.sessionRpe), fx, fy, {
      bg: "rgba(245,246,247,0.08)",
      fg: INK,
      size: 26,
    });
  }

  // A thin accent rule along the bottom edge.
  const rule = ctx.createLinearGradient(0, 0, RECAP_W, 0);
  rule.addColorStop(0, withAlpha(accent, 0));
  rule.addColorStop(0.5, accent);
  rule.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = rule;
  ctx.fillRect(0, RECAP_H - 10, RECAP_W, 10);
}

/** The PNG as a Blob (for sharing or saving). */
export function recapBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
