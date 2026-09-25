import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, ImageIcon, X } from "lucide-react";
import { DumbbellLoader } from "./DumbbellLoader";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic } from "../../lib/gym/store";

export type FoodScannerStatus = "scanning" | "lookingUp" | "notFound";

/** When to suggest the shutter if no barcode has shown up — a UX nudge,
 *  not a measured value. Nothing is sent to the AI automatically. */
const LABEL_HINT_MS = 3000;

/**
 * One camera for both scan paths. zxing-js decodes barcodes continuously
 * against the live stream (free, offline, instant — so it always goes
 * first); the shutter grabs the current frame for the AI label reader when
 * there's no barcode, or when the barcode isn't in the product database.
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
}: {
  open: boolean;
  status: FoodScannerStatus;
  onClose: () => void;
  /** A decoded barcode; the parent sets `status` to "lookingUp". */
  onBarcode: (barcode: string) => void;
  /** The shutter's captured frame, for the label reader. */
  onPhoto: (photo: Blob) => void;
  /** Pick an existing photo instead of the live camera. */
  onChoosePhoto: () => void;
}) {
  const t = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Refs, not deps: the parent's callbacks and status change every render,
  // and the camera must only restart when the scanner opens or closes.
  const onBarcodeRef = useRef(onBarcode);
  onBarcodeRef.current = onBarcode;
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowHint(false);
    const hint = setTimeout(() => setShowHint(true), LABEL_HINT_MS);

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
            haptic([20, 30]);
            onBarcodeRef.current(result.getText());
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
      clearTimeout(hint);
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
    canvas.toBlob((blob) => blob && onPhoto(blob), "image/jpeg", 0.92);
  };

  if (!open) return null;

  const busy = status === "lookingUp";
  const message =
    status === "notFound"
      ? t.barcodeScanner.notFound
      : busy
        ? t.barcodeScanner.lookingUp
        : showHint
          ? t.barcodeScanner.noBarcodeHint
          : t.barcodeScanner.aim;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <video ref={videoRef} className="absolute inset-0 size-full object-cover" muted playsInline />

      <div className="safe-top relative flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-5 pb-6 pt-3">
        <p className="text-[15px] font-semibold text-white">{t.barcodeScanner.title}</p>
        <button
          onClick={onClose}
          aria-label={t.common.close}
          className="glass flex size-9 items-center justify-center rounded-full text-white active:scale-95"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-10">
        {error ? (
          <p className="glass-strong flex max-w-xs items-start gap-2 rounded-2xl px-4 py-3 text-[14px] text-white">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
            {error}
          </p>
        ) : busy ? (
          <DumbbellLoader size={56} className="text-white" />
        ) : (
          <div className="aspect-[3/2] w-full max-w-sm rounded-2xl border-2 border-white/70" />
        )}
      </div>

      <div className="safe-bottom relative flex flex-col items-center gap-4 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-6 pb-6 pt-10">
        <p
          className={`max-w-xs text-center text-[14px] ${
            status === "notFound" ? "font-semibold text-white" : "text-white/80"
          }`}
        >
          {message}
        </p>
        <div className="flex w-full max-w-xs items-center justify-between">
          <button
            onClick={onChoosePhoto}
            aria-label={t.barcodeScanner.choosePhoto}
            className="glass flex size-12 items-center justify-center rounded-full text-white active:scale-95"
          >
            <ImageIcon className="size-5" />
          </button>
          <button
            onClick={capture}
            disabled={busy || !!error}
            aria-label={t.barcodeScanner.photographLabel}
            className={`flex size-[72px] items-center justify-center rounded-full border-4 border-white text-black active:scale-95 disabled:opacity-40 ${
              status === "notFound" || showHint ? "bg-white" : "bg-white/80"
            } ${status === "notFound" ? "ring-4 ring-primary" : ""}`}
          >
            <Camera className="size-7" />
          </button>
          <span className="size-12" aria-hidden />
        </div>
        <p className="text-[12px] text-white/70">{t.barcodeScanner.shutterCaption}</p>
      </div>
    </div>
  );
}
