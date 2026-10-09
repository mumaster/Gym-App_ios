import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, ImageIcon, X } from "lucide-react";
import { DumbbellLoader } from "./DumbbellLoader";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic } from "../../lib/gym/store";

export type FoodScannerStatus = "scanning" | "lookingUp" | "notFound";

/** What the camera is pointed at. "barcode" reads barcodes live, with no
 *  shutter; "label" sends the shutter's photo to the AI label reader; "note"
 *  and "plate" send it to the list reader (FoodListSheet). */
export type ScanMode = "barcode" | "label" | "note" | "plate" | "qr";

/** A sideways swipe this far over the picture switches mode, like the iOS
 *  camera. A gesture threshold, not a measured value. */
const SWIPE_PX = 50;

/** When to suggest the Label mode if no barcode has shown up — a UX nudge,
 *  not a measured value. Nothing is sent to the AI automatically. */
const LABEL_HINT_MS = 3000;

/**
 * One camera for every scan, in modes switched above the shutter (or by a
 * sideways swipe). Barcode mode, the first, has zxing-js decode barcodes
 * continuously against the live stream (free, offline, instant) and shows
 * no shutter. Label mode's shutter grabs the current frame for the AI label
 * reader (also where a barcode the product database doesn't know sends you).
 * Note and plate mode send the shutter's photo to the list reader. Barcodes
 * are only decoded in barcode mode, so a package in view can't take over.
 * Full-screen `fixed inset-0 z-[60]`, above AddFoodSheet's own z-50 sheet.
 * `@zxing/browser` (~200KB gzipped) is imported inside the effect, so it's
 * only fetched the first time the scanner opens.
 *
 * zxing's `controls.stop()` also stops the camera, so after a detection the
 * stream is kept running and further barcodes are simply ignored while the
 * parent looks one up (`status !== "scanning"`) — the shutter must stay
 * usable if the lookup comes back empty.
 */
