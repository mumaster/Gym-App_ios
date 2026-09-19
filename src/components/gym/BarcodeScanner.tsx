import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { haptic } from "../../lib/gym/store";

/**
 * Full-screen live camera overlay for scanning a product barcode — a
 * separate fixed layer above AddFoodSheet's own BottomSheet (z-[60] vs its
 * z-50), not another step inside it, since this needs the whole viewport
 * for the camera preview rather than the sheet's bounded height. Decoding
 * happens continuously against the video stream via zxing-js
 * (BrowserMultiFormatReader.decodeFromVideoDevice), which also owns
 * requesting the camera and picks the back/environment-facing one when
 * available — there's no native barcode API reliably supported on iOS
 * Safari (this app's primary target) to lean on instead. `@zxing/browser`
 * (~200KB gzipped) is dynamically imported inside the effect below rather
 * than at module scope, so it's fetched only the first time someone
 * actually opens the scanner, not as part of every nutrition-page load.
 */
export function BarcodeScanner({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  /** Called once, with the decoded barcode text, the instant a frame
   *  resolves — the caller is responsible for closing the scanner. */
  onDetected: (barcode: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs, not deps: onDetected/onClose are fresh closures from the parent on
  // every render, and this effect must only restart when the scanner itself
  // opens or closes — not on every re-render, which would tear down and
  // re-request the camera in a loop.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!open) return;
    setError(null);

    let cancelled = false;
    let controls: { stop: () => void } | undefined;

    import("@zxing/browser")
      .then(({ BrowserMultiFormatReader }) => {
        if (cancelled) return undefined;
        const reader = new BrowserMultiFormatReader();
        return reader.decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
          // NotFoundException fires on essentially every frame with no
          // barcode in view — the normal scanning state, not an error, so
          // there's nothing to do on a missed decode besides wait for the
          // next frame.
          if (cancelled || !result) return;
          haptic([20, 30]);
          controls?.stop();
          onDetectedRef.current(result.getText());
        });
      })
      .then((c) => {
        // The scanner can close before the module/getUserMedia/
        // decodeFromVideoDevice resolves (a fast tap). If that already
        // happened, this stream was never captured by the cleanup below,
        // so stop it here instead — otherwise it leaks, running after the
        // overlay is gone.
        if (!c) return;
        controls = c;
        if (cancelled) c.stop();
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "Camera access was denied — allow it in your browser settings, or use a photo or manual entry instead."
            : "Couldn't start the camera — try a photo or manual entry instead.",
        );
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <video ref={videoRef} className="absolute inset-0 size-full object-cover" muted playsInline />

      <div className="safe-top relative flex items-center justify-between px-5 pt-3">
        <p className="text-[15px] font-semibold text-white">Scan barcode</p>
        <button
          onClick={onClose}
          aria-label="Close"
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
        ) : (
          <div className="aspect-[3/2] w-full max-w-sm rounded-2xl border-2 border-white/70" />
        )}
      </div>

      <p className="safe-bottom relative px-6 pb-6 text-center text-[13px] text-white/70">
        Line the barcode up inside the frame
      </p>
    </div>
  );
}
