/** Live barcode decoding for FoodScanner. The old path used zxing's
 *  decodeFromConstraints, which decodes a full 1080p frame in JS only every
 *  500 ms and only starts the camera after the library has downloaded. This
 *  decodes a downsized frame in a tight loop instead, with the browser's
 *  native BarcodeDetector where it exists (iOS Safari doesn't have it yet,
 *  so zxing stays the fallback there). */

/** Widest frame handed to the JS decoder. Barcodes in the on-screen frame are
 *  still ~5 px per module at this width, and decoding gets ~4x cheaper than
 *  at 1920. */
export const DECODE_MAX_WIDTH = 1024;

/** Pause between decode attempts, after the previous one finished (so a slow
 *  phone never queues up work). Was 500 ms. */
export const SCAN_INTERVAL_MS = 60;

/** The size to draw a video frame at for decoding: the same aspect ratio,
 *  never upscaled, at most DECODE_MAX_WIDTH wide. */
export function decodeSize(videoWidth: number, videoHeight: number): { w: number; h: number } {
  if (!videoWidth || !videoHeight) return { w: 0, h: 0 };
  const scale = Math.min(1, DECODE_MAX_WIDTH / videoWidth);
  return { w: Math.round(videoWidth * scale), h: Math.round(videoHeight * scale) };
}

/** Product barcodes, Code 128/39 and QR (shared meals, equipment). Fewer
 *  formats than zxing's default of all of them means less work per frame. */
export const NATIVE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "qr_code",
];

interface NativeDetector {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

/** Resolves to a function that reads one code from the video, or null when
 *  there's none in view. */
export async function createVideoDecoder(
  video: HTMLVideoElement,
): Promise<() => Promise<string | null>> {
  const Native = (
    globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => NativeDetector }
  ).BarcodeDetector;
  if (Native) {
    try {
      const detector = new Native({ formats: NATIVE_FORMATS });
      return async () => (await detector.detect(video))[0]?.rawValue ?? null;
    } catch {
      // Formats unsupported on this device: fall through to zxing.
    }
  }

  const {
    MultiFormatReader,
    BinaryBitmap,
    HybridBinarizer,
    HTMLCanvasElementLuminanceSource,
    DecodeHintType,
    BarcodeFormat,
  } = await import("@zxing/library");
  const reader = new MultiFormatReader();
  reader.setHints(
    new Map([
      [
        DecodeHintType.POSSIBLE_FORMATS,
        [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
        ],
      ],
    ]),
  );
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async () => {
    const { w, h } = decodeSize(video.videoWidth, video.videoHeight);
    if (!ctx || !w) return null;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    try {
      const bitmap = new BinaryBitmap(
        new HybridBinarizer(new HTMLCanvasElementLuminanceSource(canvas)),
      );
      return reader.decodeWithState(bitmap).getText();
    } catch {
      // NotFoundException: no barcode in this frame, the normal case.
      return null;
    }
  };
}
