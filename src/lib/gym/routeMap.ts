/**
 * The route map from a watch app's screenshot, redrawn in Forge's own
 * colours: the map itself turned into a neutral grey, and the route lifted
 * out as a mask that the UI fills with the user's accent (RouteMapView), so
 * it follows whichever palette is chosen, live.
 *
 * Finding the route: watch apps draw it as a thick, strongly coloured line
 * (Huawei: a green → yellow → orange → red pace gradient) over a muted map.
 * A pixel counts as route when its chroma (max − min channel) and brightness
 * are both high — muted map colours, grey roads, white labels and even
 * Apple Maps' yellow motorways (chroma ≈ 140) fall below it — and only
 * connected pieces of real size are kept, which drops coloured map icons.
 * These thresholds are image-processing choices tuned on Huawei Health
 * screenshots, not training numbers.
 */

/** Minimum max − min channel difference (0–255) for a route pixel. */
export const ROUTE_MIN_CHROMA = 150;
/** Minimum brightest channel (0–255) for a route pixel. */
export const ROUTE_MIN_BRIGHTNESS = 170;
/** Pieces smaller than this share of the largest piece are dropped (map
 *  icons); the route itself is split into several by km markers. */
export const ROUTE_MIN_PIECE_SHARE = 0.03;
/** …and anything under this many pixels, whatever the largest piece. */
export const ROUTE_MIN_PIECE_PX = 12;
/** Less route than this in total means there's no route to show. */
export const ROUTE_MIN_TOTAL_PX = 60;

/** Stored per cardio session (routeMapStore.ts). */
export interface RouteMap {
  /** Grey, dark-style map (light roads on dark), JPEG data URL. */
  map: string;
  /** The route as a white-on-transparent PNG data URL, same size as `map`. */
  route: string;
  /** Just the route, cropped to its own bounds and drawn bolder, for a small
   *  thumbnail (PNG data URL, square). */
  thumb: string;
  width: number;
  height: number;
}

/** Route mask (1 = route) for RGBA pixels, with small pieces removed. */
export function routeMask(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const n = width * height;
  const raw = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min >= ROUTE_MIN_CHROMA && max >= ROUTE_MIN_BRIGHTNESS) raw[i] = 1;
  }
  // Connected pieces (8-neighbour), by flood fill.
  const label = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < n; start++) {
    if (!raw[start] || label[start] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % width;
      const y = (p - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if ((!dx && !dy) || nx < 0 || nx >= width) continue;
          const q = ny * width + nx;
          if (raw[q] && label[q] === -1) {
            label[q] = id;
            stack.push(q);
          }
        }
      }
    }
    sizes.push(size);
  }
  const largest = Math.max(0, ...sizes);
  const minSize = Math.max(ROUTE_MIN_PIECE_PX, largest * ROUTE_MIN_PIECE_SHARE);
  const out = new Uint8Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const l = label[i]!;
    if (l >= 0 && sizes[l]! >= minSize) {
      out[i] = 1;
      total++;
    }
  }
  return total >= ROUTE_MIN_TOTAL_PX ? out : new Uint8Array(n);
}

/** Grows a mask by `r` pixels (a square neighbourhood), to close the
 *  antialiased edge and keep a thin route visible when drawn small. */
export function dilate(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width) out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

