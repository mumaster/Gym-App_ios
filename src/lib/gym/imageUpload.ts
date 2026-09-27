function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Label photos: longest edge 1280px — a label's fine print stays perfectly
 *  legible well below full camera resolution, and a smaller image means less
 *  to upload and fewer tiles for Gemini to process, so this is the main
 *  lever for a faster scan without spending anything. */
export const LABEL_PHOTO_LIMIT = { maxWidth: 1280, maxHeight: 1280 };

/** App screenshots are tall and narrow: a scrolling capture of a run in
 *  Huawei Health is a phone's width and many screens tall. Gemini gives each
 *  image a fixed token budget, so one very tall image is shrunk as a whole
 *  until its small print (split tables, zone minutes) is unreadable. So a
 *  screenshot is scaled to a phone's width and cut into parts about one
 *  screen tall, each read at full budget. Parts overlap so no line of text
 *  is only ever seen cut in half; the prompt says to count overlaps once. */
export const SCREENSHOT_WIDTH = 1080;
export const SCREENSHOT_PART_HEIGHT = 1800;
export const SCREENSHOT_PART_OVERLAP = 160;

/** Where to cut an image of `height` px into overlapping parts: [top, bottom] pairs. */
export function screenshotParts(
  height: number,
  part = SCREENSHOT_PART_HEIGHT,
  overlap = SCREENSHOT_PART_OVERLAP,
): [number, number][] {
  if (height <= part) return [[0, height]];
  const out: [number, number][] = [];
  for (let top = 0; ; top += part - overlap) {
    const bottom = Math.min(height, top + part);
    out.push([top, bottom]);
    if (bottom >= height) break;
  }
  return out;
}

/** A screenshot at phone width, cut into overlapping JPEG parts (see above).
 *  Falls back to the original file as one image if that fails. */
export async function screenshotToBase64Parts(
  file: File,
): Promise<{ base64: string; mimeType: string }[]> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, SCREENSHOT_WIDTH / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const out: { base64: string; mimeType: string }[] = [];
    for (const [top, bottom] of screenshotParts(height)) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = bottom - top;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D canvas context unavailable");
      ctx.drawImage(
        bitmap,
        0,
        top / scale,
        bitmap.width,
        (bottom - top) / scale,
        0,
        0,
        width,
        bottom - top,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (!blob) throw new Error("Canvas failed to encode JPEG");
      out.push({ base64: await readAsBase64(blob), mimeType: "image/jpeg" });
    }
    bitmap.close();
    return out;
  } catch {
    return [{ base64: await readAsBase64(file), mimeType: file.type || "image/jpeg" }];
  }
}

/** Downscales + re-encodes as JPEG (phone camera photos are routinely
 *  several MB at full resolution). Falls back to the original file untouched
 *  if resizing fails for any reason — a slower scan beats a broken one. */
export async function fileToBase64(
  file: File,
  limit: { maxWidth: number; maxHeight: number } = LABEL_PHOTO_LIMIT,
): Promise<{ base64: string; mimeType: string }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, limit.maxWidth / bitmap.width, limit.maxHeight / bitmap.height);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("Canvas failed to encode JPEG");

    return { base64: await readAsBase64(blob), mimeType: "image/jpeg" };
  } catch {
    return { base64: await readAsBase64(file), mimeType: file.type || "image/jpeg" };
  }
}