export function FoodScanner({
  open,
  status,
  onClose,
  onBarcode,
  onPhoto,
  onChoosePhoto,
  modes = ["barcode", "label"],
  mode = modes[0] ?? "barcode",
  onMode,
}: {
  open: boolean;
  status: FoodScannerStatus;
  onClose: () => void;
  /** A decoded barcode (label mode only); the parent sets `status` to
   *  "lookingUp". */
  onBarcode?: (barcode: string) => void;
  /** The shutter's captured frame, with the mode it was taken in. */
  onPhoto: (photo: Blob, mode: ScanMode) => void;
  /** Pick an existing photo instead of the live camera. */
  onChoosePhoto: (mode: ScanMode) => void;
  /** The modes to offer; with more than one, a switch above the shutter. */
  modes?: ScanMode[];
  mode?: ScanMode;
  onMode?: (mode: ScanMode) => void;
}) {
  const t = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  /** Barcodes already reported while the camera is open: one the database
   *  didn't know is still in view after switching back to Barcode, and
   *  shouldn't send you straight back to Label. */
  const reported = useRef(new Set<string>());

  // Refs, not deps: the parent's callbacks and status change every render,
  // and the camera must only restart when the scanner opens or closes.
  const onBarcodeRef = useRef(onBarcode);
  onBarcodeRef.current = onBarcode;
  const statusRef = useRef(status);
  statusRef.current = status;

  // The "no barcode?" nudge, counted from opening or switching to Barcode.
  useEffect(() => {
    setShowHint(false);
    if (!open || mode !== "barcode") return;
    const hint = setTimeout(() => setShowHint(true), LABEL_HINT_MS);
    return () => clearTimeout(hint);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    reported.current.clear();

    let cancelled = false;
    let controls: { stop: () => void } | undefined;

    import("@zxing/browser")
      .then(({ BrowserMultiFormatReader }) => {
        if (cancelled) return undefined;
        const reader = new BrowserMultiFormatReader();
        // Ask for a high-resolution stream: the same frames feed the label
        // reader, which needs legible print.
        return reader.decodeFromConstraints(
          {
            video: {
              facingMode: "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          videoRef.current ?? undefined,
          (result) => {
            // NotFoundException fires on nearly every frame without a
            // barcode — the normal state, nothing to do.
            if (cancelled || !result || statusRef.current !== "scanning") return;
            // Only in Barcode mode: in the others you're photographing
            // something, and a package in view isn't the point.
            if (
              (modeRef.current !== "barcode" && modeRef.current !== "qr") ||
              !onBarcodeRef.current
            )
              return;
            const code = result.getText();
            if (reported.current.has(code)) return;
            reported.current.add(code);
            haptic([20, 30]);
            onBarcodeRef.current(code);
          },
        );
      })
      .then((c) => {
        // The scanner can close before getUserMedia resolves (a fast tap);
        // stop the stream here instead of leaking it.
        if (!c) return;
        controls = c;
        if (cancelled) c.stop();
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? t.barcodeScanner.cameraAccessDenied
            : t.barcodeScanner.cameraStartFailed,
        );
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, t]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    haptic([15, 25]);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && onPhoto(blob, mode), "image/jpeg", 0.92);
  };

  const switchMode = (next: ScanMode) => {
    if (next === mode || !onMode) return;
    haptic(10);
    onMode(next);
  };

  const onSwipeEnd = (x: number, y: number) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || modes.length < 2) return;
    const dx = x - start.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(y - start.y)) return;
    const i = modes.indexOf(mode) + (dx < 0 ? 1 : -1);
    const next = modes[i];
    if (next) switchMode(next);
  };

  if (!open) return null;

  const copy = t.barcodeScanner;
  const barcode = mode === "barcode" || mode === "qr";
  const busy = barcode && status === "lookingUp";
  // A barcode the database didn't know lands here, in Label mode.
  const highlight = mode === "label" && status === "notFound";
  const message = highlight
    ? copy.notFound
    : busy
      ? copy.lookingUp
      : barcode && showHint && modes.includes("label")
        ? copy.noBarcodeHint
        : copy.aimFor[mode];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <video ref={videoRef} className="absolute inset-0 size-full object-cover" muted playsInline />

      <div className="safe-top relative flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-5 pb-6 pt-3">
        <p className="text-[15px] font-semibold text-white">{copy.titleFor[mode]}</p>
        <button
          onClick={onClose}
          aria-label={t.common.close}
          className="glass flex size-9 items-center justify-center rounded-full text-white active:scale-95"
        >
          <X className="size-5" />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center px-10"
        onTouchStart={(e) => {
          const p = e.touches[0];
          swipeStart.current = p ? { x: p.clientX, y: p.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const p = e.changedTouches[0];
          if (p) onSwipeEnd(p.clientX, p.clientY);
        }}
      >
        {error ? (
          <p className="glass-strong flex max-w-xs items-start gap-2 rounded-2xl px-4 py-3 text-[14px] text-white">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
            {error}
          </p>
        ) : busy ? (
          <DumbbellLoader size={56} className="text-white" />
        ) : (
          // The frame's shape says what fits in it: a label, a sheet of
          // paper, a round plate.
          <div
            aria-hidden
            className={`border-2 border-white/70 transition-[aspect-ratio,border-radius,width] duration-200 motion-reduce:transition-none ${
              mode === "barcode"
                ? "aspect-[2/1] w-full max-w-sm rounded-2xl"
                : mode === "qr"
                  ? "aspect-square w-[min(100%,16rem)] rounded-2xl"
                  : mode === "label"
                    ? "aspect-[4/5] w-[min(100%,16rem)] rounded-2xl"
                    : mode === "note"
                      ? "aspect-[3/4] w-[min(100%,15rem)] rounded-2xl"
                      : "aspect-square w-[min(100%,16rem)] rounded-full"
            }`}
          />
        )}
      </div>

      <div className="safe-bottom relative flex flex-col items-center gap-4 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-6 pb-6 pt-10">
        <p
          className={`max-w-xs text-center text-[14px] ${
            highlight ? "font-semibold text-white" : "text-white/80"
          }`}
        >
          {message}
        </p>
        {modes.length > 1 ? (
          <div
            role="radiogroup"
            aria-label={copy.modeLabel}
            className="flex rounded-full bg-white/15 p-1 backdrop-blur-md"
          >
            {modes.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={m === mode}
                onClick={() => switchMode(m)}
                className={`tap-target min-h-[36px] rounded-full px-3.5 text-[14px] font-semibold transition-colors motion-reduce:transition-none ${
                  m === mode ? "bg-white text-black" : "text-white/85"
                }`}
              >
                {copy.modes[m]}
              </button>
            ))}
          </div>
        ) : null}
        {barcode ? (
          // Nothing to press: a barcode is read the moment it's in view.
          // The row keeps the shutter's height so switching doesn't jump.
          <div className="h-[72px]" aria-hidden />
        ) : (
          <div className="flex w-full max-w-xs items-center justify-between">
            <button
              onClick={() => onChoosePhoto(mode)}
              aria-label={copy.choosePhoto}
              className="glass flex size-12 items-center justify-center rounded-full text-white active:scale-95"
            >
              <ImageIcon className="size-5" />
            </button>
            <button
              onClick={capture}
              disabled={!!error}
              aria-label={copy.shutterFor[mode]}
              className={`flex size-[72px] items-center justify-center rounded-full border-4 border-white bg-white text-black active:scale-95 disabled:opacity-40 ${
                highlight ? "ring-4 ring-primary" : ""
              }`}
            >
              <Camera className="size-7" />
            </button>
            <span className="size-12" aria-hidden />
          </div>
        )}
        <p className="text-[12px] text-white/70">{copy.captionFor[mode]}</p>
      </div>
    </div>
  );
}