/** Bounding box of the set pixels, or null for an empty mask. */
export function maskBounds(
  mask: Uint8Array,
  width: number,
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Where a box the reader gave for one image part ([ymin, xmin, ymax, xmax]
 *  in 0–1000) sits in the original screenshot, in its own pixels. */
export function partBoxToCrop(
  box: number[],
  part: { top: number; width: number; height: number; scale: number },
): { x: number; y: number; w: number; h: number } | null {
  if (box.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = box.map((v) => Math.min(1000, Math.max(0, v))) as [
    number,
    number,
    number,
    number,
  ];
  if (ymax - ymin < 50 || xmax - xmin < 50) return null;
  const x = ((xmin / 1000) * part.width) / part.scale;
  const y = (part.top + (ymin / 1000) * part.height) / part.scale;
  const w = (((xmax - xmin) / 1000) * part.width) / part.scale;
  const h = (((ymax - ymin) / 1000) * part.height) / part.scale;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/** Stored map width: plenty for a full-width card, small enough to store. */
const MAP_WIDTH = 720;
const THUMB_SIZE = 96;

/** Crops the map out of a screenshot and splits it into a grey map and the
 *  route mask (see top of file). Null when no route is found in it. */
export async function extractRouteMap(
  file: Blob,
  crop: { x: number; y: number; w: number; h: number },
): Promise<RouteMap | null> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const sx = Math.max(0, Math.min(crop.x, bitmap.width - 1));
    const sy = Math.max(0, Math.min(crop.y, bitmap.height - 1));
    const sw = Math.min(crop.w, bitmap.width - sx);
    const sh = Math.min(crop.h, bitmap.height - sy);
    if (sw < 40 || sh < 40) return null;
    const scale = Math.min(1, MAP_WIDTH / sw);
    const width = Math.round(sw * scale);
    const height = Math.round(sh * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
    const img = ctx.getImageData(0, 0, width, height);
    const mask = routeMask(img.data, width, height);
    const bounds = maskBounds(mask, width);
    if (!bounds) return null;

    // Grey map, levels stretched, always dark-style (the UI inverts it in
    // light mode) whichever map style the screenshot used.
    const n = width * height;
    const lum = new Float32Array(n);
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) {
      const d = img.data;
      const l = 0.2126 * d[i * 4]! + 0.7152 * d[i * 4 + 1]! + 0.0722 * d[i * 4 + 2]!;
      lum[i] = l;
      hist[Math.round(l)]!++;
    }
    const pct = (p: number) => {
      let acc = 0;
      for (let v = 0; v < 256; v++) {
        acc += hist[v]!;
        if (acc >= n * p) return v;
      }
      return 255;
    };
    const lo = pct(0.02);
    const hi = Math.max(lo + 1, pct(0.98));
    let mean = 0;
    for (let i = 0; i < n; i++) mean += lum[i]!;
    const invert = mean / n > 128;
    const grey = ctx.createImageData(width, height);
    for (let i = 0; i < n; i++) {
      let v = Math.min(1, Math.max(0, (lum[i]! - lo) / (hi - lo)));
      if (invert) v = 1 - v;
      const g = Math.round(v * 255);
      grey.data[i * 4] = g;
      grey.data[i * 4 + 1] = g;
      grey.data[i * 4 + 2] = g;
      grey.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(grey, 0, 0);
    const map = canvas.toDataURL("image/jpeg", 0.72);

    const route = maskToPng(dilate(mask, width, height, 1), width, height);
    const thumb = thumbnail(mask, width, height, bounds);
    return { map, route, thumb, width, height };
  } finally {
    bitmap.close();
  }
}

function maskImage(mask: Uint8Array, width: number, height: number): ImageData {
  const out = new ImageData(width, height);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    out.data[i * 4] = 255;
    out.data[i * 4 + 1] = 255;
    out.data[i * 4 + 2] = 255;
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

function maskToPng(mask: Uint8Array, width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(maskImage(mask, width, height), 0, 0);
  return canvas.toDataURL("image/png");
}

/** The route alone, centred in a square with a margin, drawn bolder so it
 *  still reads at thumbnail size. Scaled down with the canvas's own
 *  smoothing (plain pixel sampling broke thin lines into dashes), then
 *  closed — grown and shrunk back — so the gaps a watch app's km markers
 *  leave in the line join up. */
function thumbnail(
  mask: Uint8Array,
  width: number,
  height: number,
  b: { x: number; y: number; w: number; h: number },
): string {
  const side = THUMB_SIZE;
  const pad = 12;
  const s = (side - 2 * pad) / Math.max(b.w, b.h);
  const src = document.createElement("canvas");
  src.width = width;
  src.height = height;
  src.getContext("2d")!.putImageData(maskImage(mask, width, height), 0, 0);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  const dw = b.w * s;
  const dh = b.h * s;
  ctx.drawImage(src, b.x, b.y, b.w, b.h, (side - dw) / 2, (side - dh) / 2, dw, dh);
  const px = ctx.getImageData(0, 0, side, side).data;
  const small = new Uint8Array(side * side);
  for (let i = 0; i < small.length; i++) if (px[i * 4 + 3]! > 24) small[i] = 1;
  const closed = erode(dilate(small, side, side, 3), side, side, 3);
  return maskToPng(dilate(closed, side, side, 1), side, side);
}

/** Shrinks a mask by `r` pixels: the opposite of dilate. */
export function erode(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let keep = mask[y * width + x] === 1;
      for (let dy = -r; keep && dy <= r; dy++) {
        const ny = y + dy;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width || !mask[ny * width + nx]) {
            keep = false;
            break;
          }
        }
      }
      if (keep) out[y * width + x] = 1;
    }
  }
  return out;
}
