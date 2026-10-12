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
/** Tilts (degrees) the JS decoder tries, one per attempt in turn. zxing reads
 *  1D codes only roughly upright, plus a 90° turn with TRY_HARDER, so the
 *  frame is drawn rotated to catch a code held at an angle. With the 90° turn
 *  these cover every direction to within ~12°. */
export const TILT_ANGLES = [0, 25, -25, 50, -50];

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
    new Map<number, unknown>([
      [DecodeHintType.TRY_HARDER, true],
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
  let attempt = 0;
  return async () => {
    const { w, h } = decodeSize(video.videoWidth, video.videoHeight);
    if (!ctx || !w) return null;
    const tilt = TILT_ANGLES[attempt++ % TILT_ANGLES.length] ?? 0;
    canvas.width = w;
    canvas.height = h;
    if (tilt) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      ctx.rotate((tilt * Math.PI) / 180);
      ctx.drawImage(video, -w / 2, -h / 2, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }
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
