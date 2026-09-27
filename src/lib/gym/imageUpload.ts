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

/** App screenshots are tall and narrow (a scrolling capture can be 1080 ×
 *  5000+). Capping the long edge would shrink their text to nothing, so
 *  these keep a phone's full width and allow a tall image. */
export const SCREENSHOT_LIMIT = { maxWidth: 1080, maxHeight: 6000 };

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
